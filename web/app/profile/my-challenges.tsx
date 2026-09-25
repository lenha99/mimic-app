"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "./profile.module.css";

export type MyChallenge = {
  id: string;
  title: string;
  emoji: string;
  line: string | null;
  status: "pending" | "approved" | "rejected";
};

const STATUS: Record<MyChallenge["status"], string> = {
  pending: "검토 중 · 링크는 됨",
  approved: "홈에 올라감",
  rejected: "반려됨",
};

/** 내가 만든 챌린지 — 상태를 보고, 링크를 다시 던진다. */
export function MyChallenges({ items }: { items: MyChallenge[] }) {
  const [copied, setCopied] = useState<string | null>(null);

  const send = async (c: MyChallenge) => {
    const url = `${window.location.origin}/record/${c.id}`;
    const text = `내 목소리 따라해봐 ${c.emoji} "${c.line || c.title}"`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "MIMIC", text, url });
      } catch {
        // 시트를 닫은 것뿐이다.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setCopied(c.id);
      window.setTimeout(() => setCopied(null), 2400);
    } catch {
      // 복사가 막힌 환경 — 열어보기 링크로 대신한다.
    }
  };

  return (
    <div className={styles.card}>
      <div className="eyebrow">내 챌린지</div>
      {items.length === 0 ? (
        <p className={styles.hint}>
          아직 만든 챌린지가 없어요. <Link href="/create">5초 녹음해서 만들기 →</Link>
        </p>
      ) : (
        <ul className={styles.recList}>
          {items.map((c) => (
            <li key={c.id} className={styles.recRow}>
              <div className={styles.recHead}>
                <span className={styles.recTitle}>
                  {c.emoji} {c.title}
                </span>
                <span className={c.status === "rejected" ? styles.warn : styles.recScore}>
                  {STATUS[c.status]}
                </span>
              </div>
              {c.status !== "rejected" && (
                <div className={styles.recActions}>
                  <Link href={`/record/${c.id}`} className={styles.editBtn}>
                    열어보기
                  </Link>
                  <button type="button" className={styles.recDelete} onClick={() => send(c)}>
                    {copied === c.id ? "복사됨" : "친구한테 던지기"}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
