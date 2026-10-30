import type { Lang } from "./i18n";

/**
 * 목소리 음역대 — "내 목소리는 몇 옥타브?"
 *
 * 세 가지를 잰다: 평소 말하는 음(1부터 10까지 세기), 낼 수 있는 가장 낮은 음, 가장 높은 음.
 * 전부 실제로 잰 음이라 "랜덤이네"가 나올 틈이 없다. 숫자는 피아노 건반 위치(MIDI 번호)로 다룬다.
 *
 * 처음엔 사극 배역 16역을 붙였다가 접었다 — 측정값 넷을 지어낸 규칙으로 이름에 이은 것이라
 * 다시 하면 바뀌고, 해외에선 사극을 모른다. 건반·옥타브·악기는 어디서나 통한다.
 */

export type Gender = "m" | "f" | "x";

export type RangeCard = {
  /** 평소 말하는 음(MIDI, 소수 한 자리) */
  speak: number | null;
  /** 말할 때 오르내리는 폭(반음) */
  spread: number | null;
  /** 낼 수 있는 가장 낮은 음(MIDI 정수) */
  low: number | null;
  /** 낼 수 있는 가장 높은 음(MIDI 정수) */
  high: number | null;
  gender: Gender;
  lang: Lang;
  avatar: string;
};

/* --- 음 이름 ------------------------------------------------------------- */

export const hzToMidi = (hz: number) => 69 + 12 * Math.log2(hz / 440);
export const midiToHz = (m: number) => 440 * 2 ** ((m - 69) / 12);

const KO_NAMES = ["도", "도#", "레", "레#", "미", "파", "파#", "솔", "솔#", "라", "라#", "시"];
const EN_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/**
 * 음 이름. 한국어는 노래방에서 쓰는 표기 — 440Hz 라가 "2옥타브 라", 가운데 도(C4)가 "2옥타브 도".
 * 영어는 국제 표기(A4). 둘 다 사람들이 고음 자랑할 때 실제로 쓰는 말이다.
 */
export function noteName(midi: number, lang: Lang): { note: string; octave: string; full: string } {
  const m = Math.round(midi);
  const pc = ((m % 12) + 12) % 12;
  const o = Math.floor(m / 12) - 1;
  if (lang === "en") {
    // 영어권은 "A4" 한 덩어리로 읽는다 — 옥타브 숫자를 따로 떼면 뭔지 모른다.
    const full = `${EN_NAMES[pc]}${o}`;
    return { note: full, octave: "", full };
  }
  const note = KO_NAMES[pc];
  const octave = `${o - 2}옥타브`;
  return { note, octave, full: `${octave} ${note}` };
}

/** 피아노 88건반 중 몇 번째(왼쪽 맨 끝 라가 1번). */
export const pianoKey = (midi: number) => Math.round(midi) - 20;

/** 낮은 음~높은 음이 몇 옥타브인지 — 소수 한 자리. */
export const octaves = (low: number, high: number) => Math.round(((high - low) / 12) * 10) / 10;

/* --- 같은 성별 안에서 어디쯤 -------------------------------------------------- */

/**
 * 성인이 편하게 말할 때의 평균 음높이. 남 약 120Hz, 여 약 210Hz 로 음성학 교재에 흔히 실리는 값이고,
 * 사람마다 흩어진 정도는 2.5반음쯤이다. 예시 음성으로 잰 값(남 135·여 224Hz)은 연기 톤이라 더 높았다.
 * 실제 사용자 값은 voice_card_done 이벤트에 쌓이니 그걸로 다시 맞춘다.
 */
const NORM: Record<"m" | "f", { mean: number; sd: number }> = {
  m: { mean: hzToMidi(120), sd: 2.5 },
  f: { mean: hzToMidi(210), sd: 2.5 },
};

/** 같은 성별 100명 중 낮은 쪽에서 몇 번째인지(1~99). 성별을 안 골랐으면 null. */
export function lowRank(speak: number, gender: Gender): number | null {
  if (gender === "x") return null;
  const { mean, sd } = NORM[gender];
  const p = normCdf((speak - mean) / sd);
  return Math.min(99, Math.max(1, Math.round(p * 100)));
}

