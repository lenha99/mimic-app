import type { Lang } from "./i18n";

/**
 * 보이스 카드 — "내 목소리, 사극에선 무슨 역?"
 *
 * 브라우저가 실제로 잴 수 있는 네 가지만 쓴다: 평균 음높이, 억양 폭, 말 속도, 말끝 힘.
 * 축마다 둘로 나눠 16역. 역 이름은 장난이지만 이유는 내 녹음 숫자에서 나온다 —
 * "왕형"인 이유가 "억양 폭 3.1반음, 말끝까지 힘이 살아 있어서"여야 랜덤처럼 안 보인다.
 * "목소리 좋음 상위 3%" 같은 잴 수 없는 말은 하지 않는다.
 */

export type Gender = "m" | "f" | "x";

/** 네 축 — 0 이면 앞쪽(낮음·평탄·느긋·또렷), 1 이면 뒤쪽(높음·출렁·빠름·흐림). */
export type Axes = [0 | 1, 0 | 1, 0 | 1, 0 | 1];

export type Measure = {
  hz: number;
  /** 억양 폭(반음) */
  st: number;
  /** 초당 음절 — 못 재면 null */
  pace: number | null;
  /** 말끝 음량 변화(dB, 음수일수록 흐림) — 못 재면 null */
  end: number | null;
  gender: Gender;
  lang: Lang;
};

/** 음높이 경계 — 같은 성별 안에서 낮은 편/높은 편. 모르면 남녀 사이 값. */
const PITCH_CUT: Record<Gender, number> = { m: 125, f: 205, x: 165 };
/** 사극 문장은 원래 억양이 출렁인다 — 경계를 평소 말투보다 높게 둔다. */
const RANGE_CUT = 8;
const PACE_CUT: Record<Lang, number> = { ko: 5.0, en: 3.9 };
const END_CUT = -6;

/** 경계에서 이만큼 안쪽이면 "살짝" — 다시 하면 바뀔 수 있는 축. */
const MARGIN = { hz: 0.07, st: 1.2, pace: 0.35, end: 1.5 };

export function axesOf(m: Measure): Axes {
  return [
    m.hz >= PITCH_CUT[m.gender] ? 1 : 0,
    m.st >= RANGE_CUT ? 1 : 0,
    (m.pace ?? 0) >= PACE_CUT[m.lang] ? 1 : 0,
    (m.end ?? 0) <= END_CUT ? 1 : 0,
  ];
}

/** 경계에 가장 가깝게 걸린 축 하나 — 그 축을 뒤집은 역이 "살짝 기질". 없으면 null. */
export function borderAxis(m: Measure): number | null {
  const d = [
    Math.abs(m.hz / PITCH_CUT[m.gender] - 1) / MARGIN.hz,
    Math.abs(m.st - RANGE_CUT) / MARGIN.st,
    m.pace === null ? Infinity : Math.abs(m.pace - PACE_CUT[m.lang]) / MARGIN.pace,
    m.end === null ? Infinity : Math.abs(m.end - END_CUT) / MARGIN.end,
  ];
  const i = d.indexOf(Math.min(...d));
  return d[i] < 1 ? i : null;
}

export type RoleKey =
  | "king" | "sage" | "general" | "reaper" | "lord" | "mystic" | "executioner" | "bandit"
  | "eunuch" | "courtlady" | "clerk" | "schemer" | "queen" | "bard" | "jester" | "goblin";

/** 축 네 개를 이진수로 — [음높이, 억양, 속도, 말끝] */
const BY_AXES: RoleKey[] = [
  "king", "sage", "general", "reaper",
  "lord", "mystic", "executioner", "bandit",
  "eunuch", "courtlady", "clerk", "schemer",
  "queen", "bard", "jester", "goblin",
];

export function roleOf(a: Axes): RoleKey {
  return BY_AXES[a[0] * 8 + a[1] * 4 + a[2] * 2 + a[3]];
}

export type Role = {
  /** 도장에 찍히는 한 글자 */
  seal: string;
  ko: string;
  en: string;
  whyKo: string;
  whyEn: string;
  lineKo: string;
  lineEn: string;
  /** 같이 있으면 찰떡 */
  best: RoleKey;
  /** 만나면 싸움 */
  rival: RoleKey;
};

