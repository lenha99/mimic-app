"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useT } from "@/components/lang";
import styles from "./social.module.css";

/**
 * 🔔 목소리 구독. 구독하면 올린 사람에게 "○○님이 구독했어요"가 간다.
 * 로그인 안 했으면 로그인으로 보낸다(구독한 사람이 누군지 알아야 하니까).
 */
export function FollowButton({
  creator,
  initial,
  loggedIn,
  onChange,
}: {
  creator: string;
  initial: boolean;
  loggedIn: boolean;
  onChange?: (following: boolean, followers: number) => void;
}) {
  const t = useT();
  const path = usePathname() ?? "/";
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);

  if (!loggedIn) {
    return (
      <Link href={`/login?next=${encodeURIComponent(path)}`} className={styles.btn}>
        {t("🔔 목소리 구독", "🔔 Subscribe")}
      </Link>
    );
  }

  const toggle = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/follow", {
        method: on ? "DELETE" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ creator }),
      });
      const d = (await res.json()) as { following?: boolean; followers?: number };
      if (res.ok && typeof d.following === "boolean") {
        setOn(d.following);
        onChange?.(d.following, d.followers ?? 0);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <button type="button" className={on ? styles.btnOn : styles.btn} onClick={() => void toggle()} disabled={busy}>
      {on ? t("✓ 구독 중", "✓ Subscribed") : t("🔔 목소리 구독", "🔔 Subscribe")}
    </button>
  );
}
