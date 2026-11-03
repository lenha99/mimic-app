import Link from "next/link";
import { ClaimPending } from "@/app/[lang]/profile/claim-pending";
import { HomeBeacon } from "@/components/home-beacon";
import { InstallBanner } from "@/components/install-banner";
import { TopBar } from "@/components/top-bar";
import { VoiceStories } from "@/components/home/voice-stories";
import { MyVoiceCard } from "@/components/home/my-voice-card";
import home from "@/components/home/home.module.css";
import { HomeHero } from "@/components/weekly/home-hero";
import { getMemes } from "@/lib/memes";
import { findScript, SCRIPTS } from "@/lib/practice";
import { galleryEntries, getBoard, liveWeek } from "@/lib/weekly-server";
import { HomePick } from "@/components/home/home-pick";
import { FirstMission } from "@/components/home/first-mission";
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
 * 홈은 "뭐부터 하지"에만 답한다 — 연습실이라는 큰 문 하나(추천 대본·목소리 갤러리가 붙어 있다), 작은 입구 둘.
 * (예전 맨 위는 "오늘의 명대사", 그다음엔 "이번 주 보이스 챌린지"였다. 처음 온 사람이 챌린지·갤러리를
 * 헷갈려 해서, 어떤 대본으로 올려도 같은 ❤ 순위로 합치고 연습실을 주인공으로 올렸다.)
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
  const [{ memes }, weekly, gallery] = await Promise.all([
    getMemes(),
    getBoard(week).catch(() => ({ week, entries: [], totalLikes: 0 })),
    galleryEntries(24).catch(() => []),
  ]);
  const lines = memes.filter((m) => m.line);
  const t = await getT();
  const line = firstLine(findScript(weekly.week.scriptId)?.text ?? "");
  // 첫 미션 — 운영자 픽부터, 그다음 최근 목소리. 대사는 이번 주 추천 대본 첫 줄(자르지 않은 것).
  const missionVoices = [...gallery.filter((e) => e.featured), ...gallery.filter((e) => !e.featured)]
    .slice(0, 3)
    .map((e) => ({ id: e.id, name: e.name, avatar: e.avatar, look: e.look }));
  const missionLine = plainFirst(findScript(weekly.week.scriptId)?.text ?? "");

  return (
    <main className="shell">
      {/* 위쪽 바 — 🌐 언어 · ♡ 활동 · ✈ 메시지. 안내 말풍선이 오른쪽 끝에 맞춰 펼쳐지므로 맨 끝에 둔다. */}
      <TopBar>
        <TourHelp id="home" welcome short />
      </TopBar>

      {/* 올라온 목소리 — 인스타 스토리처럼. 주를 넘어 쌓인 것까지(월요일에 비지 않게). 맨 앞은 "+ 내 목소리". */}
      <VoiceStories entries={gallery.slice(0, 20).map((e) => ({ id: e.id, name: e.name, avatar: e.avatar, look: e.look }))} />

      {/* 연습실 — 첫 한 걸음. 아래에 이번 주 추천 대본과 목소리 갤러리(❤ 순위)가 붙어 있다. */}
      <HomeHero
        week={weekly.week}
        top={weekly.entries.slice(0, 3)}
        count={weekly.entries.length}
        line={line}
        scripts={SCRIPTS.length}
        total={gallery.length}
        faces={gallery.map((e) => e.avatar)}
      />

      {/* 운영자 픽 — 좋은 목소리는 첫 화면에서 바로 들린다. */}
      <HomePick picks={gallery.filter((e) => e.featured).slice(0, 5)} />

      <InstallBanner />

      {/* 로그인 전에 저장한 녹음을 계정으로 가져온다. 가져올 게 없으면 아무것도 안 그린다. */}
      <ClaimPending />

      {/* 내 목소리 페이지 — 있는지도 모르면 없는 기능이다. */}
      <MyVoiceCard />

      {/* 그 밖의 입구 — 연습실로 이어지지 않는 놀거리라 아래에 작게. */}
      <div className={home.sectionHead}>
        <h2>{t("더 놀거리", "More to try")}</h2>
      </div>
      <nav className={home.bento} aria-label={t("둘러보기", "Explore")}>
        <Link href="/voice" className={`${home.tile} ${home.tileVoice}`} data-tour="home-voice">
          <span className={home.tileEmoji} aria-hidden="true">
            🎤
          </span>
          <span className={home.tileText}>
            <b>{t("음역대 테스트", "Vocal range")}</b>
            <small>{t("내 최고음은 🐬 돌고래급? · 10초", "Are you 🐬 Dolphin? · 10s")}</small>
          </span>
        </Link>
        <Link href="/challenges" className={`${home.tile} ${home.tileLine}`} data-tour="home-memes">
          <span className={home.tileEmoji} aria-hidden="true">
            🎬
          </span>
          <span className={home.tileText}>
            <b>{t("명대사 따라하기", "Movie lines")}</b>
            <small>{t(`대사 ${lines.length}개 · 점수 대결`, `${lines.length} lines · score battle`)}</small>
          </span>
        </Link>
        <Link href="/anime" className={`${home.tile} ${home.tileAnime}`} data-tour="home-anime">
          <span className={home.tileEmoji} aria-hidden="true">
            🌀
          </span>
          <span className={home.tileText}>
            <b>{t("애니 명대사 기합 대결", "Anime lines hype battle")}</b>
            <small>{t("심장을 바쳐라! 나선환! · 친구랑 폰 하나로", "Shout iconic lines · battle friends on one phone")}</small>
          </span>
          <i className={home.tileNew}>NEW</i>
        </Link>
      </nav>

      <HomeBeacon />

      {missionLine && <FirstMission voices={missionVoices} scriptId={weekly.week.scriptId} line={missionLine} />}

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

/** 미션용 한 줄 — 첫 문단, 길면 첫 문장까지만(대신 자르지 않는다: 읽을 글자와 음절 수가 맞아야 한다) */
function plainFirst(text: string): string {
  const first = text.split(/\r?\n/).find((l) => l.trim()) ?? "";
  const plain = first.replace(/[/*]/g, " ").replace(/\s+/g, " ").trim();
  if (plain.length <= 60) return plain;
  const m = plain.match(/^.+?[.?!]/);
  return m && m[0].length >= 8 ? m[0] : plain;
}

/** 대본 첫 줄 — 쉼(/)·강조(*) 표시를 걷어내고 짧게. */
function firstLine(text: string): string {
  const first = text.split(/\r?\n/).find((l) => l.trim()) ?? "";
  const plain = first.replace(/[/*]/g, " ").replace(/\s+/g, " ").trim();
  return plain.length > 44 ? `${plain.slice(0, 43)}…` : plain;
}
