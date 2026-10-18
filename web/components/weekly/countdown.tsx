"use client";

import { useEffect, useState } from "react";
import { remaining } from "@/lib/weekly";
import styles from "./weekly.module.css";

/**
 * 마감 카운트다운 — 일 · 시 · 분 · 초 네 칸이 1초마다 넘어간다.
 *
 * 정적 페이지라 서버가 그린 시각은 몇 분씩 낡는다. 첫 그림은 칸만 그리고 숫자는
 * 붙은 뒤에 채운다(서버·브라우저 시각이 달라 생기는 하이드레이션 불일치를 피한다).
 */
export function Countdown({
  to,
  opensAt,
  compact = false,
}: {
  to: number;
  /** 주어지면 그 전엔 오픈까지를 세고, 위에 "오픈까지 / 마감까지"를 붙인다. */
  opensAt?: number;
  compact?: boolean;
}) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // 붙은 뒤에야 지금 시각을 안다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const before = opensAt !== undefined && now !== null && now < opensAt;
  const r = now === null ? null : remaining((before ? opensAt! : to) - now);
  const cells: [string, number | null][] = [
    ["일", r?.d ?? null],
    ["시간", r?.h ?? null],
    ["분", r?.m ?? null],
    ["초", r?.s ?? null],
  ];
  const urgent = r !== null && r.d === 0 && r.h < 6;

  const cellsEl = (
    <div
      className={`${compact ? styles.countCompact : styles.count} ${urgent ? styles.countUrgent : ""}`}
      role="timer"
      aria-label={r ? `${r.d}일 ${r.h}시간 ${r.m}분 남음` : "남은 시간"}
    >
      {cells.map(([label, v]) => (
        <span key={label} className={styles.countCell}>
          <b>{v === null ? "--" : String(v).padStart(2, "0")}</b>
          <small>{label}</small>
        </span>
      ))}
    </div>
  );
  if (opensAt === undefined) return cellsEl;
  return (
    <div>
      <p className={styles.countCaption}>{before ? "시즌 오픈까지" : "마감까지"}</p>
      {cellsEl}
    </div>
  );
}
