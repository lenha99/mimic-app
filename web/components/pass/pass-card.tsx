"use client";

import Link from "next/link";
import { useLang, useT } from "@/components/lang";
import { useViewer } from "@/components/viewer";
import { VoiceAvatar } from "@/components/voice-avatar";
import { DEFAULT_AVATAR } from "@/lib/avatar";
import { readNickname } from "@/lib/nickname";
import { AvatarFrame, LevelPill, NameFx, PassBadges } from "./look";
import s from "./pass.module.css";
import { usePass } from "./use-pass";

/** 나 탭 · 프로필 — 내 VOICE PASS 한 장. 누르면 /pass 로. */
export function PassCard() {
  const t = useT();
  const lang = useLang();
  const v = usePass();
  const viewer = useViewer();
  const name = viewer?.nickname ?? (typeof window !== "undefined" ? readNickname() : "") ?? "";
  const look = v?.look;
  const p = v?.progress;

  return (
    <Link href="/pass" className={s.card} aria-label={t("보이스 패스 보기", "Open Voice Pass")}>
      <AvatarFrame frame={look?.frame}>
        <VoiceAvatar avatar={viewer?.avatar ?? DEFAULT_AVATAR} size={64} />
      </AvatarFrame>
      <div className={s.cardBody}>
        <p className={s.eyebrow}>VOICE PASS</p>
        <p className={s.who}>
          <NameFx fx={look?.name}>{name || t("나", "Me")}</NameFx>
          {look && <LevelPill level={look.level} rank={look.rank} />}
          <PassBadges badges={look?.badges} lang={lang} />
        </p>
        <div className={s.bar} aria-hidden="true">
          <span style={{ width: `${Math.round((p?.ratio ?? 0) * 100)}%` }} />
        </div>
        <div className={s.xpRow}>
          <span>
            <b>{v?.xp ?? 0}</b> XP
          </span>
          <span>{p && p.need > 0 ? t(`다음 레벨까지 ${p.need} XP`, `${p.need} XP to next`) : p ? "MAX" : ""}</span>
        </div>
      </div>
      <i className={s.go} aria-hidden="true">
        ›
      </i>
    </Link>
  );
}
