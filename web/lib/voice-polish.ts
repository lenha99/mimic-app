import { decodeMono } from "./voice-analysis";

/**
 * 목소리 보정 — 출전 전에 "필터 끼기"를 켜면 이걸 거친 녹음이 올라간다.
 *
 * 사람들이 목소리를 안 올리는 큰 이유는 "폰으로 녹음한 내 목소리가 별로"라서다. 사진
 * 필터처럼 켜기만 하면 나아져야 한다 — 조절 손잡이는 일부러 없다. 일반인은 안 만진다.
 *
 * 전부 브라우저에서 한다(서버 비용 0). 순서:
 *   1) 잡음 제거 — 조용한 구간에서 방 소음의 모양을 배워 주파수별로 걷어낸다(spectral gating).
 *      녹음은 noiseSuppression 을 끈 채 받으므로(room.tsx) 여기서 처음 지운다.
 *   2) 다듬기 — 웅웅거림(저역) 빼고, 또렷함(3.5kHz)·공기감(10kHz) 살짝, 컴프레서로 고르게,
 *      아주 옅은 방 울림. "보정했다"가 티 나면 실패다.
 *   3) 최대 -1dBFS 로 맞추고 24kHz 16비트 모노 wav 로 낸다(60초 ≈ 2.9MB, 출전 상한 4MB 안).
 */
const OUT_RATE = 24_000;

export async function polishVoice(blob: Blob): Promise<Blob> {
  const { data, rate } = await decodeMono(blob);
  const low = rate === OUT_RATE ? data : await render(data, rate, () => {});
  const clean = gate(await denoise(low), OUT_RATE);
  const shaped = await shape(clean);
  normalize(shaped, 0.89);
  return encodeWav(shaped, OUT_RATE);
}

// ---------- 1) 잡음 제거 ----------

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

