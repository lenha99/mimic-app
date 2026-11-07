import type { Analysis } from "./voice-analysis";

/**
 * 애니 명대사 — "잘하면 멋지고 못해도 웃긴" 기합 대사.
 *
 * 채점은 두 가지다.
 *  1) 원본 비교 — 사람이 픽커로 고른 원본 구간이 `anime_<id>` 로 올라가 있으면(draft 라
 *     밈 목록엔 안 뜬다) 서버가 원본과 견준다(modal_app._score profile="anime": 억양 모양·
 *     끊어 외친 박자 중심, 음절 덩어리 수가 안 맞으면 상한). 원본처럼 해야 점수가 나온다.
 *  2) 원본이 아직 없으면 브라우저 "기합 점수" — 대사가 요구하는 것(성량·억양 폭·길이·끝·
 *     덩어리 수)과 견준다. 닮음은 못 재니 최대 89점(ESTIMATE_CAP). 오프라인 대결도 이쪽.
 *
 * say: 원어 발음을 한글로 (따라 하는 사람 대부분이 원어로 외친다). ko: 뜻 / 더빙 대사.
 */
export type AnimeStyle = "shout" | "cool" | "evil" | "cute" | "tense";

export type AnimeLine = {
  id: string;
  series: string;
  seriesEn: string;
  who: string;
  whoEn: string;
  say: string;
  ko: string;
  en: string;
  emoji: string;
  style: AnimeStyle;
  /** 외치는 길이(초) 적당한 범위 */
  span: [number, number];
  /** 원본이 끊어 외치는 덩어리 수(대략). 원본 음성이 없을 때 "아아악" 한 덩어리를 거른다 */
  beats: number;
  tip: string;
  tipEn: string;
  /** 카드 색 */
  hue: number;
};

export const ANIME_LINES: AnimeLine[] = [
  {
    id: "sasageyo",
    series: "진격의 거인",
    seriesEn: "Attack on Titan",
    who: "엘빈 단장",
    whoEn: "Commander Erwin",
    say: "신조오 사사게요!",
    ko: "심장을 바쳐라!",
    en: "Dedicate your hearts!",
    emoji: "🫀",
    style: "shout",
    span: [1.2, 3],
    beats: 5,
    tip: "주먹을 가슴에 쾅. 마지막 '요'를 하늘까지 끌어올려요",
    tipEn: "Fist to chest. Drag the last syllable to the sky",
    hue: 12,
  },
  {
    id: "kaizokuou",
    series: "원피스",
    seriesEn: "One Piece",
    who: "루피",
    whoEn: "Luffy",
    say: "카이조쿠오니 오레와 나루!",
    ko: "해적왕이 될 거야!",
    en: "I'm gonna be King of the Pirates!",
    emoji: "🏴‍☠️",
    style: "shout",
    span: [1.8, 3.8],
    beats: 8,
    tip: "밀짚모자 꾹 누르고, 해맑게 끝까지 소리 질러요",
    tipEn: "Hold your hat, shout it with a huge grin",
    hue: 350,
  },
  {
    id: "ryoiki",
    series: "주술회전",
    seriesEn: "Jujutsu Kaisen",
    who: "고죠 사토루",
    whoEn: "Gojo Satoru",
    say: "료이키 텐카이… 무료오쿠쇼.",
    ko: "영역전개… 무량공처.",
    en: "Domain Expansion… Infinite Void.",
    emoji: "🫴",
    style: "cool",
    span: [2, 4.8],
    beats: 7,
    tip: "소리 지르면 진다. 여유롭게, 낮게, 쉼 한 번",
    tipEn: "Don't shout. Calm, low, one pause",
    hue: 220,
  },
  {
    id: "mizunokokyu",
    series: "귀멸의 칼날",
    seriesEn: "Demon Slayer",
    who: "탄지로",
    whoEn: "Tanjiro",
    say: "미즈노 코큐, 이치노카타! 미나모기리!",
    ko: "물의 호흡 제1형! 수면 베기!",
    en: "Water Breathing, First Form! Water Surface Slash!",
    emoji: "🌊",
    style: "shout",
    span: [2.4, 5],
    beats: 10,
    tip: "숨 크게 한 번 들이쉬고, 기술 이름에서 칼을 휘둘러요",
    tipEn: "Big breath in, swing the blade on the move name",
    hue: 190,
  },
  {
    id: "keikaku",
    series: "데스노트",
    seriesEn: "Death Note",
    who: "라이토",
    whoEn: "Light",
    say: "케이카쿠 도오리…",
    ko: "계획대로…",
    en: "Just as planned…",
    emoji: "📓",
    style: "evil",
    span: [1, 2.8],
    beats: 5,
    tip: "작게, 음흉하게, 입꼬리 올리고 속삭여요",
    tipEn: "Quiet, sinister, whisper with a smirk",
    hue: 0,
  },
  {
    id: "nigecha",
    series: "에반게리온",
    seriesEn: "Evangelion",
    who: "신지",
    whoEn: "Shinji",
    say: "니게차 다메다, 니게차 다메다…!",
    ko: "도망치면 안 돼, 도망치면 안 돼…!",
    en: "I mustn't run away, I mustn't run away…!",
    emoji: "🤖",
    style: "tense",
    span: [2.2, 5],
    beats: 8,
    tip: "떨리는 목소리로 시작해서 두 번째에 각오를 담아요",
    tipEn: "Start shaky, find your resolve on the second",
    hue: 270,
  },
];

