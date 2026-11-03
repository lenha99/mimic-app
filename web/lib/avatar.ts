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
 * DB(profiles.avatar)는 키 이름과 값 모양(^[a-z]{1,16}$)만 검사한다. 허용 목록은 여기
 * 한 곳이고, 모르는 값은 normalizeAvatar 가 기본값으로 떨어뜨린다 — 파츠를 늘릴 때
 * 마이그레이션이 필요 없게. 값을 빼면 저장된 캐릭터가 바뀌니 늘리기만 한다.
 */
export const AVATAR_OPTIONS = {
  body: ["parrot", "blob", "cat", "bear", "bunny", "ghost"],
  color: [
    "coco", "skin", "tan", "cocoa", "volt", "pink", "peach", "red", "blue", "cyan", "mint", "lime", "lilac", "white", "ink",
  ],
  eyes: ["dot", "shiny", "happy", "sleepy", "wink", "star", "heart", "angry", "sad"],
  hair: ["none", "sprout", "bangs", "bob", "twin", "spiky", "perm", "bun", "bald", "white"],
  hairColor: ["black", "brown", "blonde", "pink", "blue", "gray"],
  face: ["none", "blush", "freckles", "mustache", "beard", "wrinkles", "tears", "bandaid"],
  glasses: ["none", "round", "thick", "sun", "heart", "reading"],
  hat: ["none", "headset", "cap", "beanie", "bucket", "beret", "party", "visor", "crown", "bow", "flower"],
  fx: ["none", "notes", "sparkle", "hearts", "fire", "rain", "sweat"],
} as const;

type Options = typeof AVATAR_OPTIONS;
export type AvatarPart = keyof Options;
export type Avatar = { [K in AvatarPart]: Options[K][number] };

/** 아무것도 안 고른 사람의 얼굴 — 코코네 식구(노랑 왕관앵무)에 녹음 부스 헤드셋. */
export const DEFAULT_AVATAR: Avatar = {
  body: "parrot",
  color: "coco",
  eyes: "dot",
  hair: "none",
  hairColor: "black",
  face: "blush",
  glasses: "none",
  hat: "headset",
  fx: "none",
};

/** 몸 색. 형광 원색은 귀엽기보다 눈이 아파서, 같은 이름을 유지한 채 파스텔 쪽으로 눌렀다. */
export const AVATAR_COLORS: Record<Avatar["color"], string> = {
  coco: "#ffe17a",
  skin: "#ffdcc4",
  tan: "#eab48c",
  cocoa: "#b98262",
  volt: "#e4f56a",
  pink: "#ffa8c6",
  peach: "#ffbe96",
  red: "#ff7d6e",
  blue: "#8cb9ff",
  cyan: "#88e0f0",
  mint: "#9fe6c6",
  lime: "#b4ec8c",
  lilac: "#c9b4ff",
  white: "#f7f4ef",
  ink: "#56506a",
};

export const HAIR_COLORS: Record<Avatar["hairColor"], string> = {
  black: "#3a3442",
  brown: "#8e5a38",
  blonde: "#f6d36a",
  pink: "#ff8ab6",
  blue: "#7390ff",
  gray: "#e2e0e8",
};

/** 편집 화면의 탭 순서와 이름. */
export const PART_GROUPS: { label: string; labelEn: string; icon: string; parts: AvatarPart[] }[] = [
  { label: "몸", labelEn: "Body", icon: "🐣", parts: ["body", "color"] },
  { label: "표정", labelEn: "Face", icon: "😊", parts: ["eyes", "face"] },
  { label: "머리", labelEn: "Hair", icon: "💇", parts: ["hair", "hairColor"] },
  { label: "모자", labelEn: "Hat", icon: "🎧", parts: ["hat"] },
  { label: "소품", labelEn: "Extras", icon: "✨", parts: ["glasses", "fx"] },
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
  body: { parrot: "앵무새 코코", blob: "말랑이", cat: "고양이", bear: "곰", bunny: "토끼", ghost: "유령" },
  color: {
    coco: "코코 노랑", skin: "살구", tan: "구릿빛", cocoa: "코코아", volt: "레몬", pink: "핑크", peach: "복숭아",
    red: "딸기", blue: "파랑", cyan: "하늘", mint: "민트", lime: "연두", lilac: "보라", white: "하양", ink: "까망",
  },
  eyes: {
    dot: "동글", shiny: "초롱초롱", happy: "웃음", sleepy: "졸림", wink: "윙크", star: "반짝", heart: "하트",
    angry: "버럭", sad: "울먹",
  },
  hair: {
    none: "없음", sprout: "새싹", bangs: "앞머리", bob: "단발", twin: "양갈래", spiky: "삐죽", perm: "뽀글 파마",
    bun: "쪽머리", bald: "M자", white: "백발 옆머리",
  },
  hairColor: { black: "검정", brown: "갈색", blonde: "금발", pink: "핑크", blue: "파랑", gray: "은발" },
  face: {
    none: "없음", blush: "볼터치", freckles: "주근깨", mustache: "콧수염", beard: "흰 수염",
    wrinkles: "주름", tears: "눈물", bandaid: "반창고",
  },
  glasses: { none: "없음", round: "동글이", thick: "뿔테", sun: "선글라스", heart: "하트 안경", reading: "돋보기" },
  hat: {
    none: "없음", headset: "헤드셋", cap: "캡", beanie: "비니", bucket: "버킷햇", beret: "베레모", party: "고깔",
    visor: "선캡", crown: "왕관", bow: "리본", flower: "꽃핀",
  },
  fx: { none: "없음", notes: "음표", sparkle: "반짝이", hearts: "하트", fire: "불꽃", rain: "먹구름", sweat: "땀" },
};

