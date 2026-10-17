import type { Analysis } from "./voice-analysis";
import { PITCH_RANGE, type PitchBand, type Track } from "./practice";

/**
 * 측정값 → 사람이 하는 말.
 *
 * 숫자만 주면 "그래서 뭘 하라고?"가 남는다. 학원 선생님이 부스 밖에서 하는 말처럼
 * 다음 테이크에서 바꿀 행동 하나를 준다. 기준 밖이어도 혼내지 않는다 — 연습이다.
 */

export type Status = "ok" | "low" | "high" | "na";

export type Check = {
  key: "pace" | "pause" | "pitch" | "end";
  label: string;
  /** 화면에 찍는 값 ("5.2 음절/초") */
  value: string;
  status: Status;
  /** 다음 테이크에서 할 일 */
  tip: string;
  /** 눈금 막대 — 값과 기준 구간을 같은 축에 놓는다. 없으면 막대를 안 그린다. */
  scale?: { min: number; max: number; lo: number; hi: number; at: number };
};

export type Target = {
  track: Track | "line";
  pace?: number[];
  pitch?: PitchBand;
  /** 억양 폭 기준을 직접 줄 때 (명대사 — 원본을 같은 방식으로 잰 값 ±30%) */
  pitchBand?: [number, number];
  /** 대본의 쉼 표시 개수 */
  marks?: number;
};

const fmt = (v: number, d = 1) => v.toFixed(d);

export function judge(a: Analysis, t: Target): Check[] {
  const out: Check[] = [];
  const anchor = t.track === "anchor";

  if (t.pace && a.pace !== null) {
    const [lo, hi] = t.pace;
    const status: Status = a.pace < lo ? "low" : a.pace > hi ? "high" : "ok";
    out.push({
      key: "pace",
      label: "속도",
      value: `${fmt(a.pace)} 음절/초`,
      status,
      tip:
        status === "high"
          ? "조금 빨라. 쉼표 자리에서 숨을 한 번씩 제대로 쉬면 속도는 저절로 맞는다."
          : status === "low"
            ? "조금 느려. 단어 사이를 늘이지 말고, 쉼표 자리에서만 쉬어봐."
            : "속도 좋다. 이 빠르기를 몸에 기억해 둬.",
      scale: { min: 2, max: 8, lo, hi, at: a.pace },
    });
  }

  if (t.marks !== undefined && t.marks > 0) {
    const want = t.marks;
    const got = a.pauses;
    const status: Status = got < want * 0.5 ? "low" : got > want * 1.6 + 1 ? "high" : "ok";
    out.push({
      key: "pause",
      label: "쉼",
      value: `${got}번 (표시 ${want}곳)`,
      status,
      tip:
        status === "low"
          ? `쉼 표시가 ${want}곳인데 ${got}번 쉬었어. 숨 쉬는 자리를 지키면 문장이 귀에 들어온다.`
          : status === "high"
            ? "중간중간 자주 끊겨. 한 덩어리로 읽을 곳에서 멈췄을 수 있어 — 다음 쉼표까지 한 숨에."
            : a.longestPause > 2
              ? `쉼 자리는 좋은데 가장 긴 쉼이 ${fmt(a.longestPause)}초야. 조금만 줄여봐.`
              : "숨 쉬는 자리 좋다.",
    });
  }

  const band = t.pitchBand ?? (t.pitch ? PITCH_RANGE[t.pitch] : null);
  if (band && a.pitchRange !== null) {
    const [lo, hi] = band;
    const status: Status = a.pitchRange < lo ? "low" : a.pitchRange > hi ? "high" : "ok";
    out.push({
      key: "pitch",
      label: "억양 폭",
      value: `${fmt(a.pitchRange)} 반음`,
      status,
      tip:
        status === "low"
          ? anchor
            ? "조금 평평해. 강조 단어(밑줄) 앞에서 반 박자 쉬고 한 음만 올려봐."
            : "높낮이가 평평해. 감정이 목소리 높이로 안 넘어왔어 — 강조 단어부터 크게 움직여봐."
          : status === "high"
            ? anchor
              ? "억양이 출렁여. 문장 끝을 올리지 말고 단정하게 내려 닫아."
              : "조금 과해. 감정은 높이만이 아니라 쉼과 속도로도 표현된다."
            : "높낮이 좋다.",
      scale: { min: 0, max: Math.max(20, hi + 4), lo, hi, at: a.pitchRange },
    });
  }

  if (a.endDrop !== null) {
    const status: Status = a.endDrop < -7 ? "low" : "ok";
    out.push({
      key: "end",
      label: "문장 끝",
      value: `${a.endDrop >= 0 ? "+" : ""}${fmt(a.endDrop)} dB`,
      status,
      tip:
        status === "low"
          ? anchor
            ? "문장 끝이 작아져. '-습니다'의 마지막 음절까지 같은 힘으로 밀어."
            : "말끝이 사라져. 속삭이는 장면이 아니라면 마지막 음절까지 들리게."
          : "끝까지 힘이 살아 있다.",
    });
  }

  return out;
}

/** 녹음 자체의 문제 — 이게 있으면 위 측정이 엉터리일 수 있다. */
export function warnings(a: Analysis): string[] {
  const w: string[] = [];
  if (a.span < 0.6) w.push("소리가 거의 안 잡혔어. 마이크 가까이에서 다시 해볼래?");
  else if (a.peakDb < -32) w.push("녹음이 많이 작아. 폰을 입 가까이(한 뼘) 두면 측정이 정확해져.");
  if (a.clipped) w.push("소리가 너무 커서 찢어졌어. 폰을 조금만 멀리.");
  return w;
}

export function passCount(checks: Check[]): { ok: number; total: number } {
  const judged = checks.filter((c) => c.status !== "na");
  return { ok: judged.filter((c) => c.status === "ok").length, total: judged.length };
}
