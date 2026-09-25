/**
 * 목소리 캐릭터.
 *
 * 꾸미기가 목적이 아니다 — 내 목소리를 대신 내주는 얼굴이 목적이다. 얼굴 없이
 * 목소리만 올리는 건 민망하지만, 캐릭터가 입을 벌려 대신 외치면 웃기다.
 *
 * 그래서 "누구 흉내를 내느냐"가 곧 캐릭터다. 버럭 화내는 녀석, 울먹이는 녀석,
 * 아저씨·할아버지·아줌마·할머니까지 파츠 조합으로 만들 수 있어야 명대사와 붙는다
 * ("밥은 먹고 다니냐"는 할머니가, "어이가 없네"는 버럭이가 외쳐야 웃기다).
 * 어떤 조합이든 소리에 맞춰 입이 움직인다.
 *
 * DB(profiles.avatar)는 키 이름과 값 모양만 검사한다. 허용 목록은 여기 한 곳이고,
 * 모르는 값은 normalizeAvatar 가 기본값으로 떨어뜨린다 — 파츠를 늘릴 때 마이그레이션이
 * 필요 없게.
 */
export const AVATAR_OPTIONS = {
  body: ["blob", "cat", "bear", "bunny", "ghost"],
  color: ["skin", "tan", "volt", "pink", "peach", "red", "blue", "cyan", "lime", "lilac", "white"],
  eyes: ["dot", "happy", "sleepy", "wink", "star", "heart", "angry", "sad"],
  hair: ["none", "bangs", "twin", "spiky", "perm", "bun", "bald", "white"],
  hairColor: ["black", "brown", "blonde", "pink", "gray"],
  face: ["none", "blush", "freckles", "mustache", "beard", "wrinkles", "tears", "bandaid"],
  glasses: ["none", "round", "thick", "sun", "reading"],
  hat: ["none", "cap", "beanie", "bucket", "visor", "crown", "bow", "flower", "headset"],
  fx: ["none", "fire", "rain", "sparkle", "hearts", "sweat"],
} as const;

type Options = typeof AVATAR_OPTIONS;
export type AvatarPart = keyof Options;
export type Avatar = { [K in AvatarPart]: Options[K][number] };

export const DEFAULT_AVATAR: Avatar = {
  body: "blob",
  color: "volt",
  eyes: "dot",
  hair: "none",
  hairColor: "black",
  face: "blush",
  glasses: "none",
  hat: "none",
  fx: "none",
};

export const AVATAR_COLORS: Record<Avatar["color"], string> = {
  skin: "#ffdcc0",
  tan: "#e9b48c",
  volt: "#e8ff3a",
  pink: "#ff8fb8",
  peach: "#ffb38a",
  red: "#ff5a4a",
  blue: "#6fa8ff",
  cyan: "#5ff0ff",
  lime: "#8dff7a",
  lilac: "#c3a6ff",
  white: "#f4f4f6",
};

export const HAIR_COLORS: Record<Avatar["hairColor"], string> = {
  black: "#2a2a30",
  brown: "#7a4a2b",
  blonde: "#f3cf5a",
  pink: "#ff6fa8",
  gray: "#d9d9de",
};

/** 편집 화면의 탭 순서와 이름. */
export const PART_GROUPS: { label: string; parts: AvatarPart[] }[] = [
  { label: "얼굴", parts: ["body", "color"] },
  { label: "표정", parts: ["eyes", "face"] },
  { label: "머리", parts: ["hair", "hairColor"] },
  { label: "소품", parts: ["glasses", "hat"] },
  { label: "효과", parts: ["fx"] },
];

export const PART_LABELS: Record<AvatarPart, string> = {
  body: "몸",
  color: "색",
  eyes: "눈",
  hair: "머리",
  hairColor: "머리색",
  face: "얼굴",
  glasses: "안경",
  hat: "모자",
  fx: "효과",
};

export const OPTION_LABELS: Record<AvatarPart, Record<string, string>> = {
  body: { blob: "말랑이", cat: "고양이", bear: "곰", bunny: "토끼", ghost: "유령" },
  color: {
    skin: "살구", tan: "구릿빛", volt: "형광", pink: "핑크", peach: "복숭아", red: "빨강",
    blue: "파랑", cyan: "하늘", lime: "연두", lilac: "보라", white: "하양",
  },
  eyes: {
    dot: "동글", happy: "웃음", sleepy: "졸림", wink: "윙크", star: "반짝", heart: "하트",
    angry: "버럭", sad: "울먹",
  },
  hair: {
    none: "없음", bangs: "앞머리", twin: "양갈래", spiky: "삐죽", perm: "뽀글 파마",
    bun: "쪽머리", bald: "M자", white: "백발 옆머리",
  },
  hairColor: { black: "검정", brown: "갈색", blonde: "금발", pink: "핑크", gray: "은발" },
  face: {
    none: "없음", blush: "볼터치", freckles: "주근깨", mustache: "콧수염", beard: "흰 수염",
    wrinkles: "주름", tears: "눈물", bandaid: "반창고",
  },
  glasses: { none: "없음", round: "동글이", thick: "뿔테", sun: "선글라스", reading: "돋보기" },
  hat: {
    none: "없음", cap: "캡", beanie: "비니", bucket: "버킷햇", visor: "선캡", crown: "왕관",
    bow: "리본", flower: "꽃핀", headset: "헤드셋",
  },
  fx: { none: "없음", fire: "불꽃", rain: "먹구름", sparkle: "반짝이", hearts: "하트", sweat: "땀" },
};

