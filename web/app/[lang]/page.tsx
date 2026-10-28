import Link from "next/link";
import { ClaimPending } from "@/app/[lang]/profile/claim-pending";
import { Seal } from "@/app/[lang]/voice/card";
import { HomeBeacon } from "@/components/home-beacon";
import { InstallBanner } from "@/components/install-banner";
import { ViewerBadge } from "@/components/viewer";
import { HomeHero } from "@/components/weekly/home-hero";
import { getMemes } from "@/lib/memes";
import { SCRIPTS } from "@/lib/practice";
import { getBoard, liveWeek } from "@/lib/weekly-server";
import { ScreenTour } from "@/components/onboarding/tours";
import { TourHelp } from "@/components/onboarding/tour";
import { LangSwitch } from "@/components/lang";
import { getT } from "@/lib/i18n-server";
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
  const t = await getT();

  return (
    <main className="shell">
      <header className={styles.head}>
        <span className={styles.logo}>MIMIC</span>
        <span className={styles.headRight}>
          {/* 안내 말풍선이 버튼 오른쪽 끝에 맞춰 펼쳐지므로 맨 오른쪽에 둔다. */}
          <ViewerBadge />
          <TourHelp id="home" welcome />
        </span>
      </header>

      <InstallBanner />

      {/* 로그인 전에 저장한 녹음을 계정으로 가져온다. 가져올 게 없으면 아무것도 안 그린다. */}
      <ClaimPending />

      {/* 이번 주 보이스 챌린지 — 지금 이 앱의 첫 한 걸음이다. */}
      <div data-tour="home-weekly">
        <HomeHero week={weekly.week} top={weekly.entries.slice(0, 3)} count={weekly.entries.length} />
      </div>

      <nav className={styles.doors} aria-label={t("둘러보기", "Explore")}>
        <Link href="/challenges" className={`${styles.door} ${styles.doorChallenge}`} data-tour="home-memes">
          <span className={styles.doorKicker}>{t("레전드 명대사 성대모사", "Iconic K-movie lines")}</span>
          <span className={styles.doorTitle}>{t("명대사 챌린지", "Line Challenge")}</span>
          <span className={styles.doorSub}>
            {t(`대사 ${lines.length}개 · 내 점수, 친구는 넘을 수 있을까요?`, `${lines.length} lines · Can your friends beat your score?`)}
          </span>
          <span className={styles.doorArt}>
            <span className={styles.doorScore} aria-hidden="true">
              92<small>{t("점", "pts")}</small>
            </span>
            <span className={styles.doorGo} aria-hidden="true">
              →
            </span>
          </span>
        </Link>

        <Link href="/practice" className={`${styles.door} ${styles.doorPractice}`} data-tour="home-practice">
          <span className={styles.doorKicker}>{t("성우·아나운서 지망생이라면", "For voice actors & anchors")}</span>
          <span className={styles.doorTitle}>{t("연습실", "Practice Room")}</span>
          <span className={styles.doorSub}>
            {t(`대본 ${SCRIPTS.length}편 · 고칠 곳을 콕 집어드려요`, `${SCRIPTS.length} Korean scripts · we pinpoint what to fix`)}
          </span>
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

      <Link href="/voice" className={styles.voice} data-tour="home-voice">
        <span className={styles.voiceSeals} aria-hidden="true">
          <Seal char="王" size={34} />
          <Seal char="奸" size={34} />
          <Seal char="笑" size={34} />
        </span>
        <span className={styles.voiceText}>
          <b>{t("내 목소리, 사극에선 무슨 역?", "What role would your voice play?")}</b>
          <small>{t("왕 · 간신 · 망나니 · 삐에로… 10초 판정", "King · Schemer · Jester… cast in 10 seconds")}</small>
        </span>
        <i aria-hidden="true">→</i>
      </Link>

      <HomeBeacon />

      {/* 버튼마다 "이건 뭐고 누르면 어떻게 되는지" — 위쪽 "사용법 보기"로 연다. */}
      <ScreenTour id="home" />

      <footer className={styles.foot}>
        <LangSwitch />
        <p className={styles.footNote}>
          {t(
            "🔒 연습 녹음은 내 폰에만 저장돼요 · 🌐 공개를 고른 녹음만 다른 사람이 들을 수 있어요",
            "🔒 Practice takes stay on your phone · 🌐 Only takes you make public can be heard",
          )}
        </p>
        <Link href="/probe" className={styles.footLink}>
          {t("녹음이 안 되나요? 마이크 점검하기 →", "Mic not working? Check it →")}
        </Link>
        <Link href="/?tour=1" className={styles.footLink}>
          {t("사용법 다시 보기", "How it works")}
        </Link>
      </footer>
    </main>
  );
}
