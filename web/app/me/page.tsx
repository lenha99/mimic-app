import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MyFace } from "./my-face";
import { getViewer } from "@/lib/viewer";
import { ScreenTour } from "@/components/onboarding/tours";
import { TourHelp } from "@/components/onboarding/tour";
import styles from "./me.module.css";

export const metadata: Metadata = { title: "나" };

/**
 * "나" 탭. 로그인했으면 프로필이 곧 내 자리라 그리로 보낸다.
 *
 * 로그인 전에도 할 수 있는 게 많다 — 캐릭터는 폰에 저장되고, 연습 기록도 폰에
 * 남고, 챌린지도 만들 수 있다. 로그인 벽부터 세우지 않고 그걸 먼저 보여준다.
 */
export default async function MePage() {
  const viewer = await getViewer();
  if (viewer.loggedIn) redirect("/profile");

  return (
    <main className="shell">
      <TourHelp id="me" corner />
      <header className={styles.head}>
        <div className={styles.face}>
          <MyFace fallback={viewer.avatar} />
        </div>
        <div>
          <h1 className={styles.title}>아직 손님이야</h1>
          <p className={styles.sub}>로그인 없이도 다 해볼 수 있어. 로그인하면 기록이 계정에 남아.</p>
        </div>
      </header>

      <Link href="/login" className={styles.login} data-tour="me-login">
        로그인 · 가입
      </Link>

      <ul className={styles.list}>
        <Row href="/avatar" title="내 캐릭터 꾸미기" sub="녹음하면 이 녀석이 내 목소리로 외쳐" tour="me-avatar" />
        <Row href="/practice" title="연습 기록" sub="대본마다 내 테이크가 이 폰에 쌓여 있어" tour="me-practice" />
        <Row href="/create" title="내 소리로 챌린지 만들기" sub="5초 녹음하면 친구들이 날 따라해" />
        <Row href="/probe" title="마이크 검사" sub="녹음이 안 될 때" />
        <Row href="/?tour=1" title="사용법 다시 보기" sub="홈 화면 안내를 다시 봐요 · 화면마다 ? 도 있어요" />
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
