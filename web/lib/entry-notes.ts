/** 출전작 피드백 댓글 — 화면·서버가 같이 쓰는 모양. 짚을 곳 태그는 없다(11/6): 한 줄과 답글이면 충분하다. */
export const MAX_ENTRY_NOTE = 300;
/** 한 사람이 출전작 하나에 남길 수 있는 댓글·답글 수 — 도배 방지 */
export const MAX_NOTES_PER_ENTRY = 10;

export type EntryNote = {
  id: string;
  body: string;
  nickname: string;
  createdAt: string;
  mine: boolean;
  /** 출전작 주인이 쓴 댓글 — "작성자" 표시 */
  byOwner: boolean;
  replies: EntryNote[];
};

export type EntryNotes = {
  feedbackOn: boolean;
  /** 지금 보는 사람이 이 출전작 주인인가 (계정 기준) */
  owner: boolean;
  loggedIn: boolean;
  count: number;
  notes: EntryNote[];
};
