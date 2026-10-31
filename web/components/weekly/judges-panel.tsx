"use client";

import { useLang, useT } from "@/components/lang";
import type { Verdict } from "@/lib/judges";
import styles from "./judges-panel.module.css";

/** 출전 직후 심사위원 한 줄 평. 하나씩 늦게 떠서 "듣고 반응하는" 느낌을 낸다. */
export function JudgesPanel({ verdicts }: { verdicts: Verdict[] }) {
  const t = useT();
  const lang = useLang();
  const hidden = verdicts.some((v) => v.judge.hidden);
  return (
    <div className={styles.panel} aria-live="polite">
      <p className={styles.head}>
        {hidden ? t("✨ 히든 심사위원 등장!", "✨ Secret judge appeared!") : t("심사위원 반응", "Judges say")}
      </p>
      {verdicts.map((v, i) => (
        <div
          key={v.judge.id}
          className={`${styles.row} ${v.judge.hidden ? styles.rowHidden : ""}`}
          style={{ animationDelay: `${0.5 + i * 0.9}s` }}
        >
          <span className={styles.face} aria-hidden="true">
            {v.judge.emoji}
          </span>
          <span className={styles.bubble}>
            <b>{lang === "en" ? v.judge.name[1] : v.judge.name[0]}</b>
            {v.line}
          </span>
        </div>
      ))}
    </div>
  );
}
