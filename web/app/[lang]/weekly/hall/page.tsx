import type { Metadata } from "next";
import Link from "next/link";
import { VoiceAvatar } from "@/components/voice-avatar";
import { normalizeAvatar } from "@/lib/avatar";
import { displayName, weekById, type Award } from "@/lib/weekly";
import { hallOfFame, lastWeekWinners } from "@/lib/weekly-server";
import styles from "./hall.module.css";
import { getLang, getT } from "@/lib/i18n-server";
import { tr } from "@/lib/i18n";
import { fieldName } from "@/lib/script-i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("명예의 전당", "Hall of Fame"),
    description: t("MIMIC 주간 보이스 챌린지 역대 시상대", "Every podium from the MIMIC weekly voice challenge"),
  };
}

export const revalidate = 300;

const MEDAL = ["🥇", "🥈", "🥉"];

/** 역대 시상대 — 한 번 오르면 여기 영영 남는다. 그게 다음 주에 또 도전할 이유다. */
export default async function HallPage() {
  // 지난주 정산이 아직이면 여기서 끝낸다(크론보다 사람이 먼저 올 수 있다).
  await lastWeekWinners().catch(() => null);
  const awards = await hallOfFame().catch(() => [] as Award[]);
  const lang = await getLang();
  const t = tr(lang);
  const weeks = new Map<string, Award[]>();
  for (const a of awards) weeks.set(a.weekId, [...(weeks.get(a.weekId) ?? []), a]);

  return (
    <main className={`shell ${styles.page}`}>
      <nav className={styles.nav}>
        <Link href="/weekly">{t("← 이번 주 챌린지", "← This week")}</Link>
      </nav>
      <h1 className={styles.title}>{t("명예의 전당", "Hall of Fame")}</h1>
      <p className={styles.sub}>{t("매주 ❤ 를 가장 많이 받은 세 목소리", "The three most-loved voices each week")}</p>

      {weeks.size === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyBig}>{t("첫 번째 주인공을 기다리는 중", "Waiting for the first legend")}</p>
          <p>
            {t(
              "시즌 1이 끝나면 1~3위가 여기 새겨져요. 지금 출전하면 그 첫 줄의 주인공이 될 수도 있어요 👀",
              "When Season 1 ends, the top 3 get carved in here. Enter now — the first line could be yours 👀",
            )}
          </p>
          <Link href="/weekly" className={styles.go}>
            {t("이번 주 챌린지 보기 →", "See this week's challenge →")}
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
                  {w.emoji} {t(w.title, w.titleEn)}
                  <small>{fieldName(w.field, lang)}</small>
                </p>
                <ol className={styles.places}>
                  {list.map((a) => {
                    const inner = (
                      <>
                        <span className={styles.medal}>{MEDAL[a.place - 1]}</span>
                        <VoiceAvatar avatar={normalizeAvatar(a.avatar)} size={a.place === 1 ? 56 : 44} />
                        <span className={styles.name}>{displayName(a.name, lang)}</span>
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
