"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./profile.module.css";

export function NicknameEditor({ userId, initialNickname }: { userId: string; initialNickname: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [nickname, setNickname] = useState(initialNickname);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const trimmed = nickname.trim();
    if (!trimmed) {
      setError("닉네임을 입력해주세요.");
      return;
    }
    setSaving(true);
    setError(null);
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ nickname: trimmed })
      .eq("id", userId);
    setSaving(false);

    if (updateError) {
      setError(
        updateError.code === "23505"
          ? "이미 사용 중인 닉네임이에요."
          : "저장에 실패했어요. 다시 시도해주세요.",
      );
      return;
    }
    setEditing(false);
    router.refresh();
  };

  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} className={styles.editBtn}>
        닉네임 수정
      </button>
    );
  }

  return (
    <div className={styles.editRow}>
      <input
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        className={styles.input}
        maxLength={20}
      />
      {error && <p className={styles.warn}>{error}</p>}
      <div className={styles.actions}>
        <button onClick={save} disabled={saving} className={styles.save}>
          {saving ? "저장 중..." : "저장"}
        </button>
        <button
          onClick={() => {
            setEditing(false);
            setNickname(initialNickname);
            setError(null);
          }}
          className={styles.cancel}
        >
          취소
        </button>
      </div>
    </div>
  );
}
