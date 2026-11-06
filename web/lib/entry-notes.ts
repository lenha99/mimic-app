/** 출전작 피드백 댓글 — 화면·서버가 같이 쓰는 모양. 짚을 곳 태그는 없다(11/6): 한 줄과 답글이면 충분하다. */
export const MAX_ENTRY_NOTE = 300;
/** 한 사람이 출전작 하나에 남길 수 있는 댓글·답글 수 — 도배 방지 */
export const MAX_NOTES_PER_ENTRY = 10;
/** 피드백 요청에 적는 "봐 줬으면 하는 곳" */
export const MAX_FEEDBACK_ASK = 120;

/** 올릴 때 고르는 것 — ❤ 만 / 댓글 받기 / 피드백 요청(댓글 포함) */
export type CommentMode = "off" | "comments" | "feedback";

export type EntryNote = {
  id: string;
  body: string;
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
  count: number;
  notes: EntryNote[];
};
