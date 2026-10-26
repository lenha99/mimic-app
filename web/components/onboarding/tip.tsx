"use client";

import { useEffect, useState, type ReactNode } from "react";
import { markSeen, seen, type Guide } from "@/lib/onboarding";
import styles from "./onboarding.module.css";
import { useT } from "@/components/lang";

/**
 * 그 자리에서 딱 한 번 뜨는 한 줄 안내. 닫으면 다시 안 뜬다.
 *
 * 처음 화면에서 모든 걸 설명하면 아무것도 안 남는다. 막힐 만한 순간(첫 녹음 전,
 * 처음 보는 ❤)에 그 자리에서 한 줄만 말한다.
 */
export function Tip({ id, children }: { id: Guide; children: ReactNode }) {
  const t = useT();
  const [show, setShow] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShow(!seen(id));
  }, [id]);

  if (!show) return null;
  return (
    <div className={styles.tip} role="note">
      <span className={styles.tipMark} aria-hidden="true">
        TIP
      </span>
      <p>{children}</p>
      <button
        type="button"
        className={styles.tipClose}
        aria-label={t("안내 닫기", "Dismiss tip")}
        onClick={() => {
          markSeen(id);
          setShow(false);
        }}
      >
        {t("알겠어요", "Got it")}
      </button>
    </div>
  );
}
