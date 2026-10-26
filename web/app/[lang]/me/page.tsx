import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MyFace } from "./my-face";
import { getViewer } from "@/lib/viewer";
import { ScreenTour } from "@/components/onboarding/tours";
import { TourHelp } from "@/components/onboarding/tour";
import { GuestNickname } from "./guest-nickname";
import { getT } from "@/lib/i18n-server";
import styles from "./me.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("나", "Me") };
}

/**
 * "나" 탭. 로그인했으면 프로필이 곧 내 자리라 그리로 보낸다.
 *
 * 로그인 전에도 할 수 있는 게 많다 — 캐릭터는 폰에 저장되고, 연습 기록도 폰에
 * 남고, 챌린지도 만들 수 있다. 로그인 벽부터 세우지 않고 그걸 먼저 보여준다.
 */
export default async function MePage() {
  const viewer = await getViewer();
  if (viewer.loggedIn) redirect("/profile");
  const t = await getT();

  return (
    <main className="shell">
      <TourHelp id="me" corner />
      <header className={styles.head} data-tour="me-head">
        <div className={styles.face}>
          <MyFace fallback={viewer.avatar} />
        </div>
        <div>
          <h1 className={styles.title}>{t("아직 손님이에요 👋", "You're a guest 👋")}</h1>
          <p className={styles.sub}>
            {t("로그인 없이도 다 해볼 수 있어요. 로그인하면 기록이 계정에 남아요.", "You can try everything without logging in. Log in to keep your records.")}
          </p>
        </div>
      </header>

      <GuestNickname />

      <Link href="/login" className={styles.login} data-tour="me-login">
        {t("로그인 · 가입", "Log in / sign up")}
      </Link>

      <ul className={styles.list}>
        <Row
          href="/avatar"
          title={t("내 캐릭터 꾸미기", "Customize my character")}
          sub={t("녹음하면 이 친구가 내 목소리로 외쳐요", "It shouts in your voice when you record")}
          tour="me-avatar"
        />
        <Row
          href="/practice"
          title={t("연습 기록", "Practice history")}
          sub={t("대본마다 내 테이크가 이 폰에 쌓여 있어요", "Your takes for each script, saved on this phone")}
          tour="me-practice"
        />
        <Row
          href="/create"
          title={t("내 소리로 챌린지 만들기", "Make a challenge with my sound")}
          sub={t("5초만 녹음하면 친구들이 날 따라 해요", "Record 5 seconds and friends try to copy you")}
        />
        <Row href="/probe" title={t("마이크 검사", "Mic check")} sub={t("녹음이 안 될 때", "If recording isn't working")} />
        <Row
          href="/?tour=1"
          title={t("사용법 다시 보기", "Replay the tour")}
          sub={t("홈 화면 안내를 다시 봐요 · 화면마다 💡 사용법 보기도 있어요", "See the home guide again · every screen has 💡 How it works")}
        />
      </ul>
      <ScreenTour id="me" />
    </main>
  );
}

function Row({ href, title, sub, tour }: { href: string; title: string; sub: string; tour?: string }) {
  return (
    <li data-tour={tour}>
      <Link href={href} className={styles.row}>
        <span>
          <b>{title}</b>
          <small>{sub}</small>
        </span>
        <i aria-hidden="true">→</i>
      </Link>
    </li>
  );
}
