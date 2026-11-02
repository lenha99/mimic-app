"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLang, useT } from "@/components/lang";
import styles from "@/components/social/inbox.module.css";
import { VoiceAvatar } from "@/components/voice-avatar";
import type { Avatar } from "@/lib/avatar";
import { clientId } from "@/lib/client-id";
import { currentWeek, displayName } from "@/lib/weekly";

type Item = {
  key: string;
  name: string;
  avatar: Avatar;
  page: string | null;
  latest: { id: string; challengeId: string; updatedAt: string } | null;
};

export function FollowingList() {
  const t = useT();
  const lang = useLang();
  const [items, setItems] = useState<Item[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/follow/list?client=${encodeURIComponent(clientId())}`)
      .then((r) => r.json())
      .then((d: { items?: Item[] }) => alive && setItems(d.items ?? []))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, []);

  if (items === null) return <p style={{ color: "var(--ash)", textAlign: "center", padding: 30 }}>…</p>;

  if (!items.length) {
    return (
      <section className={styles.guest}>
        <div className={styles.guestArt} aria-hidden="true">
          ⭐
        </div>
        <h2>{t("아직 구독한 목소리가 없어요", "You're not following anyone yet")}</h2>
        <ul>
          <li>{t("🎧 마음에 드는 목소리를 끝까지 들어 보고", "🎧 Listen to a voice you like")}</li>
          <li>{t("🔔 ‘목소리 구독’을 누르면", "🔔 Tap ‘Subscribe’")}</li>
          <li>{t("🎙 그 사람이 새로 올릴 때 알려드려요", "🎙 We'll tell you when they post again")}</li>
        </ul>
        <Link href="/weekly" className={styles.guestGo}>
          {t("이번 주 목소리 들으러 가기", "Hear this week's voices")}
        </Link>
      </section>
    );
  }

  const week = currentWeek().id;
  return (
    <ul className={styles.follow}>
      {items.map((x) => {
        const fresh = x.latest?.challengeId === week;
        return (
          <li key={x.key} className={styles.card}>
            <span className={`${styles.ring} ${fresh ? "" : styles.ringOff}`}>
              <VoiceAvatar avatar={x.avatar} size={48} />
            </span>
            <span className={styles.cardText}>
              <b>{displayName(x.name, lang) || t("익명의 목소리", "Anonymous voice")}</b>
              {fresh ? (
                <small className={styles.new}>{t("● 이번 주 새 목소리", "● New this week")}</small>
              ) : (
                <small>{t("이번 주엔 아직 안 올렸어요", "Nothing new this week")}</small>
              )}
            </span>
            {x.latest ? (
              <Link href={`/weekly/e/${x.latest.id}`} className={styles.cardGo}>
                {t("▶ 듣기", "▶ Play")}
              </Link>
            ) : x.page ? (
              <Link href={x.page} className={styles.cardGo}>
                {t("보기", "View")}
              </Link>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
