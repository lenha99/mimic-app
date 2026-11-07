/**
 * VOICE PASS — 활동하면 XP 가 쌓이고, 레벨이 오르면 꾸미기가 풀린다.
 *
 * 게임 시즌 패스(포트나이트·브롤스타즈)와 디스코드 프로필 효과에서 가져온 구조다.
 * "보상을 드립니다"가 아니라 "레벨이 오르면 내 아바타 프레임이 빛나고 닉네임이 반짝인다" —
 * 남들 눈에 보이는 것만 준다. 돈 드는 건 하나도 없고, 표도 따로 없다. 전부 이미 있는 숫자
 * (올린 목소리 · 받은 ❤ · 구독자 · 준 ❤ · 운영자 픽)로 계산한다.
 *
 * 레벨은 낮게 시작한다 — 사람이 적은 지금, 목소리 하나 올리고 ❤ 몇 개면 LV.2 가 된다.
 */

export type PassStats = {
  posts: number;
  likesReceived: number;
  followers: number;
  likesGiven: number;
  picked: boolean;
  /** 내가 먼저 ❤ 한 목소리가 나중에 운영자 픽이 됐다 */
  prophet: boolean;
  /** 혼자 하는 진행(11/4) — 연습한 날 수 · 하루 10번까지 센 녹음 수 · 도감에 모은 목소리 타입 수 · 지금 연속 일수 */
  activeDays: number;
  takes: number;
  dex: number;
  streak: number;
  /** 남의 목소리에 남긴 피드백 — 목소리마다 한 번 센다 · 그중 주인이 👍 도움됐어요 한 것 (11/7) */
  feedbackGiven: number;
  feedbackHelpful: number;
};

export const EMPTY_STATS: PassStats = {
  posts: 0,
  likesReceived: 0,
  followers: 0,
  likesGiven: 0,
  picked: false,
  prophet: false,
  activeDays: 0,
  takes: 0,
  dex: 0,
  streak: 0,
  feedbackGiven: 0,
  feedbackHelpful: 0,
};

/** 혼자 하는 XP 는 "아주 조금" — 남이 주는 XP(❤ +10 · 구독 +25 · 들려주기 +30)가 늘 더 크게 보이게. */
export const SOLO_XP = { day: 5, take: 1, takeCapPerDay: 10, dex: 5 } as const;

/**
 * 남을 돕는 XP 는 크게 — 피드백은 목소리 올리기(30)보다 많이 준다. 들어 주고 한마디 남기는 사람이
 * 있어야 올린 사람이 다시 올린다. 도배를 막으려고 목소리 하나당 한 번만 센다.
 */
export const FEEDBACK_XP = { give: 40, helpful: 60 } as const;

/** XP 얻는 법 — 화면(/pass)에 그대로 보여 준다 */
export const XP_RULES = [
  { key: "posts", xp: 30, ko: "목소리 들려주기", en: "Post a voice", noteKo: "목소리마다", noteEn: "per voice" },
  { key: "likesReceived", xp: 10, ko: "❤ 받기", en: "Get a ❤", noteKo: "❤ 하나마다", noteEn: "per ❤" },
  { key: "followers", xp: 25, ko: "구독자 생기기", en: "Gain a subscriber", noteKo: "한 명마다", noteEn: "per sub" },
  { key: "feedbackGiven", xp: FEEDBACK_XP.give, ko: "🎯 피드백 남기기", en: "Give feedback", noteKo: "목소리마다", noteEn: "per voice" },
  { key: "feedbackHelpful", xp: FEEDBACK_XP.helpful, ko: "내 피드백이 도움됐어요 👍", en: "Your feedback helped 👍", noteKo: "👍 마다 더", noteEn: "bonus per 👍" },
  { key: "likesGiven", xp: 3, ko: "다른 목소리에 ❤", en: "Give a ❤", noteKo: "누를 때마다", noteEn: "per ❤" },
  { key: "picked", xp: 150, ko: "운영자 픽 되기", en: "Get picked", noteKo: "한 번", noteEn: "once" },
  { key: "prophet", xp: 50, ko: "픽 될 목소리 먼저 알아보기", en: "❤ a voice before it's picked", noteKo: "한 번", noteEn: "once" },
  { key: "activeDays", xp: 5, ko: "오늘 첫 연습", en: "First practice of the day", noteKo: "하루 한 번", noteEn: "once a day" },
  { key: "takes", xp: 1, ko: "연습 녹음", en: "Practice take", noteKo: "하루 10번까지", noteEn: "up to 10 a day" },
  { key: "dex", xp: 5, ko: "새 목소리 타입 발견", en: "Discover a voice type", noteKo: "도감 한 칸마다", noteEn: "per dex slot" },
] as const;

export function xpOf(s: PassStats): number {
  return (
    s.posts * 30 +
    s.likesReceived * 10 +
    s.followers * 25 +
    s.likesGiven * 3 +
    (s.picked ? 150 : 0) +
    (s.prophet ? 50 : 0) +
    (s.activeDays ?? 0) * SOLO_XP.day +
    (s.takes ?? 0) * SOLO_XP.take +
    (s.dex ?? 0) * SOLO_XP.dex +
    (s.feedbackGiven ?? 0) * FEEDBACK_XP.give +
    (s.feedbackHelpful ?? 0) * FEEDBACK_XP.helpful
  );
}

