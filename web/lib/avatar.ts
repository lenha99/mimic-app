/**
 * 목소리 캐릭터.
 *
 * 꾸미기가 목적이 아니다 — 내 목소리를 대신 내주는 얼굴이 목적이다. 얼굴 없이
 * 목소리만 올리는 건 민망하지만, 캐릭터가 입을 벌려 대신 외치면 웃기다.
 * 그래서 선택지는 적게, 대신 어떤 조합이든 소리에 맞춰 움직인다.
 *
 * 선택지를 늘리려면 supabase 마이그레이션의 profiles_avatar_valid 제약도 같이
 * 늘려야 한다. 한쪽만 늘리면 저장이 거부된다.
 */
export const AVATAR_OPTIONS = {
  body: ["blob", "cat", "bear", "ghost"],
  color: ["volt", "pink", "cyan", "lime", "peach", "lilac"],
  eyes: ["dot", "happy", "sleepy", "star"],
  hat: ["none", "cap", "crown", "bow", "headset"],
} as const;

type Options = typeof AVATAR_OPTIONS;
export type AvatarPart = keyof Options;
export type Avatar = { [K in AvatarPart]: Options[K][number] };

export const DEFAULT_AVATAR: Avatar = {
  body: "blob",
  color: "volt",
  eyes: "dot",
  hat: "none",
};

export const AVATAR_COLORS: Record<Avatar["color"], string> = {
  volt: "#e8ff3a",
  pink: "#ff5d98",
  cyan: "#3cebff",
  lime: "#7cff6b",
  peach: "#ffb38a",
  lilac: "#b89cff",
};

export const PART_LABELS: Record<AvatarPart, string> = {
  body: "몸",
  color: "색",
  eyes: "눈",
  hat: "모자",
};

export const OPTION_LABELS: Record<string, string> = {
  blob: "말랑이",
  cat: "고양이",
  bear: "곰",
  ghost: "유령",
  dot: "동글",
  happy: "웃음",
  sleepy: "졸림",
  star: "반짝",
  none: "없음",
  cap: "캡",
  crown: "왕관",
  bow: "리본",
  headset: "헤드셋",
};

/** DB 에서 온 값은 남의 입력이다. 모르는 값은 기본값으로 떨어뜨린다. */
export function normalizeAvatar(raw: unknown): Avatar {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const pick = <K extends AvatarPart>(k: K): Avatar[K] => {
    const v = r[k];
    return (AVATAR_OPTIONS[k] as readonly string[]).includes(v as string)
      ? (v as Avatar[K])
      : DEFAULT_AVATAR[k];
  };
  return { body: pick("body"), color: pick("color"), eyes: pick("eyes"), hat: pick("hat") };
}
