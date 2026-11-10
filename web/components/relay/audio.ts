"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 릴레이 더빙 소리 — 줄 이어 재생 · 녹음. 브라우저 전용.
 *
 * 이어 재생은 <audio> 하나를 돌려 쓴다(아이폰은 사용자 탭 뒤 같은 요소를 계속 써야 소리가 난다).
 *
 * 끊김 없이 이어지게:
 * - 줄 소리는 미리 통째로 받아 기기 안 주소(blob:)로 튼다. /api/relay/audio 는 매번 서버를 거쳐
 *   서명 주소로 넘겨 주는데, 이걸 재생 순간에 하면 줄마다 0.5~2초씩 멈췄다. 받아 둔 건 다시 들을 때도 바로 나온다.
 * - 지금 줄을 트는 동안 뒤 3줄을 받아 둔다.
 * - 줄마다 이벤트를 따로 걸고 끝나면 떼어 낸다. 예전엔 앞 줄의 20초 안전 타이머가 늦게 터지면서
 *   지금 줄의 "끝남" 처리를 지워 버려, 이어 듣기가 중간에 멈추는 일이 있었다.
 * 주소가 없거나 받지 못한 줄은 브라우저 TTS(speechSynthesis)로 읽는다 — 서버 TTS 가 막혀도 장면은 들린다.
 */

export type PlayItem = {
  key: string;
  url: string | null;
  /** url 이 없을 때 브라우저 TTS 로 읽을 대사 */
  text?: string;
  /** 이 줄 다음에 붙일 애드리브 녹음 */
  adlib?: string | null;
};

const GAP_MS = 120;
const AHEAD = 3;

// ---- 미리 받기 (기기 안 캐시) ----

const MAX_CACHED = 48;
const cache = new Map<string, Promise<string | null>>();

/** 소리 파일을 통째로 받아 blob: 주소로. 실패하면 null(재생 땐 원래 주소로 한 번 더 시도한다). */
export function prefetchAudio(url: string | null | undefined): Promise<string | null> {
  if (!url) return Promise.resolve(null);
  if (url.startsWith("blob:") || url.startsWith("data:")) return Promise.resolve(url);
  const hit = cache.get(url);
  if (hit) {
    // 최근에 쓴 것을 뒤로 — 오래 안 쓴 것부터 지운다
    cache.delete(url);
    cache.set(url, hit);
    return hit;
  }
  const p = fetch(url)
    .then((r) => (r.ok ? r.blob() : null))
    .then((b) => (b && b.size > 0 ? URL.createObjectURL(b) : null))
    .catch(() => null);
  cache.set(url, p);
  void p.then((v) => {
    if (!v && cache.get(url) === p) cache.delete(url); // 실패는 기억하지 않는다 — 다음에 다시 받는다
  });
  while (cache.size > MAX_CACHED) {
    const oldest = cache.keys().next().value as string;
    const old = cache.get(oldest);
    cache.delete(oldest);
    // 지금 틀고 있을 수도 있으니 조금 뒤에 놓는다
    void old?.then((u) => u && setTimeout(() => URL.revokeObjectURL(u), 60_000));
  }
  return p;
}

/** 곧 틀 줄들을 미리 받아 둔다 (앞에서부터 n개) */
export function warmAudio(items: (PlayItem | null | undefined)[], n = AHEAD + 1) {
  for (const it of items.slice(0, n)) {
    if (!it) continue;
    void prefetchAudio(it.url);
    if (it.adlib) void prefetchAudio(it.adlib);
  }
}

/** p 가 ms 안에 안 끝나면 null */
function within<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]);
}

