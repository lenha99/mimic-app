import Link from "next/link";
import { extraLine, getMemes, playCount } from "@/lib/memes";
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

  // 명대사와 동물 소리는 고르는 마음이 다르다 — 하나는 "저거 나도 할 줄 알아",
  // 다른 하나는 "저건 웃기겠다". 한 줄로 섞어두면 둘 다 안 보인다.
  // 구분 기준은 line 의 유무다 (말소리 밈에만 대사가 있다는 레지스트리 규칙).
  const groups = [
    { head: "명대사", items: rest.filter((m) => m.line) },
    { head: "동물 소리", items: rest.filter((m) => !m.line) },
  ].filter((g) => g.items.length > 0);

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
            {playCount(today) !== null ? (
              <span className={styles.heroPlays}>
                {playCount(today)!.toLocaleString("ko-KR")}명 도전
              </span>
            ) : (
              <span className={styles.new}>NEW</span>
            )}
          </div>

          <p className={styles.heroFace} aria-hidden="true">
            {today.emoji}
          </p>
          <h1 className={styles.heroTitle}>{today.title}</h1>
          {extraLine(today) && (
            <p className={styles.heroLine}>“{extraLine(today)}”</p>
          )}
          <p className={styles.heroSource}>{today.source}</p>

          <Link href={`/record/${today.id}`} className={styles.heroGo}>
            듣고 바로 따라하기
          </Link>
        </section>
      )}

      {groups.map((g) => (
        <section key={g.head} className={styles.more}>
          <h2 className={styles.moreHead}>{g.head}</h2>
          <ul className={styles.list}>
            {g.items.map((m) => (
              <li key={m.id}>
                <Link href={`/record/${m.id}`} className={styles.row}>
                  <span className={styles.rowFace} aria-hidden="true">
                    {m.emoji}
                  </span>
                  <span className={styles.rowBody}>
                    <span className={styles.rowTitle}>{m.title}</span>
                    {/* 대사가 곧 후크다 — 출처보다 앞에 둔다. 뭘 외칠지가 먼저다. */}
                    <span className={styles.rowMeta}>
                      {extraLine(m) && (
                        <span className={styles.rowLine}>“{extraLine(m)}”</span>
                      )}
                      {extraLine(m) && " · "}
                      {m.source}
                      {playCount(m) !== null &&
                        ` · ${playCount(m)!.toLocaleString("ko-KR")}명`}
                    </span>
                  </span>
                  {playCount(m) === null && (
                    <span className={styles.newDot} aria-label="새 소리">
                      NEW
                    </span>
                  )}
                  <span className={styles.rowGo} aria-hidden="true">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

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
