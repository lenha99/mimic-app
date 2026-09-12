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

        {/* 녹음 화면(#19)은 V1 검증 결과를 본 뒤에 만든다. 지금은 검증 페이지가 입구다. */}
        <div className={styles.notice}>
          <p className={styles.noticeText}>
            녹음 기능을 만들기 전에, 이 브라우저에서 마이크가 실제로 열리는지 먼저
            확인합니다. 카카오톡에서 이 링크를 열어 테스트해 주세요.
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
            <li key={m.id} className={styles.card}>
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
            </li>
          ))}
        </ul>
      </section>

      <footer className={styles.foot}>
        MIMIC 웹 리빌드 · M1 진행 중
        <br />
        녹음·채점·공유 화면은 아직 없습니다. 마이크 검사(#13)가 먼저입니다.
      </footer>
    </main>
  );
}
