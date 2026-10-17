import Link from "next/link";
import styles from "./profile.module.css";

export type MyPracticePost = {
  id: string;
  title: string;
  notes: number;
  state: "live" | "expired" | "hidden";
};

const STATE: Record<MyPracticePost["state"], string> = {
  live: "",
  expired: "기간 끝남",
  hidden: "신고로 숨겨짐",
};

/** 연습 피드백 게시판에 올린 내 테이크 — 피드백이 몇 개 왔는지. */
export function MyPracticePosts({ items }: { items: MyPracticePost[] }) {
  return (
    <div className={styles.card}>
      <div className="eyebrow">연습 피드백</div>
      {items.length === 0 ? (
        <p className={styles.hint}>
          연습실에서 테이크 아래 &ldquo;다른 사람한테 피드백 받기&rdquo;를 누르면 여기 모여요.{" "}
          <Link href="/practice/board">게시판 보기 →</Link>
        </p>
      ) : (
        <ul className={styles.recList}>
          {items.map((p) => (
            <li key={p.id} className={styles.recRow}>
              <div className={styles.recHead}>
                <span className={styles.recTitle}>{p.title}</span>
                <span className={p.state === "hidden" ? styles.warn : styles.recScore}>
                  {STATE[p.state] || `피드백 ${p.notes}개`}
                </span>
              </div>
              {p.state !== "expired" && (
                <div className={styles.recActions}>
                  <Link href={`/practice/board/${p.id}`} className={styles.editBtn}>
                    보기
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
