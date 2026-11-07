"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 릴레이 더빙 소리 — 줄 이어 재생 · 효과음 합성 · 녹음. 브라우저 전용.
 *
 * 이어 재생은 <audio> 하나를 돌려 쓴다(아이폰은 사용자 탭 뒤 같은 요소를 계속 써야 소리가 난다).
 * 다음 줄은 미리 받아 두고(preload), 줄 사이엔 0.15초 쉰다. 주소가 없거나 깨진 줄은
 * 브라우저 TTS(speechSynthesis)로 읽는다 — 서버 TTS 가 막혀도 장면은 들린다.
 */

export type PlayItem = {
  key: string;
  url: string | null;
  /** url 이 없을 때 브라우저 TTS 로 읽을 대사 */
  text?: string;
  /** 이 줄 다음에 붙일 애드리브 녹음 */
  adlib?: string | null;
  /** 이 줄 다음에 낼 효과음 */
  sfx?: string | null;
};

const GAP_MS = 150;

export function usePlaylist() {
  const el = useRef<HTMLAudioElement | null>(null);
  const run = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [index, setIndex] = useState(-1);

  useEffect(() => {
    const a = new Audio();
    a.preload = "auto";
    el.current = a;
    const runRef = run;
    return () => {
      runRef.current++;
      a.pause();
      a.src = "";
      window.speechSynthesis?.cancel();
    };
  }, []);

  const stop = useCallback(() => {
    run.current++;
    el.current?.pause();
    window.speechSynthesis?.cancel();
    setPlaying(false);
    setIndex(-1);
  }, []);

  const playOne = useCallback((url: string | null, text: string | undefined, my: number): Promise<void> => {
    return new Promise((resolve) => {
      const a = el.current;
      if (run.current !== my) return resolve();
      if (!url || !a) {
        if (text && "speechSynthesis" in window) {
          const u = new SpeechSynthesisUtterance(text);
          u.lang = "ko-KR";
          u.rate = 1.05;
          u.onend = () => resolve();
          u.onerror = () => resolve();
          window.speechSynthesis.speak(u);
          // 아무 소리도 안 나는 기기 — 길이만큼 기다렸다 넘긴다
          setTimeout(resolve, Math.max(1500, text.length * 220));
        } else resolve();
        return;
      }
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        a.onended = null;
        a.onerror = null;
        resolve();
      };
      a.onended = finish;
      a.onerror = () => {
        // 녹음을 못 받으면 대사라도 읽는다
        finish();
      };
      a.src = url;
      a.currentTime = 0;
      void a.play().catch(finish);
      // 멈춘 채로 걸리지 않게 — 최대 20초
      setTimeout(finish, 20_000);
    });
  }, []);

  /** items 를 from 부터 to 까지 차례로. onStep(i) 로 지금 줄을 알린다. 다 들으면 true. */
  const play = useCallback(
    async (items: PlayItem[], opts: { from?: number; to?: number; onDone?: (complete: boolean) => void } = {}) => {
      const my = ++run.current;
      window.speechSynthesis?.cancel();
      setPlaying(true);
      const from = opts.from ?? 0;
      const to = Math.min(items.length - 1, opts.to ?? items.length - 1);
      for (let i = from; i <= to; i++) {
        if (run.current !== my) return;
        setIndex(i);
        const it = items[i];
        // 다음 줄 미리 받기
        const next = items[i + 1]?.url;
        if (next) {
          const pre = new Audio();
          pre.preload = "auto";
          pre.src = next;
        }
        await playOne(it.url, it.text, my);
        if (it.adlib) await playOne(it.adlib, undefined, my);
        if (it.sfx && run.current === my) await playSfx(it.sfx);
        await new Promise((r) => setTimeout(r, GAP_MS));
      }
      if (run.current !== my) return;
      setPlaying(false);
      setIndex(-1);
      opts.onDone?.(true);
    },
    [playOne],
  );

  return { play, stop, playing, index };
}

// ---- 효과음 — 파일 없이 합성 ----

let ctx: AudioContext | null = null;
function audioCtx(): AudioContext | null {
  try {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx ??= new C();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function noise(c: AudioContext, sec: number): AudioBufferSourceNode {
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * sec), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = c.createBufferSource();
  s.buffer = buf;
  return s;
}

function env(c: AudioContext, peak: number, attack: number, decay: number, at = c.currentTime): GainNode {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  g.connect(c.destination);
  return g;
}

function tone(c: AudioContext, type: OscillatorType, f0: number, f1: number, at: number, dur: number, peak: number) {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, at);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), at + dur);
  o.connect(env(c, peak, 0.01, dur, at));
  o.start(at);
  o.stop(at + dur + 0.05);
}

