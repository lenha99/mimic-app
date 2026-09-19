"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { readGuestClaims, removeGuestClaims } from "@/lib/guest-claims";
import styles from "./profile.module.css";

/**
 * 비로그인으로 저장했던 녹음을 로그인한 계정에 귀속시킨다 (이슈 #19).
 *
 * 로그인 후 첫 착지점이 /profile 이라 여기서 처리한다. 토큰은 localStorage 에만
 * 있어서 서버 컴포넌트가 읽을 수 없기 때문에 클라이언트에서 RPC를 부른다.
 *
 * 토큰은 1회용이고, 이미 귀속됐거나 남의 것이면 RPC가 거부한다 — 실패는 조용히
 * 넘기고 토큰만 버린다. 여기서 에러를 띄워봐야 사용자가 할 수 있는 게 없다.
 */
export function ClaimPending() {
  const router = useRouter();
  const [claimed, setClaimed] = useState(0);

  useEffect(() => {
    const tokens = readGuestClaims();
    if (tokens.length === 0) return;

    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      let ok = 0;
      for (const token of tokens) {
        const { error } = await supabase.rpc("claim_recording", { p_claim_token: token });
        if (!error) ok += 1;
      }
      // 성공이든 거부든 다시 시도할 이유가 없다 (토큰은 1회용).
      removeGuestClaims(tokens);
      if (cancelled) return;
      if (ok > 0) {
        setClaimed(ok);
        router.refresh();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (claimed === 0) return null;

  return (
    <p className={styles.claimed} role="status">
      로그인 전에 녹음한 {claimed}개를 이 계정으로 가져왔어요 🎙
    </p>
  );
}
