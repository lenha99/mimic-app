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
      const settled: string[] = [];
      for (const token of tokens) {
        const { error } = await supabase.rpc("claim_recording", { p_claim_token: token });
        if (!error) ok += 1;
        // 버려도 되는 건 결론이 난 토큰뿐이다 — 가져왔거나, 서버가 "없는/이미 쓴 토큰"이라고
        // 거부했거나. 네트워크 오류나 로그인 직후 세션이 아직 안 붙은 경우(login required)는
        // 다음에 다시 시도해야 한다. 여기서 지우면 그 녹음은 영영 못 가져온다.
        if (
          !error ||
          error.message.includes("invalid or already claimed") ||
          error.code === "22P02" // uuid 형식이 아닌 토큰 — 다시 해도 안 된다
        ) {
          settled.push(token);
        }
      }
      removeGuestClaims(settled);
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
