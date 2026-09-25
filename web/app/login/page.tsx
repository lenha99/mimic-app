"use client";

import { Suspense } from "react";
import { BackHome } from "@/components/back-home";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "./login.module.css";

/** TODO(Dev A): 약관 동의 UI. */
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const supabase = createClient();
  const error = useSearchParams().get("error");

  const signInWith = (provider: "kakao" | "google") =>
    supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });

  return (
    <main className="shell">
      <BackHome />
      <div className={styles.center}>
        <div className="logo">🎙 MIMIC</div>
        <h1 className={styles.title}>로그인</h1>
        <p className={styles.sub}>투표하고 랭킹에 오르려면 로그인이 필요해요.</p>

        {error && <p className={styles.error}>로그인에 실패했어요. 다시 시도해주세요.</p>}

        <button onClick={() => signInWith("kakao")} className={styles.kakao}>
          카카오로 시작하기
        </button>
        <button onClick={() => signInWith("google")} className={styles.google}>
          Google로 시작하기
        </button>
      </div>
    </main>
  );
}
