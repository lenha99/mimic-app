import Link from "next/link";
import { ClaimPending } from "@/app/profile/claim-pending";
import { HomeBeacon } from "@/components/home-beacon";
import { InstallBanner } from "@/components/install-banner";
import { ViewerBadge } from "@/components/viewer";
import { YoutubeClip } from "@/components/youtube-clip";
import { extraLine, getMemes, playCount, type Meme } from "@/lib/memes";
import { SCRIPTS } from "@/lib/practice";
import styles from "./page.module.css";

/**
 * 정적 페이지로 두고 5분마다 다시 만든다.
 *
 * 요청마다 서버에서 그리던 때는 첫 응답이 6초였다 — 트래픽이 없으니 매번
 * 콜드 스타트였고, 그 뒤로 Modal 카탈로그와 Supabase 까지 기다렸다. 카톡 링크를
 * 눌렀는데 6초 동안 하얀 화면이면 대부분 닫는다. 누구인지(로그인·내 캐릭터)는
 * 브라우저에서 나중에 채운다 (components/viewer).
 */
export const revalidate = 300;

/**
 * 홈은 "뭐부터 하지"에만 답한다 — 오늘의 명대사 하나, 입구 둘.
 *
 * 예전 홈엔 단계 안내, 피드 배너, 연습실 띠, 명대사 레일, 동물 소리 타일, 친구
 * 챌린지, 캐릭터·투표 홍보가 한 화면에 다 있었다. 다 보여주니 아무것도 안 보였다.
 * 고르는 일은 챌린지 탭, 이동은 하단 탭이 맡고 홈엔 첫 한 걸음만 남긴다.
 *
 * 맨 위 하나는 바로 도전할 수 있어야 한다. 고르는 행위가 체험보다 앞서면 대부분은
 * 고르다 나간다.
 */
export default async function Home() {
  const { memes } = await getMemes();
  const lines = memes.filter((m) => m.line);
  const today = pickToday(lines.length ? lines : memes);

  return (
    <main className="shell">
      <header className={styles.head}>
        <span className={styles.logo}>MIMIC</span>
        <ViewerBadge />
      </header>

      <InstallBanner />

      {/* 로그인 전에 저장한 녹음을 계정으로 가져온다. 가져올 게 없으면 아무것도 안 그린다. */}
      <ClaimPending />

      {today && (
        <section className={styles.hero}>
          <div className={styles.heroTop}>
            <span className={styles.kicker}>
              <span className={styles.live} aria-hidden="true" />
              오늘의 명대사
            </span>
            {playCount(today) !== null && (
              <span className={styles.plays}>
                {playCount(today)!.toLocaleString("ko-KR")}명 도전
              </span>
            )}
          </div>

          <div className={styles.stage}>
            {today.youtube ? (
              <div className={styles.clip}>
                <YoutubeClip
                  id={today.youtube.id}
                  start={today.youtube.start}
                  end={today.youtube.end}
                  title={today.title}
                />
              </div>
            ) : (
              <p className={styles.face} aria-hidden="true">
                {today.emoji}
              </p>
            )}
          </div>

          <h1 className={styles.heroTitle}>{today.title}</h1>
          <p className={styles.heroSource}>
            {today.source}
            {extraLine(today) && ` · “${extraLine(today)}”`}
          </p>

          <Link href={`/record/${today.id}`} className={styles.heroGo}>
            듣고 바로 따라하기
          </Link>
          <p className={styles.heroNote}>로그인 없이 · 탭 한 번이면 시작</p>
        </section>
      )}

      <nav className={styles.doors} aria-label="둘러보기">
        <Link href="/challenges" className={`${styles.door} ${styles.doorChallenge}`}>
          <span className={styles.doorKicker}>따라 외치고 점수 대결</span>
          <span className={styles.doorTitle}>명대사 챌린지</span>
          <span className={styles.doorSub}>{lines.length}개 · 친구한테 점수로 도전장</span>
          <span className={styles.doorArt}>
            <span className={styles.doorScore} aria-hidden="true">
              92<small>점</small>
            </span>
            <span className={styles.doorGo} aria-hidden="true">
              →
            </span>
          </span>
        </Link>

        <Link href="/practice" className={`${styles.door} ${styles.doorPractice}`}>
          <span className={styles.doorKicker}>성우·아나운서 준비</span>
          <span className={styles.doorTitle}>연습실</span>
          <span className={styles.doorSub}>대본 {SCRIPTS.length}편 · 고칠 곳을 짚어줘</span>
          <span className={styles.doorArt}>
            <span className={styles.doorPaper} aria-hidden="true">
              그때 <i>/</i> 연락 못 한 거 <i>/</i> 바빠서 그랬다고
            </span>
            <span className={styles.doorGo} aria-hidden="true">
              →
            </span>
          </span>
        </Link>
      </nav>

      <Link href="/create" className={styles.create}>
        <span>
          <b>내 소리로 챌린지 만들기</b>
          <small>5초 녹음하면 친구들이 날 따라해</small>
        </span>
        <i aria-hidden="true">→</i>
      </Link>

      <HomeBeacon />

      <footer className={styles.foot}>
        <p className={styles.footNote}>
          녹음은 &ldquo;저장하기&rdquo;를 눌러야만 남아요 · 저장 안 하면 바로 버려요
        </p>
        <Link href="/probe" className={styles.footLink}>
          녹음이 안 되면 마이크 검사 →
        </Link>
      </footer>
    </main>
  );
}

/**
 * "오늘의 명대사"는 정말 날마다 바뀐다(한국 시간 자정 기준). 페이지가 5분마다
 * 다시 만들어지므로 자정이 지나면 늦어도 5분 안에 바뀐다.
 */
function pickToday(memes: Meme[]): Meme | undefined {
  if (memes.length === 0) return undefined;
  const day = Math.floor((Date.now() + 9 * 3_600_000) / 86_400_000);
  return memes[day % memes.length];
}