export const PART_LABELS_EN: Record<AvatarPart, string> = {
  body: "Body",
  color: "Color",
  eyes: "Eyes",
  hair: "Hair",
  hairColor: "Hair color",
  face: "Details",
  glasses: "Glasses",
  hat: "Hat",
  fx: "Effect",
};

export const OPTION_LABELS_EN: Record<AvatarPart, Record<string, string>> = {
  body: { parrot: "Coco parrot", blob: "Blob", cat: "Cat", bear: "Bear", bunny: "Bunny", ghost: "Ghost" },
  color: {
    coco: "Coco yellow", skin: "Apricot", tan: "Tan", cocoa: "Cocoa", volt: "Lemon", pink: "Pink", peach: "Peach",
    red: "Strawberry", blue: "Blue", cyan: "Sky", mint: "Mint", lime: "Lime", lilac: "Lilac", white: "White", ink: "Ink",
  },
  eyes: {
    dot: "Dots", shiny: "Sparkly", happy: "Happy", sleepy: "Sleepy", wink: "Wink", star: "Starry", heart: "Hearts",
    angry: "Angry", sad: "Teary",
  },
  hair: {
    none: "None", sprout: "Sprout", bangs: "Bangs", bob: "Bob", twin: "Pigtails", spiky: "Spiky", perm: "Curly perm",
    bun: "Bun", bald: "Receding", white: "White sides",
  },
  hairColor: { black: "Black", brown: "Brown", blonde: "Blonde", pink: "Pink", blue: "Blue", gray: "Silver" },
  face: {
    none: "None", blush: "Blush", freckles: "Freckles", mustache: "Mustache", beard: "White beard",
    wrinkles: "Wrinkles", tears: "Tears", bandaid: "Band-aid",
  },
  glasses: { none: "None", round: "Round", thick: "Horn-rim", sun: "Shades", heart: "Heart specs", reading: "Readers" },
  hat: {
    none: "None", headset: "Headset", cap: "Cap", beanie: "Beanie", bucket: "Bucket hat", beret: "Beret", party: "Party hat",
    visor: "Visor", crown: "Crown", bow: "Bow", flower: "Flower pin",
  },
  fx: { none: "None", notes: "Notes", sparkle: "Sparkles", hearts: "Hearts", fire: "Fire", rain: "Rain cloud", sweat: "Sweat" },
};

/**
 * 한 번 눌러 바로 되는 캐릭터. 여기서 시작해 파츠를 바꾸면 된다.
 * 순서는 바꾸지 말고 뒤에만 붙인다 — weekly/hub 의 예시 순위표가 번호(preset)로 집는다.
 */
export const PRESETS: { name: string; nameEn: string; avatar: Avatar }[] = [
  {
    name: "버럭이",
    nameEn: "Grumpy",
    avatar: { body: "blob", color: "red", eyes: "angry", hair: "spiky", hairColor: "black", face: "none", glasses: "none", hat: "none", fx: "fire" },
  },
  {
    name: "슬픔이",
    nameEn: "Weepy",
    avatar: { body: "blob", color: "blue", eyes: "sad", hair: "bangs", hairColor: "black", face: "tears", glasses: "round", hat: "none", fx: "rain" },
  },
  {
    name: "아저씨",
    nameEn: "Ajussi",
    avatar: { body: "blob", color: "skin", eyes: "dot", hair: "bald", hairColor: "black", face: "mustache", glasses: "thick", hat: "none", fx: "sweat" },
  },
  {
    name: "할아버지",
    nameEn: "Grandpa",
    avatar: { body: "blob", color: "skin", eyes: "happy", hair: "white", hairColor: "gray", face: "beard", glasses: "reading", hat: "none", fx: "none" },
  },
  {
    name: "아줌마",
    nameEn: "Ajumma",
    avatar: { body: "blob", color: "skin", eyes: "happy", hair: "perm", hairColor: "brown", face: "blush", glasses: "none", hat: "visor", fx: "none" },
  },
  {
    name: "할머니",
    nameEn: "Grandma",
    avatar: { body: "blob", color: "skin", eyes: "happy", hair: "bun", hairColor: "gray", face: "wrinkles", glasses: "reading", hat: "flower", fx: "none" },
  },
  {
    name: "MZ",
    nameEn: "Gen Z",
    avatar: { body: "cat", color: "lilac", eyes: "wink", hair: "none", hairColor: "black", face: "blush", glasses: "sun", hat: "bucket", fx: "sparkle" },
  },
  {
    name: "사랑둥이",
    nameEn: "Lovebug",
    avatar: { body: "bunny", color: "pink", eyes: "heart", hair: "twin", hairColor: "blonde", face: "blush", glasses: "none", hat: "bow", fx: "hearts" },
  },
  {
    name: "곰돌이",
    nameEn: "Teddy",
    avatar: { body: "bear", color: "cocoa", eyes: "shiny", hair: "none", hairColor: "brown", face: "blush", glasses: "none", hat: "beret", fx: "notes" },
  },
  {
    name: "코코",
    nameEn: "Coco",
    avatar: DEFAULT_AVATAR,
  },
];

