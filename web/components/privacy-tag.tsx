"use client";

import { useT } from "@/components/lang";
import type { T } from "@/lib/i18n";
import styles from "./privacy-tag.module.css";

/**
 * 이 녹음은 어디 있고 누가 들을 수 있나 — 한눈에.
 *
 * 연습 녹음은 폰에만, 출전작은 모두에게, 명대사는 저장 방식에 따라 다르다. 같은 앱 안에서
 * 녹음의 운명이 갈리니, 녹음이 보이는 곳마다 같은 모양의 딱지를 붙인다. 자물쇠 = 나만,
 * 지구 = 모두, 고리 = 링크 받은 사람.
 */
export type PrivacyKind = "device" | "unsaved" | "private" | "link" | "public";

const COPY = (t: T): Record<PrivacyKind, { icon: string; label: string; sub: string }> => ({
  device: { icon: "🔒", label: t("내 폰에만 저장돼요", "Saved on this phone only"), sub: t("다른 사람은 들을 수 없어요", "No one else can hear it") },
  unsaved: { icon: "⏳", label: t("아직 저장 전이에요", "Not saved yet"), sub: t("저장 안 하고 나가면 사라져요", "Leave without saving and it's gone") },
  private: { icon: "🔒", label: t("나만 듣기", "Only me"), sub: t("다른 사람은 들을 수 없어요. 프로필에서 언제든 지울 수 있어요", "No one else can hear it. Delete anytime from your profile") },
  link: { icon: "🔗", label: t("링크 공개", "Link only"), sub: t("링크 받은 사람만 들을 수 있어요", "Only people with the link can listen") },
  public: { icon: "🌐", label: t("전체 공개", "Public"), sub: t("누구나 들을 수 있어요. 언제든 내릴 수 있어요", "Anyone can listen. Take it down anytime") },
});

export function PrivacyTag({ kind, compact = false }: { kind: PrivacyKind; compact?: boolean }) {
  const c = COPY(useT())[kind];
  const tone = kind === "public" || kind === "link" ? styles.open : kind === "unsaved" ? styles.temp : styles.closed;
  if (compact) {
    return (
      <span className={`${styles.chip} ${tone}`} title={c.sub}>
        <span aria-hidden="true">{c.icon}</span> {c.label}
      </span>
    );
  }
  return (
    <p className={`${styles.tag} ${tone}`}>
      <span className={styles.icon} aria-hidden="true">
        {c.icon}
      </span>
      <span>
        <b>{c.label}</b>
        <small>{c.sub}</small>
      </span>
    </p>
  );
}
