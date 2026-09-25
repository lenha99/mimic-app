"use client";

import { useEffect, useState } from "react";
import type { Avatar } from "@/lib/avatar";
import { VoiceAvatar } from "./voice-avatar";

/**
 * 혼자서 "무야~호" 하고 외치는 캐릭터 — 홈 첫 화면용.
 *
 * 설명보다 한 번 보여주는 게 빠르다. "녹음하면 이 녀석이 네 목소리로 외친다"를
 * 첫 화면에서 글 없이 전한다. "무야~" 짧게, "호!" 크게 외치고 쉬기를 반복한다.
 * 움직임을 줄이는 설정이면 입을 반쯤 연 채로 멈춰 둔다.
 */
const CYCLE_S = 2.1;

/** "무야~"(짧게) 한 번, "호!"(크게) 한 번. 나머지는 숨 고르기. */
function shout(t: number): number {
  const hump = (from: number, len: number, peak: number) =>
    t >= from && t < from + len ? Math.sin(((t - from) / len) * Math.PI) * peak : 0;
  return hump(0, 0.45, 0.6) + hump(0.55, 0.6, 1);
}

export function ShoutingAvatar({ avatar, size = 150 }: { avatar: Avatar; size?: number }) {
  const [level, setLevel] = useState(0.45);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let start = -1;
    let last = 0;
    const loop = (now: number) => {
      if (start < 0) start = now;
      // 30fps 면 입 모양으로 충분하다. 매 프레임 다시 그릴 이유가 없다.
      if (now - last > 33) {
        last = now;
        setLevel(shout(((now - start) / 1000) % CYCLE_S));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <VoiceAvatar avatar={avatar} level={level} size={size} />;
}
