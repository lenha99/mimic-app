"use client";

import { useSyncExternalStore } from "react";
import { useT } from "@/components/lang";
import { hasRecorded } from "@/lib/take-store";
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
export function LoungeCard({ via }: { via: "me" | "profile" | "home" }) {
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
        <small>{t("같이 연습하고 더빙할 사람 찾는 방", "Practice, share and find dubbing partners")}</small>
      </span>
      <span className={styles.go}>{t("입장", "Join")}</span>
    </a>
  );
}

/**
 * 홈 — 한 번이라도 녹음해 본 사람에게만(11/27, 규민). 다른 방 방장이 홈만 훑어볼 땐
 * 안 보이고, 연습실에서 한 번 읽어 본 사람은 홈에서 바로 들어갈 수 있다.
 * 홈은 정적 페이지라 녹음 여부는 브라우저에서 확인한 뒤 그린다.
 */
const noop = () => () => {};

export function HomeLounge() {
  const show = useSyncExternalStore(noop, hasRecorded, () => false);
  return show ? <LoungeCard via="home" /> : null;
}

/**
 * 한 줄 입구. posted = 들려준 직후(반응을 더 듣고 싶은 순간),
 * recorded = 연습실에서 녹음 직후(같이 연습할 사람을 찾는 순간).
 */
export function LoungeLine({ className, via = "posted" }: { className?: string; via?: "posted" | "recorded" }) {
  const t = useT();
  if (!KAKAO_OPENCHAT_URL) return null;
  return (
    <a
      href={KAKAO_OPENCHAT_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`${styles.line} ${className ?? ""}`}
      onClick={() => track("kakao_open", { via })}
    >
      {via === "recorded"
        ? t("🎙️ 같이 연습할 사람 찾기 · MIMIC 라운지 →", "🎙️ Find people to practice with · MIMIC Lounge →")
        : t("🎙️ 반응 더 듣고 싶다면 · 라운지에 자랑하기 →", "🎙️ Want more reactions? Show it off in the Lounge →")}
    </a>
  );
}
