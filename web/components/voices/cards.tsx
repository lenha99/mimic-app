"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useLang, useT } from "@/components/lang";
import { VoiceAvatar } from "@/components/voice-avatar";
import { badgeLabel, isBadge } from "@/lib/badges";
import { normalizeAvatar } from "@/lib/avatar";
import { displayName } from "@/lib/weekly";
import type { GalleryEntry } from "@/lib/weekly-server";
import { PauseIcon, PlayIcon, usePlayer, Wave } from "./player";
import styles from "./voices.module.css";

/** 정적 페이지라 "몇 분 전"은 브라우저에 붙은 뒤에만 그린다(서버 시각과 어긋나 화면이 깨지지 않게). */
const noop = () => () => {};
function useMounted(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}

/** 갤러리 카드 하나 — 얼굴을 누르면 바로 재생, 이름 쪽을 누르면 그 목소리 화면(구독·❤). */
export function VoiceCard({ e, index = 0 }: { e: GalleryEntry; index?: number }) {
  const t = useT();
  const lang = useLang();
  const p = usePlayer();
  const mounted = useMounted();
  const on = p.current?.id === e.id;
  const playing = on && p.playing;
  const name = displayName(e.name, lang);
  const play = () => p.toggle({ id: e.id, name: e.name, avatar: e.avatar });

  return (
    <li className={`${styles.card} ${on ? styles.cardOn : ""}`} style={{ animationDelay: `${Math.min(index, 10) * 40}ms` }}>
      <button type="button" className={styles.cardFace} onClick={play} aria-label={playing ? t(`${name} 멈추기`, `Pause ${name}`) : t(`${name} 듣기`, `Play ${name}`)}>
        <span className={`${styles.halo} ${playing ? styles.haloOn : ""}`} aria-hidden="true" />
        <VoiceAvatar avatar={normalizeAvatar(e.avatar)} size={54} level={playing ? 0.6 : 0} />
        <span className={styles.cardPlay} aria-hidden="true">
          {playing ? <PauseIcon size={12} /> : <PlayIcon size={12} />}
        </span>
      </button>

      <div className={styles.cardBody}>
        <Link href={`/weekly/e/${e.id}`} className={styles.cardHead}>
          <b>{name}</b>
          {e.featured && <span className={styles.pickMini}>⭐ {t("픽", "Pick")}</span>}
        </Link>
        <span className={styles.cardMeta}>
          {e.week.emoji} {t(e.week.title, e.week.titleEn)}
          {mounted ? ` · ${ago(e.at, t)}` : ""}
        </span>
        <button type="button" className={styles.cardWave} onClick={play} tabIndex={-1} aria-hidden="true">
          <Wave bars={e.bars} progress={p.progress} active={on} />
          <small>{fmtDur(e.duration)}</small>
        </button>
        {e.badges.length > 0 && (
          <span className={styles.badges}>
            {e.badges.filter(isBadge).map((b) => (
              <span key={b} className={styles.badge}>
                {badgeLabel(b, lang)}
              </span>
            ))}
          </span>
        )}
      </div>

      <Link href={`/weekly/e/${e.id}`} className={styles.cardSide} aria-label={t(`${name} 화면으로 — ❤ ${e.likes}`, `Open ${name} — ❤ ${e.likes}`)}>
        <span className={styles.heart}>♥</span>
        <b>{e.likes}</b>
        <i aria-hidden="true">›</i>
      </Link>
    </li>
  );
}

/** 운영자 픽 — 크게, 하나씩. 여러 개면 옆으로 넘긴다. */
export function Spotlight({ picks, title }: { picks: GalleryEntry[]; title?: string }) {
  const t = useT();
  const lang = useLang();
  const p = usePlayer();
  if (!picks.length) return null;
  return (
    <section className={styles.spot} aria-label={t("운영자 픽", "Editor's pick")} data-tour="voices-pick">
      <div className={styles.spotHead}>
        <span className={styles.spotChip}>⭐ {title ?? t("운영자 픽", "Editor's pick")}</span>
        {picks.length > 1 && <small>{t(`${picks.length}개 · 옆으로 넘겨 보세요`, `${picks.length} · swipe`)}</small>}
      </div>
      <div className={styles.spotRail}>
        {picks.map((e) => {
          const on = p.current?.id === e.id;
          const playing = on && p.playing;
          const name = displayName(e.name, lang);
          const play = () => p.toggle({ id: e.id, name: e.name, avatar: e.avatar });
          return (
            <article key={e.id} className={`${styles.spotCard} ${playing ? styles.spotCardOn : ""}`}>
              <span className={styles.spotGlow} aria-hidden="true" />
              <button type="button" className={styles.spotFace} onClick={play} aria-label={playing ? t("멈추기", "Pause") : t(`${name} 듣기`, `Play ${name}`)}>
                <span className={`${styles.halo} ${styles.haloBig} ${playing ? styles.haloOn : ""}`} aria-hidden="true" />
                <VoiceAvatar avatar={normalizeAvatar(e.avatar)} size={104} level={playing ? 0.7 : 0} />
              </button>
              <div className={styles.spotText}>
                <Link href={`/weekly/e/${e.id}`} className={styles.spotName}>
                  {name}
                </Link>
                <span className={styles.spotMeta}>
                  {e.week.emoji} {t(e.week.title, e.week.titleEn)} · ♥ {e.likes}
                </span>
                {e.badges.length > 0 && (
                  <span className={styles.badges}>
                    {e.badges.filter(isBadge).map((b) => (
                      <span key={b} className={styles.badge}>
                        {badgeLabel(b, lang)}
                      </span>
                    ))}
                  </span>
                )}
              </div>
              <button type="button" className={styles.spotPlay} onClick={play}>
                <span className={styles.spotPlayIcon}>{playing ? <PauseIcon size={16} /> : <PlayIcon size={16} />}</span>
                <Wave bars={e.bars} progress={p.progress} active={on} n={28} />
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function fmtDur(s: number): string {
  const v = Math.max(1, Math.round(s));
  return `0:${String(v).padStart(2, "0")}`;
}

function ago(at: string, t: (ko: string, en: string) => string): string {
  const m = Math.max(0, Math.round((Date.now() - new Date(at).getTime()) / 60_000));
  if (m < 60) return t(m < 1 ? "방금" : `${m}분 전`, m < 1 ? "just now" : `${m}m ago`);
  const h = Math.round(m / 60);
  if (h < 24) return t(`${h}시간 전`, `${h}h ago`);
  const d = Math.round(h / 24);
  if (d < 7) return t(`${d}일 전`, `${d}d ago`);
  return t(`${Math.round(d / 7)}주 전`, `${Math.round(d / 7)}w ago`);
}
