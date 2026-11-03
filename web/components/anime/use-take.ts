"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { analyzeBlob, type Analysis } from "@/lib/voice-analysis";

/**
 * 한 테이크 녹음 — 3·2·1 카운트다운 → 녹음(소리 크기 막대) → 멈춤 → 브라우저에서 측정.
 * 서버로 아무것도 안 보낸다. 대결 중 다시 듣기용 blob URL 만 손에 쥔다.
 */
export type TakePhase = "idle" | "count" | "rec" | "busy" | "done" | "error";
export type Take = { url: string; analysis: Analysis };

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
    const meter = () => {
      if (an) {
        an.getByteTimeDomainData(buf);
        let m = 0;
        for (const v of buf) m = Math.max(m, Math.abs(v - 128));
        setLevel(Math.min(1, m / 100));
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
          r.onstop = async () => {
            cleanup();
            void ctx?.close().catch(() => {});
            setLevel(0);
            setPhase("busy");
            const blob = new Blob(chunks, { type: r.mimeType || "audio/webm" });
            try {
              const analysis = await analyzeBlob(blob, null);
              setPhase("done");
              done.current?.({ url: URL.createObjectURL(blob), analysis });
            } catch {
              setPhase("error");
              done.current?.(null);
            }
          };
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