async function denoise(input: Float32Array): Promise<Float32Array> {
  // OUT_RATE(24kHz) 로 낮춘 뒤에 부른다. 1024 점 ≈ 43ms 창.
  const N = 1024;
  const hop = N / 4;
  const bins = N / 2 + 1;
  if (input.length < N * 4) return input;

  const win = new Float64Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N);
  const frames = Math.floor((input.length - N) / hop) + 1;
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  const load = (f: number) => {
    const off = f * hop;
    for (let i = 0; i < N; i++) {
      re[i] = input[off + i] * win[i];
      im[i] = 0;
    }
    fft(re, im, false);
  };

  // 스펙트럼을 전부 들고 있으면 폰에서 수십 MB 다. 대신 FFT 를 세 번 돈다(계산은 싸다).
  // 1) 프레임 에너지
  const energy = new Float64Array(frames);
  for (let f = 0; f < frames; f++) {
    let e = 0;
    const off = f * hop;
    for (let i = 0; i < N; i++) e += (input[off + i] * win[i]) ** 2;
    energy[f] = e;
  }

  // 조용한 15% 프레임 = 방 소음. 그게 말소리와 별 차이 없으면(쉼 없이 말했거나 원래 깨끗) 건드리지 않는다.
  const order = Array.from(energy.keys()).sort((a, b) => energy[a] - energy[b]);
  const quiet = order.slice(0, Math.max(5, Math.floor(frames * 0.15)));
  const median = energy[order[Math.floor(frames / 2)]] || 1e-12;
  const quietE = energy[quiet[Math.floor(quiet.length / 2)]] || 1e-12;
  const gapDb = 10 * Math.log10(median / quietE);
  if (gapDb < 6) return input; // 소음이 말과 구분이 안 된다 — 건드리면 목소리가 상한다
  const floor = gapDb > 15 ? 0.06 : 0.2;

  // 2) 소음 모양 — 조용한 프레임의 주파수별 평균 + 1.5 표준편차
  const mean = new Float64Array(bins);
  const sq = new Float64Array(bins);
  for (const f of quiet) {
    load(f);
    for (let k = 0; k < bins; k++) {
      const m = Math.hypot(re[k], im[k]);
      mean[k] += m;
      sq[k] += m * m;
    }
  }
  const thr = new Float64Array(bins);
  for (let k = 0; k < bins; k++) {
    const mu = mean[k] / quiet.length;
    const sd = Math.sqrt(Math.max(0, sq[k] / quiet.length - mu * mu));
    thr[k] = mu + 2 * sd + 1e-9;
  }
  await tick();

  // 3) 주파수별 이득. 경계는 부드럽게, 시간으로도 이어서 "뽀글거리는" 잡음(musical noise)을 줄인다.
  const out = new Float64Array(input.length);
  const norm = new Float64Array(input.length);
  const prev = new Float64Array(bins).fill(1);
  const gain = new Float64Array(bins);
  for (let f = 0; f < frames; f++) {
    load(f);
    for (let k = 0; k < bins; k++) {
      const r = Math.hypot(re[k], im[k]) / thr[k];
      const g = r >= 2.5 ? 1 : r <= 1 ? floor : floor + ((1 - floor) * (r - 1)) / 1.5;
      // 빨리 열고 천천히 닫는다 — 말 첫소리는 살리고 꼬리는 자연스럽게.
      gain[k] = g > prev[k] ? g : prev[k] * 0.7 + g * 0.3;
    }
    for (let k = 0; k < bins; k++) {
      const g = (gain[Math.max(0, k - 1)] + 2 * gain[k] + gain[Math.min(bins - 1, k + 1)]) / 4;
      prev[k] = gain[k];
      re[k] *= g;
      im[k] *= g;
    }
    for (let k = 1; k < N / 2; k++) {
      re[N - k] = re[k];
      im[N - k] = -im[k];
    }
    fft(re, im, true);
    const off = f * hop;
    for (let i = 0; i < N; i++) {
      out[off + i] += re[i] * win[i];
      norm[off + i] += win[i] * win[i];
    }
    if (f % 500 === 499) await tick();
  }
  const res = new Float32Array(input.length);
  for (let i = 0; i < res.length; i++) res[i] = norm[i] > 1e-6 ? out[i] / norm[i] : 0;
  return res;
}

/**
 * 쉼 구간 정리 — 주파수 잡음 제거 뒤에도 남는 잔잡음을 말이 없는 동안만 최대 10dB 더 낮춘다.
 * "노이즈 캔슬링 됐다"고 느끼는 건 대부분 쉼이 조용해질 때다. 말소리엔 손대지 않는다.
 */
function gate(d: Float32Array, rate: number): Float32Array {
  const win = Math.round(rate * 0.01);
  const n = Math.floor(d.length / win);
  if (n < 20) return d;
  const env = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = i * win; j < (i + 1) * win; j++) s += d[j] * d[j];
    env[i] = Math.sqrt(s / win);
  }
  const sorted = Array.from(env).sort((a, b) => a - b);
  const noise = sorted[Math.floor(n * 0.15)] + 1e-9;
  const loud = sorted[Math.floor(n * 0.9)] + 1e-9;
  if (loud / noise < 4) return d; // 쉼이 거의 없다 — 건드리지 않는다
  const thr = noise * 3;
  const out = new Float32Array(d.length);
  let g = 1;
  for (let i = 0; i < n; i++) {
    const want = env[i] >= thr ? 1 : Math.max(0.32, env[i] / thr);
    // 빨리 열고(말 첫소리) 천천히 닫는다(말끝 꼬리).
    const target = want > g ? want : g * 0.85 + want * 0.15;
    for (let j = i * win; j < (i + 1) * win; j++) {
      const k = (j - i * win) / win;
      out[j] = d[j] * (g + (target - g) * k);
    }
    g = target;
  }
  for (let j = n * win; j < d.length; j++) out[j] = d[j] * g;
  return out;
}

