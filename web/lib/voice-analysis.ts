/**
 * 녹음 한 테이크를 브라우저에서 잰다 — 연습실 대본용 (기준 음성이 없다).
 *
 * 재는 것: 말 속도(초당 음절) · 쉼 · 억양 폭(반음) · 문장 끝 처짐 · 음량.
 * 전부 "들어보면 아는 것"을 숫자로 바꾼 것이다. 성우·아나운서 학원에서 가장 자주
 * 듣는 지적이 이 넷이다: 빠르다, 숨을 안 쉰다, 평평하다, 끝이 죽는다.
 *
 * 채점 서버(librosa pyin)와 같은 걸 흉내 내지 않는다. 기준 음성이 없으니 "얼마나
 * 닮았나"는 못 재고, 대신 대본에 적힌 기준(속도 범위·억양 폭)과 견준다.
 *
 * 비용: 12kHz 로 낮춰서 소리 나는 프레임에만 피치를 찾는다. 1분 녹음이 폰에서
 * 1초 안쪽. 중간중간 쉬어서 화면이 굳지 않게 한다.
 */

const RATE = 12_000;
const HOP_S = 0.02;
const WIN = 360; // 30ms @ 12kHz — 70Hz 두 주기
const F0_MIN = 70;
const F0_MAX = 420;
/** 이보다 긴 침묵을 "쉼"으로 센다. 단어 사이 틈(0.1~0.2초)은 쉼이 아니다. */
const PAUSE_S = 0.3;
/** 문장 경계로 볼 침묵. 끝 처짐은 문장마다 잰다. */
const SENTENCE_GAP_S = 0.45;

export type Analysis = {
  /** 녹음 전체 길이(초) */
  duration: number;
  /** 처음 소리 ~ 마지막 소리(초) */
  span: number;
  /** 초당 음절. 음절 수를 모르면 null */
  pace: number | null;
  pauses: number;
  longestPause: number;
  /** 억양 폭(반음, 10~90%). 유성음이 너무 적으면 null */
  pitchRange: number | null;
  pitchHz: number | null;
  /** 문장 끝 음량 - 문장 본체 음량 (dB, 음수일수록 처짐). 문장이 없으면 null */
  endDrop: number | null;
  /** 가장 큰 소리 (dBFS) */
  peakDb: number;
  clipped: boolean;
  /** 화면용 파형 — 0~1, 고정 개수 */
  bars: number[];
  /** 화면용 — 쉼 구간 [시작, 끝] (span 기준 0~1) */
  gaps: [number, number][];
};

export async function analyzeBlob(blob: Blob, syllableCount: number | null): Promise<Analysis> {
  const pcm = await decodeMono(blob);
  return analyze(pcm.data, pcm.rate, syllableCount);
}

export async function decodeMono(blob: Blob): Promise<{ data: Float32Array; rate: number }> {
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) throw new Error("no-audio-context");
  const ctx = new Ctor();
  try {
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    const ch0 = buf.getChannelData(0);
    if (buf.numberOfChannels === 1) return { data: ch0, rate: buf.sampleRate };
    const ch1 = buf.getChannelData(1);
    const mix = new Float32Array(ch0.length);
    for (let i = 0; i < mix.length; i += 1) mix[i] = (ch0[i] + ch1[i]) / 2;
    return { data: mix, rate: buf.sampleRate };
  } finally {
    void ctx.close().catch(() => {});
  }
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

