"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useT } from "@/components/lang";
import { FollowButton } from "./follow-button";
import styles from "./social.module.css";

/**
 * 출전작 무대 아래 — 이 목소리 주인의 포트폴리오 · 구독 · 메시지.
 * 무대 화면은 캐시되니 "내가 구독 중인가"는 붙은 뒤에 묻는다. 게스트 출전작엔 안 뜬다.
 */
export function CreatorBar({ creatorId, nickname }: { creatorId: string; nickname: string }) {
  const t = useT();
  const [s, setS] = useState<{ loggedIn: boolean; self: boolean; following: boolean; followers: number } | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/follow?creator=${creatorId}`)
      .then((r) => r.json())
      .then((d) => alive && setS(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [creatorId]);

  const page = `/v/${encodeURIComponent(nickname)}`;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 8, margin: "14px 0 4px" }}>
      <Link href={page} className={styles.btnGhost}>
        {t("🎙 목소리 모음", "🎙 Voice page")}
        {s && s.followers > 0 ? ` · ${t(`구독자 ${s.followers}`, `${s.followers} subs`)}` : ""}
      </Link>
      {s && !s.self && (
        <FollowButton
          key={String(s.following)}
          creator={creatorId}
          initial={s.following}
          loggedIn={s.loggedIn}
          onChange={(following, followers) => setS({ ...s, following, followers })}
        />
      )}
      {s && !s.self && s.following && (
        <Link href={`/messages/new?to=${creatorId}`} className={styles.btnGhost}>
          {t("💬 메시지", "💬 Message")}
        </Link>
      )}
    </div>
  );
}
