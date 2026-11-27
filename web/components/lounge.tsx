"use client";

import { useT } from "@/components/lang";
import { KAKAO_OPENCHAT_URL } from "@/lib/community";
import { track } from "@/lib/track";
import styles from "./lounge.module.css";

/**
 * 라운지 = MIMIC 카카오톡 오픈채팅방 (11/27).
 *
 * 홈에 떠 있던 노란 카톡 아이콘은 뺐다 — 다른 오픈채팅방 방장이 홈만 훑어보고
 * "자기 방 운영하네, 사람 빼 가겠네" 하고 강퇴할까 봐(규민). 다른 앱들처럼
 * 내 정보(나·프로필)에 늘 있는 입구 하나 + 들려준 직후 한 줄로 권한다.
 * 카톡 노랑·말풍선 대신 MIMIC 색이라, 앱 메뉴로 보인다.
 */
export function LoungeCard({ via }: { via: "me" | "profile" }) {
  const t = useT();
  if (!KAKAO_OPENCHAT_URL) return null;
  return (
    <a
      href={KAKAO_OPENCHAT_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.card}
      onClick={() => track("kakao_open", { via })}
    >
      <span className={styles.icon} aria-hidden="true">
        🎙️
      </span>
      <span className={styles.text}>
        <b>{t("MIMIC 라운지", "MIMIC Lounge")}</b>
        <small>{t("같이 연습하고, 들려주고, 더빙할 사람 찾는 방", "Practice, share and find dubbing partners")}</small>
      </span>
      <span className={styles.go}>{t("입장", "Join")}</span>
    </a>
  );
}

/** 들려준 직후 — 반응을 더 듣고 싶은 순간에 한 줄. */
export function LoungeLine({ className }: { className?: string }) {
  const t = useT();
  if (!KAKAO_OPENCHAT_URL) return null;
  return (
    <a
      href={KAKAO_OPENCHAT_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`${styles.line} ${className ?? ""}`}
      onClick={() => track("kakao_open", { via: "posted" })}
    >
      {t("🎙️ 반응 더 듣고 싶다면 · 라운지에 자랑하기 →", "🎙️ Want more reactions? Show it off in the Lounge →")}
    </a>
  );
}