export async function analyze(
  input: Float32Array,
  rate: number,
  syllableCount: number | null,
): Promise<Analysis> {
  // 1) 12kHz 로 낮춘다 (구간 평균 — 피치 대역 70~420Hz 엔 충분하다).
  const step = Math.max(1, Math.round(rate / RATE));
  const sr = rate / step;
  const n = Math.floor(input.length / step);
  const x = new Float32Array(n);
  let peak = 0;
  let clipCount = 0;
  for (let i = 0, k = 0; i < n; i += 1) {
    let s = 0;
    for (let j = 0; j < step; j += 1, k += 1) {
      const v = input[k];
      s += v;
      const a = Math.abs(v);
      if (a > peak) peak = a;
      if (a > 0.985) clipCount += 1;
    }
    x[i] = s / step;
  }
  const duration = input.length / rate;

  // 2) 프레임 음량 (dB).
  const hop = Math.max(1, Math.round(sr * HOP_S));
  const frames = Math.max(0, Math.floor((n - WIN) / hop));
  const db = new Float32Array(frames);
  for (let f = 0; f < frames; f += 1) {
    let e = 0;
    const o = f * hop;
    for (let j = 0; j < WIN; j += 1) e += x[o + j] * x[o + j];
    db[f] = 10 * Math.log10(e / WIN + 1e-10);
  }

  // 3) 말소리 프레임 — 바닥 소음 위 10dB, 그리고 가장 큰 소리 아래 40dB 안.
  const sorted = Array.from(db).sort((a, b) => a - b);
  const floor = sorted[Math.floor(sorted.length * 0.1)] ?? -100;
  const top = sorted[Math.floor(sorted.length * 0.98)] ?? 0;
  const thr = Math.max(floor + 10, top - 40);
  const speech = new Uint8Array(frames);
  for (let f = 0; f < frames; f += 1) speech[f] = db[f] > thr ? 1 : 0;
  fillShort(speech, 0, Math.round(0.12 / HOP_S)); // 단어 사이 틈은 메운다
  fillShort(speech, 1, Math.round(0.06 / HOP_S)); // 툭 튄 잡음은 지운다

  let first = speech.indexOf(1);
  let last = speech.lastIndexOf(1);
  if (first < 0) {
    first = 0;
    last = -1;
  }
  const span = last >= first ? (last - first + 1) * HOP_S : 0;

  // 4) 쉼 · 문장.
  const gaps: [number, number][] = [];
  const sentences: [number, number][] = [];
  let pauses = 0;
  let longestPause = 0;
  let segStart = first;
  for (let f = first; f <= last; ) {
    if (speech[f]) {
      f += 1;
      continue;
    }
    let g = f;
    while (g <= last && !speech[g]) g += 1;
    const len = (g - f) * HOP_S;
    if (len >= PAUSE_S) {
      pauses += 1;
      longestPause = Math.max(longestPause, len);
      gaps.push([(f - first) / (last - first + 1), (g - first) / (last - first + 1)]);
    }
    if (len >= SENTENCE_GAP_S) {
      sentences.push([segStart, f - 1]);
      segStart = g;
    }
    f = g;
  }
  if (last >= first) sentences.push([segStart, last]);

  // 5) 피치 (YIN) — 말소리 프레임에서만.
  const tauMin = Math.floor(sr / F0_MAX);
  const tauMax = Math.ceil(sr / F0_MIN);
  const d = new Float32Array(tauMax + 1);
  const cm = new Float32Array(tauMax + 1);
  const f0: number[] = [];
  for (let f = first; f <= last; f += 1) {
    if (!speech[f]) continue;
    const o = f * hop;
    if (o + WIN + tauMax >= n) break;
    for (let tau = 1; tau <= tauMax; tau += 1) {
      let s = 0;
      for (let j = 0; j < WIN; j += 1) {
        const diff = x[o + j] - x[o + j + tau];
        s += diff * diff;
      }
      d[tau] = s;
    }
    // 누적 평균으로 정규화한 차이(CMNDF). 문턱 아래 첫 골짜기가 주기다.
    // 영화 음성처럼 배경음이 섞이면 문턱(0.15)을 못 넘는 프레임이 많아서, 그땐
    // 전체 최솟값이 충분히 깊을 때(0.35)만 받아준다 — 무성음까지 피치로 세면 폭이 부푼다.
    let run = 0;
    let found = -1;
    let bestTau = -1;
    let bestC = 1;
    for (let tau = 1; tau <= tauMax; tau += 1) {
      run += d[tau];
      cm[tau] = run > 0 ? (d[tau] * tau) / run : 1;
    }
    for (let tau = tauMin; tau <= tauMax; tau += 1) {
      const c = cm[tau];
      if (c < bestC) {
        bestC = c;
        bestTau = tau;
      }
      if (c < 0.15) {
        let t = tau;
        while (t + 1 <= tauMax && cm[t + 1] < cm[t]) t += 1;
        found = t;
        break;
      }
    }
    if (found < 0 && bestC < 0.35) found = bestTau;
    if (found > 0) f0.push(sr / found);
    if (f % 150 === 0) await tick();
  }

  let pitchRange: number | null = null;
  let pitchHz: number | null = null;
  if (f0.length >= 12) {
    const fs = f0.sort((a, b) => a - b);
    const p10 = fs[Math.floor(fs.length * 0.1)];
    const p90 = fs[Math.floor(fs.length * 0.9)];
    pitchRange = 12 * Math.log2(p90 / p10);
    pitchHz = fs[Math.floor(fs.length / 2)];
  }

  // 6) 문장 끝 처짐 — 문장마다 마지막 25% 음량과 앞 75% 음량의 차이를 평균.
  const drops: number[] = [];
  for (const [a, b] of sentences) {
    const len = b - a + 1;
    if (len * HOP_S < 0.8) continue; // 한두 마디짜리는 끝이랄 게 없다
    const cut = a + Math.floor(len * 0.75);
    const body = meanDb(db, speech, a, cut - 1);
    const tail = meanDb(db, speech, cut, b);
    if (body !== null && tail !== null) drops.push(tail - body);
  }
  const endDrop = drops.length ? drops.reduce((s, v) => s + v, 0) / drops.length : null;

  // 7) 화면용 파형.
  const BARS = 64;
  const bars: number[] = [];
  const lo = first;
  const hi = Math.max(first + 1, last + 1);
  const range = Math.max(1, top - thr + 10);
  for (let i = 0; i < BARS; i += 1) {
    const a = lo + Math.floor(((hi - lo) * i) / BARS);
    const b = Math.max(a + 1, lo + Math.floor(((hi - lo) * (i + 1)) / BARS));
    let m = -100;
    for (let f = a; f < b && f < frames; f += 1) m = Math.max(m, db[f]);
    bars.push(Math.max(0, Math.min(1, (m - (thr - 10)) / range)));
  }

  return {
    duration,
    span,
    pace: syllableCount && span > 0.5 ? syllableCount / span : null,
    pauses,
    longestPause,
    pitchRange,
    pitchHz,
    endDrop,
    peakDb: 20 * Math.log10(peak + 1e-9),
    clipped: clipCount > rate * 0.01,
    bars,
    gaps,
  };
}

/** value 로 된 run 중 maxLen 보다 짧은 것을 반대 값으로 메운다 (양 끝은 건드리지 않는다). */
function fillShort(a: Uint8Array, value: 0 | 1, maxLen: number) {
  let i = 0;
  while (i < a.length) {
    if (a[i] !== value) {
      i += 1;
      continue;
    }
    let j = i;
    while (j < a.length && a[j] === value) j += 1;
    if (i > 0 && j < a.length && j - i <= maxLen) a.fill(value ? 0 : 1, i, j);
    i = j;
  }
}

function meanDb(db: Float32Array, speech: Uint8Array, a: number, b: number): number | null {
  let s = 0;
  let c = 0;
  for (let f = a; f <= b; f += 1) {
    if (!speech[f]) continue;
    s += db[f];
    c += 1;
  }
  return c ? s / c : null;
}
