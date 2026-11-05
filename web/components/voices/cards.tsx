"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useLang, useT } from "@/components/lang";
import { VoiceAvatar } from "@/components/voice-avatar";
import { normalizeAvatar } from "@/lib/avatar";
import { challengeById, displayName } from "@/lib/weekly";
import { useLikes } from "./likes";
import { AvatarFrame, NameLine } from "@/components/pass/look";
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
  const likes = useLikes();
  // 끝난 주 출전작도 정산 뒤엔 ❤ 를 받는다(서버가 판단). 갤러리면 늘 버튼.
  const canLike = Boolean(likes);
  const liked = likes?.liked(e.id) ?? false;
  const count = likes?.count(e.id, e.likes) ?? e.likes;
  // 끝까지 들었는데 아직 ❤ 안 했으면 하트가 살짝 부른다.
  const ask = canLike && on && !playing && p.progress >= 0.98 && !liked;
  const scriptId = challengeById(e.week.id)?.scriptId;
  const fresh = likes?.fresh === e.id && liked;
  const note = likes?.note?.id === e.id ? likes.note.text : null;

  return (
    <li className={`${styles.card} ${on ? styles.cardOn : ""}`} style={{ animationDelay: `${Math.min(index, 10) * 40}ms` }}>
      <button type="button" className={styles.cardFace} onClick={play} aria-label={playing ? t(`${name} 멈추기`, `Pause ${name}`) : t(`${name} 듣기`, `Play ${name}`)}>
        <span className={`${styles.halo} ${playing ? styles.haloOn : ""}`} aria-hidden="true" />
        <AvatarFrame frame={e.look?.frame}>
          <VoiceAvatar avatar={normalizeAvatar(e.avatar)} size={54} level={playing ? 0.6 : 0} />
        </AvatarFrame>
        <span className={styles.cardPlay} aria-hidden="true">
          {playing ? <PauseIcon size={12} /> : <PlayIcon size={12} />}
        </span>
      </button>

      <div className={styles.cardBody}>
        <Link href={`/weekly/e/${e.id}`} className={styles.cardHead}>
          <b>
            <NameLine name={name} look={e.look} />
          </b>
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
      </div>

      {canLike ? (
        <button
          type="button"
          className={`${styles.likeBtn} ${liked ? styles.likeOn : ""} ${ask ? styles.likeAsk : ""}`}
          onClick={() => void likes!.toggle(e.id)}
          aria-pressed={liked}
          aria-label={liked ? t(`${name} ❤ 취소 — ${count}`, `Un-❤ ${name} — ${count}`) : t(`${name}에게 ❤ — ${count}`, `❤ ${name} — ${count}`)}
        >
          <span className={styles.likeHeart}>{liked ? "♥" : "♡"}</span>
          <b>{count}</b>
          {ask && <small>{t("좋았으면", "Liked it?")}</small>}
        </button>
      ) : (
        <Link href={`/weekly/e/${e.id}`} className={styles.cardSide} aria-label={t(`${name} 화면으로 — ❤ ${count}`, `Open ${name} — ❤ ${count}`)}>
          <span className={styles.heart}>♥</span>
          <b>{count}</b>
          <i aria-hidden="true">›</i>
        </Link>
      )}

      {fresh && scriptId && (
        <Link href={`/practice/${scriptId}`} className={styles.afterLike}>
          <span>{t("❤ 보냈어요! 나도 이 대본 읽어 볼까요?", "❤ sent! Want to read this one too?")}</span>
          <b>{t("내 목소리로 →", "My turn →")}</b>
        </Link>
      )}
      {note && (
        <p className={styles.likeNote} role="alert">
          {note}
        </p>
      )}
    </li>
  );
}

/** 운영자 픽 — 한 번에 한 명만, 크게. 지난 픽은 아래 작은 줄로 남는다(내려가도 기록은 남게). */
export function Spotlight({ pick, past = [], title }: { pick: GalleryEntry | null; past?: GalleryEntry[]; title?: string }) {
  const t = useT();
  const lang = useLang();
  const p = usePlayer();
  const mounted = useMounted();
  if (!pick) return null;
  const e = pick;
  const on = p.current?.id === e.id;
  const playing = on && p.playing;
  const name = displayName(e.name, lang);
  const play = () => p.toggle({ id: e.id, name: e.name, avatar: e.avatar });
  return (
    <section className={styles.spot} aria-label={t("운영자 픽", "Editor's pick")} data-tour="voices-pick">
      <div className={styles.spotHead}>
        <span className={styles.spotChip}>⭐ {title ?? t("운영자 픽", "Editor's pick")}</span>
        {mounted && e.featuredAt && <small>{pickSince(e.featuredAt, t)}</small>}
      </div>
      <article className={`${styles.spotCard} ${playing ? styles.spotCardOn : ""}`}>
        <span className={styles.spotGlow} aria-hidden="true" />
        <button type="button" className={styles.spotFace} onClick={play} aria-label={playing ? t("멈추기", "Pause") : t(`${name} 듣기`, `Play ${name}`)}>
          <span className={`${styles.halo} ${styles.haloBig} ${playing ? styles.haloOn : ""}`} aria-hidden="true" />
          <AvatarFrame frame={e.look?.frame}>
            <VoiceAvatar avatar={normalizeAvatar(e.avatar)} size={104} level={playing ? 0.7 : 0} />
          </AvatarFrame>
        </button>
        <div className={styles.spotText}>
          <Link href={`/weekly/e/${e.id}`} className={styles.spotName}>
            <NameLine name={name} look={e.look} badges lang={lang} />
          </Link>
          <span className={styles.spotMeta}>
            {e.week.emoji} {t(e.week.title, e.week.titleEn)} · ♥ {e.likes}
          </span>
        </div>
        <button type="button" className={styles.spotPlay} onClick={play}>
          <span className={styles.spotPlayIcon}>{playing ? <PauseIcon size={16} /> : <PlayIcon size={16} />}</span>
          <Wave bars={e.bars} progress={p.progress} active={on} n={28} />
        </button>
      </article>
      {past.length > 0 && (
        <div className={styles.pastPicks}>
          <span className={styles.pastLabel}>{t("지난 픽", "Past picks")}</span>
          <div className={styles.pastRail}>
            {past.map((x) => (
              <Link key={x.id} href={`/weekly/e/${x.id}`} className={styles.pastItem}>
                <VoiceAvatar avatar={normalizeAvatar(x.avatar)} size={36} level={0} />
                <span>{displayName(x.name, lang)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

/** "11월 3일부터 픽 · 3일째" */
function pickSince(at: string, t: (ko: string, en: string) => string): string {
  const d = new Date(at);
  const days = Math.max(1, Math.floor((Date.now() - d.getTime()) / 86_400_000) + 1);
  return t(`${d.getMonth() + 1}월 ${d.getDate()}일부터 · ${days}일째`, `Since ${d.getMonth() + 1}/${d.getDate()} · day ${days}`);
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
