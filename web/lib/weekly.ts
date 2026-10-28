import type { Lang } from "./i18n";
import { findScript, type Script } from "./practice";
import { fieldName, scriptTitle } from "./script-i18n";

/**
 * 주간 보이스 챌린지 — 브라우저·서버 공용 (DB 를 모르는 부분만).
 *
 * 이번 주 대본은 날짜만으로 정해진다(ROTATION). 그래서 정적 페이지(연습실·홈)도
 * DB 없이 "이 대본이 이번 주 챌린지인가"를 안다. DB 의 weekly_challenges 행은 출전작이
 * 매달릴 자리일 뿐, 처음 필요할 때 이 계산으로 만든다 (lib/weekly-server).
 *
 * 한 주 = 월요일 0시 ~ 다음 월요일 0시 (한국 시간).
 */

const DAY = 86_400_000;
const KST = 9 * 3_600_000;

/** 시즌 1이 열리는 월요일 (KST). 이 앞으로는 "오픈 예정"이다. */
export const LAUNCH_WEEK = "w20261019";

/** 이만큼 모여야 시상대를 연다. 두 명짜리 시상대는 초라해서 오히려 안 들어온다. */
export const MIN_PODIUM = 5;
/** 이만큼은 출전해야 시즌이 끝날 때 배지를 준다. */
export const MIN_AWARDS = 3;
/** 이만큼 들어야 ❤ 를 누를 수 있다 — 안 듣고 누르는 ❤ 는 순위를 망친다. */
export const LISTEN_RATIO = 0.8;
/** 블라인드 배틀을 이만큼 치러야 배틀 순위에 오른다. 한두 판은 운이다. */
export const MIN_BATTLES = 3;
/** 출전작이 이만큼 모여야 블라인드 배틀을 연다. 그 전엔 모르는 사람끼리 붙일 짝도, 심사할 사람도 없다. */
export const BATTLE_OPEN = 30;
/** 출전 녹음 길이 상한(초). 대본은 10~22초짜리다. */
export const MAX_ENTRY_SECONDS = 60;

/**
 * 시즌 순서. 처음엔 문턱이 낮고 듣기 재밌는 것부터 — 첫 주가 "다큐 내레이션"이면
 * 준비생만 오고, "뉴스 오프닝"이면 누구나 한 번은 따라 해 본 적이 있다.
 * 다 돌면 처음으로 돌아간다. 대본은 전부 MIMIC 이 직접 쓴 것(rights: original)이다.
 */
export const ROTATION: { scriptId: string; field: string; emoji: string }[] = [
  { scriptId: "sc_a_news_open", field: "뉴스", emoji: "📰" },
  { scriptId: "sc_v_apology", field: "감정 연기", emoji: "🎭" },
  { scriptId: "sc_v_villain", field: "캐릭터", emoji: "😈" },
  { scriptId: "sc_v_ad_coffee", field: "광고", emoji: "☕" },
  { scriptId: "sc_a_sports_goal", field: "스포츠 중계", emoji: "⚽" },
  { scriptId: "sc_v_trailer", field: "내레이션", emoji: "🎬" },
  { scriptId: "sc_a_radio_night", field: "라디오", emoji: "📻" },
  { scriptId: "sc_v_game_boss", field: "게임", emoji: "🐉" },
  { scriptId: "sc_v_joy", field: "감정 연기", emoji: "🎉" },
  { scriptId: "sc_a_weather", field: "날씨", emoji: "🌤" },
  { scriptId: "sc_v_mascot", field: "캐릭터", emoji: "🎠" },
  { scriptId: "sc_v_docu_sea", field: "내레이션", emoji: "🌊" },
];

export type Week = {
  id: string;
  season: number;
  startsAt: number;
  endsAt: number;
  scriptId: string;
  field: string;
  emoji: string;
  title: string;
  /** 영어 화면용 대본 제목 (lib/script-i18n). */
  titleEn: string;
};

function weekIdOf(mondayDay: number): string {
  const d = new Date(mondayDay * DAY);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `w${y}${m}${dd}`;
}

function mondayDayOf(at: number): number {
  const day = Math.floor((at + KST) / DAY);
  // 1970-01-01 은 목요일이다. (day + 3) % 7 == 0 이면 월요일.
  return day - ((((day + 3) % 7) + 7) % 7);
}

function mondayDayOfId(id: string): number {
  const y = Number(id.slice(1, 5));
  const m = Number(id.slice(5, 7));
  const d = Number(id.slice(7, 9));
  return Math.floor(Date.UTC(y, m - 1, d) / DAY);
}

const LAUNCH_DAY = mondayDayOfId(LAUNCH_WEEK);

function weekFromMonday(mondayDay: number): Week {
  const season = Math.floor((mondayDay - LAUNCH_DAY) / 7) + 1;
  const slot = ROTATION[(((season - 1) % ROTATION.length) + ROTATION.length) % ROTATION.length];
  const script = findScript(slot.scriptId);
  return {
    id: weekIdOf(mondayDay),
    season,
    startsAt: mondayDay * DAY - KST,
    endsAt: (mondayDay + 7) * DAY - KST,
    scriptId: slot.scriptId,
    field: slot.field,
    emoji: slot.emoji,
    title: script?.title ?? slot.field,
    titleEn: scriptTitle(slot.scriptId, script?.title ?? fieldName(slot.field, "en"), "en"),
  };
}

/**
 * 지금 열려 있는(또는 곧 열릴) 주. 시즌 1 전이면 시즌 1을 돌려준다 — 화면은
 * startsAt 이 미래인 걸 보고 "오픈 예정"으로 그린다.
 */