const PARTS = Object.keys(AVATAR_OPTIONS) as AvatarPart[];

function isKnown(k: AvatarPart, v: unknown): boolean {
  return (AVATAR_OPTIONS[k] as readonly string[]).includes(v as string);
}

/**
 * DB·브라우저에서 온 값은 남의 입력이다. 모르는 값은 기본값으로 떨어뜨린다.
 *
 * seed 를 주면, 캐릭터가 아예 없는(비었거나 알아볼 파츠가 하나도 없는) 사람에게
 * 똑같은 기본 얼굴 대신 seed 로 정해지는 얼굴(seededAvatar)을 준다 — 손님 목록이
 * 전부 같은 얼굴이면 죽은 화면처럼 보인다. seed 없이 부르면 예전과 같다.
 */
export function normalizeAvatar(raw: unknown, seed?: string): Avatar {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  if (seed !== undefined && !PARTS.some((k) => isKnown(k, r[k]))) return seededAvatar(seed);
  const out = { ...DEFAULT_AVATAR };
  for (const k of PARTS) {
    const v = r[k];
    if (isKnown(k, v)) (out as Record<string, string>)[k] = v as string;
  }
  return out;
}

/** 문자열 → 32비트 해시 (FNV-1a). */
function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** 작은 결정적 난수(mulberry32). */
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 랜덤이어도 "예쁜 쪽" 랜덤 — 버럭·울먹·콧수염 같은 연기용 파츠는 빼고, 귀여운 것만
 * 골고루. 앞의 값일수록 자주 나오게 일부러 겹쳐 적었다.
 */
const CUTE_POOL: { [K in AvatarPart]: readonly Avatar[K][] } = {
  body: ["parrot", "parrot", "blob", "cat", "cat", "bear", "bear", "bunny", "bunny", "ghost"],
  color: ["coco", "pink", "peach", "mint", "lilac", "blue", "cyan", "lime", "skin", "white", "cocoa", "tan", "volt", "ink"],
  eyes: ["dot", "dot", "shiny", "shiny", "happy", "happy", "wink", "star", "heart", "sleepy"],
  hair: ["none", "none", "none", "sprout", "bangs", "bob", "twin", "perm"],
  hairColor: ["black", "brown", "blonde", "pink", "blue", "brown"],
  face: ["blush", "blush", "blush", "none", "freckles", "bandaid"],
  glasses: ["none", "none", "none", "none", "none", "round", "sun", "heart"],
  hat: ["none", "none", "none", "headset", "beanie", "cap", "beret", "party", "bow", "flower", "crown", "bucket"],
  fx: ["none", "none", "none", "none", "none", "notes", "sparkle", "hearts"],
};

function pickFrom(next: () => number): Avatar {
  const out = { ...DEFAULT_AVATAR };
  for (const k of PARTS) {
    const pool = CUTE_POOL[k] as readonly string[];
    (out as Record<string, string>)[k] = pool[Math.floor(next() * pool.length)];
  }
  // 앵무새는 코코 노랑이 제일 코코답다 — 절반은 노랑으로.
  if (out.body === "parrot" && next() < 0.5) out.color = "coco";
  // 토끼·고양이 귀 위로 큰 모자가 얹히면 귀가 가려져 정체를 잃는다.
  if ((out.body === "bunny" || out.body === "cat") && ["bucket", "beanie", "cap"].includes(out.hat)) out.hat = "none";
  return out;
}

/** 같은 문자열이면 언제나 같은 얼굴. 꾸민 적 없는 손님에게 쓴다. */
export function seededAvatar(seed: string): Avatar {
  return pickFrom(rng(hash32(seed)));
}

/** 🎲 랜덤 — 귀여운 쪽으로만 섞는다. */
export function randomAvatar(): Avatar {
  return pickFrom(Math.random);
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
