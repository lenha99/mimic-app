"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/components/lang";
import { MAX_ENTRY_NOTE, MAX_FEEDBACK_ASK, type CommentMode, type EntryNote, type EntryNotes, type NoteKind } from "@/lib/entry-notes";
import { FEEDBACK_XP } from "@/lib/pass";
import { track } from "@/lib/track";
import styles from "./entry-feedback.module.css";

/**
 * 출전작 댓글 · 피드백 — 둘은 다른 칸이다(11/7).
 *
 *  - 💬 댓글: 자유로운 한마디(응원·감상). 한 줄 입력칸.
 *  - 🎯 피드백: 주인이 부탁한 목소리에만. 쓰는 건 댓글처럼 한 칸 — 칸을 여러 개 채우라고 하면 아무도 안 쓴다.
 *    남긴 사람은 XP 를 크게 받고(+40, 주인이 👍 하면 +60 더), 주인은 답글로 되묻는다.
 *  전엔 둘이 같은 시트·같은 목록·같은 입력칸이라 받는 사람 눈엔 똑같았다.
 *
 * 두 군데서 쓴다. 출전작 화면(page)에선 플레이어 아래에 펼쳐지고 처음엔 세 개만 보인다.
 * 갤러리 카드의 💬/🎯 를 누르면 아래에서 올라오는 시트(sheet) 안에서 — 누른 쪽 탭으로 열리고
 * 입력칸이 바닥에 붙는다.
 */
const FIRST = 3;

/** 댓글에 무슨 말을 써도 되는지 — 응원 · 느낌 · 궁금한 것 (고칠 점은 피드백 칸으로) */
const EXAMPLES: [string, string][] = [
  ["끝 대사에서 소름 돋았어요!", "That last line gave me chills!"],
  ["목소리 톤 너무 좋아요. 다른 대본도 듣고 싶어요", "Love your tone. Want to hear more"],
  ["출근길에 세 번 들었어요 ㅋㅋ", "Listened three times on my commute lol"],
  ["저도 이 대본 해 봤는데 숨 쉬는 곳 어디로 잡으셨어요?", "I tried this one too, where did you breathe?"],
];

export type NoteTab = "comments" | "feedback";

