import type { ReactNode } from "react";
import { BADGES, rankLabel, type BadgeId, type FrameId, type Look, type NameFxId, type Rank } from "@/lib/pass";
import s from "./look.module.css";

/**
 * VOICE PASS 의 겉모습 — 아바타 프레임 · 닉네임 효과 · 레벨 칩 · 특별 배지.
 * 서버·클라이언트 어디서든 그릴 수 있게 상태가 없다.
 */

const FRAME_CLASS: Record<Exclude<FrameId, "none">, string> = {
  neon: s.neon,
  holo: s.holo,
  aurora: s.aurora,
  spotlight: s.spotlight,
  legend: s.legend,
};

export function AvatarFrame({ frame, children }: { frame: FrameId | undefined; children: ReactNode }) {
  if (!frame || frame === "none") return <>{children}</>;
  return (
    <span className={`${s.frame} ${FRAME_CLASS[frame]}`}>
      {children}
    </span>
  );
}

const NAME_CLASS: Record<Exclude<NameFxId, "none">, string> = {
  glow: s.glow,
  shimmer: s.shimmer,
  chrome: s.chrome,
  prism: s.prism,
};

export function NameFx({ fx, children }: { fx: NameFxId | undefined; children: ReactNode }) {
  if (!fx || fx === "none") return <>{children}</>;
  return <span className={`${s.name} ${NAME_CLASS[fx]}`}>{children}</span>;
}

const RANK_CLASS: Record<Rank, string> = {
  rookie: s.rookie,
  rising: s.rising,
  star: s.star,
  icon: s.icon,
  legend: s.legendRank,
};

/** "Lv 5 · STAR" — compact 면 레벨만 */
export function LevelPill({ level, rank, compact = false }: { level: number; rank: Rank; compact?: boolean }) {
  return (
    <span className={`${s.lv} ${RANK_CLASS[rank]}`} title={`Lv ${level} ${rankLabel(rank)}`}>
      <i>Lv</i>
      <b>{level}</b>
      {!compact && <i>· {rankLabel(rank)}</i>}
    </span>
  );
}

function Glyph({ id }: { id: BadgeId }) {
  if (id === "pick")
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7.1L12 17.3 5.8 21l1.6-7.1L2 9.2l7.1-.6z" />
      </svg>
    );
  if (id === "oracle")
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M12 5C6.5 5 2.4 9.2 1 12c1.4 2.8 5.5 7 11 7s9.6-4.2 11-7c-1.4-2.8-5.5-7-11-7zm0 11a4 4 0 110-8 4 4 0 010 8z" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 5 6.5 5c2 0 3.5 1.1 4.5 2.6C12 6.1 13.5 5 15.5 5 19 5 21.1 8.4 19.6 11.8 17.5 16.4 12 21 12 21z" />
    </svg>
  );
}

const BADGE_CLASS: Record<BadgeId, string> = { pick: s.bPick, oracle: s.bOracle, first: s.bFirst };

export function PassBadges({ badges, lang = "ko" }: { badges: BadgeId[] | undefined; lang?: "ko" | "en" }) {
  if (!badges?.length) return null;
  return (
    <span className={s.badges}>
      {badges.map((b) => (
        <span key={b} className={`${s.badge} ${BADGE_CLASS[b]}`} title={lang === "en" ? BADGES[b].en : BADGES[b].ko}>
          <Glyph id={b} />
          {b === "first" ? "FIRST" : BADGES[b].label}
        </span>
      ))}
    </span>
  );
}

/** 이름 한 줄 — 닉네임 효과 + 레벨 칩 (+ 배지) */
export function NameLine({ name, look, badges = false, lang = "ko" }: { name: ReactNode; look: Look | undefined; badges?: boolean; lang?: "ko" | "en" }) {
  return (
    <>
      <NameFx fx={look?.name}>{name}</NameFx>
      {look && look.level > 1 && (
        <>
          {" "}
          <LevelPill level={look.level} rank={look.rank} compact />
        </>
      )}
      {badges && look && (
        <>
          {" "}
          <PassBadges badges={look.badges} lang={lang} />
        </>
      )}
    </>
  );
}