/** 제자리 radix-2 FFT. inverse 면 1/N 까지 한다. */
function fft(re: Float64Array, im: Float64Array, inverse: boolean) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let j = 0; j < len / 2; j++) {
        const ar = re[i + j];
        const ai = im[i + j];
        const br = re[i + j + len / 2] * cr - im[i + j + len / 2] * ci;
        const bi = re[i + j + len / 2] * ci + im[i + j + len / 2] * cr;
        re[i + j] = ar + br;
        im[i + j] = ai + bi;
        re[i + j + len / 2] = ar - br;
        im[i + j + len / 2] = ai - bi;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
  if (inverse) {
    for (let i = 0; i < n; i++) {
      re[i] /= n;
      im[i] /= n;
    }
  }
}

// ---------- 2) 다듬기 ----------

/** data(rate) 를 OUT_RATE 오프라인 그래프에 흘려 렌더한다. wire 가 비면 그냥 다시 샘플링. */
async function render(
  data: Float32Array,
  rate: number,
  wire: (ctx: OfflineAudioContext, src: AudioNode) => AudioNode | void,
  tail = 0,
): Promise<Float32Array> {
  const length = Math.ceil((data.length * OUT_RATE) / rate) + Math.round(OUT_RATE * tail);
  const ctx = new OfflineAudioContext(1, length, OUT_RATE);
  const buf = ctx.createBuffer(1, data.length, rate);
  buf.getChannelData(0).set(data);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const last = wire(ctx, src) ?? src;
  if (last === src) src.connect(ctx.destination);
  src.start();
  return (await ctx.startRendering()).getChannelData(0);
}

function shape(data: Float32Array): Promise<Float32Array> {
  return render(
    data,
    OUT_RATE,
    (ctx, src) => {
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 85;
      hp.Q.value = 0.7;

      const mud = ctx.createBiquadFilter();
      mud.type = "peaking";
      mud.frequency.value = 280;
      mud.Q.value = 1;
      mud.gain.value = -2.5;

      const presence = ctx.createBiquadFilter();
      presence.type = "peaking";
      presence.frequency.value = 3500;
      presence.Q.value = 0.9;
      presence.gain.value = 3;

      const air = ctx.createBiquadFilter();
      air.type = "highshelf";
      air.frequency.value = 9000;
      air.gain.value = 2;

      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -20;
      comp.knee.value = 10;
      comp.ratio.value = 2;
      comp.attack.value = 0.005;
      comp.release.value = 0.18;

      const wet = ctx.createGain();
      wet.gain.value = 0.12;
      const room = ctx.createConvolver();
      room.buffer = roomImpulse(ctx, 0.55);

      src.connect(hp).connect(mud).connect(presence).connect(air).connect(comp);
      comp.connect(ctx.destination);
      comp.connect(room).connect(wet).connect(ctx.destination);
      return comp;
    },
    0.3,
  );
}

/** 작은 방 울림 — 감쇠하는 잡음. 실제 방을 녹음한 IR 없이도 "부스 느낌"만 낸다. */
function roomImpulse(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const len = Math.round(ctx.sampleRate * seconds);
  const ir = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = ir.getChannelData(0);
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647 - 0.5;
  };
  for (let i = 0; i < len; i++) d[i] = rnd() * 2 * Math.pow(1 - i / len, 3.2);
  return ir;
}

// ---------- 3) 마무리 ----------

function normalize(d: Float32Array, peak: number) {
  let m = 0;
  for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i]));
  if (m < 1e-6) return;
  const g = peak / m;
  for (let i = 0; i < d.length; i++) d[i] *= g;
}

export function encodeWav(d: Float32Array, rate: number): Blob {
  const buf = new ArrayBuffer(44 + d.length * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  str(0, "RIFF");
  v.setUint32(4, 36 + d.length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, d.length * 2, true);
  for (let i = 0; i < d.length; i++) {
    const s = Math.max(-1, Math.min(1, d[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buf], { type: "audio/wav" });
}
