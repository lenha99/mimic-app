import Link from "next/link";
import { redirect } from "next/navigation";
import styles from "@/components/social/social.module.css";
import { VoiceAvatar } from "@/components/voice-avatar";
import { currentUserId, myThreads } from "@/lib/social-server";
import { getT } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

/** 메시지함 — 받은 요청은 위에 따로. 요청은 수락(또는 답장)하기 전까지 1개만 온다. */
export default async function MessagesPage() {
  const me = await currentUserId();
  if (!me) redirect(`/login?next=${encodeURIComponent("/messages")}`);
  const t = await getT();
  const threads = await myThreads(me);
  const requests = threads.filter((x) => x.status === "request" && x.requester !== me);
  const rest = threads.filter((x) => !(x.status === "request" && x.requester !== me));

  const row = (x: (typeof threads)[number]) => (
    <li key={x.id}>
      <Link href={`/messages/${x.id}`} className={`${styles.row} ${x.unread ? styles.rowUnread : ""}`}>
        {x.other ? <VoiceAvatar avatar={x.other.avatar} size={40} /> : <span className={styles.emoji}>👤</span>}
        <span className={styles.rowText}>
          <b>{x.other?.nickname ?? t("알 수 없음", "Unknown")}</b>
          <small>
            {x.status === "request" && x.requester === me
              ? t("상대가 받아주길 기다리는 중", "Waiting for them to accept")
              : x.last
                ? `${x.last.mine ? t("나: ", "You: ") : ""}${x.last.body}`
                : ""}
          </small>
        </span>
        {x.unread > 0 && <span className={styles.badge}>{x.unread}</span>}
      </Link>
    </li>
  );

  return (
    <main className={`shell ${styles.page}`}>
      <nav className={styles.nav}>
        <Link href="/me">{t("← 나", "← Me")}</Link>
      </nav>
      <h1 className={styles.title}>{t("메시지", "Messages")}</h1>
      <p className={styles.sub}>{t("내 목소리를 구독한 사람만 말을 걸 수 있어요", "Only your subscribers can message you")}</p>

      {requests.length > 0 && (
        <>
          <p className={styles.section}>{t(`메시지 요청 ${requests.length}`, `Requests ${requests.length}`)}</p>
          <ul className={styles.list}>{requests.map(row)}</ul>
        </>
      )}
      <p className={styles.section}>{t("대화", "Chats")}</p>
      {rest.length ? (
        <ul className={styles.list}>{rest.map(row)}</ul>
      ) : (
        <p className={styles.empty}>
          {t(
            "아직 대화가 없어요. 보이스 챌린지에 목소리를 올리면 구독자가 말을 걸어올 수 있어요 🎙️",
            "No chats yet. Enter the voice challenge and subscribers can reach out 🎙️",
          )}
        </p>
      )}
    </main>
  );
}
