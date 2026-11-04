"use client";

import Link from "next/link";
import { useT } from "@/components/lang";
import { usePass } from "@/components/pass/use-pass";
import { LevelPill } from "@/components/pass/look";
import styles from "./home.module.css";

/**
 * 홈 맨 위 한 줄 — 🔥 연속 기록 · 레벨. 매일 올 이유가 첫 화면에 보이게(듀오링고).
 * 한 번도 연습 안 한 사람에겐 안 띄운다(첫 미션이 맡는다).
 */
export function StreakChip() {
  const t = useT();
  const v = usePass();
  if (!v || v.stats.activeDays === 0) return null;
  const n = v.stats.streak;
  return (
    <Link href="/practice" className={styles.streakChip}>
      <span className={styles.streakFire} aria-hidden="true">
        🔥
      </span>
      <span className={styles.streakText}>
        {n > 0 ? (
          <>
            <b>{t(`${n}일째`, `${n}-day streak`)}</b>
            <small>{t("오늘도 한 줄 읽고 이어 가기", "Read one line today to keep it")}</small>
          </>
        ) : (
          <>
            <b>{t("연속 기록이 끊겼어요", "Streak lost")}</b>
            <small>{t("오늘 한 줄 읽으면 다시 1일째", "Read one line to start again")}</small>
          </>
        )}
      </span>
      <LevelPill level={v.progress.level} rank={v.look.rank} compact />
    </Link>
  );
}
