import Link from "next/link";
import { ClaimPending } from "@/app/profile/claim-pending";
import { HomeBeacon } from "@/components/home-beacon";
import { InstallBanner } from "@/components/install-banner";
import { IntroSheet } from "@/components/onboarding/intro-sheet";
import { ViewerBadge } from "@/components/viewer";
import { HomeHero } from "@/components/weekly/home-hero";
import { getMemes } from "@/lib/memes";
import { SCRIPTS } from "@/lib/practice";
import { getBoard, liveWeek } from "@/lib/weekly-server";
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
 * 홈은 "뭐부터 하지"에만 답한다 — 이번 주 보이스 챌린지 하나, 입구 둘.
 * (예전 맨 위는 "오늘의 명대사"였다. 밈 따라하기는 이제 아래 입구로 들어간다.)
 *
 * 예전 홈엔 단계 안내, 피드 배너, 연습실 띠, 명대사 레일, 동물 소리 타일, 친구
 * 챌린지, 캐릭터·투표 홍보가 한 화면에 다 있었다. 다 보여주니 아무것도 안 보였다.
 * 고르는 일은 챌린지 탭, 이동은 하단 탭이 맡고 홈엔 첫 한 걸음만 남긴다.
 *
 * 맨 위 하나는 바로 도전할 수 있어야 한다. 고르는 행위가 체험보다 앞서면 대부분은
 * 고르다 나간다.
 */
export default async function Home() {
  const week = await liveWeek();
  const [{ memes }, weekly] = await Promise.all([
    getMemes(),
    getBoard(week).catch(() => ({ week, entries: [], totalLikes: 0 })),
  ]);
  const lines = memes.filter((m) => m.line);

  return (
    <main className="shell">
      <header className={styles.head}>
        <span className={styles.logo}>MIMIC</span>
        <ViewerBadge />
      </header>

      <InstallBanner />

      {/* 로그인 전에 저장한 녹음을 계정으로 가져온다. 가져올 게 없으면 아무것도 안 그린다. */}
      <ClaimPending />

      {/* 이번 주 보이스 챌린지 — 지금 이 앱의 첫 한 걸음이다. */}
      <HomeHero week={weekly.week} top={weekly.entries.slice(0, 3)} count={weekly.entries.length} />

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

      {/* 처음 온 사람에게만, 한 번. */}
      <IntroSheet scriptId={weekly.week.scriptId} title={weekly.week.title} />

      <footer className={styles.foot}>
        <p className={styles.footNote}>
          🔒 연습 녹음은 내 폰에만 · 🌐 출전·공개를 고른 녹음만 다른 사람이 들어요
        </p>
        <Link href="/probe" className={styles.footLink}>
          녹음이 안 되면 마이크 검사 →
        </Link>
        <Link href="/?intro=1" className={styles.footLink}>
          사용법 다시 보기
        </Link>
      </footer>
    </main>
  );
}
