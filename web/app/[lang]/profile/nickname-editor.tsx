"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cleanNickname, NICK_MAX, nicknameProblem } from "@/lib/nickname";
import { useLang, useT } from "@/components/lang";
import styles from "./profile.module.css";

export function NicknameEditor({ userId, initialNickname }: { userId: string; initialNickname: string }) {
  const t = useT();
  const lang = useLang();
  const supabase = createClient();
  const router = useRouter();
  const [nickname, setNickname] = useState(initialNickname);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const trimmed = cleanNickname(nickname);
    if (!trimmed) {
      setError(nicknameProblem(nickname, lang));
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
          ? t("이미 누가 쓰는 닉네임이에요.", "That nickname is taken.")
          : t("저장이 안 됐어요. 다시 시도해 주세요.", "Couldn't save. Please try again."),
      );
      return;
    }
    setEditing(false);
    router.refresh();
  };

  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} className={styles.editBtn}>
        {t("닉네임 수정", "Edit nickname")}
      </button>
    );
  }

  return (
    <div className={styles.editRow}>
      <input
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        className={styles.input}
        maxLength={NICK_MAX}
      />
      {error && <p className={styles.warn}>{error}</p>}
      <div className={styles.actions}>
        <button onClick={save} disabled={saving} className={styles.save}>
          {saving ? t("저장 중…", "Saving…") : t("저장", "Save")}
        </button>
        <button
          onClick={() => {
            setEditing(false);
            setNickname(initialNickname);
            setError(null);
          }}
          className={styles.cancel}
        >
          {t("취소", "Cancel")}
        </button>
      </div>
    </div>
  );
}
