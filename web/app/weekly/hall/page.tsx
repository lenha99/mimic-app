import type { Metadata } from "next";
import Link from "next/link";
import { VoiceAvatar } from "@/components/voice-avatar";
import { normalizeAvatar } from "@/lib/avatar";
import { weekById, type Award } from "@/lib/weekly";
import { hallOfFame, lastWeekWinners } from "@/lib/weekly-server";
import styles from "./hall.module.css";

export const metadata: Metadata = {
  title: "명예의 전당",
  description: "MIMIC 주간 보이스 챌린지 역대 시상대.",
};

export const revalidate = 300;

const MEDAL = ["🥇", "🥈", "🥉"];

/** 역대 시상대 — 한 번 오르면 여기 영영 남는다. 그게 다음 주에 또 도전할 이유다. */
export default async function HallPage() {
  // 지난주 정산이 아직이면 여기서 끝낸다(크론보다 사람이 먼저 올 수 있다).
  await lastWeekWinners().catch(() => null);
  const awards = await hallOfFame().catch(() => [] as Award[]);
  const weeks = new Map<string, Award[]>();
  for (const a of awards) weeks.set(a.weekId, [...(weeks.get(a.weekId) ?? []), a]);

  return (
    <main className={`shell ${styles.page}`}>
      <nav className={styles.nav}>
        <Link href="/weekly">← 이번 주 챌린지</Link>
      </nav>
      <h1 className={styles.title}>명예의 전당</h1>
      <p className={styles.sub}>매주 ❤ 를 가장 많이 받은 세 목소리</p>

      {weeks.size === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyBig}>첫 번째 이름을 기다리는 중</p>
          <p>시즌 1이 끝나면 1~3위가 여기 새겨져요. 지금 출전하면 그 첫 줄이 당신일 수도 있어요.</p>
          <Link href="/weekly" className={styles.go}>
            이번 주 챌린지 보기 →
          </Link>
        </div>
      ) : (
        <ol className={styles.seasons}>
          {[...weeks.entries()].map(([id, list]) => {
            const w = weekById(id);
            if (!w) return null;
            return (
              <li key={id} className={styles.season}>
                <p className={styles.seasonHead}>
                  <span className={styles.chip}>S{w.season}</span>
                  {w.emoji} {w.title}
                  <small>{w.field}</small>
                </p>
                <ol className={styles.places}>
                  {list.map((a) => {
                    const inner = (
                      <>
                        <span className={styles.medal}>{MEDAL[a.place - 1]}</span>
                        <VoiceAvatar avatar={normalizeAvatar(a.avatar)} size={a.place === 1 ? 56 : 44} />
                        <span className={styles.name}>{a.name}</span>
                        <span className={styles.likes}>❤ {a.likes}</span>
                      </>
                    );
                    return (
                      <li key={a.place} className={a.place === 1 ? styles.first : undefined}>
                        {a.entryId ? (
                          <Link href={`/weekly/e/${a.entryId}`} className={styles.place}>
                            {inner}
                          </Link>
                        ) : (
                          <span className={styles.place}>{inner}</span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </li>
            );
          })}
        </ol>
      )}
    </main>
  );
}
