"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAppPath } from "@/lib/app-path";
import { useEffect, useState } from "react";
import { useT } from "@/components/lang";
import { clientId } from "@/lib/client-id";
import { FollowButton } from "./follow-button";
import styles from "./social.module.css";

type State = { loggedIn: boolean; self: boolean; following: boolean; followers: number };

/**
 * 계정 하나에 대한 🔔 구독 · 💬 메시지 — 게시판 글쓴이·피드백 남긴 사람 옆에 붙는다.
 *
 * 메시지는 구독자만 보낼 수 있다(lib/social-server canStart). 그래서 구독 전에 💬 를 누르면
 * 구독을 먼저 하고 바로 첫 메시지 화면으로 보낸다 — 두 번 누르게 하지 않는다.
 * 내 자신이면 아무것도 안 그린다.
 */
export function PersonActions({ userId, thanks = false }: { userId: string; thanks?: boolean }) {
  const t = useT();
  const router = useRouter();
  const path = useAppPath();
  const [s, setS] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/follow?creator=${userId}&client=${encodeURIComponent(clientId())}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: State | null) => alive && d && setS(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [userId]);

  if (!s) return <span style={{ display: "inline-block", minHeight: 34 }} aria-hidden="true" />;
  if (s.self) return null;

  const dm = `/messages/new?to=${userId}`;
  const message = async () => {
    if (!s.loggedIn) {
      router.push(`/login?next=${encodeURIComponent(path)}`);
      return;
    }
    if (s.following) {
      router.push(dm);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/follow", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ creator: userId, client: clientId() }),
      });
      if (res.ok) {
        router.push(dm);
        return;
      }
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      setError(d.error ?? t("메시지를 열지 못했어요. 다시 해주세요.", "Couldn't open messages. Try again."));
    } catch {
      setError(t("연결이 불안정해요. 다시 해주세요.", "Connection problem. Try again."));
    }
    setBusy(false);
  };

  return (
    <span style={{ display: "inline-grid", gap: 4, justifyItems: "start" }}>
      <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
        <FollowButton
          small
          creator={userId}
          initial={s.following}
          onChange={(following) => setS((p) => (p ? { ...p, following } : p))}
        />
        {s.loggedIn ? (
          <button
            type="button"
            className={styles.btnGhost}
            style={{ minHeight: 34, padding: "0 12px", fontSize: 13 }}
            onClick={() => void message()}
            disabled={busy}
            title={s.following ? undefined : t("메시지를 보내면 구독도 같이 돼요", "Messaging also subscribes you")}
          >
            {thanks ? t("💬 고마워요 보내기", "💬 Say thanks") : t("💬 메시지", "💬 Message")}
          </button>
        ) : (
          <Link href={`/login?next=${encodeURIComponent(path)}`} className={styles.btnGhost} style={{ minHeight: 34, padding: "0 12px", fontSize: 13 }}>
            {thanks ? t("💬 고마워요 보내기", "💬 Say thanks") : t("💬 메시지", "💬 Message")}
          </Link>
        )}
      </span>
      {error && <span className={styles.error}>{error}</span>}
    </span>
  );
}