export const ROLES: Record<RoleKey, Role> = {
  king: {
    seal: "王", ko: "왕", en: "The King",
    whyKo: "크게 말할 필요가 없어요. 낮게, 천천히, 말끝을 내리찍으면 다들 알아서 듣거든요.",
    whyEn: "You never need to raise your voice. Low, slow, and a final word that lands — people just listen.",
    lineKo: "과인의 뜻이 그러하다.", lineEn: "So it is decreed.",
    best: "eunuch", rival: "schemer",
  },
  sage: {
    seal: "仙", ko: "산신령", en: "The Mountain Sage",
    whyKo: "낮고 고른데 말끝이 안개처럼 남아요. 무슨 말을 해도 계시처럼 들려요.",
    whyEn: "Low and even, with endings that drift like mist. Everything you say sounds like a prophecy.",
    lineKo: "이 금도끼가 네 도끼냐?", lineEn: "Is this golden axe yours?",
    best: "reaper", rival: "jester",
  },
  general: {
    seal: "將", ko: "장군", en: "The General",
    whyKo: "감정은 빼고, 빠르고, 단호해요. 질문을 해도 명령처럼 들려요.",
    whyEn: "No fluff, fast and firm. Even your questions sound like orders.",
    lineKo: "진격하라! 물러서지 마라!", lineEn: "Charge! Hold the line!",
    best: "clerk", rival: "bandit",
  },
  reaper: {
    seal: "冥", ko: "저승사자", en: "The Grim Reaper",
    whyKo: "낮고 담담하게, 사무적으로 빠르게. 듣는 사람 등골이 살짝 서늘해져요.",
    whyEn: "Low, flat and businesslike. Listeners feel a little chill down the spine.",
    lineKo: "이제 가실 시간입니다.", lineEn: "It's time to go.",
    best: "sage", rival: "goblin",
  },
  lord: {
    seal: "監", ko: "대감마님", en: "The Old Minister",
    whyKo: "낮은데 굴곡이 커요. 한 마디마다 뜸을 들여서 무게를 싣는 타입이에요.",
    whyEn: "Low but full of curves. You pause before every word to give it weight.",
    lineKo: "어허, 이놈이 감히!", lineEn: "How dare you!",
    best: "schemer", rival: "clerk",
  },
  mystic: {
    seal: "道", ko: "도사", en: "The Mystic",
    whyKo: "오르내리며 뜸을 들이다 말끝을 흐려요. 다 아는 것 같은데 진짜 아는지는 아무도 몰라요.",
    whyEn: "Rising, falling, pausing, then trailing off. You sound all-knowing. Nobody can tell if you are.",
    lineKo: "허허, 다 때가 있는 법이지.", lineEn: "Everything happens in its own time.",
    best: "goblin", rival: "bard",
  },
  executioner: {
    seal: "斬", ko: "망나니", en: "The Executioner",
    whyKo: "낮고 거칠게 출렁이며 몰아쳐요. 칼춤 추기 직전의 텐션이에요.",
    whyEn: "Low, wild and relentless. Pure about-to-swing-the-blade energy.",
    lineKo: "칼 받아라!", lineEn: "Bring me the blade!",
    best: "bandit", rival: "eunuch",
  },
  bandit: {
    seal: "賊", ko: "산적 두목", en: "The Bandit Chief",
    whyKo: "기세는 대단한데 말끝이 풀려요. 호탕한데 어딘가 허술한 매력이 있어요.",
    whyEn: "All swagger until the end of the sentence. Big energy, lovably sloppy.",
    lineKo: "가진 거 다 내놓고 가라!", lineEn: "Hand over everything you've got!",
    best: "executioner", rival: "general",
  },
  eunuch: {
    seal: "侍", ko: "내시", en: "The Royal Attendant",
    whyKo: "높고 고르게, 천천히, 끝까지 공손하게. 윗분 심기를 절대 건드리지 않는 목소리예요.",
    whyEn: "High, even, unhurried and polite to the last syllable. You never upset the boss.",
    lineKo: "전하, 수라를 드시옵소서.", lineEn: "Your Majesty, dinner is served.",
    best: "king", rival: "executioner",
  },
  courtlady: {
    seal: "宮", ko: "상궁", en: "The Palace Gossip",
    whyKo: "조용하고 고르게 말하다 말끝을 삼켜요. 궁 안의 소문은 다 알고 있는 목소리예요.",
    whyEn: "Quiet and even, swallowing your endings. You know every secret in the palace.",
    lineKo: "마마, 이 일은 아무도 몰라야 하옵니다.", lineEn: "My lady, no one must ever know.",
    best: "queen", rival: "lord",
  },
  clerk: {
    seal: "吏", ko: "이방", en: "The Clerk",
    whyKo: "빠르고 또박또박, 감정은 빼고 용건만. 보고 체질이에요.",
    whyEn: "Fast, crisp, all business. Born to give reports.",
    lineKo: "사또, 보고 올리겠습니다!", lineEn: "Sir, my report is ready!",
    best: "general", rival: "lord",
  },
  schemer: {
    seal: "奸", ko: "간신", en: "The Schemer",
    whyKo: "높고 빠르게 속삭이다 말끝을 흐려요. 귓속말에 최적화된 목소리예요.",
    whyEn: "High and quick, trailing off at the end. A voice built for whispering in ears.",
    lineKo: "전하, 통촉하여 주시옵소서…", lineEn: "Your Majesty, perhaps reconsider…",
    best: "lord", rival: "king",
  },
  queen: {
    seal: "妃", ko: "대비마마", en: "The Queen Mother",
    whyKo: "높은데 굴곡이 크고 느려요. 마지막 한 마디로 판을 정리하는 타입이에요.",
    whyEn: "High, sweeping and slow. Your last word ends every argument.",
    lineKo: "주상, 이 어미의 말을 들으세요.", lineEn: "Listen to your mother, my son.",
    best: "courtlady", rival: "schemer",
  },
  bard: {
    seal: "唱", ko: "소리꾼", en: "The Bard",
    whyKo: "오르내림이 노래 같아요. 말을 하는데 가락이 붙어요.",
    whyEn: "Your rises and falls sound like a song. You speak with a melody.",
    lineKo: "얼씨구, 좋다!", lineEn: "Now that's the spirit!",
    best: "jester", rival: "mystic",
  },
  jester: {
    seal: "笑", ko: "삐에로", en: "The Jester",
    whyKo: "높고 빠르고 출렁여요. 3초 만에 분위기를 뒤집는 목소리예요.",
    whyEn: "High, fast and bouncy. You can flip the mood of a room in three seconds.",
    lineKo: "자, 다들 웃을 준비 됐지?", lineEn: "Alright, who's ready to laugh?",
    best: "bard", rival: "sage",
  },
  goblin: {
    seal: "鬼", ko: "도깨비", en: "The Goblin",
    whyKo: "들떴다 가라앉았다 종잡을 수가 없어요. 장난인지 진심인지 아무도 몰라요.",
    whyEn: "Up, down, impossible to pin down. Nobody knows if you're joking.",
    lineKo: "금 나와라, 뚝딱!", lineEn: "Gold, appear! Poof!",
    best: "mystic", rival: "reaper",
  },
};

