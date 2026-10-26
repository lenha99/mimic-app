"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MAX_NOTE, NOTE_TAGS, noteTagLabel, type NoteTag } from "@/lib/board";
import { useLang, useT } from "@/components/lang";
import styles from "../board.module.css";

/** 피드백 남기기 — 짚을 곳(여러 개)과 한 줄. */
export function NoteForm({ postId }: { postId: string }) {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const [tags, setTags] = useState<NoteTag[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (tag: NoteTag) => setTags((cur) => (cur.includes(tag) ? cur.filter((x) => x !== tag) : [...cur, tag]));

  const send = async () => {
    if (!body.trim()) {
      setError(t("한 줄이라도 적어 주세요.", "Please write at least one line."));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/practice-posts/${postId}/notes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tags, body }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? t("등록이 안 됐어요. 다시 시도해 주세요", "Couldn't post. Please try again"));
        return;
      }
      setBody("");
      setTags([]);
      router.refresh();
    } catch {
      setError(t("인터넷이 잠깐 끊겼어요. 다시 시도해 주세요", "Connection dropped. Please try again"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.form}>
      <p className={styles.formTitle}>{t("짚어줄 곳", "What to note")}</p>
      <div className={styles.tagPick}>
        {(Object.keys(NOTE_TAGS) as NoteTag[]).map((tag) => (
          <button
            key={tag}
            type="button"
            aria-pressed={tags.includes(tag)}
            className={tags.includes(tag) ? (tag === "good" ? styles.pickGood : styles.pickOn) : styles.pick}
            onClick={() => toggle(tag)}
          >
            {noteTagLabel(tag, lang)}
          </button>
        ))}
      </div>
      <textarea
        className={styles.textarea}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={MAX_NOTE}
        rows={3}
        placeholder={t(
          "예: 둘째 문단 '무서웠어' 앞에서 한 박자 더 쉬면 좋겠어요. 끝음은 깔끔했어요.",
          "e.g. One more beat of pause before '무서웠어' in paragraph 2. Clean endings!",
        )}
      />
      <div className={styles.formFoot}>
        <span>
          {body.length}/{MAX_NOTE}
        </span>
        <button type="button" className={styles.sendBtn} onClick={send} disabled={busy}>
          {busy ? t("남기는 중…", "Posting…") : t("피드백 남기기", "Leave feedback")}
        </button>
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <p className={styles.formHint}>
        {t("상대도 준비생이에요. 좋은 점 하나, 고칠 점 하나면 제일 좋아요.", "They're learning too. One thing that worked + one to fix is ideal.")}
      </p>
    </div>
  );
}

export function ReportButton({ postId, noteId, label }: { postId: string; noteId?: string; label: string }) {
  const t = useT();
  const [done, setDone] = useState(false);
  const report = async () => {
    if (!window.confirm(noteId ? t("이 피드백을 신고할까요?", "Report this feedback?") : t("이 연습을 신고할까요?", "Report this post?"))) return;
    try {
      await fetch(`/api/practice-posts/${postId}/report`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(noteId ? { noteId } : {}),
      });
    } catch {}
    setDone(true);
  };
  return (
    <button type="button" className={styles.report} onClick={report} disabled={done}>
      {done ? t("신고 완료", "Reported") : label}
    </button>
  );
}

export function OwnerActions({ postId, daysLeft }: { postId: string; daysLeft: number }) {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const remove = async () => {
    if (
      !window.confirm(
        t(
          "게시판에서 내릴까요? 녹음과 받은 피드백이 모두 지워져요. 폰에 있는 테이크는 그대로예요.",
          "Take this down? The audio and all feedback will be deleted. The take on your phone stays.",
        ),
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/practice-posts/${postId}`, { method: "DELETE" });
      if (res.ok) {
        router.replace("/practice/board");
        router.refresh();
        return;
      }
    } catch {}
    setBusy(false);
  };
  return (
    <div className={styles.owner}>
      <p>{t(`내 연습이에요 · ${daysLeft}일 뒤 자동으로 지워져요`, `Your post · auto-deleted in ${daysLeft} days`)}</p>
      <button type="button" onClick={remove} disabled={busy}>
        {busy ? t("내리는 중…", "Removing…") : t("게시판에서 내리기", "Take down")}
      </button>
    </div>
  );
}
