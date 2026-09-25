"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import styles from "./admin.module.css";

export function AdminLogin() {
  const router = useRouter();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ passcode }),
    });
    setBusy(false);
    if (!res.ok) {
      setError("암호가 달라요.");
      return;
    }
    router.refresh();
  };

  return (
    <form onSubmit={submit} className={styles.login}>
      <input
        type="password"
        value={passcode}
        onChange={(e) => setPasscode(e.target.value)}
        placeholder="운영자 암호"
        autoComplete="current-password"
      />
      {error && <p className={styles.error}>{error}</p>}
      <button type="submit" disabled={busy || !passcode}>
        {busy ? "확인 중…" : "들어가기"}
      </button>
    </form>
  );
}

export function ReviewButtons({ id, mode }: { id: string; mode: "pending" | "approved" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const act = async (action: "approve" | "reject" | "unpublish") => {
    if (action === "reject" && !window.confirm("반려하면 링크도 막히고 소리도 지워져요. 할까요?")) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/challenges/${id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusy(false);
    if (!res.ok) {
      setError("실패했어요. 다시 눌러주세요.");
      return;
    }
    router.refresh();
  };

  return (
    <div className={styles.actions}>
      {mode === "pending" ? (
        <button type="button" className={styles.approve} disabled={busy} onClick={() => act("approve")}>
          올리기
        </button>
      ) : (
        <button type="button" className={styles.neutral} disabled={busy} onClick={() => act("unpublish")}>
          목록에서 내리기
        </button>
      )}
      <button type="button" className={styles.reject} disabled={busy} onClick={() => act("reject")}>
        반려
      </button>
      <a href={`/record/${id}`} target="_blank" rel="noreferrer" className={styles.open}>
        열어보기 ↗
      </a>
      {error && <span className={styles.error}>{error}</span>}
    </div>
  );
}
