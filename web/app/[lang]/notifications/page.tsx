import Link from "next/link";
import { redirect } from "next/navigation";
import { PushButton } from "@/components/social/push-button";
import styles from "@/components/social/social.module.css";
import { VoiceAvatar } from "@/components/voice-avatar";
import { currentUserId, nicknames } from "@/lib/social-server";
import { createServiceClient } from "@/lib/supabase/service";
import { getT } from "@/lib/i18n-server";
import type { T } from "@/lib/i18n";
import { MarkRead } from "./mark-read";

export const dynamic = "force-dynamic";

const ICON: Record<string, string> = {
  follow: "🔔",
  dm: "💬",
  dm_request: "💌",
  listen_first: "🎧",
  listen_daily: "🎧",
  new_entry: "🎙",
};

/** 알림 — 구독 · 메시지 · 청취 · 구독한 목소리의 새 출전작. 열면 전부 읽음. */
export default async function NotificationsPage() {
  const me = await currentUserId();
  if (!me) redirect(`/login?next=${encodeURIComponent("/notifications")}`);
  const t = await getT();
  const service = createServiceClient();
  const { data } = await service
    .from("notifications")
    .select("id, kind, actor, entry_id, thread_id, count, created_at, read_at")
    .eq("user_id", me)
    .order("id", { ascending: false })
    .limit(50);
  const items = data ?? [];
  const who = await nicknames(items.map((n) => n.actor).filter((x): x is string => !!x), service);

  return (
    <main className={`shell ${styles.page}`}>
      <nav className={styles.nav}>
        <Link href="/me">{t("← 나", "← Me")}</Link>
        <Link href="/messages">{t("💬 메시지", "💬 Messages")}</Link>
      </nav>
      <h1 className={styles.title}>{t("알림", "Notifications")}</h1>
      <div style={{ margin: "0 0 16px" }}>
        <PushButton kind="mine" compact />
      </div>
      {items.length === 0 ? (
        <p className={styles.empty}>
          {t(
            "아직 알림이 없어요. 보이스 챌린지에 목소리를 올리면 누가 듣고 구독할 때 여기로 알려드려요 🎙️",
            "Nothing yet. Enter the voice challenge and we'll tell you here when people listen or subscribe 🎙️",
          )}
        </p>
      ) : (
        <ul className={styles.list}>
          {items.map((n) => {
            const actor = n.actor ? who.get(n.actor) : undefined;
            return (
              <li key={n.id}>
                <Link href={hrefOf(n, actor?.nickname)} className={`${styles.row} ${n.read_at ? "" : styles.rowUnread}`}>
                  {actor ? <VoiceAvatar avatar={actor.avatar} size={40} /> : <span className={styles.emoji}>{ICON[n.kind] ?? "🔔"}</span>}
                  <span className={styles.rowText}>
                    <b>{textOf(n.kind, actor?.nickname ?? t("누군가", "Someone"), n.count, t)}</b>
                    <small>{ago(n.created_at, t)}</small>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <MarkRead />
    </main>
  );
}

type Row = { kind: string; entry_id: string | null; thread_id: string | null };

function hrefOf(n: Row, actor?: string): string {
  if (n.thread_id) return `/messages/${n.thread_id}`;
  if (n.kind === "follow" && actor) return `/v/${encodeURIComponent(actor)}`;
  if (n.entry_id) return `/weekly/e/${n.entry_id}`;
  return "/weekly";
}

function textOf(kind: string, actor: string, count: number | null, t: T): string {
  switch (kind) {
    case "follow":
      return t(`${actor}님이 당신 목소리를 구독했어요`, `${actor} subscribed to your voice`);
    case "dm_request":
      return t(`${actor}님이 메시지 요청을 보냈어요 💌`, `${actor} sent you a message request 💌`);
    case "dm":
      return t(`${actor}님이 메시지를 보냈어요`, `${actor} sent you a message`);
    case "listen_first":
      return t("누군가 당신 목소리를 처음으로 끝까지 들었어요 🎧", "Someone listened to your voice for the first time 🎧");
    case "listen_daily":
      return t(`오늘 ${count ?? 0}명이 당신 목소리를 들었어요`, `${count ?? 0} people listened to your voice today`);
    case "new_entry":
      return t(`구독한 ${actor}님이 새 목소리를 올렸어요`, `${actor} posted a new take`);
    default:
      return t("새 알림", "New notification");
  }
}

function ago(at: string, t: T): string {
  const m = Math.max(0, Math.round((Date.now() - new Date(at).getTime()) / 60_000));
  if (m < 1) return t("방금", "just now");
  if (m < 60) return t(`${m}분 전`, `${m}m ago`);
  const h = Math.round(m / 60);
  if (h < 24) return t(`${h}시간 전`, `${h}h ago`);
  return t(`${Math.round(h / 24)}일 전`, `${Math.round(h / 24)}d ago`);
}
