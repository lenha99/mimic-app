import type { Analysis } from "./voice-analysis";

/**
 * 애니 명대사 — "잘하면 멋지고 못해도 웃긴" 기합 대사.
 *
 * 원본 음성은 싣지 않는다(권리 · 그리고 구간을 추측으로 자르면 빗나간다). 그래서 "얼마나
 * 닮았나" 대신 이 대사가 원래 요구하는 것 — 성량 · 억양 폭 · 길이 · 끝 처리 — 을 브라우저에서
 * 재서 "기합 점수"로 낸다. 서버 비용 0. 같은 기준으로 재니 친구끼리 대결이 공평하다.
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
    tip: "주먹을 가슴에 쾅. 마지막 '요'를 하늘까지 끌어올려요",
    tipEn: "Fist to chest. Drag the last syllable to the sky",
    hue: 12,
  },
  {
    id: "rasengan",
    series: "나루토",
    seriesEn: "Naruto",
    who: "나루토",
    whoEn: "Naruto",
    say: "라센가앙!",
    ko: "나선환!",
    en: "Rasengan!",
    emoji: "🌀",
    style: "shout",
    span: [0.8, 2.4],
    tip: "손바닥에 기를 모은다고 생각하고, '앙'에서 터뜨려요",
    tipEn: "Charge it in your palm, explode on the last syllable",
    hue: 28,
  },
  {
    id: "kamehameha",
    series: "드래곤볼",
    seriesEn: "Dragon Ball",
    who: "손오공",
    whoEn: "Goku",
    say: "카— 메— 하— 메— 하아아!",
    ko: "에네르기파!",
    en: "Kamehameha!",
    emoji: "💥",
    style: "shout",
    span: [2.5, 6.5],
    tip: "앞 네 글자는 낮게 모으고, 마지막 '하'에서 전부 쏟아요",
    tipEn: "Charge low on the first four, unleash on the last",
    hue: 200,
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
    tip: "작게, 음흉하게, 입꼬리 올리고 속삭여요",
    tipEn: "Quiet, sinister, whisper with a smirk",
    hue: 0,
  },
  {
    id: "oshioki",
    series: "세일러 문",
    seriesEn: "Sailor Moon",
    who: "세일러 문",
    whoEn: "Sailor Moon",
    say: "츠키니 카왓테 오시오키요!",
    ko: "달을 대신해서 혼내 주겠어!",
    en: "In the name of the Moon, I'll punish you!",
    emoji: "🌙",
    style: "cute",
    span: [1.8, 3.8],
    tip: "포즈 잡고 높고 또랑또랑하게. 끝에 윙크",
    tipEn: "Strike the pose, high and bright, wink at the end",
    hue: 300,
  },
  {
    id: "kiminikimeta",
    series: "포켓몬스터",
    seriesEn: "Pokémon",
    who: "지우",
    whoEn: "Ash",
    say: "피카츄, 키미니 키메타!",
    ko: "피카츄, 너로 정했다!",
    en: "Pikachu, I choose you!",
    emoji: "⚡",
    style: "shout",
    span: [1.4, 3.2],
    tip: "몬스터볼 던지는 손짓과 함께, 신나게",
    tipEn: "Throw the ball as you shout it",
    hue: 50,
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
};

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
/** a → 0점, b → 100점 사이를 잇는다 (a > b 도 된다) */
const lerp = (v: number, a: number, b: number) => clamp(((v - a) / (b - a)) * 100);

/** 기합 점수 — 대사마다 원래 요구하는 것과 견준다 */
export function hypeScore(a: Analysis, line: AnimeLine): HypeScore {
  const silent = a.span < 0.35 || a.peakDb < -45;
  const st = line.style;

  // 성량: 외치는 대사는 클수록, 음흉한 대사는 작고 또렷할수록.
  const power =
    st === "evil"
      ? 100 - Math.min(100, Math.abs(a.peakDb + 16) * 6)
      : st === "cool"
        ? 100 - Math.min(100, Math.max(0, Math.abs(a.peakDb + 11) - 4) * 7)
        : lerp(a.peakDb, -32, -5);

  // 억양 폭(반음): 기합·귀여움은 출렁여야, 쿨·음흉은 눌러야.
  const pr = a.pitchRange ?? 0;
  const range =
    st === "shout" || st === "cute"
      ? lerp(pr, 1.5, st === "cute" ? 10 : 8)
      : st === "tense"
        ? lerp(pr, 1, 6)
        : 100 - Math.min(100, Math.max(0, pr - 6) * 14 + Math.max(0, 1.5 - pr) * 30);

  // 길이: 범위 안이면 만점, 벗어나면 0.15초마다 깎인다.
  const [lo, hi] = line.span;
  const off = a.span < lo ? lo - a.span : a.span > hi ? a.span - hi : 0;
  const timing = clamp(100 - (off / 0.15) * 8);

  // 끝 처리: 외치는 대사는 끝이 살아야, 음흉·쿨은 흐려도 된다.
  const drop = a.endDrop ?? -6;
  const ending = st === "evil" || st === "cool" ? clamp(90 + Math.min(10, drop + 10)) : lerp(drop, -16, -2);

  let total = clamp(power * 0.35 + range * 0.25 + timing * 0.25 + ending * 0.15);
  if (silent) total = 0;

  const badges: HypeScore["badges"] = [];
  if (!silent && a.clipped && st !== "evil") badges.push({ ko: "마이크 파괴", en: "Mic breaker" });
  if (!silent && line.id === "kamehameha" && a.span >= 4.5) badges.push({ ko: "기 모으기 장인", en: "Charge master" });
  if (!silent && pr >= 12) badges.push({ ko: "음역 폭주", en: "Range overload" });
  if (!silent && st === "evil" && a.peakDb < -20) badges.push({ ko: "속삭임 장인", en: "Whisper pro" });
  if (!silent && timing === 100 && ending >= 90) badges.push({ ko: "칼박자", en: "Perfect timing" });

  return { total, power: clamp(power), range: clamp(range), timing, ending, tier: tierOf(total, silent), badges, silent };
}

function tierOf(total: number, silent: boolean): HypeScore["tier"] {
  if (silent) return { ko: "음소거", en: "Muted", note: "소리가 안 들렸어요. 마이크에 대고 한 번 더!", noteEn: "We couldn't hear you. Try again, closer!" };
  if (total >= 92) return { ko: "성우 데뷔각", en: "Pro debut", note: "제작사에서 연락 올 것 같아요", noteEn: "The studio is calling" };
  if (total >= 80) return { ko: "극장판 작화", en: "Movie quality", note: "극장판 클라이맥스 퀄리티", noteEn: "Climax-of-the-movie quality" };
  if (total >= 65) return { ko: "본편 퀄리티", en: "Episode quality", note: "방영분으로 손색없어요", noteEn: "Good enough to air" };
  if (total >= 50) return { ko: "총집편", en: "Recap episode", note: "할 건 했다… 기합만 조금 더", noteEn: "It's all there, needs more hype" };
  if (total >= 35) return { ko: "작화 붕괴", en: "Off-model", note: "보는 사람 배 잡는 중", noteEn: "Everyone's laughing (with you)" };
  return { ko: "엑스트라 B", en: "Extra B", note: "대사 한 줄 받은 마을 주민", noteEn: "Villager with one line" };
}