export const animeLine = (id: string) => ANIME_LINES.find((l) => l.id === id);

export type HypeScore = {
  total: number;
  power: number;
  range: number;
  timing: number;
  ending: number;
  tier: { ko: string; en: string; note: string; noteEn: string };
  badges: { ko: string; en: string }[];
  silent: boolean;
  /** 화면 막대 [한국어, 영어, 0~100] */
  bars: [string, string, number][];
  /** true 면 원본 없이 잰 추정치(최대 ESTIMATE_CAP) */
  estimate: boolean;
  /** 원본과 덩어리 수가 안 맞아 상한에 걸렸을 때 */
  burstMiss?: { ref: number; user: number };
};

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
/** a → 0점, b → 100점 사이를 잇는다 (a > b 도 된다) */
const lerp = (v: number, a: number, b: number) => clamp(((v - a) / (b - a)) * 100);

/** 원본이 없을 때의 상한 — 100점은 원본과 견줘서만 나온다 */
export const ESTIMATE_CAP = 89;

/** 기합 점수 — 원본 없이, 대사마다 원래 요구하는 것과 견준다 */
export function hypeScore(a: Analysis, line: AnimeLine): HypeScore {
  const silent = a.span < 0.35 || a.peakDb < -45;
  const st = line.style;

  // 성량: 외치는 대사는 클수록, 음흉한 대사는 작고 또렷할수록.
  // 마이크가 찢어질 만큼 지르면 소리가 뭉개진다 — 만점이 아니다.
  const rawPower =
    st === "evil"
      ? 100 - Math.min(100, Math.abs(a.peakDb + 16) * 6)
      : st === "cool"
        ? 100 - Math.min(100, Math.max(0, Math.abs(a.peakDb + 11) - 4) * 7)
        : lerp(a.peakDb, -32, -5);
  const power = a.clipped ? Math.min(rawPower, 75) : rawPower;

  // 억양 폭(반음): 기합·귀여움은 출렁여야, 쿨·음흉은 눌러야.
  const pr = a.pitchRange ?? 0;
  const range =
    st === "shout" || st === "cute"
      ? lerp(pr, 1.5, st === "cute" ? 10 : 8)
      : st === "tense"
        ? lerp(pr, 1, 6)
        : 100 - Math.min(100, Math.max(0, pr - 6) * 14 + Math.max(0, 1.5 - pr) * 30);

  // 길이: 범위 가운데가 만점, 끝으로 갈수록·벗어날수록 깎인다.
  const [lo, hi] = line.span;
  const mid = (lo + hi) / 2;
  const half = (hi - lo) / 2;
  const off = Math.max(0, Math.abs(a.span - mid) - half * 0.4);
  const timing = clamp(100 - (off / Math.max(0.3, half)) * 60);

  // 끝 처리: 외치는 대사는 끝이 살아야, 음흉·쿨은 흐려도 된다.
  const drop = a.endDrop ?? -6;
  const ending = st === "evil" || st === "cool" ? clamp(90 + Math.min(10, drop + 10)) : lerp(drop, -16, -2);

  // 박자: 끊어 외친 덩어리 수가 대사와 맞나. 이어 말하면 덜 세지므로 60% 면 만점,
  // 넘치게 쪼개도(1.8배 넘게) 깎는다. 한 덩어리로 "아아악" 지르면 여기서 무너진다.
  const ratio = a.bursts / line.beats;
  const beat = ratio > 1.8 ? clamp(100 - (ratio - 1.8) * 120) : lerp(ratio, 0.2, 0.6);

  let total = clamp(power * 0.25 + range * 0.2 + timing * 0.15 + ending * 0.1 + beat * 0.3);
  // 박자가 틀리면 다른 게 아무리 좋아도 "따라 한" 게 아니다.
  if (beat < 40) total = Math.min(total, 55);
  total = Math.min(total, ESTIMATE_CAP);
  if (silent) total = 0;

  const badges: HypeScore["badges"] = [];
  if (!silent && st === "evil" && a.peakDb < -20) badges.push({ ko: "속삭임 장인", en: "Whisper pro" });
  if (!silent && timing === 100 && beat === 100) badges.push({ ko: "칼박자", en: "Perfect timing" });

  return {
    total,
    power: clamp(power),
    range: clamp(range),
    timing,
    ending,
    tier: tierOf(total, silent),
    badges,
    silent,
    bars: [
      ["박자", "Beats", clamp(beat)],
      ["성량", "Power", clamp(power)],
      ["억양", "Range", clamp(range)],
      ["길이", "Timing", timing],
      ["끝 처리", "Ending", ending],
    ],
    estimate: true,
  };
}

