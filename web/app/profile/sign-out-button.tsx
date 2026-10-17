"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "./profile.module.css";

export function SignOutButton() {
  const supabase = createClient();
  const router = useRouter();

  const signOut = async () => {
    // 이 기기만 로그아웃한다. 기본값(global)은 폰·PC·설치한 앱 전부에서 끊는다.
    await supabase.auth.signOut({ scope: "local" });
    router.push("/");
    router.refresh();
  };

  return (
    <button onClick={signOut} className={styles.signOut}>
      로그아웃
    </button>
  );
}
