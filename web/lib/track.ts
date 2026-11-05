import { clientId } from "./client-id";

/**
 * 퍼널 이벤트 — 브라우저 전용.
 *
 * 이 앱이 퍼지는 길은 하나다: 들어와서 → 듣고 → 외치고 → 점수 → 친구한테 던지고 →
 * 받은 사람이 다시 들어온다. 채점만 세고 있으면 어디서 새는지 모른다.
 *
 * sendBeacon 으로 쏘고 잊는다. 페이지를 떠나는 순간에도 가고, 응답을 기다리지
 * 않으며, text/plain 이라 CORS 사전 요청도 없다. 실패해도 사용자는 모른다 —
 * 측정 때문에 흐름이 느려지면 본말전도다.
 *
 * 점수(score)는 채점 서버가 직접 남긴다. 여기서 또 보내면 두 번 센다.
 */
export type TrackKind =
  | "view_share"
  | "view_home"
  | "view_record"
  | "play_ref"
  | "record_start"
  | "share"
  | "arrive_challenge"
  // 피드 — 보러 와서(view) → 끝까지 듣고(play) → 반응하고(react) → 나도 해본다(try)
  | "view_feed"
  | "feed_play"
  | "feed_react"
  | "feed_try"
  // 연습실 — 퍼널(도전장)과 섞지 않는다. 연습은 퍼지는 길이 아니라 다시 오는 길이다.
  | "practice_view"
  | "practice_take"
  // 녹음 중단 — via=stop(버림) / restart(버리고 다시). 많으면 대본이 길거나 어렵다는 뜻
  | "practice_abort"
  // 주간 챌린지 — 보고(view) → 듣고(play) → ❤(like) / 출전(enter) → 공유(share)
  | "weekly_view"
  | "weekly_play"
  | "weekly_like"
  | "weekly_enter"
  | "enter_open"
  | "mission_open"
  | "mission_like"
  | "mission_next"
  | "mission_rec"
  | "mission_done"
  | "mission_skip"
  | "pass_view"
  | "pass_levelup"
  | "anime_view"
  | "anime_take"
  | "duel_start"
  | "duel_done"
  | "enter_fail"
  // 들려준 뒤 5초 안에 되돌림 — 많으면 공개가 아직 무섭다는 뜻
  | "post_undo"
  | "weekly_share"
  // 블라인드 배틀 — 허브에서 들어와(cta) → 짝을 받고(view) → 고른다(vote)
  | "battle_cta"
  | "battle_view"
  | "battle_vote"
  // 보이스 카드 — 녹음 시작(start) → 카드 나옴(done) → 공유(share)
  | "voice_card_start"
  | "voice_card_done"
  | "voice_card_share"
  | "voice_rec_open"
  // 첫 방문 안내 — 몇 장째에서 건너뛰는지(via)를 본다
  | "intro_view"
  | "intro_skip"
  | "intro_done"
  // 연습 피드백 게시판 — 입구(entry) → 목록(view) → 글 열기(open, 내 글은 check) → 듣기(play) → 한 줄(note)
  // 올리는 쪽: 패널 열기(ask_open) → 올림(post) / 실패(post_fail, via=상태 코드)
  | "board_entry"
  | "board_view"
  | "board_open"
  | "board_check"
  | "board_play"
  | "board_note"
  | "board_ask_open"
  | "board_post"
  | "board_post_fail"
  // 갤러리 피드백 댓글 (11/6 게시판을 합친 뒤) — 댓글 · 답글 · 주인이 받기 끄고 켜기(via=on|off)
  | "feedback_note"
  | "feedback_reply"
  | "feedback_toggle";

const URL_ =
  process.env.NEXT_PUBLIC_TRACK_URL ?? "https://lenha99--meme-scoring-track.modal.run";

export function track(kind: TrackKind, extra: { meme_id?: string; via?: string } = {}): void {
  try {
    // 운영자 기기(프로필의 "내 기기 통계 제외")는 처음부터 보내지 않는다 — 서버 등록이 실패해도 빠지게.
    if (localStorage.getItem("mimic.internal") === "on") return;
    const body = JSON.stringify({ kind, client: clientId(), ...extra });
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon(URL_, new Blob([body], { type: "text/plain" }));
    } else {
      void fetch(URL_, { method: "POST", body, keepalive: true }).catch(() => {});
    }
  } catch {
    // 측정 실패는 조용히 넘긴다.
  }
}
