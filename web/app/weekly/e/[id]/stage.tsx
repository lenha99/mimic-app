"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { usePlaybackLevel } from "@/components/use-playback-level";
import { VoiceAvatar } from "@/components/voice-avatar";
import { Countdown } from "@/components/weekly/countdown";
import { LikeButton } from "@/components/weekly/like-button";
import { useToast } from "@/components/weekly/toast";
import { buzz, shareLink, useWeeklyMe } from "@/components/weekly/use-weekly";
import { normalizeAvatar } from "@/lib/avatar";
import { track } from "@/lib/track";
import { audioSrc, LISTEN_RATIO, readMine, type Week } from "@/lib/weekly";
import { PrivacyTag } from "@/components/privacy-tag";
import styles from "./stage.module.css";

type Entry = {
  id: string;
  rank: number;
  total: number;
  name: string;
  guest: boolean;
  avatar: unknown;
  duration: number;
  likes: number;
  plays: number;
  trophies: number;
  createdAt: string;
};

/**
 * 출전작 한 편의 무대 — 단톡방 링크를 누르면 여기로 온다.
 *
 * 받은 사람이 할 일은 둘뿐이다: 듣고 ❤. 그래서 캐릭터와 재생 버튼이 화면 한가운데,
 * ❤ 는 그 바로 아래. 다 듣고 나면 "나도 출전"이 보인다 — 듣는 사람이 다음 출전자가 된다.
 */
