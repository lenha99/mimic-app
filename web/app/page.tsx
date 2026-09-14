import Link from "next/link";
import { getMemes } from "@/lib/memes";
import styles from "./page.module.css";

export default async function Home() {
  const { memes, stale } = await getMemes();

  return (
    <main className="shell">
      <header className={styles.head}>
        <div className="logo">🎙 MIMIC</div>
        <h1 className={styles.title}>
          듣고, 따라하고,
          <br />
          점수로 확인하세요
        </h1>
        <p className={styles.sub}>
          AI가 피치·톤·타이밍 세 축으로 채점합니다. 설치 없이 브라우저에서 바로.
        </p>

        <div className={styles.notice}>
          <p className={styles.noticeText}>
            녹음이 안 되면 브라우저 문제일 수 있습니다. 마이크 검사로 확인하세요.
          </p>
          <Link href="/probe" className={styles.noticeLink}>
            마이크 검사 →
          </Link>
        </div>
      </header>

      <section>
        <div className={styles.listHead}>
          <span className="eyebrow">따라할 소리</span>
          {stale && <span className={styles.stale}>서버 응답 없음 · 내장 목록</span>}
        </div>

        <ul className={styles.grid}>
          {memes.map((m) => (
            <li key={m.id}>
              <Link href={`/record/${m.id}`} className={styles.card}>
                <span className={styles.emoji} aria-hidden="true">
                  {m.emoji}
                </span>
                <div className={styles.cardBody}>
                  <h2 className={styles.cardTitle}>{m.title}</h2>
                  <p className={styles.cardMeta}>
                    {m.source}
                    {typeof m.plays === "number" &&
                      ` · ${m.plays.toLocaleString("ko-KR")}회`}
                  </p>
                </div>
                <span className={styles.go} aria-hidden="true">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <footer className={styles.foot}>
        MIMIC 웹 리빌드 · M1
        <br />
        녹음은 채점에만 쓰이고 저장되지 않습니다.
      </footer>
    </main>
  );
}
