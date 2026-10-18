import Link from "next/link";
import { seasonLabel, type Award, type Week } from "@/lib/weekly";
import styles from "./profile.module.css";

export type MyWeeklyEntry = {
  id: string;
  week: Week;
  likes: number;
  hidden: boolean;
  rank: number | null;
  total: number;
};

const MEDAL = ["🥇", "🥈", "🥉"];

/** 주간 챌린지 — 트로피 진열장 + 내가 출전한 주들. */
export function MyWeekly({ awards, entries, now }: { awards: Award[]; entries: MyWeeklyEntry[]; now: number }) {
  return (
    <div className={styles.card}>
      <div className="eyebrow">보이스 챌린지</div>
      {awards.length > 0 && (
        <ul className={styles.trophies}>
          {awards.map((a) => (
            <li key={`${a.weekId}-${a.place}`} className={styles.trophy}>
              <span className={styles.trophyMedal}>{MEDAL[a.place - 1]}</span>
              <span>
                <b>
                  S{a.season} {a.title}
                </b>
                <small>
                  {a.place}위 · ❤ {a.likes}
                </small>
              </span>
            </li>
          ))}
        </ul>
      )}
      {entries.length === 0 ? (
        <p className={styles.hint}>
          아직 출전한 적이 없어요. 매주 대본 하나로 ❤ 를 겨뤄요.{" "}
          <Link href="/weekly">이번 주 챌린지 →</Link>
        </p>
      ) : (
        <ul className={styles.recList}>
          {entries.map((e) => {
            const live = now < e.week.endsAt;
            return (
              <li key={e.id} className={styles.recRow}>
                <div className={styles.recHead}>
                  <span className={styles.recTitle}>
                    {seasonLabel(e.week)} · {e.week.title}
                  </span>
                  <span className={e.hidden ? styles.warn : styles.recScore}>
                    {e.hidden ? "신고로 숨겨짐" : `${e.rank ?? "-"}위 / ${e.total} · ❤ ${e.likes}`}
                  </span>
                </div>
                {!e.hidden && (
                  <div className={styles.recActions}>
                    <Link href={`/weekly/e/${e.id}`} className={styles.editBtn}>
                      {live ? "진행 중 · 보기" : "최종 결과 보기"}
                    </Link>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