export default function Stage({
  entry,
  week,
  label,
  scriptText,
  thisWeek,
}: {
  entry: Entry;
  week: Week;
  label: string;
  scriptText: string;
  thisWeek: Week;
}) {
  const me = useWeeklyMe(week.id);
  const router = useRouter();
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [likes, setLikes] = useState(entry.likes);
  const [now, setNow] = useState<number | null>(null);
  const [confirmDrop, setConfirmDrop] = useState(false);
  const [toast, showToast] = useToast();
  const src = audioSrc(entry.id, entry.createdAt);
  const level = usePlaybackLevel(audio, src, playing);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    track("weekly_view", { via: entry.id });
  }, [entry.id]);

  const live = now === null || (now >= week.startsAt && now < week.endsAt);
  const mine = me.mineId === entry.id;
  const heard = me.heard.has(entry.id);
  const liked = me.liked.has(entry.id);

  const play = () => {
    const el = audio.current;
    if (!el) return;
    if (playing) {
      el.pause();
      return;
    }
    if (el.ended || progress >= 1) el.currentTime = 0;
    void el.play().catch(() => showToast("재생하지 못했어요. 한 번 더 눌러 주세요."));
    track("weekly_play", { via: entry.id });
  };

  const unlock = () => {
    if (heard) return;
    me.hear(entry.id);
    void fetch(`/api/weekly/entries/${entry.id}/play`, { method: "POST" }).catch(() => {});
    if (!mine && live && !liked) showToast("다 들었어요 — 이제 ❤ 를 누를 수 있어요");
  };

  const like = async () => {
    if (!heard) {
      if (!playing) play();
      showToast("끝까지 들으면 ❤ 를 누를 수 있어요");
      return;
    }
    buzz();
    const before = likes;
    setLikes(before + (liked ? -1 : 1));
    try {
      const r = await me.toggleLike(entry.id);
      setLikes(r.likes);
      if (r.liked) track("weekly_like", { via: entry.id });
    } catch (e) {
      setLikes(before);
      showToast(e instanceof Error ? e.message : "❤ 를 남기지 못했어요.");
    }
  };

  const share = async () => {
    const r = await shareLink(
      location.href.split("?")[0],
      mine
        ? `MIMIC 보이스 챌린지 「${week.title}」 출전했어! 들어보고 ❤ 한 번만 눌러줘 🙏`
        : `${entry.name}의 「${week.title}」 들어봐`,
    );
    if (r === "copied") showToast("링크를 복사했어요. 단톡방에 붙여 넣어 보세요!");
    if (r !== "failed") track("weekly_share", { via: entry.id });
  };

  const drop = async () => {
    const token = readMine()[week.id]?.token ?? "";
    const res = await fetch(`/api/weekly/entries?id=${entry.id}&token=${encodeURIComponent(token)}`, { method: "DELETE" });
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      showToast(d.error ?? "내리지 못했어요.");
      return;
    }
    me.forgetMine();
    router.push("/weekly");
  };

  const report = async () => {
    const res = await fetch(`/api/weekly/entries/${entry.id}/report`, { method: "POST" });
    const d = (await res.json().catch(() => ({}))) as { error?: string };
    showToast(res.ok ? "신고했어요. 확인할게요." : (d.error ?? "신고하지 못했어요."));
  };

  return (
    <main className={`shell ${styles.page}`}>
      <audio
        ref={audio}
        src={src}
        preload="auto"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          const d = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : entry.duration;
          const p = d > 0 ? el.currentTime / d : 0;
          setProgress(p);
          if (p >= LISTEN_RATIO) unlock();
        }}
        onEnded={() => {
          setPlaying(false);
          setProgress(1);
          unlock();
        }}
      />

      <nav className={styles.nav}>
        <Link href="/weekly">← 이번 주 챌린지</Link>
        {me.loggedIn && !mine && (
          <button type="button" className={styles.report} onClick={() => void report()}>
            신고
          </button>
        )}
      </nav>

      <p className={styles.kicker}>
        <span className={styles.chip}>{label}</span>
        {week.emoji} {week.title}
      </p>

      <section className={styles.stage}>
        <div className={styles.badges}>
          <span className={`${styles.rank} ${entry.rank <= 3 ? styles[`rank${entry.rank}`] : ""}`}>
            {entry.rank <= 3 ? ["🥇", "🥈", "🥉"][entry.rank - 1] : "#"}
            <b>{entry.rank}</b>
            <small>/ {entry.total}</small>
          </span>
          {!live && <span className={styles.final}>최종 순위</span>}
        </div>

        <button type="button" className={styles.performer} onClick={play} aria-label={`${entry.name}의 녹음 ${playing ? "멈추기" : "듣기"}`}>
          <span className={`${styles.halo} ${playing ? styles.haloOn : ""}`} aria-hidden="true" />
          <VoiceAvatar avatar={normalizeAvatar(entry.avatar)} level={level} size={210} />
        </button>

        <p className={styles.name}>
          {entry.name}
          {entry.trophies > 0 && <em>🏆{entry.trophies}</em>}
          {mine && <em className={styles.me}>나</em>}
        </p>

        <div className={styles.controls}>
          <button type="button" className={styles.play} onClick={play}>
            <span className={styles.playFill} style={{ width: `${Math.min(100, progress * 100)}%` }} aria-hidden="true" />
            <span className={styles.playText}>{playing ? "❚❚ 듣는 중" : progress >= 1 ? "↻ 다시 듣기" : "▶ 들어보기"}</span>
          </button>
          <LikeButton
            likes={likes}
            liked={liked}
            locked={!heard && !mine}
            progress={playing || progress > 0 ? progress : null}
            mine={mine}
            frozen={!live}
            size="lg"
            onPress={() => void like()}
          />
        </div>
        {!mine && live && !heard && <p className={styles.hint}>끝까지 들으면 ❤ 가 열려요</p>}
      </section>

      {mine ? (
        <section className={styles.minePanel}>
          <p className={styles.mineTitle}>내 출전작이에요</p>
          <p className={styles.mineSub}>
            ❤ 는 다른 사용자들이 끝까지 듣고 눌러줘요. 당신도 다른 출전작을 듣고 ❤ 를 눌러 보세요.
          </p>
          <PrivacyTag kind="public" />
          <button type="button" className={styles.share} onClick={() => void share()}>
            내 출전작 공유하기
          </button>
          <Link href="/weekly" className={styles.mineMore}>
            다른 출전작 들으러 가기 →
          </Link>
          <div className={styles.mineRow}>
            <Link href={`/practice/${week.scriptId}?from=weekly`}>다시 녹음해서 교체</Link>
            {confirmDrop ? (
              <button type="button" className={styles.dropYes} onClick={() => void drop()}>
                정말 내리기 (❤ 사라짐)
              </button>
            ) : (
              <button type="button" onClick={() => setConfirmDrop(true)}>
                출전 취소
              </button>
            )}
          </div>
        </section>
      ) : (
        <section className={styles.cta}>
          <p className={styles.ctaTitle}>
            {thisWeek.id === week.id ? "나도 이 대본으로 붙어 볼까?" : `이번 주 대본은 「${thisWeek.title}」`}
          </p>
          <Countdown to={thisWeek.endsAt} compact />
          <Link href={`/practice/${thisWeek.scriptId}?from=weekly`} className={styles.go}>
            연습하고 출전하기 →
          </Link>
          <p className={styles.ctaNote}>로그인 없이 · 연습은 내 폰에만 · 마음에 든 테이크 하나만 올라가요</p>
          <button type="button" className={styles.shareGhost} onClick={() => void share()}>
            이 목소리 공유하기
          </button>
        </section>
      )}

      {scriptText && (
        <details className={styles.script}>
          <summary>대본 보기</summary>
          <p>{scriptText.replace(/\*/g, "")}</p>
        </details>
      )}

      <Link href="/weekly" className={styles.more}>
        다른 출전작 듣기 →
      </Link>
      {toast}
    </main>
  );
}
