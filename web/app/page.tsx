import Link from "next/link";
import { getMemes } from "@/lib/memes";
import styles from "./page.module.css";

/**
 * 홈은 목록이 아니라 첫 챌린지다.
 *
 * 이전 홈은 "고르기"를 첫 관문으로 세웠다 — 목록에서 하나 고르고, 상세로 들어가고,
 * 거기서 또 두 번 눌러야 소리가 났다. 고르는 행위가 체험보다 앞서면 대부분은
 * 고르다 나간다. 그래서 맨 위 하나를 바로 도전 가능한 상태로 놓고, 나머지는
 * 그 아래에 둔다.
 */
export default async function Home() {
  const { memes, stale } = await getMemes();
  const [today, ...rest] = memes;

  return (
    <main className="shell">
      <header className={styles.head}>
        <span className={styles.logo}>MIMIC</span>
        {stale && <span className={styles.stale}>서버 응답 없음 · 내장 목록</span>}
      </header>

      {today && (
        <section className={styles.hero}>
          <div className={styles.heroTop}>
            <span className={styles.heroKicker}>오늘의 소리</span>
            {typeof today.plays === "number" && (
              <span className={styles.heroPlays}>
                {today.plays.toLocaleString("ko-KR")}명 도전
              </span>
            )}
          </div>

          <p className={styles.heroFace} aria-hidden="true">
            {today.emoji}
          </p>
          <h1 className={styles.heroTitle}>{today.title}</h1>
          <p className={styles.heroSource}>{today.source}</p>

          <Link href={`/record/${today.id}`} className={styles.heroGo}>
            듣고 바로 따라하기
          </Link>
        </section>
      )}

      {rest.length > 0 && (
        <section className={styles.more}>
          <h2 className={styles.moreHead}>다른 소리</h2>
          <ul className={styles.list}>
            {rest.map((m) => (
              <li key={m.id}>
                <Link href={`/record/${m.id}`} className={styles.row}>
                  <span className={styles.rowFace} aria-hidden="true">
                    {m.emoji}
                  </span>
                  <span className={styles.rowBody}>
                    <span className={styles.rowTitle}>{m.title}</span>
                    <span className={styles.rowMeta}>
                      {m.source}
                      {typeof m.plays === "number" &&
                        ` · ${m.plays.toLocaleString("ko-KR")}명`}
                    </span>
                  </span>
                  <span className={styles.rowGo} aria-hidden="true">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className={styles.foot}>
        <p className={styles.footNote}>
          로그인 없이 바로 도전 · 점수만 내고 녹음은 바로 버려
        </p>
        <Link href="/probe" className={styles.footLink}>
          녹음이 안 되면 마이크 검사 →
        </Link>
      </footer>
    </main>
  );
}
