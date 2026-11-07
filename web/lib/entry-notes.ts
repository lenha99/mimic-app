/**
 * 출전작 댓글·피드백 — 화면·서버가 같이 쓰는 모양.
 *
 * 둘은 다른 것이다(11/7). 댓글은 자유로운 한마디(응원·감상). 피드백은 주인이 🎯 로 부탁했을 때만,
 * "좋았던 점"과 "바꿔 보면 좋을 점" 두 칸을 다 채워서 남긴다 — 그래야 "잘 들었어요"가 아니라
 * 고칠 곳이 돌아온다. 목록·숫자·알림도 따로다.
 */
export const MAX_ENTRY_NOTE = 300;
/** 한 사람이 출전작 하나에 남길 수 있는 댓글·답글 수 — 도배 방지 */
export const MAX_NOTES_PER_ENTRY = 10;
/** 피드백(원글)은 한 사람당 출전작 하나에 이만큼 — 같은 사람이 여러 번 첨삭하지 않게 */
export const MAX_FEEDBACK_PER_ENTRY = 2;

export type NoteKind = "comment" | "feedback";
/** 피드백 요청에 적는 "봐 줬으면 하는 곳" */
export const MAX_FEEDBACK_ASK = 120;

/** 올릴 때 고르는 것 — ❤ 만 / 댓글 받기 / 피드백 요청(댓글 포함) */
export type CommentMode = "off" | "comments" | "feedback";

export type EntryNote = {
  id: string;
  kind: NoteKind;
  /** 댓글 본문 · 피드백이면 "좋았던 점" */
  body: string;
  /** 피드백의 "바꿔 보면 좋을 점" (댓글·답글은 null) */
  tip: string | null;
  nickname: string;
  createdAt: string;
  mine: boolean;
  /** 출전작 주인이 쓴 댓글 — "작성자" 표시 */
  byOwner: boolean;
  /** 주인이 "도움됐어요"를 눌렀다 */
  helpful: boolean;
  replies: EntryNote[];
};

export type EntryNotes = {
  feedbackOn: boolean;
  /** 피드백 요청 중 — 듣는 사람에게 솔직한 피드백을 부탁했다 */
  wantsFeedback: boolean;
  /** 봐 줬으면 하는 곳 (선택) */
  ask: string | null;
  /** 지금 보는 사람이 이 출전작 주인인가 (계정 기준) */
  owner: boolean;
  loggedIn: boolean;
  /** 댓글 수(답글 포함) */
  count: number;
  /** 피드백 수(답글 포함) */
  feedbackCount: number;
  comments: EntryNote[];
  /** 도움된 것 먼저, 그다음 새것 */
  feedback: EntryNote[];
};
