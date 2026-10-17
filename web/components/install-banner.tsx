"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { detectInstallEnv, promptInstall, subscribeInstallPrompt, type InstallEnv } from "@/lib/install";
import styles from "./install-banner.module.css";

const DISMISS_KEY = "mimic:install-dismissed";
const DISMISS_FOR = 14 * 86_400_000;

/**
 * 홈 맨 위 한 줄 — "앱으로 설치". 안드로이드 크롬이면 그 자리에서 설치 창을 띄우고,
 * 나머지는 /install 안내로 보낸다. 닫으면 2주 동안 안 보인다.
 * 이미 설치해서 연 경우와 데스크톱에선 그리지 않는다.
 */
export function InstallBanner() {
  const [env, setEnv] = useState<InstallEnv | null>(null);
  const [canPrompt, setCanPrompt] = useState(false);

  useEffect(() => {
    const e = detectInstallEnv();
    if (e.kind === "installed" || e.kind === "desktop" || dismissedRecently()) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEnv(e);
    return subscribeInstallPrompt(setCanPrompt);
  }, []);

  if (!env) return null;

  const close = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // 저장이 막힌 브라우저면 이번 화면에서만 닫는다.
    }
    setEnv(null);
  };

  const label =
    env.kind === "inapp" ? "브라우저로 열고 앱으로 설치" : "홈 화면에 앱으로 설치";
  const body = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/icon-192.png" alt="" width={36} height={36} className={styles.icon} />
      <span className={styles.text}>
        <b>{label}</b>
        <small>아이콘 한 번에 · Add to Home Screen</small>
      </span>
      <span className={styles.go}>설치</span>
    </>
  );

  return (
    <div className={styles.bar}>
      {canPrompt ? (
        <button
          type="button"
          className={styles.main}
          onClick={async () => {
            if ((await promptInstall()) === "accepted") setEnv(null);
          }}
        >
          {body}
        </button>
      ) : (
        <Link href="/install" className={styles.main}>
          {body}
        </Link>
      )}
      <button type="button" className={styles.close} onClick={close} aria-label="닫기">
        ×
      </button>
    </div>
  );
}

function dismissedRecently(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return Boolean(at) && Date.now() - at < DISMISS_FOR;
  } catch {
    return false;
  }
}
