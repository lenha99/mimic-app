"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useT } from "@/components/lang";
import styles from "@/components/social/social.module.css";

export default function FirstMessage({ to }: { to: string }) {
  const t = useT();
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ to, body: text }),
      });
      const d = (await res.json()) as { threadId?: string; error?: string };
      if (!res.ok || !d.threadId) {
        setError(d.error ?? t("보내지 못했어요", "Couldn't send"));
        return;
      }
      router.replace(`/messages/${d.threadId}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={500}
        rows={4}
        placeholder={t("예) 목소리 너무 좋아요! 라디오 하셔도 될 것 같아요 🎧", "e.g. Your voice is amazing! You should do radio 🎧")}
        style={{
          padding: 14,
          borderRadius: 16,
          border: "1px solid var(--rule)",
          background: "var(--panel)",
          color: "var(--white)",
          font: "inherit",
          fontSize: 15,
        }}
      />
      {error && <p className={styles.error}>{error}</p>}
      <button type="button" className={styles.btn} onClick={() => void send()} disabled={busy || !text.trim()}>
        {busy ? t("보내는 중…", "Sending…") : t("💌 메시지 요청 보내기", "💌 Send request")}
      </button>
    </div>
  );
}
