import type { Analysis } from "./voice-analysis";
import { tr, type T } from "./i18n";
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

export function judge(a: Analysis, t: Target, L: T = tr("ko")): Check[] {
  const out: Check[] = [];
  const anchor = t.track === "anchor";

  if (t.pace && a.pace !== null) {
    const [lo, hi] = t.pace;
    const status: Status = a.pace < lo ? "low" : a.pace > hi ? "high" : "ok";
    out.push({
      key: "pace",
      label: L("속도", "Pace"),
      value: L(`${fmt(a.pace)} 음절/초`, `${fmt(a.pace)} syl/s`),
      status,
      tip:
        status === "high"
          ? L(
              "조금 빨라요. 쉼표 자리에서 숨을 한 번씩 제대로 쉬면 속도는 저절로 맞아요.",
              "A bit fast. Take a real breath at each pause mark and the pace will settle.",
            )
          : status === "low"
            ? L(
                "조금 느려요. 단어 사이를 늘이지 말고, 쉼표 자리에서만 쉬어 보세요.",
                "A bit slow. Don't stretch between words — pause only at the marks.",
              )
            : L("속도 완벽해요! 이 빠르기를 몸에 기억해 두세요.", "Pace is spot on! Lock this speed in."),
      scale: { min: 2, max: 8, lo, hi, at: a.pace },
    });
  }

  if (t.marks !== undefined && t.marks > 0) {
    const want = t.marks;
    const got = a.pauses;
    const status: Status = got < want * 0.5 ? "low" : got > want * 1.6 + 1 ? "high" : "ok";
    out.push({
      key: "pause",
      label: L("쉼", "Pauses"),
      value: L(`${got}번 (표시 ${want}곳)`, `${got} (${want} marked)`),
      status,
      tip:
        status === "low"
          ? L(
              `쉼 표시는 ${want}곳인데 ${got}번 쉬었어요. 숨 쉬는 자리를 지키면 문장이 훨씬 잘 들려요.`,
              `${want} pause marks, but you paused ${got} times. Hitting the marks makes every sentence land.`,
            )
          : status === "high"
            ? L(
                "중간중간 자주 끊겨요. 한 덩어리로 읽을 곳에서 멈췄을 수 있어요. 다음 쉼표까지 한 호흡에 가 보세요.",
                "Lots of breaks. You may be stopping mid-phrase — try reaching the next mark in one breath.",
              )
            : a.longestPause > 2
              ? L(
                  `쉼 자리는 좋은데 가장 긴 쉼이 ${fmt(a.longestPause)}초예요. 조금만 줄여 볼까요?`,
                  `Good pause spots, but the longest is ${fmt(a.longestPause)}s. Trim it a little?`,
                )
              : L("숨 쉬는 자리 아주 좋아요.", "Pauses are right where they should be."),
    });
  }

  const band = t.pitchBand ?? (t.pitch ? PITCH_RANGE[t.pitch] : null);
  if (band && a.pitchRange !== null) {
    const [lo, hi] = band;
    const status: Status = a.pitchRange < lo ? "low" : a.pitchRange > hi ? "high" : "ok";
    out.push({
      key: "pitch",
      label: L("억양 폭", "Pitch range"),
      value: L(`${fmt(a.pitchRange)} 반음`, `${fmt(a.pitchRange)} semitones`),
      status,
      tip:
        status === "low"
          ? anchor
            ? L(
                "조금 평평해요. 강조 단어(밑줄) 앞에서 반 박자 쉬고 한 음만 올려 보세요.",
                "A bit flat. Pause half a beat before the underlined word, then lift one note.",
              )
            : L(
                "높낮이가 평평해요. 감정이 목소리 높이에 아직 안 실렸어요. 강조 단어부터 크게 움직여 보세요.",
                "Pretty flat. The emotion isn't reaching your pitch yet — start by moving big on the stressed words.",
              )
          : status === "high"
            ? anchor
              ? L(
                  "억양이 출렁여요. 문장 끝을 올리지 말고 단정하게 내려 닫아 주세요.",
                  "Pitch is bouncing. Don't lift sentence endings — close them down cleanly.",
                )
              : L(
                  "조금 과해요. 감정은 높이뿐 아니라 쉼과 속도로도 표현할 수 있어요.",
                  "A touch much. Emotion can come through pauses and pace, not just pitch.",
                )
            : L("높낮이 좋아요.", "Great pitch movement."),
      scale: { min: 0, max: Math.max(20, hi + 4), lo, hi, at: a.pitchRange },
    });
  }

  if (a.endDrop !== null) {
    const status: Status = a.endDrop < -7 ? "low" : "ok";
    out.push({
      key: "end",
      label: L("문장 끝", "Endings"),
      value: `${a.endDrop >= 0 ? "+" : ""}${fmt(a.endDrop)} dB`,
      status,
      tip:
        status === "low"
          ? anchor
            ? L(
                "문장 끝이 작아져요. '-습니다'의 마지막 음절까지 같은 힘으로 밀어 주세요.",
                "Endings fade out. Push the last syllable (like '-seumnida') with the same energy.",
              )
            : L(
                "말끝이 사라져요. 속삭이는 장면이 아니라면 마지막 음절까지 들리게 해 주세요.",
                "Your endings disappear. Unless it's a whisper scene, keep the last syllable audible.",
              )
          : L("끝까지 힘이 살아 있어요.", "Strong all the way to the end."),
    });
  }

  return out;
}

/** 녹음 자체의 문제 — 이게 있으면 위 측정이 엉터리일 수 있다. */
export function warnings(a: Analysis, L: T = tr("ko")): string[] {
  const w: string[] = [];
  if (a.span < 0.6)
    w.push(L("소리가 거의 안 잡혔어요. 마이크 가까이에서 다시 해볼까요?", "We barely heard you. Get closer to the mic and try again?"));
  else if (a.peakDb < -32)
    w.push(
      L(
        "녹음이 많이 작아요. 폰을 입 가까이(한 뼘) 두면 측정이 정확해져요.",
        "Recording is very quiet. Hold the phone a hand's width from your mouth for accurate results.",
      ),
    );
  if (a.clipped) w.push(L("소리가 너무 커서 찢어졌어요. 폰을 조금만 멀리 두세요.", "Too loud — it's clipping. Move the phone back a little."));
  return w;
}

export function passCount(checks: Check[]): { ok: number; total: number } {
  const judged = checks.filter((c) => c.status !== "na");
  return { ok: judged.filter((c) => c.status === "ok").length, total: judged.length };
}
