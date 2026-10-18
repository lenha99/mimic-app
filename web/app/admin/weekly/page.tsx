import type { Metadata } from "next";
import Link from "next/link";
import { BackHome } from "@/components/back-home";
import { isAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/service";
import { audioSrc, currentWeek, seasonLabel } from "@/lib/weekly";
import { AdminLogin } from "../challenges/review";
import styles from "../challenges/admin.module.css";
import { HideToggle } from "./hide-toggle";

export const metadata: Metadata = {
  title: "보이스 챌린지 출전작",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * 출전작 관리 — 신고된 것 먼저, 그다음 이번 주 전체.
 *
 * 세 명이 신고하면 자동으로 숨는다(api/weekly/.../report). 순위 경쟁이 걸려 있어서
 * 경쟁자가 몰래 신고하는 일도 생긴다 — 들어보고 멀쩡하면 되살린다.
 */
export default async function AdminWeeklyPage() {
  if (!(await isAdmin())) {
    return (
      <main className="shell">
        <BackHome />
        <h1 className={styles.title}>보이스 챌린지 출전작</h1>
        <AdminLogin next="/admin/weekly" />
      </main>
    );
  }

  const week = currentWeek();
  const service = createServiceClient();
  const cols = "id, challenge_id, user_id, guest_name, like_count, play_count, reports, hidden, updated_at";
  const [{ data: reported }, { data: current }] = await Promise.all([
    service.from("weekly_entries").select(cols).gt("reports", 0).order("reports", { ascending: false }).limit(50),
    service
      .from("weekly_entries")
      .select(cols)
      .eq("challenge_id", week.id)
      .order("like_count", { ascending: false })
      .limit(200),
  ]);
  const users = [...new Set([...(reported ?? []), ...(current ?? [])].map((e) => e.user_id).filter((x): x is string => !!x))];
  const { data: profiles } = users.length
    ? await service.from("profiles").select("id, nickname").in("id", users)
    : { data: [] as { id: string; nickname: string }[] };
  const nick = new Map((profiles ?? []).map((p) => [p.id, p.nickname]));

  type E = NonNullable<typeof current>[number];
  const Row = ({ e }: { e: E }) => (
    <li className={styles.row}>
      <div className={styles.rowHead}>
        <span className={styles.name}>{e.user_id ? `@${nick.get(e.user_id) ?? "?"}` : e.guest_name}</span>
        <span className={styles.meta}>
          {e.challenge_id} · ❤ {e.like_count} · ▶ {e.play_count} · 신고 {e.reports}
          {e.hidden && " · 숨김"}
        </span>
      </div>
      <audio controls preload="none" src={audioSrc(e.id, e.updated_at)} className={styles.audio} />
      <div className={styles.actions}>
        <Link href={`/weekly/e/${e.id}`} className={styles.open}>
          보기
        </Link>
        <HideToggle id={e.id} hidden={e.hidden} />
      </div>
    </li>
  );

  return (
    <main className="shell">
      <BackHome />
      <h1 className={styles.title}>보이스 챌린지 출전작</h1>
      <p className={styles.sub}>
        숨기면 순위·링크·소리가 바로 끊겨요. 되살리면 신고 수가 0 으로 돌아가요.
      </p>

      <h2 className={styles.h2}>신고된 출전작 {reported?.length ?? 0}</h2>
      {reported?.length ? (
        <ul className={styles.list}>
          {reported.map((e) => (
            <Row key={e.id} e={e} />
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>신고된 출전작이 없어요.</p>
      )}

      <h2 className={styles.h2}>
        이번 주 {seasonLabel(week)} · {week.title} ({current?.length ?? 0})
      </h2>
      {current?.length ? (
        <ul className={styles.list}>
          {current.map((e) => (
            <Row key={e.id} e={e} />
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>아직 출전작이 없어요.</p>
      )}
    </main>
  );
}
