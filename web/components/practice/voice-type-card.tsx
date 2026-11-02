"use client";

import { Coco } from "@/components/brand/coco";
import { useT } from "@/components/lang";
import type { VoiceType } from "@/lib/scorecard";
import styles from "./voice-type-card.module.css";

/** 목소리 타입 한 장 — 출전 직전·직후. 잰 근거를 같이 적어 "랜덤 운세"가 아니게 한다. */
export function VoiceTypeCard({ type }: { type: VoiceType | null }) {
  const L = useT();
  if (!type) return null;
  return (
    <div className={styles.card}>
      <Coco mood="wow" size={40} />
      <p>
        <small>{L("이 테이크의 목소리 타입", "Voice type for this take")}</small>
        <b>{type.name}</b>
        <em>{type.desc}</em>
        <span>{type.why}</span>
      </p>
    </div>
  );
}
