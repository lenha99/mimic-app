"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLang, useT } from "@/components/lang";
import { markHeard } from "@/components/home/voice-stories";
import { VoiceAvatar } from "@/components/voice-avatar";
import { normalizeAvatar } from "@/lib/avatar";
import { clientId } from "@/lib/client-id";
import { track } from "@/lib/track";
import { displayName } from "@/lib/weekly";
import styles from "./voices.module.css";

/**
 * 목소리 재생기 — 화면에 오디오는 하나. 카드를 누르면 그 목소리로 바뀌고, 아래에 작은
 * 재생 막대가 뜬다(스포티파이처럼). 끝나면 멈춘다 — 사람이 적은 지금 연속 재생은 안 한다.
 *
 * 60% 넘게 들으면 "들었다"로 센다(재생 수 · 올린 사람의 첫 청취 알림 · 홈 스토리의 회색 테두리).
 */
export type Track = { id: string; name: string; avatar: unknown };

type Player = {
  current: Track | null;
  playing: boolean;
  progress: number;
  toggle: (t: Track) => void;
  stop: () => void;
};

const Ctx = createContext<Player | null>(null);

export function usePlayer(): Player {
  const p = useContext(Ctx);
  if (!p) throw new Error("PlayerProvider missing");
  return p;
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const counted = useRef<Set<string>>(new Set());
  const [current, setCurrent] = useState<Track | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const a = new Audio();
    a.preload = "none";
    audio.current = a;
    const onTime = () => {
      const p = a.duration ? a.currentTime / a.duration : 0;
      setProgress(p);
      const id = a.dataset.id;
      if (id && p >= 0.6 && !counted.current.has(id)) {
        counted.current.add(id);
        markHeard(id);
        track("weekly_play", { via: "gallery" });
        void fetch(`/api/weekly/entries/${id}/play`, { method: "POST", body: JSON.stringify({ client: clientId() }) }).catch(() => {});
      }
    };
    const onEnd = () => {
      setPlaying(false);
      setProgress(1);
    };
    const onPause = () => setPlaying(false);
    const onPlay = () => setPlaying(true);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnd);
    a.addEventListener("pause", onPause);
    a.addEventListener("play", onPlay);
    return () => {
      a.pause();
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnd);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("play", onPlay);
    };
  }, []);

  const toggle = useCallback(
    (t: Track) => {
      const a = audio.current;
      if (!a) return;
      if (current?.id === t.id) {
        if (a.paused) {
          if (a.ended) a.currentTime = 0;
          void a.play().catch(() => {});
        } else a.pause();
        return;
      }
      a.pause();
      a.src = `/api/weekly/audio/${t.id}`;
      a.dataset.id = t.id;
      setCurrent(t);
      setProgress(0);
      void a.play().catch(() => setPlaying(false));
    },
    [current],
  );

  const stop = useCallback(() => {
    audio.current?.pause();
    setCurrent(null);
    setProgress(0);
  }, []);

  const value = useMemo(() => ({ current, playing, progress, toggle, stop }), [current, playing, progress, toggle, stop]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <MiniPlayer />
    </Ctx.Provider>
  );
}

/** 아래 재생 막대 — 지금 듣는 목소리 · 멈춤 · 그 목소리 화면(구독·❤)으로. */
function MiniPlayer() {
  const t = useT();
  const lang = useLang();
  const p = useContext(Ctx);
  if (!p?.current) return null;
  const { current, playing, progress } = p;
  return (
    <div className={styles.mini} role="region" aria-label={t("재생 중", "Now playing")}>
      <span className={styles.miniBar} style={{ transform: `scaleX(${Math.min(1, progress)})` }} aria-hidden="true" />
      <button type="button" className={styles.miniFace} onClick={() => p.toggle(current)} aria-label={playing ? t("멈추기", "Pause") : t("재생", "Play")}>
        <VoiceAvatar avatar={normalizeAvatar(current.avatar)} size={40} level={playing ? 0.5 : 0} />
      </button>
      <Link href={`/weekly/e/${current.id}`} className={styles.miniText}>
        <b>{displayName(current.name, lang)}</b>
        <small>{progress >= 1 ? t("마음에 들면 구독 · ❤ →", "Like it? Subscribe · ❤ →") : t("탭하면 구독 · ❤", "Tap to subscribe · ❤")}</small>
      </Link>
      <button type="button" className={styles.miniBtn} onClick={() => p.toggle(current)} aria-label={playing ? t("멈추기", "Pause") : t("재생", "Play")}>
        {playing ? <PauseIcon /> : <PlayIcon />}
      </button>
      <button type="button" className={styles.miniClose} onClick={p.stop} aria-label={t("닫기", "Close")}>
        ×
      </button>
    </div>
  );
}

export function PlayIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 4.5v15a1 1 0 0 0 1.5.9l12-7.5a1 1 0 0 0 0-1.7l-12-7.5A1 1 0 0 0 7 4.5Z" fill="currentColor" />
    </svg>
  );
}

export function PauseIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="6" y="4.5" width="4.2" height="15" rx="1.2" fill="currentColor" />
      <rect x="13.8" y="4.5" width="4.2" height="15" rx="1.2" fill="currentColor" />
    </svg>
  );
}

/** 파형 — 들은 만큼 채워진다. 누르면 재생/멈춤. */
export function Wave({ bars, progress, active, n = 36 }: { bars: number[]; progress: number; active: boolean; n?: number }) {
  const pts = resample(bars, n);
  return (
    <span className={styles.wave} aria-hidden="true">
      {pts.map((v, i) => (
        <i
          key={i}
          className={active && i / n < progress ? styles.waveOn : undefined}
          style={{ height: `${Math.max(14, Math.round(v * 100))}%` }}
        />
      ))}
    </span>
  );
}

function resample(bars: number[], n: number): number[] {
  if (!bars.length) return Array.from({ length: n }, (_, i) => 0.3 + 0.25 * Math.abs(Math.sin(i * 1.7)));
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = Math.floor((i * bars.length) / n);
    const b = Math.max(a + 1, Math.floor(((i + 1) * bars.length) / n));
    let m = 0;
    for (let j = a; j < b; j++) m = Math.max(m, bars[j] ?? 0);
    out.push(m);
  }
  const peak = Math.max(0.01, ...out);
  return out.map((v) => v / peak);
}
