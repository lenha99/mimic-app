"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/components/lang";
import { MAX_ENTRY_NOTE, type EntryNote, type EntryNotes } from "@/lib/entry-notes";
import { track } from "@/lib/track";
import styles from "./entry-feedback.module.css";

/**
 * 출전작 피드백 — 댓글 한 줄, 답글 한 단계. 짚을 곳 태그는 없다.
 *
 * 화면을 가리지 않는 게 먼저다: 모달·고정 입력창 없이 플레이어 아래에 펼쳐지고, 처음엔 댓글
 * 세 개까지만 보인다. 입력칸은 목록 맨 위 한 줄 — 누르면 늘어나고, 비어 있으면 버튼이 잠긴다.
 */
const FIRST = 3;

export function EntryFeedback({ entryId }: { entryId: string }) {
  const t = useT();
  const [data, setData] = useState<EntryNotes | null>(null);
  const [all, setAll] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/weekly/entries/${entryId}/notes`, { cache: "no-store" });
      if (res.ok) setData((await res.json()) as EntryNotes);
    } catch {}
  }, [entryId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (!data) return null;
  const { feedbackOn, owner, loggedIn, count, notes } = data;
  const canWrite = loggedIn && (feedbackOn || owner);
  // 피드백을 안 받고 댓글도 없으면 자리를 차지하지 않는다 — 주인에게만 켜는 스위치를 보인다.
  if (!feedbackOn && count === 0 && !owner) return null;

  const send = async (body: string, parentId: string | null): Promise<boolean> => {
    setError(null);
    const res = await fetch(`/api/weekly/entries/${entryId}/notes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body, parentId }),
    }).catch(() => null);
    const d = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
    if (!res?.ok) {
      setError(d?.error ?? t("남기지 못했어요. 다시 해 주세요", "Couldn't post. Please try again"));
      return false;
    }
    track(parentId ? "feedback_reply" : "feedback_note", { via: entryId });
    setReplyTo(null);
    await load();
    return true;
  };

  const remove = async (noteId: string) => {
    await fetch(`/api/weekly/entries/${entryId}/notes?note=${noteId}`, { method: "DELETE" }).catch(() => null);
    await load();
  };

  const toggle = async () => {
    const next = !feedbackOn;
    setData({ ...data, feedbackOn: next });
    track("feedback_toggle", { via: next ? "on" : "off" });
    await fetch(`/api/weekly/entries/${entryId}/notes`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ feedbackOn: next }),
    }).catch(() => null);
  };

  const shown = all ? notes : notes.slice(0, FIRST);
  const hiddenCount = notes.length - shown.length;

  return (
    <section className={styles.wrap} aria-labelledby={`fb-${entryId}`}>
      <div className={styles.head}>
        <h2 id={`fb-${entryId}`} className={styles.title}>
          💬 {t("피드백", "Feedback")} {count > 0 && <span className={styles.count}>{count}</span>}
        </h2>
        {owner && (
          <button type="button" className={styles.switch} role="switch" aria-checked={feedbackOn} onClick={() => void toggle()}>
            <span className={styles.knob} aria-hidden="true" />
            {feedbackOn ? t("받는 중", "On") : t("꺼짐", "Off")}
          </button>
        )}
      </div>

      {canWrite ? (
        <Composer
          key="top"
          placeholder={
            owner
              ? t("듣는 사람에게 물어보기 · 예: 끝 문장 어땠어요?", "Ask your listeners · e.g. How was the last line?")
              : t("들은 느낌을 한 줄로 · 예: 둘째 문장 끝이 살짝 올라가요", "One line on how it sounded")
          }
          onSend={(b) => send(b, null)}
        />
      ) : !loggedIn && feedbackOn ? (
        <Link href={`/login?next=${encodeURIComponent(`/weekly/e/${entryId}`)}`} className={styles.login}>
          {t("로그인하고 한 줄 남기기 →", "Log in to leave a line →")}
        </Link>
      ) : !feedbackOn ? (
        <p className={styles.off}>{t("지금은 피드백을 받지 않는 목소리예요", "This voice isn't taking feedback right now")}</p>
      ) : null}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {notes.length === 0 ? (
        feedbackOn && <p className={styles.empty}>{t("아직 피드백이 없어요. 첫 한 줄이 제일 큰 힘이 돼요", "No feedback yet. A first line means the most")}</p>
      ) : (
        <ol className={styles.list}>
          {shown.map((n) => (
            <li key={n.id} className={styles.item}>
              <Note n={n} canDelete={n.mine || owner} onDelete={remove} onReply={canWrite ? () => setReplyTo(replyTo === n.id ? null : n.id) : undefined} />
              {(n.replies.length > 0 || replyTo === n.id) && (
                <ol className={styles.replies}>
                  {n.replies.map((r) => (
                    <li key={r.id}>
                      <Note n={r} canDelete={r.mine || owner} onDelete={remove} onReply={canWrite ? () => setReplyTo(n.id) : undefined} />
                    </li>
                  ))}
                  {replyTo === n.id && (
                    <li>
                      <Composer
                        key={`r-${n.id}`}
                        autoFocus
                        small
                        placeholder={t(`${n.nickname}님에게 답글`, `Reply to ${n.nickname}`)}
                        onSend={(b) => send(b, n.id)}
                        onCancel={() => setReplyTo(null)}
                      />
                    </li>
                  )}
                </ol>
              )}
            </li>
          ))}
        </ol>
      )}
      {hiddenCount > 0 && (
        <button type="button" className={styles.more} onClick={() => setAll(true)}>
          {t(`댓글 ${hiddenCount}개 더 보기`, `Show ${hiddenCount} more`)}
        </button>
      )}
    </section>
  );
}

