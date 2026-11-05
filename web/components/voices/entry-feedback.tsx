"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/components/lang";
import { MAX_ENTRY_NOTE, type EntryNote, type EntryNotes } from "@/lib/entry-notes";
import { track } from "@/lib/track";
import styles from "./entry-feedback.module.css";

/**
 * 출전작 댓글 — 응원·피드백·그냥 한마디 전부 같은 댓글이다(11/6). 답글은 한 단계, 태그는 없다.
 *
 * 두 군데서 쓴다. 출전작 화면(page)에선 플레이어 아래에 펼쳐지고 처음엔 세 개만 보인다.
 * 갤러리 카드의 💬 를 누르면 아래에서 올라오는 시트(sheet) 안에서 — 입력칸이 바닥에 붙고
 * 바로 커서가 간다. 어느 쪽이든 쓰는 칸은 비어 있으면 버튼이 잠긴다.
 */
const FIRST = 3;

/** 무슨 말을 써도 되는지 예시로만 보여 준다 — 응원 · 느낌 · 궁금한 것 */
const EXAMPLES: [string, string][] = [
  ["끝 대사에서 소름 돋았어요!", "That last line gave me chills!"],
  ["둘째 문장은 조금 더 천천히 해도 좋을 것 같아요", "Maybe slow down a bit on the second line"],
  ["목소리 톤 너무 좋아요. 다른 대본도 듣고 싶어요", "Love your tone. Want to hear more"],
  ["저도 이 대본 해 봤는데 숨 쉬는 곳 어디로 잡으셨어요?", "I tried this one too, where did you breathe?"],
];

export function EntryFeedback({
  entryId,
  variant = "page",
  onCount,
}: {
  entryId: string;
  variant?: "page" | "sheet";
  /** 댓글 수가 바뀌면 — 갤러리 카드의 💬 숫자를 맞춘다 */
  onCount?: (n: number) => void;
}) {
  const sheet = variant === "sheet";
  const t = useT();
  const [data, setData] = useState<EntryNotes | null>(null);
  const [all, setAll] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 예시는 열 때마다 하나 — 서버 렌더와 안 어긋나게 붙은 뒤에 고른다
  const [ex, setEx] = useState(0);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEx(Math.floor(Math.random() * EXAMPLES.length));
  }, []);
  const countRef = useRef(onCount);
  useEffect(() => {
    countRef.current = onCount;
  });

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/weekly/entries/${entryId}/notes`, { cache: "no-store" });
      if (res.ok) {
        const d = (await res.json()) as EntryNotes;
        setData(d);
        countRef.current?.(d.count);
      }
    } catch {}
  }, [entryId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (!data) return sheet ? <p className={styles.loading}>{t("불러오는 중…", "Loading…")}</p> : null;
  const { feedbackOn, owner, loggedIn, count, notes } = data;
  const canWrite = loggedIn && (feedbackOn || owner);
  // 댓글을 안 받고 하나도 없으면 자리를 차지하지 않는다 — 주인에게만 켜는 스위치를 보인다.
  if (!feedbackOn && count === 0 && !owner && !sheet) return null;

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

  const composer = (
    <>
        {canWrite ? (
          <Composer
            key="top"
            autoFocus={sheet}
            placeholder={
              owner
                ? t("듣는 분들께 한마디 · 예: 끝 문장 어땠어요?", "Say something to listeners · e.g. How was the last line?")
                : t(`댓글 달기 · 예: ${EXAMPLES[ex][0]}`, `Add a comment · e.g. ${EXAMPLES[ex][1]}`)
            }
            onSend={(b) => send(b, null)}
          />
        ) : !loggedIn && feedbackOn ? (
          <Link href={`/login?next=${encodeURIComponent(`/weekly/e/${entryId}`)}`} className={styles.login}>
            {t("로그인하고 댓글 달기 →", "Log in to comment →")}
          </Link>
        ) : !feedbackOn ? (
          <p className={styles.off}>{t("❤ 만 받는 목소리예요", "This voice only takes ❤")}</p>
        ) : null}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

    </>
  );

  const shown = all || sheet ? notes : notes.slice(0, FIRST);
  const hiddenCount = notes.length - shown.length;

  return (
    <section className={sheet ? styles.sheetWrap : styles.wrap} aria-labelledby={`fb-${entryId}`}>
      <div className={styles.head}>
        <h2 id={`fb-${entryId}`} className={styles.title}>
          💬 {t("댓글", "Comments")} {count > 0 && <span className={styles.count}>{count}</span>}
        </h2>
        {owner && (
          <button type="button" className={styles.switch} role="switch" aria-checked={feedbackOn} onClick={() => void toggle()}>
            <span className={styles.knob} aria-hidden="true" />
            {feedbackOn ? t("댓글 받는 중", "Comments on") : t("❤ 만 받기", "❤ only")}
          </button>
        )}
      </div>

      {!sheet && composer}
      {notes.length === 0 ? (
        feedbackOn && <p className={styles.empty}>{t("아직 댓글이 없어요. 응원 한마디도 큰 힘이 돼요", "No comments yet. Even a cheer means a lot")}</p>
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
      {sheet && <div className={styles.sheetComposer}>{composer}</div>}
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
      {body.length > MAX_ENTRY_NOTE - 50 && (
        <span className={styles.left} aria-live="polite">
          {MAX_ENTRY_NOTE - body.length}
        </span>
      )}
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
