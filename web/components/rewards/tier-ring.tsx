import type { ReactNode } from "react";
import styles from "./rewards.module.css";

/** 받은 ❤ 합계 테두리 — 0 이면 아무것도 안 감싼다. 3 브론즈 · 10 실버 · 30 골드 */
export function TierRing({ tier, children }: { tier: number; children: ReactNode }) {
  if (!tier) return <>{children}</>;
  const cls = tier >= 3 ? styles.t3 : tier === 2 ? styles.t2 : styles.t1;
  const name = tier >= 3 ? "골드" : tier === 2 ? "실버" : "브론즈";
  return (
    <span className={`${styles.ring} ${cls}`} title={`${name} 목소리`}>
      {children}
    </span>
  );
}

/** 테두리 대신 메달 하나 — 이미 다른 링이 있는 곳(홈 동그라미)용 */
export function TierMedal({ tier, children }: { tier: number; children: ReactNode }) {
  if (!tier) return <>{children}</>;
  return (
    <span className={styles.medalWrap}>
      {children}
      <i className={styles.medal} aria-label={tier >= 3 ? "골드 목소리" : tier === 2 ? "실버 목소리" : "브론즈 목소리"}>
        {tier >= 3 ? "🥇" : tier === 2 ? "🥈" : "🥉"}
      </i>
    </span>
  );
}
