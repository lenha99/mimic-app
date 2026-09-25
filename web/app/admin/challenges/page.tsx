import type { Metadata } from "next";
import { BackHome } from "@/components/back-home";
import { isAdmin } from "@/lib/admin";
import { refAudio } from "@/lib/config";
import { createServiceClient } from "@/lib/supabase/service";
import { AdminLogin, ReviewButtons } from "./review";
import styles from "./admin.module.css";

export const metadata: Metadata = {
  title: "챌린지 검토",
  robots: { index: false, follow: false },
};

/**
 * 사용자 챌린지 검토 대기열.
 *
 * 들어보고 올릴지 정한다. 대사 구간이 맞는지·괜찮은 소리인지는 들어야 안다
 * (CLAUDE.md: 측정할 수 있는 건 게이트로, 없는 건 사람에게). 길이·무음 같은
 * 기계적 검사는 만들 때 서버가 이미 했다.
 */
export const dynamic = "force-dynamic";

export default async function AdminChallengesPage() {
  if (!(await isAdmin())) {
    return (
      <main className="shell">
        <BackHome />
        <h1 className={styles.title}>챌린지 검토</h1>
        <AdminLogin />
      </main>
    );
  }

  const service = createServiceClient();
  const [{ data: pending }, { data: approved }] = await Promise.all([
    service
      .from("challenges")
      .select("id, creator_id, title, line, emoji, duration_ms, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(50),
    service
      .from("challenges")
      .select("id, creator_id, title, line, emoji, duration_ms, created_at")
      .eq("status", "approved")
      .order("reviewed_at", { ascending: false })
      .limit(20),
  ]);
  const ids = [...new Set([...(pending ?? []), ...(approved ?? [])].map((c) => c.creator_id))];
  const { data: profiles } = ids.length
    ? await service.from("profiles").select("id, nickname").in("id", ids)
    : { data: [] as { id: string; nickname: string }[] };
  const nick = new Map((profiles ?? []).map((p) => [p.id, p.nickname]));

  const Row = ({ c, mode }: { c: NonNullable<typeof pending>[number]; mode: "pending" | "approved" }) => (
    <li className={styles.row}>
      <div className={styles.rowHead}>
        <span className={styles.name}>
          {c.emoji} {c.title}
        </span>
        <span className={styles.meta}>
          @{nick.get(c.creator_id) ?? "?"} · {((c.duration_ms ?? 0) / 1000).toFixed(1)}초
        </span>
      </div>
      {c.line && <p className={styles.line}>“{c.line}”</p>}
      <audio controls preload="none" src={refAudio(c.id)} className={styles.audio} />
      <ReviewButtons id={c.id} mode={mode} />
    </li>
  );

  return (
    <main className="shell">
      <BackHome />
      <h1 className={styles.title}>챌린지 검토</h1>
      <p className={styles.sub}>
        올리면 홈 &ldquo;친구들이 만든 챌린지&rdquo;에 5분 안에 떠요. 반려하면 링크도 막히고 소리도 지워져요.
      </p>

      <h2 className={styles.h2}>대기 중 {pending?.length ?? 0}</h2>
      {pending?.length ? (
        <ul className={styles.list}>
          {pending.map((c) => (
            <Row key={c.id} c={c} mode="pending" />
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>기다리는 챌린지가 없어요.</p>
      )}

      <h2 className={styles.h2}>올린 것 (최근)</h2>
      {approved?.length ? (
        <ul className={styles.list}>
          {approved.map((c) => (
            <Row key={c.id} c={c} mode="approved" />
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>아직 없어요.</p>
      )}
    </main>
  );
}
