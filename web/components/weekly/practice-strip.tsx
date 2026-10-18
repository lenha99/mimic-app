"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { currentWeek, isLive, seasonLabel, type Week } from "@/lib/weekly";
import styles from "./weekly.module.css";

/**
 * 연습실 목차 맨 위 — 이번 주 챌린지 대본으로 가는 지름길.
 * 연습하다가 "이거 올려볼까"가 생기는 곳이 연습실이라, 입구를 여기에도 둔다.
 */
export function PracticeStrip() {
  const [state, setState] = useState<{ week: Week; live: boolean } | null>(null);
  useEffect(() => {
    // 정적 페이지 — 지금이 어느 주인지는 붙은 뒤에 안다.
    const w = currentWeek();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ week: w, live: isLive(w) });
  }, []);
  if (!state) return null;
  const { week, live } = state;
  return (
    <Link href={`/practice/${week.scriptId}?from=weekly`} className={styles.strip}>
      <span className={styles.stripIcon} aria-hidden="true">
        🏆
      </span>
      <span className={styles.stripText}>
        <small>
          {seasonLabel(week)} · {live ? "이번 주 챌린지" : "월요일 오픈"}
        </small>
        <b>
          {week.emoji} {week.title}
        </b>
      </span>
      <span className={styles.stripGo}>연습하고 출전 →</span>
    </Link>
  );
}
