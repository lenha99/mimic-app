"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./profile.module.css";

export type MyRecording = {
  id: string;
  memeTitle: string;
  score: number | null;
  grade: string | null;
  isPublic: boolean;
  hidden: boolean;
  audioUrl: string | null;
  createdAt: string;
};

/**
 * 내가 저장한 녹음. 공개를 켜고 끄고, 지운다.
 *
 * "저장한 녹음은 언제든 지울 수 있다"는 약속(PRIVACY.md)이 실제로 누를 수 있는
 * 버튼이어야 한다. 지우기는 서버(/api/recordings/[id])가 파일까지 같이 지운다.
 */
export function MyRecordings({ items }: { items: MyRecording[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setPublic = async (id: string, value: boolean) => {
    setBusy(id);
    setError(null);
    const { error: updateError } = await createClient()
      .from("recordings")
      .update({ is_public: value })
      .eq("id", id);
    setBusy(null);
    if (updateError) {
      setError("바꾸지 못했어요. 다시 시도해주세요.");
      return;
    }
    router.refresh();
  };

  const remove = async (id: string) => {
    if (!window.confirm("이 녹음을 지울까요? 받은 투표도 같이 사라져요.")) return;
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/recordings/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "지우지 못했어요. 다시 시도해주세요.");
        return;
      }
      router.refresh();
    } catch {
      setError("네트워크 오류가 났어요. 다시 시도해주세요.");
    } finally {
      setBusy(null);
    }
  };

  if (items.length === 0) {
    return (
      <div className={styles.card}>
        <div className="eyebrow">내 녹음</div>
        <p className={styles.hint}>
          아직 저장한 녹음이 없어요. 결과 화면에서 &ldquo;저장하기&rdquo;를 누르면 여기 모여요.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className="eyebrow">내 녹음</div>
      {error && <p className={styles.warn}>{error}</p>}
      <ul className={styles.recList}>
        {items.map((r) => (
          <li key={r.id} className={styles.recRow}>
            <div className={styles.recHead}>
              <span className={styles.recTitle}>{r.memeTitle}</span>
              <span className={styles.recScore}>
                {r.score ?? "-"}점{r.grade ? ` · ${r.grade}` : ""}
              </span>
            </div>
            {r.audioUrl && <audio controls src={r.audioUrl} className={styles.recAudio} />}
            <div className={styles.recActions}>
              {r.hidden ? (
                <span className={styles.warn}>신고로 숨김 · 운영자 확인 중</span>
              ) : (
                <label className={styles.recToggle}>
                  <input
                    type="checkbox"
                    checked={r.isPublic}
                    disabled={busy === r.id}
                    onChange={(e) => void setPublic(r.id, e.target.checked)}
                  />
                  <span>공개 (투표받기)</span>
                </label>
              )}
              <button
                type="button"
                className={styles.recDelete}
                disabled={busy === r.id}
                onClick={() => void remove(r.id)}
              >
                지우기
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
