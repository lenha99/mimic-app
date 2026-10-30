import { hzToMidi } from "./voice-range";

/**
 * 실시간 음높이 — 마이크를 그대로 읽어 지금 내는 음을 찾는다(YIN).
 *
 * 녹음 파일을 만들지 않는다. 음역대 테스트는 숫자 몇 개만 필요하고, 화면에 지금 음이 바로
 * 움직여야 재밌다. 프레임마다 (시각, 음) 하나씩만 모은다.
 *
 * 24kHz 로 낮춰서 찾는다. 12kHz 면 고음(1kHz 근처)에서 주기 한 칸 차이가 반음을 넘는다.
 * 주기는 포물선 보간으로 칸 사이까지 잡는다.
 */

export type Frame = { t: number; m: number };
export type Mode = "speak" | "low" | "high";

/** 모드마다 찾는 범위 — 좁을수록 빠르고 옥타브를 덜 틀린다. */
export const BOUNDS: Record<Mode, [number, number]> = {
  speak: [60, 520],
  low: [45, 420],
  high: [80, 1400],
};

const TARGET_SR = 24_000;

/** 정규화 차이(CMNDF)가 이 아래면 그 주기를 믿는다. 못 넘으면 전체 최솟값이 이만큼 깊을 때만. */
const STRICT = 0.15;
const LOOSE = 0.3;

/** 소리 x(이미 낮춘 것)에서 음높이(Hz). 못 찾으면 null. */
export function yin(x: Float32Array, sr: number, fmin: number, fmax: number): number | null {
  const tauMin = Math.max(2, Math.floor(sr / fmax));
  const tauMax = Math.ceil(sr / fmin);
  const w = x.length - tauMax - 1;
  if (w < tauMax) return null;
  const cm = new Float32Array(tauMax + 2);
  cm[0] = 1;
  let run = 0;
  for (let tau = 1; tau <= tauMax + 1; tau += 1) {
    let s = 0;
    for (let j = 0; j < w; j += 1) {
      const d = x[j] - x[j + tau];
      s += d * d;
    }
    run += s;
    cm[tau] = run > 0 ? (s * tau) / run : 1;
  }
  let found = -1;
  let best = -1;
  let bestC = 1;
  for (let tau = tauMin; tau <= tauMax; tau += 1) {
    const c = cm[tau];
    if (c < bestC) {
      bestC = c;
      best = tau;
    }
    if (c < STRICT) {
      let t = tau;
      while (t + 1 <= tauMax && cm[t + 1] < cm[t]) t += 1;
      found = t;
      break;
    }
  }
  if (found < 0 && bestC < LOOSE) found = best;
  if (found < 0) return null;
  // 포물선 보간 — 고음에선 한 칸이 수십 센트다.
  const a = cm[found - 1];
  const b = cm[found];
  const c = cm[found + 1];
  const den = a - 2 * b + c;
  const shift = den !== 0 ? (0.5 * (a - c)) / den : 0;
  const period = found + (Math.abs(shift) < 1 ? shift : 0);
  return sr / period;
}

/** 원본 sr 을 24kHz 근처로 — 구간 평균(간단한 저역 통과 겸). 돌려받은 sr 로 계산한다. */
export function downsample(input: Float32Array, sr: number): { x: Float32Array; sr: number } {
  const step = Math.max(1, Math.round(sr / TARGET_SR));
  const n = Math.floor(input.length / step);
  const x = new Float32Array(n);
  for (let i = 0, k = 0; i < n; i += 1) {
    let s = 0;
    for (let j = 0; j < step; j += 1, k += 1) s += input[k];
    x[i] = s / step;
  }
  return { x, sr: sr / step };
}

export function rms(x: Float32Array): number {
  let s = 0;
  for (let i = 0; i < x.length; i += 1) s += x[i] * x[i];
  return Math.sqrt(s / x.length);
}

/**
 * 마이크 소리 한 토막을 읽는 기계. 소음 바닥을 천천히 따라가서 그보다 충분히 큰 소리에서만 음을 찾는다.
 * 숨소리·바람 소리에서 엉뚱한 음이 잡히면 최고음 기록이 망가진다.
 */
export function makeReader(analyser: AnalyserNode, sampleRate: number) {
  const buf = new Float32Array(analyser.fftSize);
  let floor = 0.01;
  return (mode: Mode): { hz: number | null; level: number } => {
    analyser.getFloatTimeDomainData(buf);
    const r = rms(buf);
    floor = r < floor ? r : Math.min(floor * 1.003, 0.05);
    const level = Math.min(1, r * 6);
    if (r < Math.max(0.008, floor * 3)) return { hz: null, level };
    const { x, sr } = downsample(buf, sampleRate);
    const [lo, hi] = BOUNDS[mode];
    return { hz: yin(x, sr, lo, hi), level };
  };
}

/* --- 모은 프레임 정리 ------------------------------------------------------ */

const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};

/** 평소 말하는 음 — 유성음 프레임의 중앙값, 폭은 10~90%. 유성음이 이만큼(초)은 있어야 믿는다. */
export function summarizeSpeak(frames: Frame[], minVoicedS = 1.2): { speak: number; spread: number } | null {
  if (frames.length < 2) return null;
  // 프레임 간격은 화면 주사율을 따른다(60·120Hz). 이어진 프레임 사이 간격의 중앙값으로 잰다.
  const dt = Math.min(0.05, median(frames.slice(1).map((f, i) => f.t - frames[i].t)));
  if (frames.length * dt < minVoicedS) return null;
  const ms = frames.map((f) => f.m).sort((a, b) => a - b);
  // 옥타브 오검출(배음·반 주기)은 중앙값에서 멀리 떨어진다 — 한 옥타브 가까이 벗어난 건 뺀다.
  const mid = median(ms);
  const kept = ms.filter((m) => Math.abs(m - mid) < 9);
  const p = (q: number) => kept[Math.min(kept.length - 1, Math.floor(kept.length * q))];
  return { speak: Math.round(median(kept) * 10) / 10, spread: Math.round((p(0.9) - p(0.1)) * 10) / 10 };
}

/** 이 시간 동안 이 폭 안에 머물러야 "낸 음"으로 친다 — 삑사리·순간 튐은 기록이 아니다. */
export const HOLD_S = 0.35;
const HOLD_TOL = 1.0;

/**
 * 버틴 음 중 가장 낮은(높은) 음. 연속한 프레임이 HOLD_S 동안 ±HOLD_TOL 반음 안에 머문 구간만 본다.
 * 끊긴 곳(무성음)을 넘어 이어 붙이지 않는다.
 */
export function stableExtreme(frames: Frame[], mode: "low" | "high"): number | null {
  let best: number | null = null;
  let i = 0;
  while (i < frames.length) {
    // 끊기지 않은 덩어리 [i, j)
    let j = i + 1;
    while (j < frames.length && frames[j].t - frames[j - 1].t < 0.12) j += 1;
    for (let a = i; a < j; a += 1) {
      let lo = frames[a].m;
      let hi = frames[a].m;
      for (let b = a + 1; b < j; b += 1) {
        lo = Math.min(lo, frames[b].m);
        hi = Math.max(hi, frames[b].m);
        if (hi - lo > HOLD_TOL * 2) break;
        if (frames[b].t - frames[a].t >= HOLD_S) {
          const seg = frames.slice(a, b + 1).map((f) => f.m);
          const v = median(seg);
          if (best === null || (mode === "high" ? v > best : v < best)) best = v;
          break;
        }
      }
    }
    i = j;
  }
  return best === null ? null : Math.round(best);
}

export const toMidi = hzToMidi;
