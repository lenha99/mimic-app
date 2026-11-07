/**
 * 애니 명대사 — "잘하면 멋지고 못해도 웃긴" 기합 대사.
 *
 * 채점은 원본 비교 하나뿐이다 — 사람이 픽커로 고른 원본 구간이 `anime_<id>` 로 올라가 있고(draft 라
 * 밈 목록엔 안 뜬다) 서버가 원본과 견준다(modal_app._score profile="anime": 억양 모양·끊어 외친
 * 박자 중심, 음절 덩어리 수가 안 맞으면 상한). 원본이 없는 대사는 목록에 올리지 않는다.
 * 원본을 듣는 건 선택이다 — 이미 아는 사람은 바로 외쳐도 같은 자로 잰다.
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
  /** 원본이 끊어 외치는 덩어리 수(대략) — 설명·운영 참고용. 채점은 서버가 원본에서 직접 센다 */
  beats: number;
  tip: string;
  tipEn: string;
  /** 카드 색 */
  hue: number;
  /**
   * 영화·드라마 명대사(밈 카탈로그)를 대결에 태울 때만 — 원본 클립 id 와 채점 기준.
   * 애니 대사는 비워 둔다(`anime_<id>`, profile "anime").
   */
  movie?: { ref: string };
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
  {
    id: "omaewa",
    series: "북두신권",
    seriesEn: "Fist of the North Star",
    who: "켄시로",
    whoEn: "Kenshiro",
    say: "오마에와 모오 신데이루",
    ko: "넌 이미 죽어 있다",
    en: "You are already dead",
    emoji: "👊",
    style: "cool",
    span: [1.4, 3.2],
    beats: 6,
    tip: "등 돌린 채 낮고 담담하게. 끝 '이루'를 툭 내려놓아요",
    tipEn: "Back turned, low and flat. Drop the last syllables",
    hue: 25,
  },
  {
    id: "yareyare",
    series: "죠죠의 기묘한 모험",
    seriesEn: "JoJo's Bizarre Adventure",
    who: "쿠죠 죠타로",
    whoEn: "Jotaro Kujo",
    say: "야레야레다제",
    ko: "이거 참, 귀찮게 됐군",
    en: "Good grief",
    emoji: "🧢",
    style: "cool",
    span: [1.2, 2.8],
    beats: 5,
    tip: "모자챙 내리고 한숨 섞어서. 귀찮다는 듯 낮게 흘려요",
    tipEn: "Tip your cap, sigh it out, low and bored",
    hue: 245,
  },
  {
    id: "tatakae",
    series: "진격의 거인",
    seriesEn: "Attack on Titan",
    who: "에렌",
    whoEn: "Eren",
    say: "타타카에, 타타카에",
    ko: "싸워라, 싸워라",
    en: "Fight, fight",
    emoji: "⚔️",
    style: "tense",
    span: [2.6, 5.2],
    beats: 8,
    tip: "이를 악물고 눌러 말해요. 두 번째 '타타카에'에 힘을 더 실어요",
    tipEn: "Through gritted teeth. Push harder on the second one",
    hue: 140,
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
  /** 원본과 덩어리 수가 안 맞아 상한에 걸렸을 때 */
  burstMiss?: { ref: number; user: number };
};

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

/**
 * 소리가 안 들렸을 때 — 서버에 보내지 않고 바로 "음소거". 점수를 지어내지 않는다.
 * (예전엔 원본 없이 브라우저가 재는 "기합 점수"가 있었다. 화면이 원본을 다 받기 전에 외치면
 * 그 점수로 빠져서 "원본을 들어야만 진짜 점수가 나오냐"는 말이 나왔다 — 11/7 걷어냄.
 * 채점은 늘 서버가 원본과 견준다. 사용자가 원본을 들었는지와는 상관없다.)
 */
export function silentScore(movie = false): HypeScore {
  return {
    total: 0,
    power: 0,
    range: 0,
    timing: 0,
    ending: 0,
    tier: tierOf(0, true, movie),
    badges: [],
    silent: true,
    bars: [],
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

export function fromOriginal(r: OriginalScore, movie = false): HypeScore {
  const b = r.breakdown;
  const silent = false;
  const total = clamp(r.score);
  // 밈 기준 채점(영화 대사)은 기세(energy)를 따로 안 돌려준다 — 없는 칸을 0 으로 그리지 않는다
  const bars: [string, string, number][] = [
    ...(r.pitch_scored === false ? [] : ([["억양 모양", "Intonation", b.pitch]] as [string, string, number][])),
    ["박자", "Rhythm", b.timing],
    ...(typeof b.energy === "number" ? ([["기세", "Drive", b.energy]] as [string, string, number][]) : []),
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
    tier: tierOf(total, silent, movie),
    badges,
    silent,
    bars,
    burstMiss: r.bursts && !r.bursts.ok ? r.bursts : undefined,
  };
}

/** 원본 클립 id — 사람이 픽커로 골라 `ingest.py pick --id anime_<id> --kind anime` 로 올린다. 영화 대사는 밈 id 그대로 */
export const animeRefId = (line: AnimeLine) => line.movie?.ref ?? `anime_${line.id}`;

function tierOf(total: number, silent: boolean, movie = false): HypeScore["tier"] {
  if (silent) return { ko: "음소거", en: "Muted", note: "소리가 안 들렸어요. 마이크에 대고 한 번 더!", noteEn: "We couldn't hear you. Try again, closer!" };
  if (movie) {
    if (total >= 92) return { ko: "배우 데뷔각", en: "Casting call", note: "감독님이 명함 주고 갔어요", noteEn: "The director left you a card" };
    if (total >= 80) return { ko: "천만 관객", en: "Box office hit", note: "극장에서 박수 나올 퀄리티", noteEn: "The theater is clapping" };
    if (total >= 65) return { ko: "본방 사수", en: "Prime time", note: "방송 나가도 손색없어요", noteEn: "Good enough to air" };
    if (total >= 50) return { ko: "재방송", en: "Rerun", note: "느낌은 왔다… 말투만 조금 더", noteEn: "You've got it, nail the delivery" };
    if (total >= 35) return { ko: "NG 모음", en: "Blooper reel", note: "다들 배 잡는 중", noteEn: "Everyone's laughing (with you)" };
    return { ko: "지나가는 행인", en: "Passerby", note: "대사 없는 엑스트라", noteEn: "Extra with no lines" };
  }
  if (silent) return { ko: "음소거", en: "Muted", note: "소리가 안 들렸어요. 마이크에 대고 한 번 더!", noteEn: "We couldn't hear you. Try again, closer!" };
  if (total >= 92) return { ko: "성우 데뷔각", en: "Pro debut", note: "제작사에서 연락 올 것 같아요", noteEn: "The studio is calling" };
  if (total >= 80) return { ko: "극장판 작화", en: "Movie quality", note: "극장판 클라이맥스 퀄리티", noteEn: "Climax-of-the-movie quality" };
  if (total >= 65) return { ko: "본편 퀄리티", en: "Episode quality", note: "방영분으로 손색없어요", noteEn: "Good enough to air" };
  if (total >= 50) return { ko: "총집편", en: "Recap episode", note: "할 건 했다… 기합만 조금 더", noteEn: "It's all there, needs more hype" };
  if (total >= 35) return { ko: "작화 붕괴", en: "Off-model", note: "보는 사람 배 잡는 중", noteEn: "Everyone's laughing (with you)" };
  return { ko: "엑스트라 B", en: "Extra B", note: "대사 한 줄 받은 마을 주민", noteEn: "Villager with one line" };
}
