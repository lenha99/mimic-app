/**
 * 보상 — 돈 드는 건 없다. 전부 이미 있는 숫자(받은 ❤ · 구독자 · 준 ❤ · 운영자 픽)로 계산한다.
 *
 * 사람이 적다는 전제라 기준이 낮다. 첫 ❤ 한 개부터 축하한다 — 지금 올리는 사람한테 제일 큰
 * 도파민은 "누가 내 목소리를 좋아했다"는 소식 하나다.
 *
 * 받은 ❤ 합계는 목소리 테두리(브론즈 → 실버 → 골드)로 남들 눈에도 보인다.
 */

export type Tier = 0 | 1 | 2 | 3;

/** 받은 ❤ 합계 → 테두리 단계. 3 브론즈 · 10 실버 · 30 골드 */
export const LIKE_TIERS = [3, 10, 30] as const;
export function likeTier(total: number): Tier {
  return total >= LIKE_TIERS[2] ? 3 : total >= LIKE_TIERS[1] ? 2 : total >= LIKE_TIERS[0] ? 1 : 0;
}

/** 알림을 보내는 받은 ❤ 합계 */
export const LIKE_MILESTONES = [1, 3, 10, 30, 100] as const;
export const FOLLOW_MILESTONES = [3, 10, 30] as const;
export const GIVE_MILESTONES = [5, 20, 50] as const;

export type RewardStats = {
  likesReceived: number;
  followers: number;
  likesGiven: number;
  picked: boolean;
  /** 내가 먼저 ❤ 한 목소리가 나중에 운영자 픽이 된 적이 있다 */
  prophet: boolean;
};

export type RewardId =
  | "like_first"
  | "like_bronze"
  | "like_silver"
  | "like_gold"
  | "fans_3"
  | "fans_10"
  | "fans_30"
  | "ear_5"
  | "ear_20"
  | "ear_50"
  | "pick"
  | "prophet";

type Def = { id: RewardId; icon: string; ko: string; en: string; howKo: string; howEn: string; has: (s: RewardStats) => boolean };

/** 순서 = 화면에 놓이는 순서. 같은 줄(❤·구독·청취)은 높은 것만 보여 준다(shelf). */
export const REWARDS: Def[] = [
  { id: "pick", icon: "⭐", ko: "운영자 픽", en: "Editor's pick", howKo: "코코가 고른 목소리", howEn: "Picked by Coco", has: (s) => s.picked },
  { id: "like_gold", icon: "🥇", ko: "골드 목소리", en: "Gold voice", howKo: "❤ 30개", howEn: "30 ❤", has: (s) => s.likesReceived >= 30 },
  { id: "like_silver", icon: "🥈", ko: "실버 목소리", en: "Silver voice", howKo: "❤ 10개", howEn: "10 ❤", has: (s) => s.likesReceived >= 10 },
  { id: "like_bronze", icon: "🥉", ko: "브론즈 목소리", en: "Bronze voice", howKo: "❤ 3개", howEn: "3 ❤", has: (s) => s.likesReceived >= 3 },
  { id: "like_first", icon: "💗", ko: "첫 ❤", en: "First ❤", howKo: "❤ 1개", howEn: "1 ❤", has: (s) => s.likesReceived >= 1 },
  { id: "fans_30", icon: "👑", ko: "팬덤 있는 목소리", en: "Has a fandom", howKo: "구독자 30명", howEn: "30 subscribers", has: (s) => s.followers >= 30 },
  { id: "fans_10", icon: "🔔", ko: "단골 생긴 목소리", en: "Has regulars", howKo: "구독자 10명", howEn: "10 subscribers", has: (s) => s.followers >= 10 },
  { id: "fans_3", icon: "🌱", ko: "떠오르는 목소리", en: "Rising voice", howKo: "구독자 3명", howEn: "3 subscribers", has: (s) => s.followers >= 3 },
  { id: "prophet", icon: "🔮", ko: "픽 예언가", en: "Pick prophet", howKo: "먼저 ❤ 한 목소리가 운영자 픽", howEn: "You ❤'d a voice before it got picked", has: (s) => s.prophet },
  { id: "ear_50", icon: "🎧", ko: "황금 귀", en: "Golden ears", howKo: "❤ 50번 주기", howEn: "Give 50 ❤", has: (s) => s.likesGiven >= 50 },
  { id: "ear_20", icon: "🎧", ko: "귀 밝은 청취자", en: "Sharp ears", howKo: "❤ 20번 주기", howEn: "Give 20 ❤", has: (s) => s.likesGiven >= 20 },
  { id: "ear_5", icon: "🎧", ko: "첫 청취자", en: "First listener", howKo: "❤ 5번 주기", howEn: "Give 5 ❤", has: (s) => s.likesGiven >= 5 },
];

const LINES: RewardId[][] = [
  ["like_gold", "like_silver", "like_bronze", "like_first"],
  ["fans_30", "fans_10", "fans_3"],
  ["ear_50", "ear_20", "ear_5"],
];

export function rewardDef(id: RewardId): Def {
  return REWARDS.find((r) => r.id === id)!;
}

/** 받은 보상 — 같은 줄은 가장 높은 것 하나만 */
export function earned(s: RewardStats): RewardId[] {
  const have = new Set(REWARDS.filter((r) => r.has(s)).map((r) => r.id));
  for (const line of LINES) {
    const top = line.find((id) => have.has(id));
    for (const id of line) if (id !== top) have.delete(id);
  }
  return REWARDS.map((r) => r.id).filter((id) => have.has(id));
}

/** 다음 목표 — 줄마다 아직 못 받은 가장 가까운 것과 남은 수 */
export function nextGoals(s: RewardStats): { id: RewardId; left: number; unitKo: string; unitEn: string }[] {
  const out: { id: RewardId; left: number; unitKo: string; unitEn: string }[] = [];
  const like = [1, 3, 10, 30].find((n) => s.likesReceived < n);
  if (like) out.push({ id: (["like_first", "like_bronze", "like_silver", "like_gold"] as const)[[1, 3, 10, 30].indexOf(like)], left: like - s.likesReceived, unitKo: "❤", unitEn: "❤" });
  const fans = [3, 10, 30].find((n) => s.followers < n);
  if (fans) out.push({ id: (["fans_3", "fans_10", "fans_30"] as const)[[3, 10, 30].indexOf(fans)], left: fans - s.followers, unitKo: "명", unitEn: " subs" });
  const ear = [5, 20, 50].find((n) => s.likesGiven < n);
  if (ear) out.push({ id: (["ear_5", "ear_20", "ear_50"] as const)[[5, 20, 50].indexOf(ear)], left: ear - s.likesGiven, unitKo: "번", unitEn: " ❤" });
  return out;
}

/** 방금 준 ❤ 로 청취자 보상을 새로 받았나 */
export function giveReward(given: number): RewardId | null {
  return given === 5 ? "ear_5" : given === 20 ? "ear_20" : given === 50 ? "ear_50" : null;
}

export function isReward(x: unknown): x is RewardId {
  return typeof x === "string" && REWARDS.some((r) => r.id === x);
}