export function currentWeek(at: number = Date.now()): Week {
  const monday = Math.max(mondayDayOf(at), LAUNCH_DAY);
  return weekFromMonday(monday);
}

/** 바로 전 주. 시즌 1 이전이면 없다. */
export function previousWeek(at: number = Date.now()): Week | null {
  const monday = mondayDayOf(at) - 7;
  return monday < LAUNCH_DAY ? null : weekFromMonday(monday);
}

export function weekById(id: string): Week | null {
  if (!/^w\d{8}$/.test(id)) return null;
  const monday = mondayDayOfId(id);
  if (!Number.isFinite(monday) || monday < LAUNCH_DAY || weekIdOf(monday) !== id) return null;
  // 월요일이 아닌 날짜로 만든 id 는 받지 않는다.
  if (mondayDayOf(monday * DAY - KST) !== monday) return null;
  return weekFromMonday(monday);
}

export function isLive(w: Pick<Week, "startsAt" | "endsAt">, at: number = Date.now()): boolean {
  return at >= w.startsAt && at < w.endsAt;
}

export function weekScript(w: Week): Script | undefined {
  return findScript(w.scriptId);
}

/** 시즌 라벨 — "S3 · 광고" / "S3 · Commercial" */
export function seasonLabel(w: Pick<Week, "season" | "field">, lang: Lang = "ko"): string {
  return `S${w.season} · ${fieldName(w.field, lang)}`;
}

/** 남은 시간 — 카운트다운 칸 네 개 (일·시·분·초). */
export function remaining(ms: number): { d: number; h: number; m: number; s: number } {
  const t = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(t / 86400), h: Math.floor((t % 86400) / 3600), m: Math.floor((t % 3600) / 60), s: t % 60 };
}

/** 게스트 출전 이름 — 기기 id 에서 고정으로 뽑는다. 같은 폰이면 매주 같은 번호다. */
export function guestName(seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return `익명의 목소리 #${String((h >>> 0) % 10000).padStart(4, "0")}`;
}

/** 저장된 게스트 이름은 한국어다 — 영어 화면에선 앞말만 바꿔 보여준다. */
export function displayName(name: string, lang: Lang): string {
  return lang === "en" ? name.replace(/^익명의 목소리/, "Anonymous voice") : name;
}

/** 화면에 내려가는 출전작 하나. 오디오는 /api/weekly/audio/{id} 로 받는다(서명 URL 만료 대비). */
export type EntryCard = {
  id: string;
  rank: number;
  name: string;
  guest: boolean;
  avatar: unknown;
  duration: number;
  bars: number[];
  likes: number;
  plays: number;
  /** 지난 시즌 수상 횟수 — 이름 옆 트로피 */
  trophies: number;
  createdAt: string;
  /** 블라인드 배틀 성적. 배틀 칸이 아직 없는 DB 면 null */
  battle: { rating: number; wins: number; losses: number } | null;
};

export type WeeklyBoard = {
  week: Week;
  entries: EntryCard[];
  totalLikes: number;
};

/** 시상대 기록 한 줄 — 명예의 전당·지난주·프로필 트로피. */
export type Award = {
  weekId: string;
  season: number;
  field: string;
  title: string;
  place: number;
  name: string;
  avatar: unknown;
  likes: number;
  entryId: string | null;
  userId: string | null;
};

/** v 는 녹음을 바꾼 시각 — 교체하면 주소가 바뀌어 예전 소리가 캐시에서 나오지 않는다. */
export function audioSrc(entryId: string, v?: string): string {
  return `/api/weekly/audio/${entryId}${v ? `?v=${encodeURIComponent(v)}` : ""}`;
}

/* --- 이 기기에 남기는 것 (브라우저 전용) ------------------------------------ */

const MINE_KEY = "mimic.weekly.mine";
const HEARD_KEY = "mimic.weekly.heard";

export type MineRecord = { entryId: string; token: string | null; takeId?: string };

/** 주마다 내 출전작. 게스트는 token 이 있어야 교체·내리기·계정 귀속을 할 수 있다. */
export function readMine(): Record<string, MineRecord> {
  try {
    const raw = localStorage.getItem(MINE_KEY);
    const v: unknown = raw ? JSON.parse(raw) : {};
    return v && typeof v === "object" ? (v as Record<string, MineRecord>) : {};
  } catch {
    return {};
  }
}

export function writeMine(weekId: string, rec: MineRecord | null): void {
  try {
    const all = readMine();
    if (rec) all[weekId] = rec;
    else delete all[weekId];
    localStorage.setItem(MINE_KEY, JSON.stringify(all));
  } catch {
    // 저장이 막힌 브라우저 — 로그인 출전은 서버가 기억하고, 게스트는 이번 화면에서만 안다.
  }
}

/** 계정에 귀속할 게스트 출전 열쇠들. */
export function guestTokens(): string[] {
  return Object.values(readMine())
    .map((r) => r.token)
    .filter((t): t is string => typeof t === "string" && t.length > 0);
}

export function dropTokens(tokens: string[]): void {
  const drop = new Set(tokens);
  try {
    const all = readMine();
    for (const k of Object.keys(all)) if (all[k].token && drop.has(all[k].token!)) all[k] = { ...all[k], token: null };
    localStorage.setItem(MINE_KEY, JSON.stringify(all));
  } catch {}
}

/** 끝까지 들은 출전작 — 다시 와도 또 들으라고 하지 않는다. */
export function readHeard(): Set<string> {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(HEARD_KEY) ?? "[]");
    return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

export function markHeard(id: string): void {
  try {
    const list = [...readHeard()].filter((x) => x !== id);
    list.push(id);
    localStorage.setItem(HEARD_KEY, JSON.stringify(list.slice(-300)));
  } catch {}
}