function Note({ n, canDelete, onDelete, onReply }: { n: EntryNote; canDelete: boolean; onDelete: (id: string) => void; onReply?: () => void }) {
  const t = useT();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className={styles.note}>
      <p className={styles.meta}>
        <b>{n.nickname}</b>
        {n.byOwner && <span className={styles.ownerChip}>{t("작성자", "Author")}</span>}
        <span className={styles.ago}>{agoOf(n.createdAt, t)}</span>
      </p>
      <p className={styles.body}>{n.body}</p>
      <p className={styles.actions}>
        {onReply && (
          <button type="button" onClick={onReply}>
            {t("답글", "Reply")}
          </button>
        )}
        {canDelete &&
          (confirm ? (
            <button type="button" className={styles.danger} onClick={() => onDelete(n.id)}>
              {t("정말 지울까요?", "Delete?")}
            </button>
          ) : (
            <button type="button" onClick={() => setConfirm(true)}>
              {t("지우기", "Delete")}
            </button>
          ))}
      </p>
    </div>
  );
}

function Composer({
  placeholder,
  onSend,
  onCancel,
  autoFocus,
  small,
}: {
  placeholder: string;
  onSend: (body: string) => Promise<boolean>;
  onCancel?: () => void;
  autoFocus?: boolean;
  small?: boolean;
}) {
  const t = useT();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);
  // 줄이 늘면 칸도 같이 — 최대 5줄
  const grow = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };
  const submit = async () => {
    const text = body.trim();
    if (!text || busy) return;
    setBusy(true);
    const ok = await onSend(text);
    setBusy(false);
    if (ok) {
      setBody("");
      if (ref.current) ref.current.style.height = "auto";
    }
  };
  return (
    <div className={small ? `${styles.composer} ${styles.composerSmall}` : styles.composer}>
      <textarea
        ref={ref}
        rows={1}
        value={body}
        maxLength={MAX_ENTRY_NOTE}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => {
          setBody(e.target.value);
          grow(e.target);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit();
          if (e.key === "Escape" && onCancel) onCancel();
        }}
      />
      <button type="button" className={styles.send} onClick={() => void submit()} disabled={!body.trim() || busy} aria-label={t("남기기", "Post")}>
        {busy ? "…" : "↑"}
      </button>
    </div>
  );
}

function agoOf(at: string, t: (ko: string, en: string) => string): string {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(at)) / 60_000));
  if (m < 1) return t("방금", "just now");
  if (m < 60) return t(`${m}분 전`, `${m}m`);
  const h = Math.round(m / 60);
  if (h < 24) return t(`${h}시간 전`, `${h}h`);
  const d = Math.round(h / 24);
  return d < 7 ? t(`${d}일 전`, `${d}d`) : t(`${Math.round(d / 7)}주 전`, `${Math.round(d / 7)}w`);
}