/** 효과음 하나 — 끝날 때까지 기다린다 */
export function playSfx(id: string): Promise<void> {
  const c = audioCtx();
  if (!c) return Promise.resolve();
  const t = c.currentTime + 0.02;
  let len = 0.8;
  switch (id) {
    case "boom": {
      const n = noise(c, 1.4);
      const f = c.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.setValueAtTime(900, t);
      f.frequency.exponentialRampToValueAtTime(60, t + 1.2);
      n.connect(f).connect(env(c, 0.9, 0.01, 1.3, t));
      n.start(t);
      tone(c, "sine", 90, 30, t, 0.8, 0.8);
      len = 1.4;
      break;
    }
    case "heart":
      for (const k of [0, 0.22, 0.8, 1.02]) tone(c, "sine", 70, 40, t + k, 0.16, 0.9);
      len = 1.3;
      break;
    case "whoosh": {
      const n = noise(c, 0.7);
      const f = c.createBiquadFilter();
      f.type = "bandpass";
      f.Q.value = 2;
      f.frequency.setValueAtTime(300, t);
      f.frequency.exponentialRampToValueAtTime(3000, t + 0.5);
      n.connect(f).connect(env(c, 0.6, 0.25, 0.4, t));
      n.start(t);
      len = 0.7;
      break;
    }
    case "ding":
      tone(c, "sine", 1320, 1310, t, 1.1, 0.4);
      tone(c, "sine", 2640, 2630, t, 0.6, 0.12);
      len = 1.1;
      break;
    case "thunder": {
      const n = noise(c, 2.2);
      const f = c.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = 400;
      n.connect(f).connect(env(c, 1, 0.05, 2, t));
      n.start(t);
      const crack = noise(c, 0.2);
      crack.connect(env(c, 0.5, 0.005, 0.18, t));
      crack.start(t);
      len = 2;
      break;
    }
    case "drum":
      for (let i = 0; i < 14; i++) tone(c, "triangle", 180, 90, t + i * 0.07, 0.06, 0.35 + i * 0.02);
      tone(c, "sine", 120, 50, t + 1.0, 0.5, 0.9);
      len = 1.5;
      break;
    case "door": {
      tone(c, "square", 110, 50, t, 0.25, 0.5);
      const n = noise(c, 0.3);
      n.connect(env(c, 0.7, 0.003, 0.25, t));
      n.start(t);
      len = 0.5;
      break;
    }
    case "sparkle":
      [1568, 1976, 2349, 3136].forEach((f, i) => tone(c, "sine", f, f, t + i * 0.08, 0.35, 0.18));
      len = 0.7;
      break;
    default:
      return Promise.resolve();
  }
  return new Promise((r) => setTimeout(r, len * 1000));
}

// ---- 녹음 ----

export type RecState = "idle" | "count" | "rec" | "done";

/**
 * 짧은 녹음 하나 — 3·2·1 뒤에 녹음, maxMs 가 지나면 저절로 멈춘다.
 * 측정이 아니라 연기라서 브라우저 잡음 제거·음량 보정은 켜 둔다(연습실과 다르다).
 */
export function useRecorder() {
  const [state, setState] = useState<RecState>("idle");
  const [count, setCount] = useState(3);
  const [level, setLevel] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [duration, setDuration] = useState(0);
  const stream = useRef<MediaStream | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const timers = useRef<number[]>([]);
  const cancelled = useRef(false);

  const cleanup = useCallback(() => {
    timers.current.forEach((x) => clearTimeout(x));
    timers.current = [];
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }, []);
  useEffect(() => () => cleanup(), [cleanup]);

  const reset = useCallback(() => {
    cancelled.current = true;
    if (rec.current && rec.current.state !== "inactive") rec.current.stop();
    cleanup();
    setState("idle");
    setBlob(null);
    setLevel(0);
    setElapsed(0);
  }, [cleanup]);

  const start = useCallback(
    async (maxMs: number, opts: { countdown?: boolean; onStart?: () => void } = {}) => {
      setError(null);
      setBlob(null);
      if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setError("이 브라우저는 녹음을 지원하지 않아요. 크롬이나 사파리로 열어 주세요");
        return;
      }
      let live: MediaStream;
      try {
        live = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      } catch {
        setError("마이크를 허용해야 녹음할 수 있어요 🎙️");
        return;
      }
      stream.current = live;
      cancelled.current = false;
      let analyser: AnalyserNode | null = null;
      const c = audioCtx();
      if (c) {
        try {
          analyser = c.createAnalyser();
          analyser.fftSize = 512;
          c.createMediaStreamSource(live).connect(analyser);
        } catch {
          analyser = null;
        }
      }
      const begin = () => {
        if (cancelled.current) return;
        const chunks: Blob[] = [];
        const r = new MediaRecorder(live);
        rec.current = r;
        r.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
        const t0 = performance.now();
        r.onstop = () => {
          const ms = performance.now() - t0;
          cleanup();
          if (cancelled.current) return;
          const b = new Blob(chunks, { type: r.mimeType || "audio/webm" });
          if (b.size < 800) {
            setState("idle");
            setError("소리가 안 잡혔어요. 다시 해 볼까요?");
            return;
          }
          setDuration(Math.round(ms) / 1000);
          setBlob(b);
          setState("done");
        };
        r.start();
        opts.onStart?.();
        setState("rec");
        const buf = new Uint8Array(analyser?.fftSize ?? 512);
        let smooth = 0;
        const loop = () => {
          if (r.state === "inactive") return;
          const ms = performance.now() - t0;
          setElapsed(ms);
          if (analyser) {
            analyser.getByteTimeDomainData(buf);
            let s = 0;
            for (let i = 0; i < buf.length; i++) {
              const v = (buf[i] - 128) / 128;
              s += v * v;
            }
            smooth = smooth * 0.7 + Math.min(1, Math.sqrt(s / buf.length) * 4) * 0.3;
            setLevel(smooth);
          }
          if (ms >= maxMs) r.stop();
          else requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
      };
      if (opts.countdown === false) return begin();
      setState("count");
      setCount(3);
      timers.current.push(window.setTimeout(() => setCount(2), 700));
      timers.current.push(window.setTimeout(() => setCount(1), 1400));
      timers.current.push(window.setTimeout(begin, 2100));
    },
    [cleanup],
  );

  const stop = useCallback(() => {
    if (rec.current && rec.current.state !== "inactive") rec.current.stop();
  }, []);

  return { state, count, level, elapsed, error, blob, duration, start, stop, reset, setError };
}
