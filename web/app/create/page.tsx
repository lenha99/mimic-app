import type { Metadata } from "next";
import Link from "next/link";
import { BackHome } from "@/components/back-home";
import { createClient } from "@/lib/supabase/server";
import { Creator } from "./creator";
import styles from "./create.module.css";

export const metadata: Metadata = {
  title: "내 챌린지 만들기",
  description: "내 목소리로 챌린지를 만들고 친구한테 따라해보라고 던져요.",
};

/**
 * 내 챌린지 만들기.
 *
 * 콘텐츠가 모자란 걸 운영자 손으로만 메우면 한 주에 몇 개가 한계다. 친구의 말버릇,
 * 성대모사, 사투리 한마디는 그 자체로 제일 웃긴 콘텐츠고 권리 문제도 없다.
 * 만든 사람이 곧 링크를 던지므로 콘텐츠가 곧 확산이다.
 */
export default async function CreatePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="shell">
      <BackHome />
      <header className={styles.head}>
        <h1>내 챌린지 만들기</h1>
        <p>내 소리를 녹음하면 친구들이 날 따라해</p>
      </header>
      {user ? (
        <Creator />
      ) : (
        <div className={styles.gate}>
          <p>챌린지는 로그인하면 만들 수 있어요. 누가 만들었는지 보여주고, 몇 명이 따라했는지 알려줘야 해서요.</p>
          <Link href="/login" className={styles.primary}>
            로그인하고 만들기
          </Link>
        </div>
      )}
    </main>
  );
}
