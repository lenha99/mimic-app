"use client";

import { useState } from "react";
import { useT } from "@/components/lang";
import { clientId } from "@/lib/client-id";
import styles from "./social.module.css";

/**
 * 🔔 목소리 구독. 로그인 없이도 누른 즉시 된다(기기 id). 구독하면 올린 사람에게 알림이 간다.
 * 누르자마자 켜진 것처럼 보이고(낙관적), 실패하면 되돌린다.
 */
export function FollowButton({
  entry,
  creator,
  initial,
  onChange,
  big = false,
}: {
  entry?: string;
  creator?: string;
  initial: boolean;
  onChange?: (following: boolean, followers: number | null) => void;
  big?: boolean;
}) {
  const t = useT();
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    const next = !on;
    setBusy(true);
    setError(null);
    setOn(next);
    onChange?.(next, null);
    try {
      const res = await fetch("/api/follow", {
        method: next ? "POST" : "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entry, creator, client: clientId() }),
      });
      const d = (await res.json().catch(() => ({}))) as { following?: boolean; followers?: number; error?: string };
      if (res.ok && typeof d.following === "boolean") {
        setOn(d.following);
        onChange?.(d.following, d.followers ?? null);
      } else {
        setOn(!next);
        onChange?.(!next, null);
        setError(d.error ?? t("구독하지 못했어요. 다시 해주세요.", "Couldn't subscribe. Try again."));
      }
    } catch {
      setOn(!next);
      onChange?.(!next, null);
      setError(t("연결이 불안정해요. 다시 해주세요.", "Connection problem. Try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className={on ? styles.btnOn : styles.btn}
        style={big ? { minHeight: 50, padding: "0 22px", fontSize: 15.5 } : undefined}
        onClick={() => void toggle()}
        disabled={busy}
      >
        {on ? t("✓ 구독 중", "✓ Subscribed") : t("🔔 목소리 구독", "🔔 Subscribe")}
      </button>
      {error && <p className={styles.error}>{error}</p>}
    </>
  );
}
