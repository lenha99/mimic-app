"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./profile.module.css";

/** 회원 탈퇴. 녹음 파일·투표·프로필이 전부 지워진다 (/api/account). */
export function DeleteAccount() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (
      !window.confirm(
        "정말 탈퇴할까요? 저장한 녹음·받은 투표·캐릭터가 전부 지워지고 되돌릴 수 없어요.",
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "탈퇴에 실패했어요. 다시 시도해주세요.");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("네트워크가 끊겼어요. 다시 시도해주세요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.danger}>
      {error && <p className={styles.warn}>{error}</p>}
      <button type="button" onClick={run} disabled={busy} className={styles.dangerBtn}>
        {busy ? "지우는 중…" : "회원 탈퇴"}
      </button>
    </div>
  );
}
