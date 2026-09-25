"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePlaybackLevel } from "@/components/use-playback-level";
import { VoiceAvatar } from "@/components/voice-avatar";
import type { Avatar } from "@/lib/avatar";
import { track } from "@/lib/track";
import styles from "./share.module.css";

/**
 * 공유 링크의 무대. 탭하면 캐릭터가 보낸 사람 목소리로 외친다.
 *
 * 자동재생은 브라우저가 막으므로 첫 탭을 받는다. 그 탭이 곧 "들어보고 싶다"는
 * 뜻이라, 버튼을 크게 두고 캐릭터 자체도 누를 수 있게 한다.
 */
export function SharePlayer({
  memeId,
  title,
  line,
  emoji,
  score,
  grade,
  who,
  avatar,
  audioUrl,
}: {
  memeId: string;
  title: string;
  line: string;
  emoji: string;
  score: number;
  grade: string;
  who: string | null;
  avatar: Avatar;
  audioUrl: string | null;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [played, setPlayed] = useState(false);
  const level = usePlaybackLevel(audio, audioUrl, playing);

  useEffect(() => {
    track("view_share", { meme_id: memeId });
  }, [memeId]);

  const play = () => {
    const el = audio.current;
    if (!el) return;
    el.currentTime = 0;
    void el.play().catch(() => {});
  };

  const name = who ?? "친구";

  return (
    <>
      {audioUrl && (
        <audio
          ref={audio}
          src={audioUrl}
          preload="auto"
          onPlay={() => {
            setPlaying(true);
            setPlayed(true);
          }}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
        />
      )}

      <p className={styles.kicker}>
        <b>{name}</b>가 도전장을 보냈어
      </p>

      <section className={styles.stage}>
        <div className={styles.meta}>
          <span className={styles.meme}>
            {emoji} {title}
          </span>
          <span className={styles.score}>
            {score}
            <small>점</small>
            {grade && <em>{grade}</em>}
          </span>
        </div>

        <button type="button" className={styles.performer} onClick={play} aria-label={`${name}의 녹음 듣기`}>
          <span className={`${styles.bubble} ${playing ? styles.bubbleOn : ""}`}>{line}</span>
          <VoiceAvatar avatar={avatar} level={level} size={200} />
        </button>

        {audioUrl ? (
          <button type="button" className={styles.play} onClick={play}>
            {playing ? "외치는 중…" : played ? "↻ 한 번 더" : "▶ 들어보기"}
          </button>
        ) : (
          <p className={styles.missing}>녹음을 불러오지 못했어. 새로고침 해볼래?</p>
        )}
      </section>

      <Link href={`/record/${memeId}?s=${score}`} className={styles.go}>
        나도 해보기 · {score}점 넘어봐
      </Link>
      <p className={styles.note}>설치 없이 · 로그인 없이 · 탭 한 번이면 시작</p>
      <Link href="/" className={styles.home}>
        다른 소리 구경하기 →
      </Link>
    </>
  );
}
