"use client";

import Link from "next/link";
import { useT } from "@/components/lang";
import { useUnread } from "@/lib/unread-client";
import styles from "./inbox.module.css";

/**
 * 받은 것들 한 곳 — 🔔 활동 · 💬 메시지 · ⭐ 구독 중. 위쪽 바의 ♡·✈ 아이콘이 여기로 온다.
 * 세 화면이 같은 탭을 달고 있어서 어디로 들어와도 나머지 둘이 보인다.
 */
export function InboxTabs({ active }: { active: "activity" | "messages" | "following" }) {
  const t = useT();
  const u = useUnread(active === "activity" ? "/notifications" : active === "messages" ? "/messages" : "/following");
  const tabs = [
    { id: "activity", href: "/notifications", label: t("활동", "Activity"), n: u.activity },
    { id: "messages", href: "/messages", label: t("메시지", "Messages"), n: u.dm },
    { id: "following", href: "/following", label: t("구독 중", "Following"), n: 0 },
  ] as const;
  return (
    <div className={styles.head}>
      <Link href="/" className={styles.back} aria-label={t("홈으로", "Home")}>
        ←
      </Link>
      <nav className={styles.tabs} aria-label={t("받은 편지함", "Inbox")}>
        {tabs.map((x) => (
          <Link key={x.id} href={x.href} className={x.id === active ? styles.tabOn : styles.tab} aria-current={x.id === active ? "page" : undefined}>
            {x.label}
            {x.n > 0 && x.id !== active && <i className={styles.dot}>{x.n > 9 ? "9+" : x.n}</i>}
          </Link>
        ))}
      </nav>
    </div>
  );
}

/** 손님에게 — 막지 않고, 로그인하면 여기 뭐가 생기는지 보여 준다. */
export function GuestInbox({ kind, next }: { kind: "activity" | "messages"; next: string }) {
  const t = useT();
  return (
    <section className={styles.guest}>
      <div className={styles.guestArt} aria-hidden="true">
        {kind === "activity" ? "🎧" : "💌"}
      </div>
      <h2>
        {kind === "activity"
          ? t("누가 내 목소리를 들었는지 궁금하지 않아요?", "Wonder who's been listening?")
          : t("내 목소리에 반한 사람이 말을 걸어와요", "Fans of your voice can message you")}
      </h2>
      <ul>
        {kind === "activity" ? (
          <>
            <li>{t("🔔 구독한 사람 이름이 보여요", "🔔 See who subscribed")}</li>
            <li>{t("🎧 오늘 몇 명이 들었는지", "🎧 How many listened today")}</li>
            <li>{t("🏆 트로피가 계정에 남아요", "🏆 Trophies stay on your account")}</li>
          </>
        ) : (
          <>
            <li>{t("💬 구독자만 보낼 수 있어서 안전해요", "💬 Only subscribers can write — safe")}</li>
            <li>{t("💌 받아주기 전엔 요청 1개만", "💌 Just one request until you accept")}</li>
            <li>{t("🎙 내 목소리 페이지 링크가 생겨요", "🎙 Get your own voice page link")}</li>
          </>
        )}
      </ul>
      <Link href={`/login?next=${encodeURIComponent(next)}`} className={styles.guestGo}>
        {t("3초 만에 로그인하고 보기", "Log in to see it")}
      </Link>
      <p>{t("손님일 때 한 구독은 로그인하면 그대로 옮겨져요", "Subscriptions you made as a guest come with you")}</p>
    </section>
  );
}
