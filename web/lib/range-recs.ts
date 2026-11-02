import type { Lang } from "./i18n";
import { findScript, type Script } from "./practice";
import { hzToMidi, lowRank, type RangeCard } from "./voice-range";

/**
 * 음역대 결과 → 연습실 대본 추천. 테스트가 "신기하다"에서 끝나지 않고 연습실로 이어지게.
 *
 * 근거는 단순하다 — 낮고 안정된 목소리는 다큐·뉴스·묵직한 광고에서, 높고 밝은 목소리는 캐릭터·
 * 쇼호스트에서 강점이 된다. 말할 때 오르내림이 좁으면 억양을 넓히는 대본, 넓으면 단정하게 닫는
 * 대본으로 반대쪽을 채운다. 음역이 넓으면 한 사람이 여러 인물을 맡는 대본.
 */
export type Rec = { script: Script; why: { ko: string; en: string } };

type Pos = "low" | "mid" | "high";

const BY_POS: Record<Pos, { id: string; ko: string; en: string }[]> = {
  low: [
    { id: "sc_v_docu_history", ko: "낮은 목소리의 무게가 그대로 강점이 되는 다큐", en: "A documentary where a low voice is pure strength" },
    { id: "sc_a_news_open", ko: "신뢰감 있는 저음은 뉴스 앵커의 기본기", en: "A trustworthy low voice is an anchor's foundation" },
    { id: "sc_v_ad_car", ko: "묵직한 저음이 고급스러움을 만드는 광고", en: "An ad where a deep voice sounds premium" },
    { id: "sc_v_strategist", ko: "낮고 차분한 톤에 어울리는 냉정한 캐릭터", en: "A cool-headed character that suits a calm low tone" },
  ],
  mid: [
    { id: "sc_a_radio_night", ko: "편안한 중음은 라디오 DJ에게 가장 좋은 악기", en: "A relaxed mid voice is a radio DJ's best instrument" },
    { id: "sc_v_corp_film", ko: "따뜻한 중음이 신뢰를 주는 기업 영상", en: "A brand film where a warm mid tone builds trust" },
    { id: "sc_s_pt_open", ko: "어떤 청중에게나 편한 높이 — 발표에 딱", en: "A height that's easy for any audience — perfect for talks" },
    { id: "sc_a_radio_story", ko: "다정한 중음으로 읽는 사연 소개", en: "Read a listener's letter in a friendly mid tone" },
  ],
  high: [
    { id: "sc_v_hero", ko: "밝고 높은 소리가 살아나는 열혈 주인공", en: "A hot-blooded hero that comes alive in a bright, high voice" },
    { id: "sc_a_showhost", ko: "높은 에너지가 무기가 되는 쇼호스트", en: "A shopping host where high energy is the weapon" },
    { id: "sc_v_sidekick", ko: "높은 톤이 귀여움이 되는 조수 캐릭터", en: "A sidekick where a high tone turns into charm" },
    { id: "sc_v_flutter", ko: "높은 음에서 설렘이 잘 묻어나는 독백", en: "A monologue where excitement shows in the high notes" },
  ],
};

/** 말하는 음 → 낮음/중간/높음. 성별을 골랐으면 같은 성별 안에서, 안 골랐으면 대략 절대값으로. */
function positionOf(c: RangeCard): Pos | null {
  if (c.speak !== null) {
    const r = lowRank(c.speak, c.gender);
    if (r !== null) return r <= 30 ? "low" : r >= 70 ? "high" : "mid";
    return c.speak < hzToMidi(140) ? "low" : c.speak > hzToMidi(210) ? "high" : "mid";
  }
  if (c.low !== null && c.high !== null) {
    const mid = (c.low + c.high) / 2;
    return mid < hzToMidi(170) ? "low" : mid > hzToMidi(300) ? "high" : "mid";
  }
  return null;
}

export function positionLabel(c: RangeCard, lang: Lang): string | null {
  const p = positionOf(c);
  if (!p) return null;
  const ko = { low: "낮고 묵직한 목소리", mid: "편안한 중간 목소리", high: "밝고 높은 목소리" }[p];
  const en = { low: "a low, grounded voice", mid: "a comfortable mid voice", high: "a bright, high voice" }[p];
  return lang === "en" ? en : ko;
}

export function rangeRecs(c: RangeCard, n = 3): Rec[] {
  const pos = positionOf(c) ?? "mid";
  const picks: { id: string; ko: string; en: string }[] = [];

  // 말할 때 오르내림 — 반대쪽을 채워 주는 한 편을 먼저.
  if (c.spread !== null && c.spread < 5) {
    picks.push({ id: "sc_v_fairytale", ko: "말할 때 높낮이가 좁은 편 — 세 인물을 오가며 억양을 넓혀요", en: "Your pitch moves narrowly — stretch it across three characters" });
  } else if (c.spread !== null && c.spread > 11) {
    picks.push({ id: "sc_a_news_report", ko: "억양이 풍부한 편 — 리포트로 단정하게 닫는 연습을", en: "Lots of melody — practice closing lines cleanly with a report" });
  }
  // 음역이 두 옥타브 가까이면 1인 다역.
  if (c.low !== null && c.high !== null && c.high - c.low >= 22) {
    picks.push({ id: "sc_v_drama_duo", ko: "음역이 넓어요 — 한 사람이 두 인물을 맡는 오디오드라마", en: "Wide range — play two roles in one audio drama" });
  }
  for (const p of BY_POS[pos]) picks.push(p);

  const out: Rec[] = [];
  const seen = new Set<string>();
  for (const p of picks) {
    if (seen.has(p.id)) continue;
    const script = findScript(p.id);
    if (!script) continue;
    seen.add(p.id);
    out.push({ script, why: { ko: p.ko, en: p.en } });
    if (out.length >= n) break;
  }
  return out;
}
