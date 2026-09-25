"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * 재생 중인 <audio> 의 지금 소리 크기(0~1). 캐릭터 입 모양을 여기서 받는다.
 *
 * <audio> 에 Web Audio 분석기를 직접 물리지 않는다. createMediaElementSource 는
 * CORS 헤더가 없는 소리를 무음으로 만들어서, 분석이 실패하면 재생까지 같이 죽는다.
 * 대신 파일을 한 번 따로 받아 포락선(시간별 크기)을 미리 계산해 두고, 재생 위치로
 * 꺼내 쓴다. 이 경로가 실패해도 재생은 멀쩡하고 캐릭터만 대충 움직인다.
 */
const FPS = 30;

export function usePlaybackLevel(
  audio: RefObject<HTMLAudioElement | null>,
  src: string | null,
  active: boolean,
): number {
  const [level, setLevel] = useState(0);
  const envelope = useRef<Float32Array | null>(null);

  useEffect(() => {
    envelope.current = null;
    if (!src) return;
    let cancelled = false;
    void loadEnvelope(src).then((env) => {
      if (!cancelled) envelope.current = env;
    });
    return () => {
      cancelled = true;
    };
  }, [src]);

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const loop = () => {
      const t = audio.current?.currentTime ?? 0;
      const env = envelope.current;
      if (env) {
        setLevel(env[Math.min(env.length - 1, Math.floor(t * FPS))] ?? 0);
      } else {
        // 포락선을 못 만들었을 때(디코드 불가 형식 등) — 말하는 척이라도 한다.
        setLevel(0.3 + 0.25 * Math.abs(Math.sin(t * 9)));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active, audio]);

  // 멈추면 입을 닫는다. 마지막 프레임 값이 남아 있어도 여기서 가린다.
  return active ? level : 0;
}

async function loadEnvelope(src: string): Promise<Float32Array | null> {
  let ctx: AudioContext | null = null;
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    const data = await res.arrayBuffer();

    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    const buf = await ctx.decodeAudioData(data);

    const ch = buf.getChannelData(0);
    const step = Math.max(1, Math.floor(buf.sampleRate / FPS));
    const out = new Float32Array(Math.ceil(ch.length / step));
    for (let i = 0; i < out.length; i += 1) {
      let sum = 0;
      const end = Math.min(ch.length, (i + 1) * step);
      for (let j = i * step; j < end; j += 1) sum += ch[j] * ch[j];
      out[i] = Math.sqrt(sum / Math.max(1, end - i * step));
    }

    // 녹음마다 크기가 제각각이라 자기 최댓값 기준으로 편다. 튀는 한 프레임에 끌려가지
    // 않게 상위 5% 지점을 천장으로 쓴다.
    const sorted = Array.from(out).sort((a, b) => a - b);
    const ceil = sorted[Math.floor(sorted.length * 0.95)] || 1;
    for (let i = 0; i < out.length; i += 1) {
      out[i] = Math.min(1, Math.pow(out[i] / ceil, 0.7));
    }
    return out;
  } catch {
    return null;
  } finally {
    void ctx?.close().catch(() => {});
  }
}