function normCdf(z: number) {
  // Abramowitz–Stegun 근사. 백분위 표시엔 차고 넘친다.
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

/* --- 등급 — 옥타브는 몰라도 "돌고래 고음", "동굴 목소리"는 다 안다 ---------------------- */

export type Tier = { emoji: string; ko: string; en: string };
type Ladder = { at: Record<Gender, number>; tier: Tier }[];

/**
 * 고음 등급 — 아래에서 위로. at 은 그 등급이 시작하는 음(MIDI).
 * 남자 기준선은 노래방 문화에서 쓰는 말 그대로다: 2옥타브 라(A4)가 "고음 잘한다"의 상징, 3옥타브 미(E5)부터 돌고래.
 * 여자는 같은 느낌이 나는 자리로 올렸다(3옥타브 도가 여자 고음 기준선). 성별을 안 고르면 남자 기준.
 */
const HIGH_LADDER: Ladder = [
  { at: { m: -Infinity, f: -Infinity, x: -Infinity }, tier: { emoji: "🚿", ko: "샤워실 가수", en: "Shower Singer" } },
  { at: { m: 64, f: 67, x: 64 }, tier: { emoji: "🎤", ko: "노래방 평균", en: "Karaoke Regular" } },
  { at: { m: 69, f: 72, x: 69 }, tier: { emoji: "🔥", ko: "노래방 에이스", en: "Karaoke Ace" } },
  { at: { m: 72, f: 76, x: 72 }, tier: { emoji: "🎸", ko: "락 보컬", en: "Rock Vocalist" } },
  { at: { m: 76, f: 81, x: 76 }, tier: { emoji: "🐬", ko: "돌고래", en: "Dolphin" } },
];

/** 저음 등급 — 위에서 아래로. at 은 그 음 이하면 그 등급(MIDI). 한국 밈 "동굴 목소리"가 가운데다. */
const LOW_LADDER: Ladder = [
  { at: { m: Infinity, f: Infinity, x: Infinity }, tier: { emoji: "🙂", ko: "담백한 저음", en: "Easygoing Low" } },
  { at: { m: 49, f: 56, x: 49 }, tier: { emoji: "📻", ko: "라디오 DJ", en: "Radio DJ" } },
  { at: { m: 44, f: 51, x: 44 }, tier: { emoji: "🕳️", ko: "동굴 목소리", en: "Cave Voice" } },
  { at: { m: 39, f: 46, x: 39 }, tier: { emoji: "🌊", ko: "심해 목소리", en: "Deep-Sea Voice" } },
  { at: { m: 35, f: 42, x: 35 }, tier: { emoji: "🪨", ko: "지하 암반수", en: "Bedrock Bass" } },
];

export type TierInfo = {
  index: number;
  tier: Tier;
  /** 등급 수 */
  count: number;
  /** 다음 등급과 거기까지 남은 반음. 꼭대기(바닥)면 null */
  next: { tier: Tier; keys: number } | null;
};

export function tierOf(mode: "low" | "high", midi: number, gender: Gender): TierInfo {
  const ladder = mode === "high" ? HIGH_LADDER : LOW_LADDER;
  const m = Math.round(midi);
  let index = 0;
  for (let i = 0; i < ladder.length; i += 1) {
    const at = ladder[i].at[gender];
    if (mode === "high" ? m >= at : m <= at) index = i;
  }
  const nx = ladder[index + 1];
  const next = nx ? { tier: nx.tier, keys: Math.abs(nx.at[gender] - m) } : null;
  return { index, tier: ladder[index].tier, count: ladder.length, next };
}

/** 사다리 전체 — 재는 화면에 깔아 두고 올라가는(내려가는) 게 보이게 한다. */
export function ladder(mode: "low" | "high", gender: Gender): { tier: Tier; at: number }[] {
  return (mode === "high" ? HIGH_LADDER : LOW_LADDER).map((x) => ({ tier: x.tier, at: x.at[gender] }));
}

export const tierLabel = (t: Tier, lang: Lang) => `${t.emoji} ${lang === "en" ? t.en : t.ko}`;

/** 보통 사람이 내는 음역(옥타브). 훈련 안 한 성인은 대개 1.5~2옥타브. */
export const TYPICAL_OCTAVES: [number, number] = [1.5, 2];

/* --- 악기 ----------------------------------------------------------------- */

export type Instrument = {
  key: string;
  emoji: string;
  ko: string;
  en: string;
  whyKo: string;
  whyEn: string;
};

/**
 * 평소 말하는 음이 그 악기가 주로 연주하는 음역 안에 드는 것 중에서 고른다.
 * 남자 말소리(대략 라2~파3)와 여자 말소리(대략 솔3~도4)가 각각 너덧 악기로 갈리게 반음 둘씩 끊었다.
 * 설명은 다 좋은 말이다 — 평범한 목소리도 "오 나 첼로래" 하고 올릴 수 있어야 한다.
 */
const INSTRUMENTS: [number, Instrument][] = [
  [45, {
    key: "tuba", emoji: "🎺", ko: "튜바", en: "Tuba",
    whyKo: "오케스트라 맨 뒤에서 전체를 받쳐 주는 소리. 낮게 깔리는데 듬직해요.",
    whyEn: "The sound holding up the whole orchestra from the back row. Low, steady, reliable.",
  }],
  [47, {
    key: "bassoon", emoji: "🪈", ko: "바순", en: "Bassoon",
    whyKo: "낮고 부드러운데 은근 유머가 있는 소리. ‘피터와 늑대’에서 할아버지 역이에요.",
    whyEn: "Low and soft with a quiet sense of humor. It plays the grandfather in Peter and the Wolf.",
  }],
  [49, {
    key: "cello", emoji: "🎻", ko: "첼로", en: "Cello",
    whyKo: "사람 목소리를 가장 닮았다는 악기. 낮고 따뜻하게 울려요.",
    whyEn: "Said to be the instrument closest to the human voice. Low and warm.",
  }],
  [51, {
    key: "trombone", emoji: "🎺", ko: "트롬본", en: "Trombone",
    whyKo: "시원하게 뻗는 중저음. 한마디 하면 방 안이 꽉 차요.",
    whyEn: "A big, open low-mid sound. One sentence and the room is full.",
  }],
  [53, {
    key: "horn", emoji: "📯", ko: "호른", en: "French horn",
    whyKo: "부드럽게 감싸는 소리. 영화 음악 감동 장면마다 나와요.",
    whyEn: "A round, warm sound that wraps around you. It's in every big movie moment.",
  }],
  [55, {
    key: "sax", emoji: "🎷", ko: "알토 색소폰", en: "Alto sax",
    whyKo: "말랑하고 감성적인 소리. 밤에 듣기 좋은 목소리예요.",
    whyEn: "Smooth and soulful. A voice made for late nights.",
  }],
  [57, {
    key: "viola", emoji: "🎻", ko: "비올라", en: "Viola",
    whyKo: "바이올린보다 낮고 차분한 소리. 듣는 사람을 편하게 해요.",
    whyEn: "Calmer and deeper than a violin. It puts people at ease.",
  }],
  [59, {
    key: "clarinet", emoji: "🎶", ko: "클라리넷", en: "Clarinet",
    whyKo: "맑고 동글동글한 소리. 어떤 노래에도 잘 섞여요.",
    whyEn: "Clear and round. Blends into any song.",
  }],
  [Infinity, {
    key: "violin", emoji: "🎻", ko: "바이올린", en: "Violin",
    whyKo: "높고 또렷하게 노래하는 소리. 멀리서도 귀에 꽂혀요.",
    whyEn: "Bright and singing. You can pick it out from across the room.",
  }],
];

export function instrumentOf(speak: number): Instrument {
  const m = Math.round(speak);
  return INSTRUMENTS.find(([top]) => m <= top)![1];
}

export const INSTRUMENT_LIST = INSTRUMENTS.map(([, i]) => i);

/* --- 공유 링크 ------------------------------------------------------------ */

/** 링크에 담는 값 — 말하는 음·폭은 ×10 정수, 최저·최고는 MIDI 정수. */
export function cardQuery(c: RangeCard): string {
  const q = new URLSearchParams();
  if (c.speak !== null) q.set("s", String(Math.round(c.speak * 10)));
  if (c.spread !== null) q.set("w", String(Math.round(c.spread * 10)));
  if (c.low !== null) q.set("lo", String(c.low));
  if (c.high !== null) q.set("hi", String(c.high));
  q.set("g", c.gender);
  q.set("l", c.lang);
  if (c.avatar) q.set("a", c.avatar);
  return q.toString();
}

function num(v: string | null, lo: number, hi: number): number | null {
  if (v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= lo && n <= hi ? n : null;
}

/** 사람 목소리로 낼 수 있는 범위(MIDI 24~96, 대략 33Hz~2kHz) 밖의 값은 버린다. */
export function readCard(q: URLSearchParams): RangeCard | null {
  const s = num(q.get("s"), 240, 960);
  const low = num(q.get("lo"), 24, 96);
  const high = num(q.get("hi"), 24, 96);
  if (s === null && (low === null || high === null)) return null;
  const w = num(q.get("w"), 0, 360);
  const g = q.get("g");
  return {
    speak: s === null ? null : s / 10,
    spread: w === null ? null : w / 10,
    low: low === null ? null : Math.round(low),
    high: high === null ? null : Math.round(high),
    gender: g === "m" || g === "f" ? g : "x",
    lang: q.get("l") === "en" ? "en" : "ko",
    avatar: (q.get("a") ?? "").slice(0, 120),
  };
}

/** 최저·최고가 둘 다 있고 순서가 맞아야 음역이다. */
export function hasRange(c: RangeCard): c is RangeCard & { low: number; high: number } {
  return c.low !== null && c.high !== null && c.high > c.low;
}

/* --- 결과 문구 — 화면 카드와 공유 이미지가 같은 말을 한다 ------------------------- */

export function summary(c: RangeCard, lang: Lang) {
  const en = lang === "en";
  const t = (ko: string, e: string) => (en ? e : ko);
  const name = (m: number) => noteName(m, lang).full;
  const tn = (x: Tier) => (en ? x.en : x.ko);
  const range = hasRange(c) ? octaves(c.low!, c.high!) : null;
  const high = c.high !== null ? tierOf("high", c.high, c.gender) : null;
  const low = c.low !== null ? tierOf("low", c.low, c.gender) : null;

  // 제목은 등급이다 — "2.3옥타브"는 노래하는 사람만 안다. 고음 등급이 제일 자랑하고 싶은 말이다.
  const main = high ? { info: high, kind: "high" as const } : low ? { info: low, kind: "low" as const } : null;
  const headline = main ? tn(main.info.tier) : c.speak !== null ? name(c.speak) : "?";
  const emoji = main ? main.info.tier.emoji : "";
  const lead = main
    ? main.kind === "high"
      ? t("내 고음 등급", "My high-note tier")
      : t("내 저음 등급", "My low-note tier")
    : t("평소 내 목소리 음", "My speaking note");
  const sub = main
    ? main.kind === "high"
      ? t(`최고음 ${name(c.high!)}`, `Highest note ${name(c.high!)}`)
      : t(`최저음 ${name(c.low!)}`, `Lowest note ${name(c.low!)}`)
    : c.speak !== null
      ? t(`피아노 ${pianoKey(c.speak)}번째 건반`, `Piano key #${pianoKey(c.speak)}`)
      : "";

  const facts: string[] = [];
  if (high && low) facts.push(t(`저음 등급: ${tn(low.tier)} (${name(c.low!)})`, `Low tier: ${tn(low.tier)} (${name(c.low!)})`));
  if (main?.info.next) {
    const n = main.info.next;
    facts.push(t(`다음 등급 ${tn(n.tier)}까지 ${n.keys}칸`, `${n.keys} key${n.keys > 1 ? "s" : ""} to the next tier: ${tn(n.tier)}`));
  } else if (main) {
    facts.push(t("맨 끝 등급 달성!", "Top tier reached!"));
  }
  if (range !== null) {
    const keys = c.high! - c.low! + 1;
    const [a, b] = TYPICAL_OCTAVES;
    facts.push(
      t(
        `음역 ${range}옥타브 · 피아노 건반 ${keys}개 (보통 사람 ${a}~${b}옥타브)`,
        `Range ${range} octaves · ${keys} piano keys (most people: ${a}–${b})`,
      ),
    );
  }
  if (c.speak !== null) {
    const r = lowRank(c.speak, c.gender);
    if (r !== null) {
      facts.push(t(`평소 목소리: 같은 성별 100명 중 ${r}번째로 낮음`, `Speaking voice: #${r} lowest out of 100 ${c.gender === "m" ? "men" : "women"}`));
    }
  }
  const instrument = c.speak !== null ? instrumentOf(c.speak) : null;
  return { headline, emoji, lead, sub, facts, instrument, range, high, low };
}
