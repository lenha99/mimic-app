import type { Metadata } from "next";
import Link from "next/link";
import { BackHome } from "@/components/back-home";
import { createClient } from "@/lib/supabase/server";
import { Creator } from "./creator";
import { ScreenTour } from "@/components/onboarding/tours";
import { TourHelp } from "@/components/onboarding/tour";
import { getT } from "@/lib/i18n-server";
import styles from "./create.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("내 챌린지 만들기", "Make a challenge"),
    description: t("내 목소리로 챌린지를 만들고 친구한테 따라 해 보라고 보내 보세요.", "Turn your voice into a challenge and dare friends to copy it."),
  };
}

/**
 * 내 챌린지 만들기.
 *
 * 콘텐츠가 모자란 걸 운영자 손으로만 메우면 한 주에 몇 개가 한계다. 친구의 말버릇,
 * 성대모사, 사투리 한마디는 그 자체로 제일 웃긴 콘텐츠고 권리 문제도 없다.
 * 만든 사람이 곧 링크를 던지므로 콘텐츠가 곧 확산이다.
 */
export default async function CreatePage() {
  const t = await getT();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="shell">
      <TourHelp id="create" corner />
      <BackHome />
      <header className={styles.head} data-tour="create-head">
        <h1>{t("내 챌린지 만들기", "Make a challenge")}</h1>
        <p>{t("내 소리를 녹음하면 친구들이 날 따라 해요", "Record your sound — friends try to copy you")}</p>
      </header>
      {user ? (
        <Creator />
      ) : (
        <div className={styles.gate} data-tour="create-gate">
          <p>
            {t(
              "챌린지는 로그인하면 만들 수 있어요. 누가 만들었는지, 몇 명이 따라 했는지 알려 드려야 해서요.",
              "Log in to make challenges — so we can show who made it and how many people tried.",
            )}
          </p>
          <Link href="/login" className={styles.primary}>
            {t("로그인하고 만들기", "Log in to create")}
          </Link>
        </div>
      )}
      <ScreenTour id="create" />
    </main>
  );
}