export const SEALS = Object.values(ROLES)
  .map((r) => r.seal)
  .join("");

/** 도장 한자 16자만 잘라 받는 서체 — 몇 KB. */
export const SEAL_FONT_CSS = `https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@900&text=${encodeURIComponent(SEALS)}&display=swap`;

export function isRole(v: unknown): v is RoleKey {
  return typeof v === "string" && v in ROLES;
}

/** 축 이름 — [앞쪽, 뒤쪽] × [ko, en] */
export const AXES: { ko: [string, string]; en: [string, string] }[] = [
  { ko: ["저음", "고음"], en: ["Low", "High"] },
  { ko: ["평탄", "출렁"], en: ["Flat", "Swingy"] },
  { ko: ["느긋", "빠름"], en: ["Slow", "Fast"] },
  { ko: ["또렷", "흐림"], en: ["Firm", "Fading"] },
];

/**
 * 축마다 0~1 위치 — 카드의 슬라이더. 경계가 가운데(0.5)에 오게 펼친다.
 * 끝으로 갈수록 그 성향이 세다는 뜻이고, 숫자는 옆에 그대로 적는다.
 */
export function sliders(m: Measure): (number | null)[] {
  const clamp = (v: number) => Math.max(0.04, Math.min(0.96, v));
  const cut = PITCH_CUT[m.gender];
  return [
    clamp(0.5 + Math.log2(m.hz / cut) * 1.6),
    clamp(0.5 + (m.st - RANGE_CUT) / 10),
    m.pace === null ? null : clamp(0.5 + (m.pace - PACE_CUT[m.lang]) / 3),
    m.end === null ? null : clamp(0.5 - (m.end - END_CUT) / 10),
  ];
}

