"use client";

import { useT } from "@/components/lang";
import { Spotlight } from "@/components/voices/cards";
import { PlayerProvider } from "@/components/voices/player";
import type { GalleryEntry } from "@/lib/weekly-server";

/** 홈 — 운영자 픽. 주가 바뀌어도 내려가지 않는다(좋은 목소리가 월요일에 묻히지 않게). */
export function HomePick({ picks }: { picks: GalleryEntry[] }) {
  const t = useT();
  if (!picks.length) return null;
  return (
    <PlayerProvider>
      <Spotlight picks={picks} title={t("지금 들어 볼 목소리", "Listen to this voice")} />
    </PlayerProvider>
  );
}
