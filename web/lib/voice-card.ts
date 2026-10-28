import type { Lang } from "./i18n";

/**
 * 보이스 카드 — 10초 읽고 "내 목소리는 이런 유형"을 받는 장난감.
 *
 * 브라우저가 실제로 잴 수 있는 것만 쓴다: 평균 음높이(Hz), 억양 폭(반음), 말 속도.
 * "좋은 목소리 상위 3%" 같은 건 잴 수 없으니 말하지 않는다. 유형은 이 숫자들을
 * 구간으로 나눈 것이고, 카드에도 숫자를 그대로 적어 근거를 보여 준다.
 */

export type Register = "low" | "midlow" | "midhigh" | "high";
export type Expr = "steady" | "balanced" | "dynamic";
export type VoiceTypeKey = `${Register}-${Expr}`;

/** 음높이 구간(Hz) 경계 — 대략 남성 저음 ~ 여성 고음을 넷으로. */
const REGISTER_CUTS: [number, Register][] = [
  [120, "low"],
  [170, "midlow"],
  [230, "midhigh"],
];

export function registerOf(hz: number): Register {
  for (const [cut, r] of REGISTER_CUTS) if (hz < cut) return r;
  return "high";
}

/** 억양 폭(반음) — 5 미만은 차분, 9 초과는 다이내믹. */
export function exprOf(semitones: number): Expr {
  if (semitones < 5) return "steady";
  if (semitones > 9) return "dynamic";
  return "balanced";
}

type VoiceType = { ko: string; en: string; roleKo: string; roleEn: string; script: string };

export const VOICE_TYPES: Record<VoiceTypeKey, VoiceType> = {
  "low-steady": { ko: "신뢰의 저음", en: "The Trusted Bass", roleKo: "다큐 내레이션 · 은행 광고", roleEn: "Documentary narration · bank ads", script: "sc_v_docu_sea" },
  "low-balanced": { ko: "심야 라디오", en: "Midnight Radio", roleKo: "심야 라디오 · 오디오북", roleEn: "Late-night radio · audiobooks", script: "sc_a_radio_night" },
  "low-dynamic": { ko: "카리스마 보스", en: "Final Boss", roleKo: "악당 · 게임 보스", roleEn: "Villains · game bosses", script: "sc_v_game_boss" },
  "midlow-steady": { ko: "뉴스룸 앵커", en: "Newsroom Anchor", roleKo: "뉴스 · 브리핑", roleEn: "News · briefings", script: "sc_a_news_open" },
  "midlow-balanced": { ko: "든든한 주인공", en: "Reliable Lead", roleKo: "드라마 주연 · 광고 내레이션", roleEn: "Drama leads · ad voice-overs", script: "sc_v_ad_coffee" },
  "midlow-dynamic": { ko: "예고편 보이스", en: "Trailer Voice", roleKo: "영화 예고편 · 스포츠 중계", roleEn: "Movie trailers · sports calls", script: "sc_v_trailer" },
  "midhigh-steady": { ko: "차분한 낭독가", en: "Calm Narrator", roleKo: "편지 낭독 · 오디오북", roleEn: "Letter readings · audiobooks", script: "sc_a_read_letter" },
  "midhigh-balanced": { ko: "아침 라디오", en: "Morning Host", roleKo: "출근길 라디오 · 날씨", roleEn: "Morning radio · weather", script: "sc_a_radio_morning" },
  "midhigh-dynamic": { ko: "감정 연기파", en: "Scene Stealer", roleKo: "감정 연기 · 드라마", roleEn: "Emotional acting · drama", script: "sc_v_confess" },
  "high-steady": { ko: "맑은 안내 방송", en: "Crystal Announcer", roleKo: "안내 방송 · 날씨", roleEn: "Announcements · weather", script: "sc_a_weather" },
  "high-balanced": { ko: "애니 주인공", en: "Anime Lead", roleKo: "애니 주인공 · 게임 캐릭터", roleEn: "Anime leads · game characters", script: "sc_v_boy" },
  "high-dynamic": { ko: "텐션 마스코트", en: "Hype Mascot", roleKo: "마스코트 · 게임 광고", roleEn: "Mascots · game ads", script: "sc_v_mascot" },
};

export function isVoiceType(v: unknown): v is VoiceTypeKey {
  return typeof v === "string" && v in VOICE_TYPES;
}

export const REGISTER_LABEL: Record<Register, [string, string]> = {
  low: ["깊은 저음", "Deep low"],
  midlow: ["중저음", "Low-mid"],
  midhigh: ["중고음", "High-mid"],
  high: ["맑은 고음", "Bright high"],
};

export const EXPR_LABEL: Record<Expr, [string, string]> = {
  steady: ["차분한 억양", "Steady tone"],
  balanced: ["균형 잡힌 억양", "Balanced tone"],
  dynamic: ["다이내믹한 억양", "Dynamic tone"],
};

/** 읽을 문장. 음절 수를 알아야 속도를 잴 수 있다. 영어는 직접 센 값. */
export const READ_LINE: Record<Lang, { text: string; syllables: number }> = {
  ko: {
    text: "안녕하세요, 이게 제 목소리예요. 제대로 들어 본 건 오늘이 처음인데, 생각보다 괜찮았으면 좋겠네요!",
    syllables: 0, // 아래에서 센다
  },
  en: {
    text: "Hi, this is my voice. I've never really listened to it before, so let's find out what it sounds like today!",
    syllables: 26,
  },
};
READ_LINE.ko.syllables = (READ_LINE.ko.text.match(/[가-힣]/g) ?? []).length;

export type Pace = "slow" | "steady" | "fast";

/** 초당 음절 → 속도 꼬리표. 한국어와 영어는 음절 밀도가 달라 경계가 다르다. */
export function paceOf(perSec: number, lang: Lang): Pace {
  const [slow, fast] = lang === "en" ? [3.3, 4.6] : [4.2, 5.8];
  if (perSec < slow) return "slow";
  if (perSec > fast) return "fast";
  return "steady";
}

export const PACE_LABEL: Record<Pace, [string, string]> = {
  slow: ["또박또박", "Unhurried"],
  steady: ["안정적인 속도", "Even pace"],
  fast: ["에너지 넘치는 속도", "High energy"],
};

/** 공유 링크에 담는 값 — 숫자는 정수로 줄인다(억양 폭·속도는 ×10). */
export type CardData = { type: VoiceTypeKey; hz: number; st10: number; pace10: number | null; avatar: string };

export function cardQuery(c: CardData, lang: Lang): string {
  const q = new URLSearchParams({ t: c.type, hz: String(c.hz), st: String(c.st10), a: c.avatar, l: lang });
  if (c.pace10 !== null) q.set("p", String(c.pace10));
  return q.toString();
}

function num(v: string | null, lo: number, hi: number): number | null {
  const n = Number(v);
  return v !== null && v !== "" && Number.isFinite(n) && n >= lo && n <= hi ? Math.round(n) : null;
}

/** 링크에서 카드 값을 되읽는다. 손으로 고친 값은 범위를 벗어나면 버린다. */
export function readCard(q: URLSearchParams): (CardData & { lang: Lang }) | null {
  const type = q.get("t");
  const hz = num(q.get("hz"), 50, 500);
  const st10 = num(q.get("st"), 0, 400);
  if (!isVoiceType(type) || hz === null || st10 === null) return null;
  return {
    type,
    hz,
    st10,
    pace10: num(q.get("p"), 5, 150),
    avatar: (q.get("a") ?? "").slice(0, 120),
    lang: q.get("l") === "en" ? "en" : "ko",
  };
}
