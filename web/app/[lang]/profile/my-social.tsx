"use client";

import Link from "next/link";
import { useState } from "react";
import { useT } from "@/components/lang";
import { PushButton } from "@/components/social/push-button";
import s from "@/components/social/social.module.css";
import styles from "./profile.module.css";

/**
 * 프로필 맨 위 — 내 목소리에 돌아온 것들: 알림 · 메시지 · 구독자 · 포트폴리오 링크,
 * 그리고 메시지 받기 설정 하나와 알림 켜기.
 */
export function MySocial({
  nickname,
  followers,
  unread,
  dmUnread,
  dmPolicy,
}: {
  nickname: string;
  followers: number;
  unread: number;
  dmUnread: number;
  dmPolicy: "followers" | "off";
}) {
  const t = useT();
  const [policy, setPolicy] = useState(dmPolicy);
  const [busy, setBusy] = useState(false);

  const toggleDm = async () => {
    const next = policy === "followers" ? "off" : "followers";
    setBusy(true);
    try {
      const res = await fetch("/api/social/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dmPolicy: next }),
      });
      if (res.ok) setPolicy(next);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.card}>
      <div className="eyebrow">{t("내 목소리", "My voice")}</div>
      <ul className={s.list} style={{ marginTop: 10 }}>
        <li>
          <Link href="/notifications" className={s.row}>
            <span className={s.emoji}>🔔</span>
            <span className={s.rowText}>
              <b>{t("알림", "Notifications")}</b>
              <small>{t("누가 듣고 · 구독하고 · 말을 걸었는지", "Who listened, subscribed, or messaged")}</small>
            </span>
            {unread > 0 && <span className={s.badge}>{unread}</span>}
          </Link>
        </li>
        <li>
          <Link href="/messages" className={s.row}>
            <span className={s.emoji}>💬</span>
            <span className={s.rowText}>
              <b>{t("메시지", "Messages")}</b>
              <small>{t("구독자가 보낸 메시지 요청", "Message requests from subscribers")}</small>
            </span>
            {dmUnread > 0 && <span className={s.badge}>{dmUnread}</span>}
          </Link>
        </li>
        <li>
          <Link href={`/v/${encodeURIComponent(nickname)}`} className={s.row}>
            <span className={s.emoji}>🎙</span>
            <span className={s.rowText}>
              <b>{t("내 목소리 모음", "My voice page")}</b>
              <small>{t(`구독자 ${followers}명 · 인스타 프로필에 걸 수 있는 링크`, `${followers} subscribers · link for your bio`)}</small>
            </span>
          </Link>
        </li>
        <li>
          <div className={s.setting}>
            <span className={s.rowText}>
              <b>{t("메시지 받기", "Receive messages")}</b>
              <small>
                {policy === "followers"
                  ? t("내 목소리 구독자만 · 받아주기 전엔 1개만", "Subscribers only · one message until you accept")
                  : t("꺼짐 — 아무도 메시지를 못 보내요", "Off — nobody can message you")}
              </small>
            </span>
            <button type="button" className={policy === "followers" ? s.btnOn : s.btnGhost} onClick={() => void toggleDm()} disabled={busy}>
              {policy === "followers" ? t("켜짐", "On") : t("꺼짐", "Off")}
            </button>
          </div>
        </li>
      </ul>
      <div style={{ marginTop: 12 }}>
        <PushButton kind="mine" compact />
      </div>
    </div>
  );
}
