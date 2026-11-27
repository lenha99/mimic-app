"use client";

import { useEffect, useState } from "react";
import { useT } from "@/components/lang";
import { KAKAO_OPENCHAT_URL } from "@/lib/community";
import { track } from "@/lib/track";
import styles from "./kakao-chat-popup.module.css";

const HIDE_KEY = "mimic:kakao-hide-until";
const HIDE_CLOSED = 3 * 86_400_000; // × 로 닫으면 3일
const HIDE_JOINED = 30 * 86_400_000; // 들어갔으면 한 달

/**
 * 홈 작은 팝업 — 카카오톡 오픈채팅방(11/27). 화면을 막지 않게 하단 탭 위 오른쪽에 작게.
 * 첫 미션 시트처럼 화면을 덮는 게 떠 있는 동안(body 스크롤 잠금)엔 기다렸다가 띄운다.
 */
export function KakaoChatPopup() {
  const t = useT();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!KAKAO_OPENCHAT_URL || hiddenNow()) return;
    let timer = 0;
    const tryShow = () => {
      if (document.body.style.overflow === "hidden") {
        timer = window.setTimeout(tryShow, 2000);
        return;
      }
      setShow(true);
    };
    timer = window.setTimeout(tryShow, 2500);
    return () => window.clearTimeout(timer);
  }, []);

  if (!show) return null;

  const hide = (ms: number) => {
    try {
      localStorage.setItem(HIDE_KEY, String(Date.now() + ms));
    } catch {
      // 저장이 막힌 브라우저면 이번 화면에서만 닫는다.
    }
    setShow(false);
  };

  return (
    <div className={styles.pop} role="dialog" aria-label={t("MIMIC 오픈채팅방", "MIMIC open chat")}>
      <a
        href={KAKAO_OPENCHAT_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.main}
        onClick={() => {
          track("kakao_open", { via: "home" });
          hide(HIDE_JOINED);
        }}
      >
        <span className={styles.icon} aria-hidden="true">
          💬
        </span>
        <span className={styles.text}>
          <b>{t("MIMIC 오픈채팅방", "MIMIC open chat")}</b>
          <small>{t("목소리 들려주고 같이 더빙해요", "Share voices, dub together")}</small>
        </span>
        <span className={styles.go}>{t("입장", "Join")}</span>
      </a>
      <button type="button" className={styles.close} onClick={() => hide(HIDE_CLOSED)} aria-label={t("닫기", "Close")}>
        ×
      </button>
    </div>
  );
}

function hiddenNow(): boolean {
  try {
    return Number(localStorage.getItem(HIDE_KEY) ?? 0) > Date.now();
  } catch {
    return false;
  }
}