/** 서버 원본 비교 결과(modal_app._score profile="anime") → 화면용 점수 */
export type OriginalScore = {
  score: number;
  breakdown: { pitch: number; tone: number; timing: number; energy?: number };
  pitch_scored?: boolean;
  bursts?: { ref: number; user: number; ok: boolean };
  waveform?: { ref: number[]; user: number[] };
};

export function fromOriginal(r: OriginalScore): HypeScore {
  const b = r.breakdown;
  const silent = false;
  const total = clamp(r.score);
  const bars: [string, string, number][] = [
    ...(r.pitch_scored === false ? [] : ([["억양 모양", "Intonation", b.pitch]] as [string, string, number][])),
    ["박자", "Rhythm", b.timing],
    ["기세", "Drive", b.energy ?? 0],
    ["목소리 결", "Tone", b.tone],
  ];
  const badges: HypeScore["badges"] = [];
  if (b.timing >= 95 && (r.bursts?.ok ?? true)) badges.push({ ko: "칼박자", en: "Perfect timing" });
  if (b.pitch >= 95 && r.pitch_scored !== false) badges.push({ ko: "억양 복사기", en: "Intonation copy" });
  return {
    total,
    power: b.energy ?? 0,
    range: b.pitch,
    timing: b.timing,
    ending: b.tone,
    tier: tierOf(total, silent),
    badges,
    silent,
    bars,
    estimate: false,
    burstMiss: r.bursts && !r.bursts.ok ? r.bursts : undefined,
  };
}

/** 원본 클립 id — 사람이 픽커로 골라 `ingest.py pick --id anime_<id> --kind anime` 로 올린다 */
export const animeRefId = (line: AnimeLine) => `anime_${line.id}`;

function tierOf(total: number, silent: boolean): HypeScore["tier"] {
  if (silent) return { ko: "음소거", en: "Muted", note: "소리가 안 들렸어요. 마이크에 대고 한 번 더!", noteEn: "We couldn't hear you. Try again, closer!" };
  if (total >= 92) return { ko: "성우 데뷔각", en: "Pro debut", note: "제작사에서 연락 올 것 같아요", noteEn: "The studio is calling" };
  if (total >= 80) return { ko: "극장판 작화", en: "Movie quality", note: "극장판 클라이맥스 퀄리티", noteEn: "Climax-of-the-movie quality" };
  if (total >= 65) return { ko: "본편 퀄리티", en: "Episode quality", note: "방영분으로 손색없어요", noteEn: "Good enough to air" };
  if (total >= 50) return { ko: "총집편", en: "Recap episode", note: "할 건 했다… 기합만 조금 더", noteEn: "It's all there, needs more hype" };
  if (total >= 35) return { ko: "작화 붕괴", en: "Off-model", note: "보는 사람 배 잡는 중", noteEn: "Everyone's laughing (with you)" };
  return { ko: "엑스트라 B", en: "Extra B", note: "대사 한 줄 받은 마을 주민", noteEn: "Villager with one line" };
}