/** 한 번 눌러 바로 되는 캐릭터. 여기서 시작해 파츠를 바꾸면 된다. */
export const PRESETS: { name: string; avatar: Avatar }[] = [
  {
    name: "버럭이",
    avatar: { body: "blob", color: "red", eyes: "angry", hair: "spiky", hairColor: "black", face: "none", glasses: "none", hat: "none", fx: "fire" },
  },
  {
    name: "슬픔이",
    avatar: { body: "blob", color: "blue", eyes: "sad", hair: "bangs", hairColor: "black", face: "tears", glasses: "round", hat: "none", fx: "rain" },
  },
  {
    name: "아저씨",
    avatar: { body: "blob", color: "skin", eyes: "dot", hair: "bald", hairColor: "black", face: "mustache", glasses: "thick", hat: "none", fx: "sweat" },
  },
  {
    name: "할아버지",
    avatar: { body: "blob", color: "skin", eyes: "happy", hair: "white", hairColor: "gray", face: "beard", glasses: "reading", hat: "none", fx: "none" },
  },
  {
    name: "아줌마",
    avatar: { body: "blob", color: "skin", eyes: "happy", hair: "perm", hairColor: "brown", face: "blush", glasses: "none", hat: "visor", fx: "none" },
  },
  {
    name: "할머니",
    avatar: { body: "blob", color: "skin", eyes: "happy", hair: "bun", hairColor: "gray", face: "wrinkles", glasses: "reading", hat: "flower", fx: "none" },
  },
  {
    name: "MZ",
    avatar: { body: "cat", color: "lilac", eyes: "wink", hair: "none", hairColor: "black", face: "blush", glasses: "sun", hat: "bucket", fx: "sparkle" },
  },
  {
    name: "사랑둥이",
    avatar: { body: "bunny", color: "pink", eyes: "heart", hair: "twin", hairColor: "blonde", face: "blush", glasses: "none", hat: "bow", fx: "hearts" },
  },
];

const PARTS = Object.keys(AVATAR_OPTIONS) as AvatarPart[];

/** DB·브라우저에서 온 값은 남의 입력이다. 모르는 값은 기본값으로 떨어뜨린다. */
export function normalizeAvatar(raw: unknown): Avatar {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const out = { ...DEFAULT_AVATAR };
  for (const k of PARTS) {
    const v = r[k];
    if ((AVATAR_OPTIONS[k] as readonly string[]).includes(v as string)) {
      (out as Record<string, string>)[k] = v as string;
    }
  }
  return out;
}

export function randomAvatar(): Avatar {
  const out = { ...DEFAULT_AVATAR };
  for (const k of PARTS) {
    const opts = AVATAR_OPTIONS[k];
    (out as Record<string, string>)[k] = opts[Math.floor(Math.random() * opts.length)];
  }
  return out;
}

/** 로그인 전에 꾸민 캐릭터는 이 브라우저에 둔다. 로그인하면 계정으로 옮긴다. */
export const LOCAL_AVATAR_KEY = "mimic.avatar";

export function parseLocalAvatar(raw: string | null): Avatar | null {
  if (!raw) return null;
  try {
    return normalizeAvatar(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function readLocalAvatar(): Avatar | null {
  try {
    return parseLocalAvatar(localStorage.getItem(LOCAL_AVATAR_KEY));
  } catch {
    return null;
  }
}

export function writeLocalAvatar(a: Avatar): void {
  try {
    localStorage.setItem(LOCAL_AVATAR_KEY, JSON.stringify(a));
  } catch {
    // 저장이 막힌 환경이면 이번 화면에서만 쓴다.
  }
}

/**
 * 링크 한 줄에 싣는 캐릭터 코드 — 미리보기 카드(/api/og) 주소용.
 * 파츠 순서대로 값을 점으로 잇는다: "blob.skin.happy.bun.gray.wrinkles.reading.flower.none".
 * 읽을 땐 normalizeAvatar 를 거치므로 깨진 코드는 기본값으로 떨어진다.
 */
export function encodeAvatar(a: Avatar): string {
  return PARTS.map((k) => a[k]).join(".");
}

export function decodeAvatar(code: string | null | undefined): Avatar {
  if (!code) return DEFAULT_AVATAR;
  const vals = code.split(".");
  return normalizeAvatar(Object.fromEntries(PARTS.map((k, i) => [k, vals[i]])));
}
