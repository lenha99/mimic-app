"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useT } from "@/components/lang";
import styles from "./profile.module.css";

/** 회원 탈퇴. 녹음 파일·투표·프로필이 전부 지워진다 (/api/account). */
export function DeleteAccount() {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (
      !window.confirm(
        t(
          "정말 탈퇴할까요? 저장한 녹음·받은 투표·캐릭터가 전부 지워지고 되돌릴 수 없어요.",
          "Delete your account? All recordings, votes and your character will be erased. This can't be undone.",
        ),
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
        setError(data.error ?? t("탈퇴가 안 됐어요. 다시 시도해 주세요.", "Couldn't delete your account. Please try again."));
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError(t("인터넷이 잠깐 끊겼어요. 다시 시도해 주세요.", "Connection dropped. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.danger}>
      {error && <p className={styles.warn}>{error}</p>}
      <button type="button" onClick={run} disabled={busy} className={styles.dangerBtn}>
        {busy ? t("지우는 중…", "Deleting…") : t("회원 탈퇴", "Delete account")}
      </button>
    </div>
  );
}
