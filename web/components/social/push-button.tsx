"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useT } from "@/components/lang";
import { pushState, type PushState } from "@/lib/push-client";
import { NotifySheet } from "./notify-sheet";
import styles from "./social.module.css";

/**
 * 🔔 알림 버튼 — 누르면 알림 설정 시트(종류별 켜기/끄기)가 올라온다. 권한은 시트에서
 * "알림 받기"를 누르는 순간에만 묻는다. 아이폰 사파리면 설치 안내로 보낸다.
 * kind 는 꺼져 있을 때의 문구만 바꾼다: "new" 새 출전작, "mine" 내 목소리 반응.
 */
export function PushButton({ kind = "new", compact = false }: { kind?: "new" | "mine"; compact?: boolean }) {
  const t = useT();
  const [state, setState] = useState<PushState | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    pushState()
      .then((s) => alive && setState(s))
      .catch(() => alive && setState("unsupported"));
    return () => {
      alive = false;
    };
  }, []);

  if (state === null || state === "unsupported") return null;

  if (state === "needs-install") {
    return (
      <Link href="/install" className={compact ? styles.btnGhost : styles.btn}>
        {t("📲 홈 화면에 추가하면 알림을 받을 수 있어요", "📲 Add to Home Screen to get alerts")}
      </Link>
    );
  }
  if (state === "denied") {
    return <p className={styles.note}>{t("알림이 차단돼 있어요. 브라우저 설정에서 허용해 주세요.", "Notifications are blocked. Allow them in browser settings.")}</p>;
  }

  const on = state === "on";
  const label = on
    ? t("🔔 알림 켜짐 · 설정", "🔔 Alerts on · settings")
    : kind === "mine"
      ? t("🔔 누가 들으면 알려주기", "🔔 Tell me when someone listens")
      : t("🔔 새 목소리 올라오면 알림", "🔔 Alert me to new voices");

  return (
    <>
      <button type="button" className={on ? styles.btnOn : compact ? styles.btnGhost : styles.btn} onClick={() => setOpen(true)}>
        {label}
      </button>
      <NotifySheet open={open} on={on} onClose={() => setOpen(false)} onState={setState} />
    </>
  );
}
