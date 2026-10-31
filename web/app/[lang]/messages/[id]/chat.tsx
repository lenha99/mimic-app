"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/components/lang";
import styles from "@/components/social/social.module.css";

type Msg = { id: number; mine: boolean; body: string; at: string };
type Thread = {
  id: string;
  other: { id: string; nickname: string } | null;
  status: "request" | "open" | "declined";
  requester: string;
  messages: Msg[];
};

/** 대화 — 열려 있는 동안 8초마다 새 메시지를 본다(실시간 연결은 비용·복잡도 대비 아직 과하다). */
export default function Chat({ initial, me }: { initial: Thread; me: string }) {
  const t = useT();
  const router = useRouter();
  const [th, setTh] = useState(initial);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  const incoming = th.status === "request" && th.requester !== me;
  const waiting = th.status === "request" && th.requester === me;
  const sentOne = waiting && th.messages.some((m) => m.mine);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [th.messages.length]);

  useEffect(() => {
    const tick = window.setInterval(async () => {
      if (document.hidden) return;
      const res = await fetch(`/api/messages/${th.id}`).catch(() => null);
      if (res?.ok) setTh((await res.json()) as Thread);
    }, 8000);
    return () => window.clearInterval(tick);
  }, [th.id]);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/messages/${th.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const d = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(d.error ?? t("보내지 못했어요", "Couldn't send"));
        return;
      }
      setText("");
      const again = await fetch(`/api/messages/${th.id}`);
      if (again.ok) setTh((await again.json()) as Thread);
    } finally {
      setBusy(false);
    }
  };

  const act = async (action: "accept" | "decline" | "block") => {
    if (
      action === "block" &&
      !window.confirm(t("차단하면 서로 메시지를 못 보내고, 구독도 끊겨요.", "Blocking stops messages both ways and removes their subscription."))
    )
      return;
    await fetch(`/api/messages/${th.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (action === "accept") setTh({ ...th, status: "open" });
    else router.push("/messages");
  };

  return (
    <main className={`shell ${styles.page}`}>
      <nav className={styles.nav}>
        <Link href="/messages">{t("← 메시지", "← Messages")}</Link>
        {th.other && <Link href={`/v/${encodeURIComponent(th.other.nickname)}`}>{t("프로필", "Profile")}</Link>}
      </nav>
      <h1 className={styles.title} style={{ fontSize: 26 }}>
        {th.other?.nickname ?? t("알 수 없음", "Unknown")}
      </h1>

      {incoming && (
        <div className={styles.request}>
          {t(
            "내 목소리를 구독한 분이 보낸 메시지 요청이에요. 받아주거나 답장하면 대화가 열려요. 상대는 아직 메시지 1개만 보낼 수 있어요.",
            "A subscriber sent you a message request. Accept or reply to open the chat. Until then they can only send one message.",
          )}
          <div className={styles.requestActions}>
            <button type="button" className={styles.btn} onClick={() => void act("accept")}>
              {t("받기", "Accept")}
            </button>
            <button type="button" className={styles.btnGhost} onClick={() => void act("decline")}>
              {t("거절", "Decline")}
            </button>
            <button type="button" className={styles.btnGhost} onClick={() => void act("block")}>
              {t("차단", "Block")}
            </button>
          </div>
        </div>
      )}

      <div className={styles.chat}>
        {th.messages.map((m) => (
          <div key={m.id} className={m.mine ? styles.bubbleMine : styles.bubble}>
            {m.body}
          </div>
        ))}
        {sentOne && (
          <p className={styles.note} style={{ textAlign: "center" }}>
            {t("상대가 받아주면 대화를 이어갈 수 있어요", "You can keep chatting once they accept")}
          </p>
        )}
        <div ref={end} />
      </div>

      {!sentOne && (
        <div className={styles.composer}>
          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.composerInner}>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={500}
              rows={1}
              placeholder={incoming ? t("답장하면 대화가 열려요", "Reply to open the chat") : t("메시지 보내기", "Message")}
            />
            <button type="button" className={styles.btn} onClick={() => void send()} disabled={busy || !text.trim()}>
              {t("보내기", "Send")}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
