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
  | "view_home"
  | "view_record"
  | "play_ref"
  | "record_start"
  | "share"
  | "arrive_challenge";

const URL_ =
  process.env.NEXT_PUBLIC_TRACK_URL ?? "https://lenha99--meme-scoring-track.modal.run";

export function track(kind: TrackKind, extra: { meme_id?: string; via?: string } = {}): void {
  try {
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
