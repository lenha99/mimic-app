"use client";

import Link from "next/link";
import { useState } from "react";
import { useT } from "@/components/lang";
import styles from "./profile.module.css";

export type MyChallenge = {
  id: string;
  title: string;
  emoji: string;
  line: string | null;
  status: "pending" | "approved" | "rejected";
};

/** 내가 만든 챌린지 — 상태를 보고, 링크를 다시 던진다. */
export function MyChallenges({ items }: { items: MyChallenge[] }) {
  const t = useT();
  const STATUS: Record<MyChallenge["status"], string> = {
    pending: t("검토 중 · 링크는 돼요", "In review · link works"),
    approved: t("홈에 올라갔어요 🎉", "Live on home 🎉"),
    rejected: t("반려됐어요", "Not approved"),
  };
  const [copied, setCopied] = useState<string | null>(null);

  const send = async (c: MyChallenge) => {
    const url = `${window.location.origin}/record/${c.id}`;
    const text = t(`내 목소리 따라 할 수 있음? ${c.emoji} "${c.line || c.title}"`, `Bet you can't copy my voice ${c.emoji} "${c.line || c.title}"`);
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
      <div className="eyebrow">{t("내 챌린지", "My challenges")}</div>
      {items.length === 0 ? (
        <p className={styles.hint}>
          {t("아직 만든 챌린지가 없어요.", "No challenges yet.")} <Link href="/create">{t("5초 녹음해서 만들기 →", "Record 5 seconds to make one →")}</Link>
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
                    {t("열어보기", "Open")}
                  </Link>
                  <button type="button" className={styles.recDelete} onClick={() => send(c)}>
                    {copied === c.id ? t("복사 완료!", "Copied!") : t("친구한테 보내기", "Send to a friend")}
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