export function EntryFeedback({
  entryId,
  variant = "page",
  tab: initialTab,
  onCount,
}: {
  entryId: string;
  variant?: "page" | "sheet";
  /** 처음 열 탭 — 갤러리 카드에서 🎯 로 열면 피드백. 비우면 피드백을 부탁한 목소리는 피드백부터 */
  tab?: NoteTab;
  /** 숫자가 바뀌면 — 갤러리 카드의 💬 · 🎯 숫자를 맞춘다 */
  onCount?: (comments: number, feedback: number) => void;
}) {
  const sheet = variant === "sheet";
  const t = useT();
  const [data, setData] = useState<EntryNotes | null>(null);
  const [tab, setTab] = useState<NoteTab | null>(initialTab ?? null);
  const [all, setAll] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 피드백을 남기면 잠깐 "+40 XP" — 남을 도운 게 바로 보상으로 보이게
  const [gained, setGained] = useState(0);
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
        countRef.current?.(d.count, d.feedbackCount);
      }
    } catch {}
  }, [entryId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (!data) return sheet ? <p className={styles.loading}>{t("불러오는 중…", "Loading…")}</p> : null;
  const { feedbackOn, wantsFeedback, ask, owner, loggedIn, count, feedbackCount, comments, feedback } = data;
  const mode: CommentMode = wantsFeedback ? "feedback" : feedbackOn ? "comments" : "off";
  const canComment = loggedIn && (feedbackOn || owner);
  // 피드백 탭은 부탁했거나 이미 받은 게 있을 때만
  const hasFeedbackTab = wantsFeedback || feedbackCount > 0;
  const want = tab ?? (wantsFeedback ? "feedback" : "comments");
  const current: NoteTab = want === "feedback" && hasFeedbackTab ? "feedback" : "comments";
  // 아무것도 안 받고 하나도 없으면 자리를 차지하지 않는다 — 주인에게만 스위치를 보인다.
  if (!feedbackOn && count === 0 && feedbackCount === 0 && !owner && !sheet) return null;

  const gaveFeedback = feedback.some((n) => n.mine);
  const canFeedback = loggedIn && wantsFeedback && !owner;

  const send = async (kind: NoteKind, body: string, parentId: string | null): Promise<boolean> => {
    setError(null);
    const res = await fetch(`/api/weekly/entries/${entryId}/notes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, body, parentId }),
    }).catch(() => null);
    const d = (await res?.json().catch(() => ({}))) as { error?: string; xp?: number } | undefined;
    if (!res?.ok) {
      setError(d?.error ?? t("남기지 못했어요. 다시 해 주세요", "Couldn't post. Please try again"));
      return false;
    }
    track(parentId ? "feedback_reply" : kind === "feedback" ? "feedback_note" : "comment_note", { via: entryId });
    setReplyTo(null);
    if (d?.xp) {
      setGained(d.xp);
      setTimeout(() => setGained(0), 4000);
    }
    await load();
    return true;
  };

  const remove = async (noteId: string) => {
    await fetch(`/api/weekly/entries/${entryId}/notes?note=${noteId}`, { method: "DELETE" }).catch(() => null);
    await load();
  };

  const patch = async (body: Record<string, unknown>) => {
    await fetch(`/api/weekly/entries/${entryId}/notes`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
  };

  /** 주인 — ❤ 만 / 댓글 / 피드백 요청 바꾸기 */
  const changeMode = async (m: CommentMode) => {
    setData({ ...data, feedbackOn: m !== "off", wantsFeedback: m === "feedback" });
    if (m === "feedback") setTab("feedback");
    track("feedback_toggle", { via: m });
    await patch({ feedbackOn: m !== "off", wantsFeedback: m === "feedback" });
  };

  const saveAsk = async (text: string) => {
    setData({ ...data, ask: text.trim() || null });
    await patch({ ask: text });
  };

  /** 주인 — 이 피드백이 도움됐어요(쓴 사람에게 알림) */
  const markHelpful = async (n: EntryNote) => {
    track("feedback_helpful", { via: n.helpful ? "off" : "on" });
    await patch({ noteId: n.id, helpful: !n.helpful });
    await load();
  };

  const loginHref = `/login?next=${encodeURIComponent(`/weekly/e/${entryId}`)}`;
  const errorLine = error && (
    <p className={styles.error} role="alert">
      {error}
    </p>
  );

  const commentComposer = (
    <>
      {canComment ? (
        <Composer
          key="top"
          autoFocus={sheet}
          placeholder={
            owner
              ? t("듣는 분들께 한마디 · 예: 들어 줘서 고마워요!", "Say something to listeners · e.g. Thanks for listening!")
              : t(`댓글 달기 · 예: ${EXAMPLES[ex][0]}`, `Add a comment · e.g. ${EXAMPLES[ex][1]}`)
          }
          onSend={(b) => send("comment", b, null)}
        />
      ) : !loggedIn && feedbackOn ? (
        <Link href={loginHref} className={styles.login}>
          {t("로그인하고 댓글 달기 →", "Log in to comment →")}
        </Link>
      ) : !feedbackOn ? (
        <p className={styles.off}>{t("❤ 만 받는 목소리예요", "This voice only takes ❤")}</p>
      ) : null}
      {errorLine}
    </>
  );

  const feedbackComposer = (
    <>
      {gained > 0 && (
        <p className={styles.xpToast} role="status">
          🎯 {t(`피드백 고마워요! +${gained} XP`, `Thanks for the feedback! +${gained} XP`)}
        </p>
      )}
      {canFeedback ? (
        <Composer
          key="fb"
          autoFocus={sheet}
          placeholder={
            gaveFeedback
              ? t("더 하고 싶은 말이 있으면 또 남겨요", "Anything else? Leave another")
              : t(`들은 느낌 한마디 · 예: 끝이 살짝 빨라요 (+${FEEDBACK_XP.give} XP)`, `How did it sound? e.g. The ending felt rushed (+${FEEDBACK_XP.give} XP)`)
          }
          onSend={(b) => send("feedback", b, null)}
        />
      ) : owner ? (
        <p className={styles.off}>
          {wantsFeedback
            ? t(`피드백은 들은 사람들이 남겨요. 궁금하면 답글로 되묻고, 도움됐으면 👍 — 쓴 사람이 +${FEEDBACK_XP.helpful} XP 를 받아요`, `Listeners leave feedback here. Reply to ask more, tap 👍 if it helped — they get +${FEEDBACK_XP.helpful} XP`)
            : t("지금은 피드백을 받지 않아요. 위에서 🎯 피드백 요청을 켜면 다시 받아요", "Not taking feedback now. Turn on 🎯 above to ask again")}
        </p>
      ) : !loggedIn && wantsFeedback ? (
        <Link href={loginHref} className={styles.login}>
          {t("로그인하고 피드백 남기기 →", "Log in to give feedback →")}
        </Link>
      ) : !wantsFeedback ? (
        <p className={styles.off}>{t("지금은 피드백을 받지 않는 목소리예요", "This voice isn't taking feedback now")}</p>
      ) : null}
      {errorLine}
    </>
  );

  const composer = current === "feedback" ? feedbackComposer : commentComposer;
  const list = current === "feedback" ? feedback : comments;
  const shown = all || sheet ? list : list.slice(0, FIRST);
  const hiddenCount = list.length - shown.length;

  return (
    <section className={sheet ? styles.sheetWrap : styles.wrap} aria-labelledby={`fb-${entryId}`}>
      {hasFeedbackTab ? (
        <div className={styles.tabs} role="tablist" aria-label={t("댓글 · 피드백", "Comments · Feedback")} id={`fb-${entryId}`}>
          <button
            type="button"
            role="tab"
            aria-selected={current === "comments"}
            className={styles.tab}
            onClick={() => {
              setTab("comments");
              setAll(false);
              setError(null);
            }}
          >
            💬 {t("댓글", "Comments")} {count > 0 && <span className={styles.count}>{count}</span>}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={current === "feedback"}
            className={`${styles.tab} ${styles.tabFeedback}`}
            onClick={() => {
              setTab("feedback");
              setAll(false);
              setError(null);
            }}
          >
            🎯 {t("피드백", "Feedback")} {feedbackCount > 0 && <span className={styles.count}>{feedbackCount}</span>}
          </button>
        </div>
      ) : (
        <div className={styles.head}>
          <h2 id={`fb-${entryId}`} className={styles.title}>
            💬 {t("댓글", "Comments")} {count > 0 && <span className={styles.count}>{count}</span>}
          </h2>
        </div>
      )}

      {owner && (
        <div className={styles.modes} role="radiogroup" aria-label={t("받을 것", "What you'd like back")}>
          {(
            [
              ["off", t("❤ 만", "❤ only")],
              ["comments", t("💬 댓글", "💬 Comments")],
              ["feedback", t("🎯 피드백 요청", "🎯 Ask feedback")],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" role="radio" aria-checked={mode === id} className={styles.modeBtn} onClick={() => void changeMode(id)}>
              {label}
            </button>
          ))}
        </div>
      )}

      {current === "feedback" &&
        wantsFeedback &&
        (owner ? (
          <AskEditor initial={ask ?? ""} onSave={saveAsk} />
        ) : (
          <div className={styles.askCard}>
            <b>🎯 {t("이 목소리는 피드백을 원해요", "This voice wants feedback")}</b>
            {ask && <q>{ask}</q>}
            <small>{t(`짧게 한마디면 충분해요. 남기면 +${FEEDBACK_XP.give} XP`, `A short note is plenty. +${FEEDBACK_XP.give} XP for you`)}</small>
          </div>
        ))}

      {!sheet && composer}
      {list.length === 0 ? (
        current === "feedback" ? (
          wantsFeedback && <p className={styles.empty}>{t("아직 피드백이 없어요. 첫 피드백이 제일 반가워요", "No feedback yet. The first one means the most")}</p>
        ) : (
          feedbackOn && <p className={styles.empty}>{t("아직 댓글이 없어요. 응원 한마디도 큰 힘이 돼요", "No comments yet. Even a cheer means a lot")}</p>
        )
      ) : (
        <ol className={styles.list}>
          {shown.map((n) => (
            <li key={n.id} className={n.kind === "feedback" ? styles.fbItem : styles.item}>
              <Note
                n={n}
                canDelete={n.mine || owner}
                onDelete={remove}
                onReply={canComment ? () => setReplyTo(replyTo === n.id ? null : n.id) : undefined}
                onHelpful={owner && n.kind === "feedback" && !n.byOwner ? () => void markHelpful(n) : undefined}
              />
              {(n.replies.length > 0 || replyTo === n.id) && (
                <ol className={styles.replies}>
                  {n.replies.map((r) => (
                    <li key={r.id}>
                      <Note n={r} canDelete={r.mine || owner} onDelete={remove} onReply={canComment ? () => setReplyTo(n.id) : undefined} />
                    </li>
                  ))}
                  {replyTo === n.id && (
                    <li>
                      <Composer
                        key={`r-${n.id}`}
                        autoFocus
                        small
                        placeholder={t(`${n.nickname}님에게 답글`, `Reply to ${n.nickname}`)}
                        onSend={(b) => send(n.kind, b, n.id)}
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
          {current === "feedback" ? t(`피드백 ${hiddenCount}개 더 보기`, `Show ${hiddenCount} more`) : t(`댓글 ${hiddenCount}개 더 보기`, `Show ${hiddenCount} more`)}
        </button>
      )}
      {sheet && <div className={styles.sheetComposer}>{composer}</div>}
    </section>
  );
}

function Note({
  n,
  canDelete,
  onDelete,
  onReply,
  onHelpful,
}: {
  n: EntryNote;
  canDelete: boolean;
  onDelete: (id: string) => void;
  onReply?: () => void;
  onHelpful?: () => void;
}) {
  const t = useT();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className={styles.note}>
      <p className={styles.meta}>
        <b>{n.nickname}</b>
        {n.byOwner && <span className={styles.ownerChip}>{t("작성자", "Author")}</span>}
        <span className={styles.ago}>{agoOf(n.createdAt, t)}</span>
        {n.helpful && <span className={styles.helpfulChip}>👍 {t("도움된 피드백", "Helpful")}</span>}
      </p>
      <p className={styles.body}>{n.body}</p>
      <p className={styles.actions}>
        {onHelpful && (
          <button type="button" className={n.helpful ? styles.helpfulOn : undefined} onClick={onHelpful} aria-pressed={n.helpful}>
            👍 {n.helpful ? t("도움됐어요", "Helpful") : t("도움됐어요?", "Helpful?")}
          </button>
        )}
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

/** 주인 — 봐 줬으면 하는 곳 한 줄. 칸을 떠나면 저장한다. */
function AskEditor({ initial, onSave }: { initial: string; onSave: (text: string) => void }) {
  const t = useT();
  const [v, setV] = useState(initial);
  const [saved, setSaved] = useState(false);
  return (
    <label className={styles.askEdit}>
      <span>{t("🎯 특히 봐 줬으면 하는 곳", "🎯 What to listen for")}</span>
      <input
        value={v}
        maxLength={MAX_FEEDBACK_ASK}
        placeholder={t("예: 끝 문장 톤이 어색한지 (비워도 돼요)", "e.g. Is the last line's tone off? (optional)")}
        onChange={(e) => {
          setV(e.target.value);
          setSaved(false);
        }}
        onBlur={() => {
          if (v.trim() === initial.trim()) return;
          onSave(v);
          setSaved(true);
        }}
      />
      {saved && <small>{t("저장했어요", "Saved")}</small>}
    </label>
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
