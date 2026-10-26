"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PrivacyTag } from "@/components/privacy-tag";
import { useT } from "@/components/lang";
import styles from "./profile.module.css";

export type MyRecording = {
  id: string;
  memeTitle: string;
  score: number | null;
  grade: string | null;
  isPublic: boolean;
  /** 링크를 만들어 보낸 적 있다 — 링크를 받은 사람은 들을 수 있다. */
  shared: boolean;
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
  const t = useT();
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
      setError(t("바꾸지 못했어요. 다시 시도해 주세요.", "Couldn't update. Please try again."));
      return;
    }
    router.refresh();
  };

  const remove = async (id: string) => {
    if (!window.confirm(t("이 녹음을 지울까요? 받은 투표도 같이 사라져요.", "Delete this recording? Its votes will be gone too."))) return;
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/recordings/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? t("지우지 못했어요. 다시 시도해 주세요.", "Couldn't delete. Please try again."));
        return;
      }
      router.refresh();
    } catch {
      setError(t("인터넷이 잠깐 끊겼어요. 다시 시도해 주세요.", "Connection dropped. Please try again."));
    } finally {
      setBusy(null);
    }
  };

  if (items.length === 0) {
    return (
      <div className={styles.card}>
        <div className="eyebrow">{t("내 녹음", "My recordings")}</div>
        <p className={styles.hint}>
          {t("아직 저장한 녹음이 없어요. 결과 화면에서 “저장하기”를 누르면 여기 모여요.", "No saved recordings yet. Tap “Save” on a result and it'll show up here.")}
        </p>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className="eyebrow">{t("내 녹음", "My recordings")}</div>
      {error && <p className={styles.warn}>{error}</p>}
      <ul className={styles.recList}>
        {items.map((r) => (
          <li key={r.id} className={styles.recRow}>
            <div className={styles.recHead}>
              <span className={styles.recTitle}>{r.memeTitle}</span>
              <PrivacyTag kind={r.isPublic ? "public" : r.shared ? "link" : "private"} compact />
              <span className={styles.recScore}>
                {r.score ?? "-"}
                {t("점", " pts")}
                {r.grade ? ` · ${r.grade}` : ""}
              </span>
            </div>
            {r.audioUrl && <audio controls src={r.audioUrl} className={styles.recAudio} />}
            <div className={styles.recActions}>
              {r.hidden ? (
                <span className={styles.warn}>{t("신고로 숨김 · 운영자 확인 중", "Hidden after a report · under review")}</span>
              ) : (
                <label className={styles.recToggle}>
                  <input
                    type="checkbox"
                    checked={r.isPublic}
                    disabled={busy === r.id}
                    onChange={(e) => void setPublic(r.id, e.target.checked)}
                  />
                  <span>{t("공개 (투표받기)", "Public (get votes)")}</span>
                </label>
              )}
              <button
                type="button"
                className={styles.recDelete}
                disabled={busy === r.id}
                onClick={() => void remove(r.id)}
              >
                {t("지우기", "Delete")}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
