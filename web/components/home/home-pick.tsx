"use client";

import { useT } from "@/components/lang";
import { Spotlight } from "@/components/voices/cards";
import { PlayerProvider } from "@/components/voices/player";
import type { GalleryEntry } from "@/lib/weekly-server";
import styles from "./home.module.css";

/** 홈 — 운영자 픽. 주가 바뀌어도 내려가지 않는다(좋은 목소리가 월요일에 묻히지 않게). */
export function HomePick({ picks }: { picks: GalleryEntry[] }) {
  const t = useT();
  if (!picks.length) return null;
  return (
    <PlayerProvider>
      {/* 위 연습실 카드와 확실히 떨어뜨린다 — 붙어 있으면 연습실 카드의 일부처럼 보인다. */}
      <div className={styles.pick}>
        <Spotlight picks={picks} title={t("지금 들어 볼 목소리", "Listen to this voice")} />
      </div>
    </PlayerProvider>
  );
}
