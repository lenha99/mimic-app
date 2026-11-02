import { PITCH_RANGE, type PitchBand } from "./practice";
import type { Analysis } from "./voice-analysis";

/**
 * 강점 배지 — 출전작에 공개로 붙는 "잘한 점". 못한 점은 배지로 만들지 않는다.
 *
 * 점수나 등급을 공개로 붙이면 올리기가 무서워진다(지금 가장 큰 문제가 "올리기 무섭다"다).
 * 그래서 잘한 것만, 측정으로 확실히 말할 수 있는 것만, 최대 셋.
 */
export const BADGES = {
  pause: { emoji: "🎯", ko: "끊어 읽기 정확", en: "Clean phrasing" },
  pace: { emoji: "⏱", ko: "속도 안정", en: "Steady pace" },
  melody: { emoji: "🎢", ko: "억양이 살아 있음", en: "Lively intonation" },
  ending: { emoji: "🎙", ko: "말끝 또렷", en: "Crisp endings" },
  clean: { emoji: "✨", ko: "깨끗한 녹음", en: "Clean recording" },
} as const;

export type BadgeId = keyof typeof BADGES;

export function isBadge(x: unknown): x is BadgeId {
  return typeof x === "string" && x in BADGES;
}

export function badgeLabel(id: BadgeId, lang: "ko" | "en"): string {
  const b = BADGES[id];
  return `${b.emoji} ${lang === "en" ? b.en : b.ko}`;
}

/** 측정값 → 잘한 점(중요한 순). 대본 기준이 없으면 그 항목은 건너뛴다. */
export function strengthsOf(
  a: Analysis | null,
  target: { pace?: number[]; pitch?: PitchBand; marks?: number } = {},
): BadgeId[] {
  if (!a) return [];
  const out: BadgeId[] = [];
  if (target.marks !== undefined && target.marks > 0 && Math.abs(a.pauses - target.marks) <= Math.max(1, Math.round(target.marks * 0.2))) {
    out.push("pause");
  }
  if (a.endDrop !== null && a.endDrop >= -4) out.push("ending");
  if (a.pitchRange !== null && target.pitch) {
    const [lo, hi] = PITCH_RANGE[target.pitch];
    if (a.pitchRange >= lo && a.pitchRange <= hi * 1.15) out.push("melody");
  }
  if (a.pace !== null && target.pace && a.pace >= target.pace[0] && a.pace <= target.pace[1]) out.push("pace");
  if (!a.clipped && a.peakDb > -18 && a.peakDb < -0.5) out.push("clean");
  return out.slice(0, 3);
}
