"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/components/lang";
import { EntryFeedback } from "./entry-feedback";
import styles from "./comment-sheet.module.css";

/**
 * 갤러리 카드 💬 → 아래에서 올라오는 댓글 시트. 화면 절반 남짓만 덮고, 위쪽 어두운 곳·✕·Esc 로 닫는다.
 * 카드(li)는 움직임 효과(transform)가 있어 그 안에선 fixed 가 안 먹으니 body 로 띄운다.
 */
export function CommentSheet({ entryId, name, onClose, onCount }: { entryId: string; name: string; onClose: () => void; onCount?: (n: number) => void }) {
  const t = useT();
  // 부모가 닫기 함수를 매번 새로 만들어도 열고 닫는 준비는 한 번만
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const back = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      back?.focus?.();
    };
  }, []);

  return createPortal(
    <div className={styles.backdrop} onClick={onClose}>
      <div
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label={t(`${name} 댓글`, `Comments on ${name}`)}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.top}>
          <span className={styles.grip} aria-hidden="true" />
          <span className={styles.who}>{name}</span>
          <button type="button" className={styles.close} onClick={onClose} aria-label={t("닫기", "Close")}>
            ✕
          </button>
        </div>
        <div className={styles.body}>
          <EntryFeedback entryId={entryId} variant="sheet" onCount={onCount} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
