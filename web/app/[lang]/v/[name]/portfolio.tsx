"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useLang, useT } from "@/components/lang";
import { FollowButton } from "@/components/social/follow-button";
import styles from "@/components/social/social.module.css";
import { VoiceAvatar } from "@/components/voice-avatar";
import { useToast } from "@/components/weekly/toast";
import { shareLink } from "@/components/weekly/use-weekly";
import { normalizeAvatar } from "@/lib/avatar";
import { audioSrc } from "@/lib/weekly";

type Take = { id: string; title: string; titleEn: string; emoji: string; likes: number; plays: number; duration: number; v: string };

export default function Portfolio({
  creator,
  takes,
  stats,
  viewer,
}: {
  creator: { id: string; nickname: string; avatar: unknown; dmPolicy: "followers" | "off" };
  takes: Take[];
  stats: { followers: number; likes: number; awards: number };
  viewer: { loggedIn: boolean; self: boolean; following: boolean };
}) {
  const t = useT();
  const lang = useLang();
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [followers, setFollowers] = useState(stats.followers);
  const [following, setFollowing] = useState(viewer.following);
  const [toast, showToast] = useToast();

  const play = (take: Take) => {
    audio.current ??= new Audio();
    const a = audio.current;
    if (playing === take.id) {
      a.pause();
      setPlaying(null);
      return;
    }
    a.src = audioSrc(take.id, take.v);
    a.onended = () => setPlaying(null);
    setPlaying(take.id);
    a.play().catch(() => setPlaying(null));
  };

  const share = async () => {
    const r = await shareLink(
      `${location.origin}/v/${encodeURIComponent(creator.nickname)}`,
      t(`${creator.nickname}의 목소리 모음 🎙️ 들어보고 구독해 줘`, `${creator.nickname}'s voice 🎙️ give it a listen`),
    );
    if (r === "copied") showToast(t("링크 복사 완료! 인스타 프로필에 붙여 보세요", "Link copied! Put it in your bio"));
  };

  const canMessage = !viewer.self && creator.dmPolicy === "followers";

  return (
    <main className={`shell ${styles.page}`}>
      <nav className={styles.nav}>
        <Link href="/weekly">{t("← 보이스 챌린지", "← Voice challenge")}</Link>
      </nav>

      <section className={styles.hero}>
        <VoiceAvatar avatar={normalizeAvatar(creator.avatar)} size={120} level={playing ? 0.6 : 0} />
        <p className={styles.name}>{creator.nickname}</p>
        <div className={styles.stats}>
          <span>
            <b>{followers}</b>
            {t("구독자", "Subscribers")}
          </span>
          <span>
            <b>{stats.likes}</b>❤
          </span>
          <span>
            <b>{stats.awards}</b>
            {t("수상", "Awards")}
          </span>
        </div>
        <div className={styles.actions}>
          {viewer.self ? (
            <>
              <button type="button" className={styles.btn} onClick={() => void share()}>
                {t("🔗 내 포트폴리오 링크", "🔗 Share my page")}
              </button>
              <Link href="/messages" className={styles.btnGhost}>
                {t("💬 메시지함", "💬 Inbox")}
              </Link>
            </>
          ) : (
            <>
              <FollowButton
                creator={creator.id}
                initial={viewer.following}
                onChange={(on, n) => {
                  setFollowing(on);
                  if (n !== null) setFollowers(n);
                }}
              />
              {canMessage && following && (
                <Link href={viewer.loggedIn ? `/messages/new?to=${creator.id}` : `/login?next=${encodeURIComponent(`/v/${creator.nickname}`)}`} className={styles.btnGhost}>
                  {t("💬 메시지", "💬 Message")}
                </Link>
              )}
            </>
          )}
        </div>
        {!viewer.self && canMessage && !following && (
          <p className={styles.note}>{t("구독하면 메시지를 보낼 수 있어요", "Subscribe to send a message")}</p>
        )}
      </section>

      <p className={styles.section}>{t("출전한 목소리", "Entries")}</p>
      {takes.length === 0 ? (
        <p className={styles.empty}>{t("아직 출전한 목소리가 없어요", "No entries yet")}</p>
      ) : (
        <ul className={styles.list}>
          {takes.map((x) => (
            <li key={x.id}>
              <div className={styles.take}>
                <button type="button" className={styles.play} onClick={() => play(x)} aria-label={t("듣기", "Play")}>
                  {playing === x.id ? "❚❚" : "▶"}
                </button>
                <Link href={`/weekly/e/${x.id}`} className={styles.rowText} style={{ color: "inherit", textDecoration: "none" }}>
                  <b>
                    {x.emoji} {lang === "en" ? x.titleEn : x.title}
                  </b>
                  <small>
                    ❤ {x.likes} · 🎧 {x.plays} · {Math.round(x.duration)}
                    {t("초", "s")}
                  </small>
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
      {toast}
    </main>
  );
}
