import type { Analysis } from "./voice-analysis";
import { tr, type T } from "./i18n";

/**
 * 목소리 타입 — 코코의 심사표 맨 아래, 출전 카드·공유 문구에 쓴다.
 *
 * 전부 이 녹음에서 잰 값으로만 말한다(LLM·서버 없음, 비용 0). 예전 "마디별 억양 선·고칠 한 곳"은
 * 대본을 다시 보여 주는 것과 다르지 않아 걷어냈다 — 심사표의 본론은 대본 확인(lib/script-match)이다.
 */

/* ── 목소리 타입 ───────────────────────────────────────────────────────── */

export type VoiceType = { id: string; name: string; desc: string; why: string };

type Lv = 0 | 1 | 2;
/** 낮음·중간·높음 세 칸. 경계는 연습실 대본들의 기준 범위(registry pace·PITCH_RANGE) 분포에서 잡았다. */
const lv = (v: number, lo: number, hi: number): Lv => (v < lo ? 0 : v >= hi ? 2 : 1);

/** [이름, 한 줄 설명] — 속도(행) × 억양 폭(열). 칭찬처럼 들리게 쓴다(못한 점은 고칠 곳에서 말한다). */
const GRID: [string, string, string, string][][] = [
  // 느림
  [
    ["docu", "다큐 내레이터형", "Documentary narrator", "담담하게 끌고 가는 신뢰의 목소리"],
    ["radio", "심야 라디오 DJ형", "Late-night radio DJ", "귀에 가까이 앉아 말하는 듯한 편안함"],
    ["story", "오디오북 낭독형", "Audiobook narrator", "장면이 그려지는 이야기꾼"],
  ],
  // 보통
  [
    ["anchor", "뉴스 앵커형", "News anchor", "또박또박, 흔들림 없는 전달력"],
    ["announcer", "정석 아나운서형", "Classic announcer", "높낮이도 속도도 교과서처럼 고른"],
    ["drama", "드라마 더빙형", "Drama dubbing", "감정이 실린 대사가 자연스러운"],
  ],
  // 빠름
  [
    ["breaking", "속보 리포터형", "Breaking-news reporter", "빠르고 정확하게 핵심만"],
    ["host", "쇼호스트형", "Shopping-show host", "막힘없이 술술, 듣는 사람을 붙잡는"],
    ["ad", "광고 성우형", "Commercial voice", "짧은 시간에 귀에 꽂히는 에너지"],
  ],
];
const GRID_EN: Record<string, string> = {
  docu: "Calm and steady — a voice you trust",
  radio: "Close and comfortable, like sitting next to you",
  story: "A storyteller who paints the scene",
  anchor: "Clear and steady delivery",
  announcer: "Textbook-even pitch and pace",
  drama: "Lines that carry real feeling",
  breaking: "Fast and precise, straight to the point",
  host: "Smooth and gripping, never stalls",
  ad: "Energy that sticks in a few seconds",
};

/** 속도를 모를 때(명대사 등) — 억양 폭만으로. */
const NO_PACE: [string, string, string, string][] = [
  ["calm", "담백한 독백형", "Understated monologue", "꾸밈없이 무게를 싣는"],
  ["drama", "드라마 더빙형", "Drama dubbing", "감정이 실린 대사가 자연스러운"],
  ["actor", "연기파 배우형", "Character actor", "높낮이로 인물을 만드는"],
];
const NO_PACE_EN: Record<string, string> = {
  calm: "Plain, with weight",
  drama: "Lines that carry real feeling",
  actor: "Builds a character with pitch",
};

/**
 * 속도 3칸 × 억양 폭 3칸 = 9가지 기본 타입에, 목소리 높이·쉼·말끝으로 특별 타입이 덮인다.
 * 잰 값에서만 나온다 — 근거를 같이 보여 줘서 "랜덤 운세"가 아니게 한다.
 * 성별을 가정하지 않는다 — 음높이(Hz)만 본다.
 */
export function voiceTypeOf(a: Analysis | null, L: T = tr("ko")): VoiceType | null {
  if (!a || a.pitchRange === null) return null;
  const hz = a.pitchHz ?? 0;
  const low = hz > 0 && hz < 125;
  const high = hz > 240;
  const range = lv(a.pitchRange, 5.5, 10);
  const pace = a.pace !== null ? lv(a.pace, 3.9, 5.3) : null;
  const perMin = a.span > 5 ? (a.pauses / a.span) * 60 : 0;
  const strongEnd = a.endDrop !== null && a.endDrop > -2;

  let pick: [string, string, string, string];
  let en: string;
  // 특별 타입 — 조건이 뚜렷할 때만
  if (low && pace !== null && pace <= 1 && range <= 1) {
    pick = ["trailer", "영화 예고편 성우형", "Movie-trailer voice", "한마디로 분위기를 까는 묵직함"];
    en = "Sets the mood in one line";
  } else if (high && range === 2 && pace !== null && pace >= 1) {
    pick = ["anime", "애니 캐릭터 성우형", "Anime character voice", "통통 튀는 표정이 들리는"];
    en = "You can hear the expression bounce";
  } else if (high && range >= 1 && pace === 1) {
    pick = ["kids", "키즈 채널 진행자형", "Kids-show host", "밝고 다정하게 끌어 주는"];
    en = "Bright and friendly, leads the way";
  } else if (pace === 0 && range === 2 && perMin >= 14) {
    pick = ["poem", "시 낭송형", "Poetry reader", "쉼 하나까지 음악처럼 쓰는"];
    en = "Uses every pause like music";
  } else if (pace === 2 && range === 2 && strongEnd) {
    pick = ["sports", "스포츠 캐스터형", "Sports caster", "끝까지 힘이 안 빠지는 현장감"];
    en = "Live energy right to the last word";
  } else if (pace === null) {
    pick = NO_PACE[range];
    en = NO_PACE_EN[pick[0]];
  } else {
    pick = GRID[pace][range];
    en = GRID_EN[pick[0]];
  }
  const [id, ko, enName, desc] = pick;
  // 특별 타입은 이미 높이를 담고 있다 — 기본 타입에만 높이 수식어를 붙인다.
  const special = ["trailer", "anime", "kids"].includes(id);
  const tone = special ? "" : low ? L("낮고 묵직한 ", "Deep ") : high ? L("맑고 높은 ", "Bright ") : "";

  const bits: string[] = [];
  if (a.pace !== null) bits.push(L(`속도 ${a.pace.toFixed(1)}음절/초`, `${a.pace.toFixed(1)} syl/s`));
  bits.push(L(`억양 폭 ${a.pitchRange.toFixed(1)}반음`, `${a.pitchRange.toFixed(1)} st range`));
  if (hz) bits.push(`${Math.round(hz)}Hz`);
  return { id, name: tone + L(ko, enName), desc: L(desc, en), why: bits.join(" · ") };
}
