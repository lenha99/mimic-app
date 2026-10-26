"use client";

import Link from "next/link";
import { useState } from "react";
import { MAX_ASK, POST_DAYS, type BoardTrack } from "@/lib/board";
import { updateTake, type Take } from "@/lib/take-store";
import { useT } from "@/components/lang";
import styles from "./ask-feedback.module.css";

/**
 * 테이크 하나를 연습 피드백 게시판에 올린다 — "다른 사람한테 들려주고 피드백 받기".
 *
 * 연습 녹음은 원래 이 폰에만 있다. 그래서 올리기 전에 무엇이 공개되는지(녹음·대본·닉네임)와
 * 언제 지워지는지(14일)를 버튼 바로 위에 적는다. 올린 테이크엔 게시물 주소를 붙여 두고
 * 다음부터는 "피드백 보기"로 바뀐다.
 */
export function AskFeedback({
  take,
  scriptId,
  title,
  text,
  track,
  onPosted,
}: {
  take: Take;
  scriptId: string;
  title: string;
  text: string;
  track: BoardTrack;
  onPosted: () => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [ask, setAsk] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needLogin, setNeedLogin] = useState(false);

  if (take.postId) {
    return (
      <Link href={`/practice/board/${take.postId}`} className={styles.posted} data-tour="room-ask">
        <span>{t("게시판에 올린 테이크예요", "Posted to the board")}</span>
        <b>{t("피드백 보기 →", "See feedback →")}</b>
      </Link>
    );
  }

  if (!open) {
    return (
      <button type="button" className={styles.open} onClick={() => setOpen(true)} data-tour="room-ask">
        <span className={styles.openIcon} aria-hidden="true">
          🎧
        </span>
        <span>
          <b>{t("다른 사람한테 피드백 받아 보기", "Get feedback from others")}</b>
          <small>{t(`이 테이크를 연습 게시판에 올려요 · ${POST_DAYS}일 뒤 자동 삭제`, `Posts this take to the practice board · auto-deleted in ${POST_DAYS} days`)}</small>
        </span>
      </button>
    );
  }

  const post = async () => {
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      const ext = take.blob.type.includes("mp4") ? "m4a" : "webm";
      body.append("file", take.blob, `take.${ext}`);
      body.append("script_id", scriptId);
      body.append("title", title.slice(0, 40));
      body.append("text", text.slice(0, 900));
      body.append("track", track);
      body.append("ask", ask.trim());
      const res = await fetch("/api/practice-posts", { method: "POST", body });
      const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (res.status === 401) {
        setNeedLogin(true);
        return;
      }
      if (!res.ok || !data.id) {
        setError(data.error ?? t("업로드가 안 됐어요. 다시 시도해 주세요", "Couldn't upload. Please try again"));
        return;
      }
      await updateTake(take.id, { postId: data.id });
      onPosted();
    } catch {
      setError(t("인터넷이 잠깐 끊겼어요. 다시 시도해 주세요", "Connection dropped. Please try again"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.panel}>
      <p className={styles.title}>{t("연습 게시판에 올리기", "Post to the practice board")}</p>
      <ul className={styles.facts}>
        <li>{t("이 녹음과 대본, 내 닉네임이 다른 사람에게 보여요", "Others will see this take, the script and your nickname")}</li>
        <li>{t(`${POST_DAYS}일 뒤 녹음째 지워지고, 그 전에도 언제든 내릴 수 있어요`, `Deleted with the audio after ${POST_DAYS} days — or take it down anytime`)}</li>
        <li>{t("로그인한 사람만 올리고 피드백을 남길 수 있어요", "Only logged-in users can post and leave feedback")}</li>
      </ul>
      <label className={styles.field}>
        <span>
          {t("특히 봐줬으면 하는 곳", "What should they focus on?")} <small>{t("선택", "optional")}</small>
        </span>
        <input
          value={ask}
          onChange={(e) => setAsk(e.target.value)}
          maxLength={MAX_ASK}
          placeholder={t("예: 둘째 문단 감정이 너무 일찍 터지는지", "e.g. Does the emotion in paragraph 2 peak too early?")}
        />
      </label>
      {needLogin ? (
        <p className={styles.login}>
          {t("올리려면 로그인이 필요해요.", "You need to log in to post.")}{" "}
          <Link href={`/login?next=${encodeURIComponent(`/practice/${scriptId}`)}`}>{t("로그인 · 가입 →", "Log in / sign up →")}</Link>
          <small>{t("녹음은 이 폰에 그대로 있어요. 로그인하고 돌아와서 다시 누르면 돼요.", "Your take stays on this phone. Log in, come back and tap again.")}</small>
        </p>
      ) : (
        <div className={styles.actions}>
          <button type="button" className={styles.cancel} onClick={() => setOpen(false)} disabled={busy}>
            {t("취소", "Cancel")}
          </button>
          <button type="button" className={styles.go} onClick={post} disabled={busy}>
            {busy ? t("올리는 중…", "Uploading…") : t("올리고 피드백 받기", "Post & get feedback")}
          </button>
        </div>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
