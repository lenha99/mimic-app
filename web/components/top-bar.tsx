"use client";

import Link from "next/link";
import { useAppPath } from "@/lib/app-path";
import type { ReactNode } from "react";
import { Coco } from "@/components/brand/coco";
import { setLang, useLang, useT } from "@/components/lang";
import { useUnread } from "@/lib/unread-client";
import styles from "./top-bar.module.css";

/**
 * 위쪽 바 — 로고 · 🌐 언어 · 🔔 활동 · 💬 메시지.
 *
 * 인스타·스레드처럼 "누가 반응했나"와 "메시지"를 항상 오른쪽 위에 둔다. 예전엔 "나" 탭
 * 깊숙이 있어서 구독·메시지가 있는지도 몰랐다. 언어 버튼도 여기 — 외국인이 한국어 화면을
 * 받았을 때 바로 보이는 자리에 "EN"이 있어야 한다.
 */
export function TopBar({
  children,
  title,
  showLang = true,
}: {
  children?: ReactNode;
  title?: ReactNode;
  showLang?: boolean;
}) {
  const t = useT();
  const lang = useLang();
  const path = useAppPath();
  const u = useUnread(path);

  return (
    <header className={styles.bar}>
      {title ?? (
        <Link href="/" className={styles.logo} aria-label="MIMIC">
          <Coco size={30} headset={false} />
          MIMIC
        </Link>
      )}
      <div className={styles.actions}>
        {showLang && (
          <button
            type="button"
            className={styles.lang}
            onClick={() => setLang(lang === "ko" ? "en" : "ko")}
            aria-label={lang === "ko" ? "Switch to English" : "한국어로 보기"}
            data-tour="top-lang"
          >
            <GlobeIcon />
            <span>{lang === "ko" ? "EN" : "한국어"}</span>
          </button>
        )}
        <Link
          href="/notifications"
          className={styles.icon}
          aria-label={t(
            `활동${u.activity ? ` · 새 알림 ${u.activity}개` : ""}`,
            `Activity${u.activity ? ` · ${u.activity} new` : ""}`,
          )}
          data-tour="top-activity"
        >
          <HeartIcon />
          {u.activity > 0 && (
            <i className={styles.badge}>{u.activity > 9 ? "9+" : u.activity}</i>
          )}
        </Link>
        <Link
          href="/messages"
          className={styles.icon}
          aria-label={t(
            `메시지${u.dm ? ` · 안 읽은 ${u.dm}개` : ""}`,
            `Messages${u.dm ? ` · ${u.dm} unread` : ""}`,
          )}
          data-tour="top-dm"
        >
          <SendIcon />
          {u.dm > 0 && <i className={styles.badge}>{u.dm > 9 ? "9+" : u.dm}</i>}
        </Link>
        {children}
      </div>
    </header>
  );
}

function GlobeIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.9" />
      <path
        d="M3 12h18M12 3c2.6 2.6 3.9 5.6 3.9 9s-1.3 6.4-3.9 9c-2.6-2.6-3.9-5.6-3.9-9S9.4 5.6 12 3Z"
        stroke="currentColor"
        strokeWidth="1.9"
      />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg
      width="25"
      height="25"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 20.3s-7.8-4.6-7.8-10.4A4.4 4.4 0 0 1 12 7.2a4.4 4.4 0 0 1 7.8 2.7c0 5.8-7.8 10.4-7.8 10.4Z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg
      width="25"
      height="25"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M21 3 10.2 13.8M21 3l-6.6 18-4.2-7.2L3 9.6 21 3Z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
    </svg>
  );
}
