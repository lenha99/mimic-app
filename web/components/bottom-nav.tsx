"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { clientId } from "@/lib/client-id";
import { syncPush } from "@/lib/push-client";
import { useT } from "@/components/lang";
import styles from "./bottom-nav.module.css";

/**
 * 하단 탭 — 홈 · 챌린지 · 연습실 · 나.
 *
 * "챌린지"는 주간 보이스 챌린지(/weekly)다. 밈 따라하기(/challenges)는 그 안에서 들어간다.
 *
 * 홈 상단에 필이 다섯 개 붙어 있던 시절엔 어디로 가야 할지 고르는 게 일이었다.
 * 세션이 넷뿐이니 엄지 자리에 고정해 둔다.
 *
 * 몰입 화면(녹음·연습·캐릭터 꾸미기·피드)에선 숨긴다. 그 화면들은 바닥에 자기
 * 버튼이 있고, 탭이 겹치면 녹음 버튼이 밀려 올라간다.
 */
const TABS = [
  { href: "/", label: ["홈", "Home"], icon: HomeIcon, match: (p: string) => p === "/" },
  {
    href: "/weekly",
    label: ["챌린지", "Challenge"],
    icon: MicIcon,
    match: (p: string) => p.startsWith("/weekly") || p.startsWith("/challenges"),
  },
  { href: "/practice", label: ["연습실", "Practice"], icon: ScriptIcon, match: (p: string) => p === "/practice" || p === "/practice/board" },
  { href: "/me", label: ["나", "Me"], icon: MeIcon, match: (p: string) => p.startsWith("/me") || p.startsWith("/profile") },
];

/** 탭이 보이는 화면 — 목록·허브 화면만. */
const SHOW = [/^\/$/, /^\/weekly$/, /^\/weekly\/hall$/, /^\/challenges$/, /^\/practice$/, /^\/practice\/board$/, /^\/me$/, /^\/profile$/, /^\/rank$/];

export function BottomNav() {
  const path = usePathname() ?? "/";
  const t = useT();
  const unread = useUnread(path);
  if (!SHOW.some((re) => re.test(path))) return null;
  return (
    <>
      <div className={styles.spacer} aria-hidden="true" />
      <nav className={styles.bar} aria-label={t("주 메뉴", "Main menu")} data-tour="nav">
        {TABS.map(({ href, label, icon: Icon, match }) => {
          const on = match(path);
          return (
            <Link key={href} href={href} className={on ? styles.tabOn : styles.tab} aria-current={on ? "page" : undefined}>
              <Icon />
              <span>{t(label[0], label[1])}</span>
              {href === "/me" && unread > 0 && <i className={styles.dot} aria-label={t(`새 알림 ${unread}개`, `${unread} new`)} />}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

function HomeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1v-9.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ScriptIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 3h9l3 3v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8.5 9h7M8.5 12.5h7M8.5 16h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function MeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8.5" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4.5 20.5c1.2-3.6 4.1-5.5 7.5-5.5s6.3 1.9 7.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** 안 읽은 알림 수 — 탭이 보이는 화면에 올 때마다 한 번. 로그인 안 했으면 0. */
let lastUnreadAt = 0;

function useUnread(path: string): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!SHOW.some((re) => re.test(path))) return;
    // 탭을 옮길 때마다 묻지 않는다 — 30초에 한 번이면 점은 충분히 맞다.
    const now = Date.now();
    if (now - lastUnreadAt < 30_000 && !/\/(me|profile|notifications)/.test(path)) return;
    lastUnreadAt = now;
    let alive = true;
    let claim = "";
    try {
      // 로그인 직후 한 번 — 손님일 때 한 구독을 계정으로 옮긴다(서버는 로그인 안 했으면 무시).
      if (!localStorage.getItem("mimic.claimed")) claim = clientId();
    } catch {}
    fetch(`/api/notifications?count=1${claim ? `&claim=${encodeURIComponent(claim)}` : ""}`)
      .then((r) => r.json())
      .then((d: { unread?: number; claimed?: boolean }) => {
        if (d.claimed) {
          try {
            localStorage.setItem("mimic.claimed", "1");
          } catch {}
        }
        if (alive) setN(d.unread ?? 0);
      })
      .catch(() => {});
    void syncPush();
    return () => {
      alive = false;
    };
  }, [path]);
  return n;
}
