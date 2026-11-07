"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 한 테이크 녹음 — 3·2·1 카운트다운 → 녹음(소리 크기 막대) → 멈춤.
 * 멈추는 즉시 테이크를 돌려준다. 예전엔 여기서 브라우저 분석(디코드·억양 측정)을 끝낸 뒤에야
 * 서버로 보냈는데, 그 시간이 고스란히 "점수가 늦다"였다. 무음 판정은 녹음 중 소리 막대의
 * 최대값(peak)으로 한다 — 이미 손에 있는 값이라 기다릴 게 없다.
 * env 는 녹음 중 소리 크기를 촘촘히 적은 것 — 채점 기다리는 동안 내 파형으로 그린다.
 */
export type TakePhase = "idle" | "count" | "rec" | "busy" | "done" | "error";
export type Take = { url: string; blob: Blob; peak: number; seconds: number; env: number[]; silent: boolean };

/** 이보다 작게만 들어왔으면 "소리가 안 들렸어요" — 서버에 안 보낸다 */
const SILENT_PEAK = 0.03;
const SILENT_SECONDS = 0.4;

export function useTake(maxSeconds: number) {
  const [phase, setPhase] = useState<TakePhase>("idle");
  const [count, setCount] = useState(3);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<"nomic" | "unsupported" | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timers = useRef<number[]>([]);
  const raf = useRef(0);
  const done = useRef<((t: Take | null) => void) | null>(null);

  const cleanup = useCallback(() => {
    timers.current.forEach((x) => window.clearTimeout(x));
    timers.current = [];
    cancelAnimationFrame(raf.current);
    stream.current?.getTracks().forEach((x) => x.stop());
    stream.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const stop = useCallback(() => {
    if (rec.current?.state === "recording") rec.current.stop();
  }, []);

  /** 카운트다운부터 측정까지. 끝나면 테이크(실패면 null) */
  const start = useCallback(async (): Promise<Take | null> => {
    setError(null);
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("unsupported");
      setPhase("error");
      return null;
    }
    let live: MediaStream;
    try {
      live = await navigator.mediaDevices.getUserMedia({
        audio: { autoGainControl: false, noiseSuppression: false, echoCancellation: false },
      });
    } catch {
      setError("nomic");
      setPhase("error");
      return null;
    }
    stream.current = live;

    // 소리 크기 막대 — 외치는 맛이 화면에 보여야 한다.
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    const ctx = Ctor ? new Ctor() : null;
    const an = ctx?.createAnalyser();
    if (ctx && an) {
      an.fftSize = 512;
      ctx.createMediaStreamSource(live).connect(an);
    }
    const buf = new Uint8Array(an?.fftSize ?? 0);
    let peak = 0;
    const env: number[] = [];
    const meter = () => {
      if (an) {
        an.getByteTimeDomainData(buf);
        let m = 0;
        for (const v of buf) m = Math.max(m, Math.abs(v - 128));
        const lv = Math.min(1, m / 100);
        peak = Math.max(peak, lv);
        env.push(lv);
        setLevel(lv);
      }
      raf.current = requestAnimationFrame(meter);
    };

    return new Promise<Take | null>((resolve) => {
      done.current = resolve;
      setPhase("count");
      setCount(3);
      [2, 1].forEach((n, i) => timers.current.push(window.setTimeout(() => setCount(n), (i + 1) * 700)));
      timers.current.push(
        window.setTimeout(() => {
          const chunks: Blob[] = [];
          const r = new MediaRecorder(live);
          rec.current = r;
          r.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.push(e.data);
          };
          let began = 0;
          r.onstop = () => {
            cleanup();
            void ctx?.close().catch(() => {});
            setLevel(0);
            const blob = new Blob(chunks, { type: r.mimeType || "audio/webm" });
            const seconds = (performance.now() - began) / 1000;
            // 소리 막대를 못 만든 브라우저(AudioContext 없음)는 peak 를 모른다 — 서버에 맡긴다
            const silent = Boolean(an) && (peak < SILENT_PEAK || seconds < SILENT_SECONDS);
            setPhase("done");
            done.current?.({ url: URL.createObjectURL(blob), blob, peak, seconds, env: squeeze(env, 48), silent });
          };
          began = performance.now();
          r.start();
          setPhase("rec");
          meter();
          timers.current.push(window.setTimeout(() => r.state === "recording" && r.stop(), maxSeconds * 1000));
        }, 2100),
      );
    });
  }, [cleanup, maxSeconds]);

  const reset = useCallback(() => {
    setPhase("idle");
    setLevel(0);
  }, []);

  return { phase, count, level, error, start, stop, reset };
}

/** 프레임마다 적은 소리 크기를 n 칸으로 줄인다(칸마다 최대값) */
function squeeze(xs: number[], n: number): number[] {
  if (!xs.length) return Array(n).fill(0);
  return Array.from({ length: n }, (_, i) => {
    const a = Math.floor((i * xs.length) / n);
    const b = Math.max(a + 1, Math.floor(((i + 1) * xs.length) / n));
    return Math.max(...xs.slice(a, b));
  });
}
