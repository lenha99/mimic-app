"use client";

import { useEffect, useRef, useState } from "react";
import type { Example } from "@/lib/examples";
import styles from "./example-player.module.css";

/**
 * AI 예시 듣기 — 처음 온 사람이 "아, 이렇게 하는 거구나"를 귀로 확인하는 곳.
 *
 * 늘 "AI 예시"라고 붙인다. 정답처럼 들리면 그 목소리를 흉내 내려 하고, 사람 출전작처럼
 * 보이면 판을 속이는 게 된다. 명대사는 AI 가 실제 채점기로 받은 점수도 같이 보여준다 —
 * 감정 없는 AI 점수는 "이건 넘을 수 있겠다"는 첫 목표가 된다.
 */
export function ExamplePlayer({
  example,
  title = "AI 예시 듣기",
  note,
}: {
  example: Example | undefined;
  title?: string;
  note?: string;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = audio.current;
    return () => el?.pause();
  }, []);

  if (!example) return null;

  const toggle = () => {
    const el = audio.current;
    if (!el) return;
    if (playing) {
      el.pause();
      return;
    }
    if (el.ended) el.currentTime = 0;
    void el.play().catch(() => {});
  };

  return (
    <div className={`${styles.box} ${playing ? styles.on : ""}`}>
      <audio
        ref={audio}
        src={example.src}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setProgress(1);
        }}
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          const d = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : example.duration;
          setProgress(d > 0 ? el.currentTime / d : 0);
        }}
      />
      <button type="button" className={styles.play} onClick={toggle} aria-label={playing ? "AI 예시 멈추기" : title}>
        {playing ? "❚❚" : "▶"}
      </button>
      <div className={styles.body}>
        <p className={styles.title}>
          <span className={styles.badge}>AI 예시</span>
          {title}
          {typeof example.score === "number" && (
            <span className={styles.score}>
              AI 점수 <b>{example.score}</b>
            </span>
          )}
        </p>
        <span className={styles.wave} aria-hidden="true">
          {example.bars.map((b, i) => (
            <i
              key={i}
              style={{ height: `${Math.max(14, b * 100)}%` }}
              className={i / example.bars.length < progress ? styles.waveOn : undefined}
            />
          ))}
        </span>
        {note && <p className={styles.note}>{note}</p>}
      </div>
    </div>
  );
}
