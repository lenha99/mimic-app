"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useT } from "@/components/lang";
import { clientId } from "@/lib/client-id";
import { FollowButton } from "./follow-button";
import { PushButton } from "./push-button";
import styles from "./social.module.css";

type State = { loggedIn: boolean; self: boolean; following: boolean; followers: number; creatorUser: string | null };

/**
 * 출전작 무대 아래 — 이 목소리 주인 구독 · 메시지 · 포트폴리오. 손님 출전작에도 뜬다.
 *
 * 로그인 없이 구독은 되지만, 로그인하면 더 생긴다: 누가 구독했는지 보이고, 메시지를 주고받는다.
 * 그 차이를 버튼 옆 한 줄로 보여 준다(막지 않고 당긴다).
 * 무대 화면은 캐시되니 상태는 붙은 뒤에 묻는다.
 */
export function CreatorBar({ entryId, nickname, listened = false }: { entryId: string; nickname: string; listened?: boolean }) {
  const t = useT();
  const path = usePathname() ?? "/";
  const [s, setS] = useState<State | null>(null);
  const [justFollowed, setJustFollowed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/follow?entry=${entryId}&client=${encodeURIComponent(clientId())}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: State | null) => alive && d && setS(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [entryId]);

  if (!s) return <div style={{ minHeight: 58 }} aria-hidden="true" />;
  const login = `/login?next=${encodeURIComponent(path)}`;

  if (s.self) {
    return (
      <div style={{ display: "grid", justifyItems: "center", gap: 6, margin: "14px 0 4px", textAlign: "center" }}>
        <span className={styles.btnGhost} style={{ cursor: "default" }}>
          🔔 {t(`내 목소리 구독자 ${s.followers}명`, `${s.followers} subscribers`)}
        </span>
        {!s.loggedIn && (
          <p className={styles.note}>
            {t("로그인하면 누가 구독했는지 보이고 메시지도 받을 수 있어요 · ", "Log in to see who subscribed and get messages · ")}
            <Link href={login} style={{ color: "var(--volt)", fontWeight: 800 }}>
              {t("로그인", "Log in")}
            </Link>
          </p>
        )}
      </div>
    );
  }

  const page = s.creatorUser ? `/v/${encodeURIComponent(nickname)}` : null;
  return (
    <div style={{ display: "grid", justifyItems: "center", gap: 8, margin: "14px 0 4px", textAlign: "center" }}>
      {listened && !s.following && (
        <p className={styles.note} style={{ color: "var(--volt)", fontWeight: 800, fontSize: 13.5 }}>
          {t("목소리 마음에 들었어요? 구독하면 새로 올릴 때 알려드려요", "Liked the voice? Subscribe to hear the next one")}
        </p>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <FollowButton
          entry={entryId}
          initial={s.following}
          big={listened && !s.following}
          onChange={(following, followers) => {
            setS((p) => (p ? { ...p, following, followers: followers ?? p.followers + (following ? 1 : -1) } : p));
            if (following) setJustFollowed(true);
          }}
        />
        {s.following && s.creatorUser && (
          <Link href={s.loggedIn ? `/messages/new?to=${s.creatorUser}` : login} className={styles.btnGhost}>
            {t("💬 메시지", "💬 Message")}
          </Link>
        )}
        {page && (
          <Link href={page} className={styles.btnGhost}>
            {t("🎙 목소리 모음", "🎙 Voice page")}
          </Link>
        )}
      </div>
      <p className={styles.note}>
        {t(`구독자 ${Math.max(0, s.followers)}명`, `${Math.max(0, s.followers)} subscribers`)}
        {s.following && s.creatorUser && !s.loggedIn ? t(" · 로그인하면 메시지를 보낼 수 있어요", " · Log in to send a message") : ""}
      </p>
      {justFollowed && s.following && (
        <div style={{ display: "grid", justifyItems: "center", gap: 6 }}>
          <p className={styles.note}>{t("구독했어요! 알림을 켜면 새 목소리가 올라올 때 바로 알려드려요", "Subscribed! Turn on alerts to hear about new takes")}</p>
          <PushButton kind="new" compact />
        </div>
      )}
    </div>
  );
}
