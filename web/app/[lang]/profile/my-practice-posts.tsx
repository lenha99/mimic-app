import Link from "next/link";
import { getT } from "@/lib/i18n-server";
import styles from "./profile.module.css";

export type MyPracticePost = {
  id: string;
  title: string;
  notes: number;
  state: "live" | "expired" | "hidden";
};

/** 연습 피드백 게시판에 올린 내 테이크 — 피드백이 몇 개 왔는지. */
export async function MyPracticePosts({ items }: { items: MyPracticePost[] }) {
  const t = await getT();
  const STATE: Record<MyPracticePost["state"], string> = {
    live: "",
    expired: t("기간 끝남", "Expired"),
    hidden: t("신고로 숨겨짐", "Hidden after a report"),
  };
  return (
    <div className={styles.card}>
      <div className="eyebrow">{t("연습 피드백", "Practice feedback")}</div>
      {items.length === 0 ? (
        <p className={styles.hint}>
          {t(
            "연습실에서 테이크 아래 “다른 사람한테 피드백 받아 보기”를 누르면 여기 모여요.",
            "Tap “Get feedback from others” under a take in the Practice Room and it'll show up here.",
          )}{" "}
          <Link href="/practice/board">{t("게시판 보기 →", "See the board →")}</Link>
        </p>
      ) : (
        <ul className={styles.recList}>
          {items.map((p) => (
            <li key={p.id} className={styles.recRow}>
              <div className={styles.recHead}>
                <span className={styles.recTitle}>{p.title}</span>
                <span className={p.state === "hidden" ? styles.warn : styles.recScore}>
                  {STATE[p.state] || t(`피드백 ${p.notes}개`, `${p.notes} note${p.notes === 1 ? "" : "s"}`)}
                </span>
              </div>
              {p.state !== "expired" && (
                <div className={styles.recActions}>
                  <Link href={`/practice/board/${p.id}`} className={styles.editBtn}>
                    {t("보기", "View")}
                  </Link>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
