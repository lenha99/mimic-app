import Link from "next/link";
import { redirect } from "next/navigation";
import styles from "@/components/social/social.module.css";
import { canStart, currentUserId, profileById } from "@/lib/social-server";
import { createServiceClient } from "@/lib/supabase/service";
import { getT } from "@/lib/i18n-server";
import { messageError } from "@/lib/message-errors";
import FirstMessage from "./first-message";

export const dynamic = "force-dynamic";

/** 첫 메시지 — 대화방이 이미 있으면 거기로, 없으면 요청 1개를 쓰는 화면. */
export default async function NewMessagePage({ searchParams }: { searchParams: Promise<{ to?: string }> }) {
  const to = (await searchParams).to ?? "";
  const me = await currentUserId();
  if (!me) redirect(`/login?next=${encodeURIComponent(`/messages/new?to=${to}`)}`);
  const t = await getT();
  const other = await profileById(to);
  if (!other) redirect("/messages");

  const [a, b] = me < other.id ? [me, other.id] : [other.id, me];
  const { data: existing } = await createServiceClient().from("dm_threads").select("id").eq("a", a).eq("b", b).maybeSingle();
  if (existing) redirect(`/messages/${existing.id}`);

  const why = await canStart(me, other.id);
  return (
    <main className={`shell ${styles.page}`}>
      <nav className={styles.nav}>
        <Link href={`/v/${encodeURIComponent(other.nickname)}`}>{t("← 프로필", "← Profile")}</Link>
      </nav>
      <h1 className={styles.title} style={{ fontSize: 26 }}>
        {other.nickname}
      </h1>
      {why ? (
        <p className={styles.empty}>{messageError(why, t)}</p>
      ) : (
        <>
          <p className={styles.sub}>
            {t(
              "첫 메시지는 요청으로 가요. 상대가 받아주기 전까지는 1개만 보낼 수 있으니 마음을 담아 써 주세요 💌",
              "Your first message goes as a request. You can send just one until they accept — make it count 💌",
            )}
          </p>
          <FirstMessage to={other.id} />
        </>
      )}
    </main>
  );
}
