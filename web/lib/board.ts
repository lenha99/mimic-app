import type { Lang } from "./i18n";

/**
 * 연습 피드백 게시판 — 규칙과 상수. 브라우저·서버가 같이 쓴다.
 *
 * 연습 테이크는 원래 기기에만 남는다. 여기 오는 건 본인이 "피드백 받기"로 고른 것뿐이고,
 * 14일 뒤 파일째 지운다(크론). 용량 상한도 여기서 정한다 — Supabase 무료 저장 1GB 안에서
 * 녹음 하나 ~1MB 로 잡아 전체 400개, 한 사람 3개.
 */

export const POST_DAYS = 14;
export const MAX_POSTS_PER_USER = 3;
export const MAX_LIVE_POSTS = 400;
export const MAX_POST_BYTES = 4 * 1024 * 1024;
export const MAX_ASK = 120;
export const MAX_NOTE = 300;
export const MAX_NOTES_PER_USER_PER_POST = 3;
/** 서로 다른 사람 이만큼이 신고하면 바로 숨긴다. 운영자가 나중에 본다. */
export const HIDE_AT_REPORTS = 2;

export const NOTE_TAGS = {
  pace: "속도",
  breath: "호흡·쉼",
  diction: "발음",
  emotion: "감정",
  ending: "말끝",
  good: "좋았어요",
} as const;
export type NoteTag = keyof typeof NOTE_TAGS;

const NOTE_TAGS_EN: Record<NoteTag, string> = {
  pace: "Pace",
  breath: "Breath & pauses",
  diction: "Diction",
  emotion: "Emotion",
  ending: "Endings",
  good: "Loved it",
};

export function noteTagLabel(tag: NoteTag, lang: Lang): string {
  return lang === "en" ? NOTE_TAGS_EN[tag] : NOTE_TAGS[tag];
}

export function isNoteTag(t: unknown): t is NoteTag {
  return typeof t === "string" && t in NOTE_TAGS;
}

export type BoardTrack = "voice" | "anchor" | "line";
export const BOARD_TRACK_LABEL: Record<BoardTrack, string> = {
  voice: "성우",
  anchor: "아나운서·낭독",
  line: "명대사",
};

export function boardTrackLabel(track: BoardTrack, lang: Lang): string {
  return lang === "en" ? { voice: "Voice acting", anchor: "Anchor & reading", line: "Movie lines" }[track] : BOARD_TRACK_LABEL[track];
}

export type PostSummary = {
  id: string;
  title: string;
  track: BoardTrack;
  ask: string | null;
  nickname: string;
  notes: number;
  createdAt: string;
  mine: boolean;
};

export type NoteView = {
  id: string;
  tags: NoteTag[];
  body: string;
  nickname: string;
  createdAt: string;
  mine: boolean;
};

export type PostView = PostSummary & {
  scriptText: string;
  audioUrl: string | null;
  expiresAt: string;
  /** 자동 삭제까지 남은 날 */
  daysLeft: number;
  noteList: NoteView[];
};
