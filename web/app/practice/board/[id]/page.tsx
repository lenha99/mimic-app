import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { QuickFeedback } from "@/components/quick-feedback";
import { BOARD_TRACK_LABEL, NOTE_TAGS } from "@/lib/board";
import { getPost } from "@/lib/board-server";
import { ago, parseScript } from "@/lib/practice";
import { createClient } from "@/lib/supabase/server";
import { NoteForm, OwnerActions, ReportButton } from "./post-actions";
import styles from "../board.module.css";

export const metadata: Metadata = { title: "연습 피드백", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * 게시물 하나 — 대본을 펴 놓고 그 사람 목소리를 듣고, 짚을 곳을 남긴다.
 * 대본이 같이 보여야 "어디서 빨라졌는지"를 짚을 수 있다.
 */
export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const post = await getPost(id, user?.id ?? null);
  if (!post) notFound();

  return (
    <main className={`shell ${styles.post}`}>
      <nav className={styles.top}>
        <Link href="/practice/board" className={styles.back}>
          ← 연습 피드백
        </Link>
        {!post.mine && user && <ReportButton postId={post.id} label="신고" />}
      </nav>

      <header className={styles.postHead}>
        <p className={styles.eyebrow}>
          {BOARD_TRACK_LABEL[post.track]} · {post.nickname}
          {post.mine && " (나)"} · {ago(Date.parse(post.createdAt))}
        </p>
        <h1 className={styles.h1}>{post.title}</h1>
        {post.ask && (
          <p className={styles.askBig}>
            <span>봐주세요</span>“{post.ask}”
          </p>
        )}
      </header>

      {post.audioUrl ? (
        <audio className={styles.audio} src={post.audioUrl} controls preload="metadata" />
      ) : (
        <p className={styles.note}>녹음을 불러오지 못했어요. 새로고침해 주세요.</p>
      )}

      <article className={styles.paper}>
        {parseScript(post.scriptText).map((para, i) => (
          <p key={i}>
            {para.map((piece, j) =>
              piece.kind === "pause" ? (
                <span key={j} className={styles.pause}>
                  {" / "}
                </span>
              ) : piece.strong ? (
                <u key={j}>{piece.text}</u>
              ) : (
                <span key={j}>{piece.text}</span>
              ),
            )}
          </p>
        ))}
      </article>

      <section className={styles.notes}>
        <h2 className={styles.notesTitle}>
          피드백 <span>{post.noteList.length}</span>
        </h2>
        {post.noteList.length === 0 && (
          <p className={styles.note}>
            {post.mine ? "아직 피드백이 없어요. 조금만 기다려 주세요." : "첫 번째로 들어주세요. 한 줄이면 충분해요."}
          </p>
        )}
        <ol className={styles.noteList}>
          {post.noteList.map((n) => (
            <li key={n.id} className={styles.noteItem}>
              <div className={styles.noteHead}>
                <b>{n.nickname}</b>
                <span>{ago(Date.parse(n.createdAt))}</span>
                {!n.mine && user && <ReportButton postId={post.id} noteId={n.id} label="신고" />}
              </div>
              {n.tags.length > 0 && (
                <div className={styles.tags}>
                  {n.tags.map((t) => (
                    <span key={t} className={t === "good" ? styles.tagGood : styles.tag}>
                      {NOTE_TAGS[t]}
                    </span>
                  ))}
                </div>
              )}
              <p className={styles.noteBody}>{n.body}</p>
            </li>
          ))}
        </ol>

        {post.mine ? (
          <OwnerActions postId={post.id} daysLeft={post.daysLeft} />
        ) : user ? (
          <NoteForm postId={post.id} />
        ) : (
          <Link href={`/login?next=${encodeURIComponent(`/practice/board/${post.id}`)}`} className={styles.loginCta}>
            로그인하고 피드백 남기기 →
          </Link>
        )}
      </section>

      <QuickFeedback page="board" />
    </main>
  );
}