export function usePlaylist() {
  const el = useRef<HTMLAudioElement | null>(null);
  const run = useRef(0);
  /** 지금 재생 중인 한 줄을 바로 끝내는 함수 — 멈추면 기다리던 약속이 곧장 풀린다 */
  const cancelCur = useRef<(() => void) | null>(null);
  const [playing, setPlaying] = useState(false);
  const [index, setIndex] = useState(-1);

  useEffect(() => {
    const a = new Audio();
    a.preload = "auto";
    a.setAttribute("playsinline", "");
    el.current = a;
    const runRef = run;
    const curRef = cancelCur;
    return () => {
      runRef.current++;
      curRef.current?.();
      a.pause();
      a.removeAttribute("src");
      window.speechSynthesis?.cancel();
    };
  }, []);

  const stop = useCallback(() => {
    run.current++;
    cancelCur.current?.();
    el.current?.pause();
    window.speechSynthesis?.cancel();
    setPlaying(false);
    setIndex(-1);
  }, []);

  /** 브라우저 TTS 로 한 줄 */
  const speak = useCallback((text: string, my: number): Promise<void> => {
    return new Promise((resolve) => {
      if (run.current !== my || !("speechSynthesis" in window)) return resolve();
      let done = false;
      let timer = 0;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (cancelCur.current === finish) cancelCur.current = null;
        resolve();
      };
      cancelCur.current = finish;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "ko-KR";
      u.rate = 1.05;
      u.onend = finish;
      u.onerror = finish;
      window.speechSynthesis.speak(u);
      // 아무 소리도 안 나는 기기 — 길이만큼 기다렸다 넘긴다
      timer = window.setTimeout(finish, Math.max(2500, text.length * 260));
    });
  }, []);

  /** <audio> 로 주소 하나. 끝까지 들으면 true, 못 틀면 false */
  const playSrc = useCallback((src: string, my: number): Promise<boolean> => {
    return new Promise((resolve) => {
      const a = el.current;
      if (!a || run.current !== my) return resolve(true);
      let done = false;
      let timer = 0;
      const arm = (ms: number) => {
        clearTimeout(timer);
        timer = window.setTimeout(() => finish(true), ms);
      };
      const onEnded = () => finish(true);
      const onError = () => finish(false);
      const onPlaying = () => {
        // 길이를 알면 길이 + 여유, 모르면(브라우저 녹음 webm) 넉넉히 — 멈춘 채로 걸리지만 않게
        const d = a.duration;
        arm(Number.isFinite(d) && d > 0 ? (d - a.currentTime) * 1000 + 2500 : 45_000);
      };
      function finish(ok: boolean) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        a!.removeEventListener("ended", onEnded);
        a!.removeEventListener("error", onError);
        a!.removeEventListener("playing", onPlaying);
        if (cancelCur.current === cancel) cancelCur.current = null;
        resolve(ok);
      }
      const cancel = () => finish(true);
      cancelCur.current = cancel;
      a.addEventListener("ended", onEnded);
      a.addEventListener("error", onError);
      a.addEventListener("playing", onPlaying);
      a.src = src;
      try {
        a.currentTime = 0;
      } catch {}
      // 받는 데 너무 오래 걸리면 넘긴다
      arm(12_000);
      void a.play().catch(() => finish(false));
    });
  }, []);

  /** 한 줄 — 받아 둔 소리 → 원래 주소 → TTS 순으로 */
  const playOne = useCallback(
    async (url: string | null, text: string | undefined, my: number): Promise<void> => {
      if (run.current !== my) return;
      if (url) {
        const local = await within(prefetchAudio(url), 8_000);
        if (run.current !== my) return;
        if (local && (await playSrc(local, my))) return;
        if (run.current !== my) return;
        if (!local && (await playSrc(url, my))) return;
        if (run.current !== my) return;
      }
      if (text) await speak(text, my);
    },
    [playSrc, speak],
  );

  /** items 를 from 부터 to 까지 차례로. 다 들으면 onDone(true). 중간에 멈추면 부르지 않는다. */
  const play = useCallback(
    async (items: PlayItem[], opts: { from?: number; to?: number; onDone?: (complete: boolean) => void } = {}) => {
      cancelCur.current?.();
      el.current?.pause();
      const my = ++run.current;
      window.speechSynthesis?.cancel();
      setPlaying(true);
      const from = opts.from ?? 0;
      const to = Math.min(items.length - 1, opts.to ?? items.length - 1);
      for (let i = from; i <= to; i++) {
        if (run.current !== my) return;
        setIndex(i);
        warmAudio(items.slice(i, Math.min(to, i + AHEAD) + 1));
        const it = items[i];
        await playOne(it.url, it.text, my);
        if (it.adlib) await playOne(it.adlib, undefined, my);
        if (i < to) await new Promise((r) => setTimeout(r, GAP_MS));
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

// ---- 오디오 컨텍스트 ----

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

// ---- 녹음 ----

export type RecState = "idle" | "count" | "rec" | "done";

const MIC: MediaStreamConstraints = { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } };
const live = (m: MediaStream | null) => !!m && m.getAudioTracks().some((t) => t.readyState === "live");

/**
 * 짧은 녹음 하나 — 3·2·1 뒤에 녹음, maxMs 가 지나면 저절로 멈춘다.
 * 측정이 아니라 연기라서 브라우저 잡음 제거·음량 보정은 켜 둔다(연습실과 다르다).
 *
 * prepare() 로 마이크를 먼저 열어 두면 start() 가 기다림 없이 바로 녹음한다 — 앞 대사(큐)가
 * 끝나자마자 녹음이 시작돼야 하는데, 큐가 끝난 뒤에 마이크를 열면 기기에 따라 1~3초 늦었다.
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
  const source = useRef<MediaStreamAudioSourceNode | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const timers = useRef<number[]>([]);
  const cancelled = useRef(false);

  const cleanup = useCallback(() => {
    timers.current.forEach((x) => clearTimeout(x));
    timers.current = [];
    try {
      source.current?.disconnect();
    } catch {}
    source.current = null;
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

  /** 마이크를 미리 연다. 못 열면 false (오류 문구는 error 에) */
  const prepare = useCallback(async (): Promise<boolean> => {
    if (live(stream.current)) return true;
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("이 브라우저는 녹음을 지원하지 않아요. 크롬이나 사파리로 열어 주세요");
      return false;
    }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia(MIC);
      return true;
    } catch {
      setError("마이크를 허용해야 녹음할 수 있어요 🎙️");
      return false;
    }
  }, []);

  const start = useCallback(
    async (maxMs: number, opts: { countdown?: boolean; onStart?: () => void } = {}) => {
      setError(null);
      setBlob(null);
      if (!(await prepare())) return;
      const mic = stream.current!;
      cancelled.current = false;
      let analyser: AnalyserNode | null = null;
      const c = audioCtx();
      if (c) {
        try {
          analyser = c.createAnalyser();
          analyser.fftSize = 512;
          source.current = c.createMediaStreamSource(mic);
          source.current.connect(analyser);
        } catch {
          analyser = null;
        }
      }
      const begin = () => {
        if (cancelled.current) return;
        const chunks: Blob[] = [];
        let r: MediaRecorder;
        try {
          r = new MediaRecorder(mic);
        } catch {
          cleanup();
          setState("idle");
          setError("녹음을 시작하지 못했어요. 다시 눌러 주세요");
          return;
        }
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
        let lastUi = -1e9;
        const loop = () => {
          if (r.state === "inactive") return;
          const ms = performance.now() - t0;
          // 화면은 초당 20번만 — 매 프레임 다시 그리면 저사양 폰이 버벅인다
          const ui = ms - lastUi >= 50;
          if (ui) {
            lastUi = ms;
            setElapsed(ms);
          }
          if (analyser) {
            analyser.getByteTimeDomainData(buf);
            let s = 0;
            for (let i = 0; i < buf.length; i++) {
              const v = (buf[i] - 128) / 128;
              s += v * v;
            }
            smooth = smooth * 0.7 + Math.min(1, Math.sqrt(s / buf.length) * 4) * 0.3;
            if (ui) setLevel(smooth);
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
    [cleanup, prepare],
  );

  const stop = useCallback(() => {
    if (rec.current && rec.current.state !== "inactive") rec.current.stop();
  }, []);

  return { state, count, level, elapsed, error, blob, duration, prepare, start, stop, reset, setError };
}