/** 레벨 n 이 되는 데 필요한 누적 XP (index = 레벨 - 1) */
export const LEVEL_XP = [0, 30, 80, 150, 250, 400, 600, 850, 1200, 1700] as const;
export const MAX_LEVEL = LEVEL_XP.length;

export function levelOf(xp: number): number {
  let lv = 1;
  for (let i = 0; i < LEVEL_XP.length; i++) if (xp >= LEVEL_XP[i]) lv = i + 1;
  return lv;
}

/** 지금 레벨 안에서 얼마나 왔나 — 0..1, 다음 레벨까지 남은 XP */
export function progressOf(xp: number): { level: number; into: number; need: number; ratio: number } {
  const level = levelOf(xp);
  if (level >= MAX_LEVEL) return { level, into: 0, need: 0, ratio: 1 };
  const lo = LEVEL_XP[level - 1];
  const hi = LEVEL_XP[level];
  return { level, into: xp - lo, need: hi - xp, ratio: (xp - lo) / (hi - lo) };
}

export type Rank = "rookie" | "rising" | "star" | "icon" | "legend";
export const RANKS: { id: Rank; from: number; label: string }[] = [
  { id: "rookie", from: 1, label: "ROOKIE" },
  { id: "rising", from: 3, label: "RISING" },
  { id: "star", from: 5, label: "STAR" },
  { id: "icon", from: 7, label: "ICON" },
  { id: "legend", from: 9, label: "LEGEND" },
];
export function rankOf(level: number): Rank {
  let r: Rank = "rookie";
  for (const x of RANKS) if (level >= x.from) r = x.id;
  return r;
}
export function rankLabel(r: Rank): string {
  return RANKS.find((x) => x.id === r)!.label;
}

/** 아바타 프레임 — 레벨로 풀린다. 가장 높은 것을 자동으로 낀다 */
export type FrameId = "none" | "neon" | "holo" | "aurora" | "spotlight" | "legend";
/** 닉네임 효과 */
export type NameFxId = "none" | "glow" | "shimmer" | "chrome" | "prism";
/** 특별 배지 — 레벨과 상관없이 한 일로만 */
export type BadgeId = "pick" | "oracle" | "first";

export type Unlock =
  | { level: number; kind: "frame"; id: Exclude<FrameId, "none">; ko: string; en: string }
  | { level: number; kind: "name"; id: Exclude<NameFxId, "none">; ko: string; en: string };

/** 패스 트랙 — 레벨마다 무엇이 풀리는지 */
export const UNLOCKS: Unlock[] = [
  { level: 2, kind: "frame", id: "neon", ko: "네온 프레임", en: "Neon frame" },
  { level: 3, kind: "name", id: "glow", ko: "글로우 닉네임", en: "Glow name" },
  { level: 4, kind: "frame", id: "holo", ko: "홀로그램 프레임", en: "Holo frame" },
  { level: 5, kind: "name", id: "shimmer", ko: "시머 닉네임", en: "Shimmer name" },
  { level: 6, kind: "frame", id: "aurora", ko: "오로라 프레임", en: "Aurora frame" },
  { level: 7, kind: "name", id: "chrome", ko: "크롬 닉네임", en: "Chrome name" },
  { level: 8, kind: "frame", id: "spotlight", ko: "스포트라이트 프레임", en: "Spotlight frame" },
  { level: 10, kind: "frame", id: "legend", ko: "레전드 프레임", en: "Legend frame" },
  { level: 10, kind: "name", id: "prism", ko: "프리즘 닉네임", en: "Prism name" },
];

export const BADGES: Record<BadgeId, { label: string; ko: string; en: string }> = {
  pick: { label: "PICK", ko: "운영자 픽으로 뽑힌 목소리", en: "Picked by the editors" },
  oracle: { label: "ORACLE", ko: "픽 될 목소리를 먼저 알아본 귀", en: "Spotted a pick before anyone" },
  first: { label: "FIRST ❤", ko: "첫 ❤ 를 받은 목소리", en: "Got a first ❤" },
};

export type Look = { level: number; rank: Rank; frame: FrameId; name: NameFxId; badges: BadgeId[] };

export function lookOf(s: PassStats): Look {
  const level = levelOf(xpOf(s));
  let frame: FrameId = "none";
  let name: NameFxId = "none";
  for (const u of UNLOCKS) {
    if (u.level > level) continue;
    if (u.kind === "frame") frame = u.id;
    else name = u.id;
  }
  // 운영자 픽은 레벨이 낮아도 스포트라이트를 받는다 — 픽은 그 자체로 무대다.
  if (s.picked && ["none", "neon", "holo", "aurora"].includes(frame)) frame = "spotlight";
  const badges: BadgeId[] = [];
  if (s.picked) badges.push("pick");
  if (s.prophet) badges.push("oracle");
  if (s.likesReceived >= 1 && !s.picked) badges.push("first");
  return { level, rank: rankOf(level), frame, name, badges };
}

export const NO_LOOK: Look = { level: 1, rank: "rookie", frame: "none", name: "none", badges: [] };

/** 다음에 풀릴 것 */
export function nextUnlock(level: number): Unlock | null {
  return UNLOCKS.find((u) => u.level > level) ?? null;
}

export function unlocksAt(level: number): Unlock[] {
  return UNLOCKS.filter((u) => u.level === level);
}

/** 알림을 보내는 단계 — 받은 ❤ 합계 · 구독자 수 */
export const LIKE_STEPS = [1, 3, 10, 30, 100] as const;
export const FOLLOW_STEPS = [3, 10, 30] as const;
