import type { Metadata } from "next";
import Link from "next/link";
import { BackHome } from "@/components/back-home";
import { isAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/service";
import { AdminLogin } from "../challenges/review";
import styles from "../challenges/admin.module.css";

export const metadata: Metadata = { title: "피드백 모아보기", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

const PAGE_LABEL = { record: "명대사 결과", practice: "연습실", board: "피드백 게시판" } as const;

/**
 * 운영자용 — 결과 화면 한 줄 피드백과 신고로 숨겨진 게시판 글.
 * 숫자(👍/👎 비율)는 위에, 글은 아래에. 한 줄짜리 글이 숫자보다 많이 알려준다.
 */
export default async function AdminFeedbackPage() {
  if (!(await isAdmin())) {
    return (
      <main className="shell">
        <BackHome />
        <h1 className={styles.title}>피드백 모아보기</h1>
        <AdminLogin />
      </main>
    );
  }

  const service = createServiceClient();
  const since = daysAgo(14);
  const [{ data: rows }, { data: hiddenPosts }, { data: hiddenNotes }] = await Promise.all([
    service
      .from("app_feedback")
      .select("id, page, item_id, rating, message, created_at, user_id")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(300),
    service.from("practice_posts").select("id, title, reports").eq("hidden", true).limit(50),
    service.from("practice_notes").select("id, post_id, body, reports").eq("hidden", true).limit(50),
  ]);
  const all = rows ?? [];
  const up = all.filter((r) => r.rating === 1).length;
  const words = all.filter((r) => r.message);

  return (
    <main className="shell">
      <BackHome />
      <h1 className={styles.title}>피드백 모아보기</h1>
      <p>
        최근 14일 · 👍 {up} · 👎 {all.length - up} · 글 {words.length}개
      </p>

      <ul className={styles.list}>
        {words.map((r) => (
          <li key={r.id} className={styles.row}>
            <div className={styles.rowHead}>
              <span className={styles.name}>
                {r.rating === 1 ? "👍" : "👎"} {PAGE_LABEL[r.page]}
                {r.item_id ? ` · ${r.item_id}` : ""}
              </span>
              <span className={styles.meta}>
                {new Date(r.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}
                {r.user_id ? " · 회원" : " · 손님"}
              </span>
            </div>
            <p>{r.message}</p>
          </li>
        ))}
        {words.length === 0 && <li className={styles.row}>아직 글로 남긴 피드백이 없어요.</li>}
      </ul>

      <h2 className={styles.title}>신고로 숨겨진 것</h2>
      <ul className={styles.list}>
        {(hiddenPosts ?? []).map((p) => (
          <li key={p.id} className={styles.row}>
            연습 · {p.title} · 신고 {p.reports} · <Link href={`/practice/board/${p.id}`}>id {p.id.slice(0, 8)}</Link>
          </li>
        ))}
        {(hiddenNotes ?? []).map((n) => (
          <li key={n.id} className={styles.row}>
            피드백 · “{n.body}” · 신고 {n.reports}
          </li>
        ))}
        {!hiddenPosts?.length && !hiddenNotes?.length && <li className={styles.row}>없어요.</li>}
      </ul>
      <p className={styles.meta}>되살리기는 Supabase 표 편집기에서 hidden 을 false 로.</p>
    </main>
  );
}