/** 근거 한 줄씩 — 숫자와 그 숫자가 뜻하는 것. */
export function evidence(m: Measure, lang: Lang): string[] {
  const a = axesOf(m);
  const en = lang === "en";
  const g = m.gender === "x" ? "" : en ? " for your voice group" : " 같은 성별 평균보다";
  const out = [
    en
      ? `Avg pitch ${Math.round(m.hz)}Hz — ${a[0] ? "on the high side" : "on the low side"}${g}`
      : `평균 음높이 ${Math.round(m.hz)}Hz —${g} ${a[0] ? "높은 편" : "낮은 편"}`,
    en
      ? `Pitch range ${m.st.toFixed(1)} semitones — ${a[1] ? "big rises and falls" : "keeps emotions in check"}`
      : `억양 폭 ${m.st.toFixed(1)}반음 — ${a[1] ? "오르내림이 커요" : "감정을 잘 안 드러내요"}`,
  ];
  if (m.pace !== null) {
    out.push(
      en
        ? `${m.pace.toFixed(1)} syllables/sec — ${a[2] ? "you push the pace" : "you take your time"}`
        : `초당 ${m.pace.toFixed(1)}음절 — ${a[2] ? "몰아치는 편" : "느긋한 편"}`,
    );
  }
  if (m.end !== null) {
    out.push(
      en
        ? `Sentence endings ${m.end.toFixed(1)}dB — ${a[3] ? "you let them fade" : "strong to the last word"}`
        : `말끝 ${m.end.toFixed(1)}dB — ${a[3] ? "끝을 흘리는 편" : "끝까지 힘이 살아 있어요"}`,
    );
  }
  return out;
}

/** 읽을 문장 — 사극 한 줄이라 읽는 것부터 재밌다. 음절 수를 알아야 속도를 잰다(영어는 직접 센 값). */
export const READ_LINE: Record<Lang, { text: string; syllables: number }> = {
  ko: {
    text: "게 아무도 없느냐! 오늘 밤 궁에 수상한 자가 들었다 하니, 문을 모두 걸어 잠그고 날이 밝을 때까지 아무도 들이지 마라.",
    syllables: 0, // 아래에서 센다
  },
  en: {
    text: "Is anyone out there? A stranger slipped into the palace tonight, so lock every gate and let no one in until sunrise!",
    syllables: 31,
  },
};
READ_LINE.ko.syllables = (READ_LINE.ko.text.match(/[가-힣]/g) ?? []).length;

/* --- 공유 링크 ------------------------------------------------------------ */

/** 링크에 담는 값. 숫자는 정수로(억양 폭·속도·말끝은 ×10). 역은 숫자에서 다시 계산한다. */
export type CardData = Measure & { avatar: string };

export function cardQuery(c: CardData): string {
  const q = new URLSearchParams({
    hz: String(Math.round(c.hz)),
    st: String(Math.round(c.st * 10)),
    g: c.gender,
    l: c.lang,
  });
  if (c.pace !== null) q.set("p", String(Math.round(c.pace * 10)));
  if (c.end !== null) q.set("e", String(Math.round(c.end * 10)));
  if (c.avatar) q.set("a", c.avatar);
  return q.toString();
}

function num(v: string | null, lo: number, hi: number): number | null {
  if (v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= lo && n <= hi ? n : null;
}

/** 링크에서 카드 값을 되읽는다. 범위를 벗어난 값은 버린다. */
export function readCard(q: URLSearchParams): CardData | null {
  const hz = num(q.get("hz"), 50, 500);
  const st = num(q.get("st"), 0, 400);
  if (hz === null || st === null) return null;
  const p = num(q.get("p"), 5, 150);
  const e = num(q.get("e"), -400, 200);
  const g = q.get("g");
  return {
    hz,
    st: st / 10,
    pace: p === null ? null : p / 10,
    end: e === null ? null : e / 10,
    gender: g === "m" || g === "f" ? g : "x",
    lang: q.get("l") === "en" ? "en" : "ko",
    avatar: (q.get("a") ?? "").slice(0, 120),
  };
}

/** 카드 하나에서 화면에 필요한 걸 다 꺼낸다. */
export function verdict(m: Measure) {
  const axes = axesOf(m);
  const key = roleOf(axes);
  const b = borderAxis(m);
  let lean: RoleKey | null = null;
  if (b !== null) {
    const flipped = [...axes] as Axes;
    flipped[b] = flipped[b] ? 0 : 1;
    lean = roleOf(flipped);
  }
  return { key, role: ROLES[key], axes, lean };
}
