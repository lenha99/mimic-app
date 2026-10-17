"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MAX_NOTE, NOTE_TAGS, type NoteTag } from "@/lib/board";
import styles from "../board.module.css";

/** 피드백 남기기 — 짚을 곳(여러 개)과 한 줄. */
export function NoteForm({ postId }: { postId: string }) {
  const router = useRouter();
  const [tags, setTags] = useState<NoteTag[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (t: NoteTag) => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  const send = async () => {
    if (!body.trim()) {
      setError("한 줄이라도 적어 주세요.");
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
        setError(data.error ?? "남기지 못했어요.");
        return;
      }
      setBody("");
      setTags([]);
      router.refresh();
    } catch {
      setError("네트워크가 끊겼어요. 다시 해주세요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.form}>
      <p className={styles.formTitle}>짚어줄 곳</p>
      <div className={styles.tagPick}>
        {(Object.keys(NOTE_TAGS) as NoteTag[]).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={tags.includes(t)}
            className={tags.includes(t) ? (t === "good" ? styles.pickGood : styles.pickOn) : styles.pick}
            onClick={() => toggle(t)}
          >
            {NOTE_TAGS[t]}
          </button>
        ))}
      </div>
      <textarea
        className={styles.textarea}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={MAX_NOTE}
        rows={3}
        placeholder="예: 둘째 문단 '무서웠어' 앞에서 한 박자 더 쉬면 좋겠어요. 끝음은 깔끔했어요."
      />
      <div className={styles.formFoot}>
        <span>
          {body.length}/{MAX_NOTE}
        </span>
        <button type="button" className={styles.sendBtn} onClick={send} disabled={busy}>
          {busy ? "남기는 중…" : "피드백 남기기"}
        </button>
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <p className={styles.formHint}>상대도 준비생이에요. 좋은 점 하나, 고칠 점 하나면 제일 좋아요.</p>
    </div>
  );
}

export function ReportButton({ postId, noteId, label }: { postId: string; noteId?: string; label: string }) {
  const [done, setDone] = useState(false);
  const report = async () => {
    if (!window.confirm(noteId ? "이 피드백을 신고할까요?" : "이 연습을 신고할까요?")) return;
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
      {done ? "신고됨" : label}
    </button>
  );
}

export function OwnerActions({ postId, daysLeft }: { postId: string; daysLeft: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const remove = async () => {
    if (!window.confirm("게시판에서 내릴까요? 녹음과 받은 피드백이 모두 지워져요. 폰에 있는 테이크는 그대로예요.")) {
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
      <p>내 연습이에요 · {daysLeft}일 뒤 자동으로 지워져요</p>
      <button type="button" onClick={remove} disabled={busy}>
        {busy ? "내리는 중…" : "게시판에서 내리기"}
      </button>
    </div>
  );
}
