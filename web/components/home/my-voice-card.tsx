"use client";

import Link from "next/link";
import { useT } from "@/components/lang";
import { useViewer } from "@/components/viewer";
import { VoiceAvatar } from "@/components/voice-avatar";
import { DEFAULT_AVATAR } from "@/lib/avatar";
import styles from "./home.module.css";

/**
 * 내 목소리 페이지(포트폴리오) 알리기 — 있는지도 모르면 없는 기능이다.
 * 로그인했으면 내 링크로 바로, 손님이면 "로그인하면 생긴다"로 당긴다.
 */
export function MyVoiceCard() {
  const t = useT();
  const viewer = useViewer();
  const nick = viewer?.loggedIn ? viewer.nickname : null;
  const href = nick ? `/v/${encodeURIComponent(nick)}` : `/login?next=${encodeURIComponent("/profile")}`;

  return (
    <Link href={href} className={styles.voiceCard} data-tour="home-portfolio">
      <span className={styles.voiceCardFace}>
        <VoiceAvatar avatar={viewer?.avatar ?? DEFAULT_AVATAR} size={52} />
      </span>
      <span className={styles.voiceCardText}>
        <small>{t("NEW · 내 목소리 페이지", "NEW · Your voice page")}</small>
        <b>{nick ? `🔗 /v/${nick}` : t("인스타 프로필에 거는 내 목소리 링크", "A voice link for your bio")}</b>
        <span>
          {nick
            ? t("출전작 · ❤ · 트로피 · 구독자가 한 페이지에", "Entries, ❤, trophies and subscribers in one page")
            : t("로그인하면 바로 생겨요 · 구독자가 메시지도 보낼 수 있어요", "Log in to get one · subscribers can message you")}
        </span>
      </span>
      <i aria-hidden="true">→</i>
    </Link>
  );
}
