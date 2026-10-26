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
import { audioSrc, displayName, LISTEN_RATIO, readMine, type Week } from "@/lib/weekly";
import { useLang, useT } from "@/components/lang";
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
  const t = useT();
  const lang = useLang();
  const name = displayName(entry.name, lang);
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
    void el.play().catch(() => showToast(t("재생이 안 됐어요. 한 번 더 눌러 주세요", "Couldn't play. Tap once more")));
    track("weekly_play", { via: entry.id });
  };

  const unlock = () => {
    if (heard) return;
    me.hear(entry.id);
    void fetch(`/api/weekly/entries/${entry.id}/play`, { method: "POST" }).catch(() => {});
  };

  const like = async () => {
    buzz();
    const before = likes;
    setLikes(before + (liked ? -1 : 1));
    try {
      const r = await me.toggleLike(entry.id);
      setLikes(r.likes);
      if (r.liked) track("weekly_like", { via: entry.id });
    } catch (e) {
      setLikes(before);
      showToast(e instanceof Error ? e.message : t("❤ 가 안 눌렸어요. 다시 시도해 주세요", "Couldn't send ❤. Try again"));
    }
  };

  const share = async () => {
    const r = await shareLink(
      location.href.split("?")[0],
      mine
        ? t(
            `MIMIC 보이스 챌린지 「${week.title}」 출전함 🎙️ 들어보고 ❤ 하나만 눌러줘 🙏`,
            `I entered the MIMIC voice challenge "${week.titleEn}" 🎙️ Give it a listen and tap ❤ 🙏`,
          )
        : t(`${name}의 「${week.title}」 이거 들어봐 ㄷㄷ`, `You have to hear ${name}'s take on "${week.titleEn}" 👀`),
    );
    if (r === "copied") showToast(t("링크 복사 완료! 단톡방에 붙여 넣어 보세요", "Link copied! Paste it in your group chat"));
    if (r !== "failed") track("weekly_share", { via: entry.id });
  };

  const drop = async () => {
    const token = readMine()[week.id]?.token ?? "";
    const res = await fetch(`/api/weekly/entries?id=${entry.id}&token=${encodeURIComponent(token)}`, { method: "DELETE" });
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      showToast(d.error ?? t("내리지 못했어요. 다시 시도해 주세요", "Couldn't remove it. Try again"));
      return;
    }
    me.forgetMine();
    router.push("/weekly");
  };

  const report = async () => {
    const res = await fetch(`/api/weekly/entries/${entry.id}/report`, { method: "POST" });
    const d = (await res.json().catch(() => ({}))) as { error?: string };
    showToast(
      res.ok
        ? t("신고가 접수됐어요. 빠르게 확인할게요", "Reported. We'll look into it")
        : (d.error ?? t("신고가 안 됐어요. 다시 시도해 주세요", "Couldn't report. Try again")),
    );
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
        <Link href="/weekly">{t("← 이번 주 챌린지", "← This week")}</Link>
        {me.loggedIn && !mine && (
          <button type="button" className={styles.report} onClick={() => void report()}>
            {t("신고", "Report")}
          </button>
        )}
      </nav>

      <p className={styles.kicker}>
        <span className={styles.chip}>{label}</span>
        {week.emoji} {t(week.title, week.titleEn)}
      </p>

      <section className={styles.stage}>
        <div className={styles.badges}>
          <span className={`${styles.rank} ${entry.rank <= 3 ? styles[`rank${entry.rank}`] : ""}`}>
            {entry.rank <= 3 ? ["🥇", "🥈", "🥉"][entry.rank - 1] : "#"}
            <b>{entry.rank}</b>
            <small>/ {entry.total}</small>
          </span>
          {!live && <span className={styles.final}>{t("최종 순위", "Final rank")}</span>}
        </div>

        <button type="button" className={styles.performer} onClick={play} aria-label={t(`${name}의 녹음 ${playing ? "멈추기" : "듣기"}`, `${playing ? "Pause" : "Play"} ${name}'s take`)}>
          <span className={`${styles.halo} ${playing ? styles.haloOn : ""}`} aria-hidden="true" />
          <VoiceAvatar avatar={normalizeAvatar(entry.avatar)} level={level} size={210} />
        </button>

        <p className={styles.name}>
          {name}
          {entry.trophies > 0 && <em>🏆{entry.trophies}</em>}
          {mine && <em className={styles.me}>{t("나", "Me")}</em>}
        </p>

        <div className={styles.controls}>
          <button type="button" className={styles.play} onClick={play}>
            <span className={styles.playFill} style={{ width: `${Math.min(100, progress * 100)}%` }} aria-hidden="true" />
            <span className={styles.playText}>{playing ? t("❚❚ 듣는 중", "❚❚ Playing") : progress >= 1 ? t("↻ 다시 듣기", "↻ Replay") : t("▶ 들어보기", "▶ Listen")}</span>
          </button>
          <LikeButton
            likes={likes}
            liked={liked}
            locked={false}
            progress={playing || progress > 0 ? progress : null}
            mine={mine}
            frozen={!live}
            size="lg"
            onPress={() => void like()}
          />
        </div>
      </section>

      {mine ? (
        <section className={styles.minePanel}>
          <p className={styles.mineTitle}>{t("내 출전작이에요 🎙️", "This is your entry 🎙️")}</p>
          <p className={styles.mineSub}>
            {t(
              "❤ 는 다른 사람들이 듣고 눌러줘요. 친구들한테 공유하면 ❤ 가 훨씬 빨리 모여요!",
              "Others listen and tap ❤. Share it with friends and the ❤ pile up way faster!",
            )}
          </p>
          <PrivacyTag kind="public" />
          <button type="button" className={styles.share} onClick={() => void share()}>
            {t("❤ 모으러 공유하기", "Share to get ❤")}
          </button>
          <Link href="/weekly" className={styles.mineMore}>
            {t("다른 출전작 들으러 가기 →", "Listen to other entries →")}
          </Link>
          <div className={styles.mineRow}>
            <Link href={`/practice/${week.scriptId}?from=weekly`}>{t("다시 녹음해서 교체", "Re-record & replace")}</Link>
            {confirmDrop ? (
              <button type="button" className={styles.dropYes} onClick={() => void drop()}>
                {t("정말 내릴까요? (❤ 사라져요)", "Really remove? (❤ will be lost)")}
              </button>
            ) : (
              <button type="button" onClick={() => setConfirmDrop(true)}>
                {t("출전 취소", "Withdraw")}
              </button>
            )}
          </div>
        </section>
      ) : (
        <section className={styles.cta}>
          <p className={styles.ctaTitle}>
            {thisWeek.id === week.id
              ? t("나도 이 대본으로 한판 붙어 볼까요? 🔥", "Think you can do better? 🔥")
              : t(`이번 주 대본은 「${thisWeek.title}」`, `This week's script: "${thisWeek.titleEn}"`)}
          </p>
          <Countdown to={thisWeek.endsAt} compact />
          <Link href={`/practice/${thisWeek.scriptId}?from=weekly`} className={styles.go}>
            {t("연습하고 출전하기 →", "Practice & enter →")}
          </Link>
          <p className={styles.ctaNote}>
            {t("가입 없이 · 연습은 내 폰에만 · 마음에 든 테이크 하나만 올라가요", "No sign-up · practice stays on your phone · only your pick goes up")}
          </p>
          <button type="button" className={styles.shareGhost} onClick={() => void share()}>
            {t("이 목소리 공유하기", "Share this voice")}
          </button>
        </section>
      )}

      {scriptText && (
        <details className={styles.script}>
          <summary>{t("대본 보기", "Show script")}</summary>
          <p>{scriptText.replace(/\*/g, "")}</p>
        </details>
      )}

      <Link href="/weekly" className={styles.more}>
        {t("다른 출전작 듣기 →", "More entries →")}
      </Link>
      {toast}
    </main>
  );
}
