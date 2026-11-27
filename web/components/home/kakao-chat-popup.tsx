"use client";

import { useT } from "@/components/lang";
import { KAKAO_OPENCHAT_URL } from "@/lib/community";
import { track } from "@/lib/track";
import styles from "./kakao-chat-popup.module.css";

/**
 * 홈 오른쪽 아래 작은 앱 아이콘 — 카카오톡 오픈채팅방(11/27).
 * 언제든 들어가고 싶을 때 들어가야 해서 닫기 없이 늘 같은 자리에 떠 있다(규민).
 * 처음엔 닫히는 팝업이었다가 → 사라지면 안 된다 → 크지 않게, 정사각형 아이콘으로.
 */
export function KakaoChatPopup() {
  const t = useT();
  if (!KAKAO_OPENCHAT_URL) return null;
  return (
    <a
      href={KAKAO_OPENCHAT_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.fab}
      aria-label={t("MIMIC 카카오톡 오픈채팅방", "MIMIC KakaoTalk open chat")}
      onClick={() => track("kakao_open", { via: "home" })}
    >
      <span className={styles.icon} aria-hidden="true">
        <svg viewBox="0 0 24 24" width="30" height="30">
          <path
            fill="#3a1d1d"
            d="M12 3.6c-5 0-9 3.15-9 7.04 0 2.52 1.68 4.73 4.2 5.97l-.86 3.13c-.08.29.25.52.5.35l3.73-2.47c.47.05.94.07 1.43.07 5 0 9-3.15 9-7.05S17 3.6 12 3.6Z"
          />
        </svg>
      </span>
      <span className={styles.label}>{t("오픈채팅", "Chat")}</span>
    </a>
  );
}
