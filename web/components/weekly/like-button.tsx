"use client";

import { useState } from "react";
import { LISTEN_RATIO } from "@/lib/weekly";
import styles from "./weekly.module.css";

/**
 * ❤ 버튼. 끝까지 듣기 전엔 잠겨 있고, 듣는 동안 테두리가 차오른다 — 다 차면 열린다.
 *
 * "들어야 누를 수 있다"를 글로 설명하면 안 읽는다. 차오르는 링이 그 규칙을 보여준다.
 */
export function LikeButton({
  likes,
  liked,
  locked,
  progress,
  mine = false,
  frozen = false,
  size = "md",
  onPress,
}: {
  likes: number;
  liked: boolean;
  locked: boolean;
  /** 지금 이 출전작을 듣는 중이면 0~1, 아니면 null */
  progress: number | null;
  mine?: boolean;
  frozen?: boolean;
  size?: "md" | "lg";
  onPress: () => void;
}) {
  const [burst, setBurst] = useState(0);
  const fill = locked ? Math.min(1, (progress ?? 0) / LISTEN_RATIO) : 1;
  const R = 21;
  const C = 2 * Math.PI * R;
  const label = mine
    ? `내 출전작 · ❤ ${likes}`
    : frozen
      ? `마감 · ❤ ${likes}`
      : locked
        ? `끝까지 들으면 ❤ 를 누를 수 있어요 · 지금 ${likes}`
        : liked
          ? `❤ 취소 · 지금 ${likes}`
          : `❤ 누르기 · 지금 ${likes}`;

  return (
    <button
      type="button"
      className={`${size === "lg" ? styles.likeLg : styles.like} ${liked ? styles.likeOn : ""} ${locked ? styles.likeLocked : ""}`}
      aria-label={label}
      aria-pressed={liked}
      disabled={mine || frozen}
      onClick={() => {
        if (!locked && !liked) setBurst((n) => n + 1);
        onPress();
      }}
    >
      <span className={styles.likeIcon}>
        <svg viewBox="0 0 48 48" aria-hidden="true">
          <circle cx="24" cy="24" r={R} className={styles.likeTrack} />
          {locked && !mine && (
            <circle
              cx="24"
              cy="24"
              r={R}
              className={styles.likeRing}
              strokeDasharray={C}
              strokeDashoffset={C * (1 - fill)}
            />
          )}
          <path
            className={styles.likeHeart}
            d="M24 34.5s-9.5-5.6-9.5-12.2A5.3 5.3 0 0 1 24 19.2a5.3 5.3 0 0 1 9.5 3.1c0 6.6-9.5 12.2-9.5 12.2Z"
          />
        </svg>
        {burst > 0 && <i key={burst} className={styles.likeBurst} aria-hidden="true" />}
      </span>
      <span className={styles.likeCount}>{likes.toLocaleString("ko-KR")}</span>
    </button>
  );
}
