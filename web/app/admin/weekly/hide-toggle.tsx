"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "../challenges/admin.module.css";

export function HideToggle({ id, hidden }: { id: string; hidden: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/weekly/${id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hidden: !hidden }),
    });
    setBusy(false);
    if (!res.ok) {
      setError("바꾸지 못했어요.");
      return;
    }
    router.refresh();
  };

  return (
    <>
      <button type="button" className={hidden ? styles.approve : styles.reject} onClick={() => void toggle()} disabled={busy}>
        {busy ? "…" : hidden ? "되살리기" : "숨기기"}
      </button>
      {error && <p className={styles.error}>{error}</p>}
    </>
  );
}
