"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useT } from "@/components/lang";
import { disablePush, enablePush, pushState, type PushState } from "@/lib/push-client";
import styles from "./social.module.css";

/**
 * 🔔 알림 켜기 — 누르는 순간에만 권한을 묻는다. 아이폰 사파리면 설치 안내로 보낸다.
 * kind="new" 는 "새 출전작 알림", kind="mine" 은 "내 목소리를 누가 들으면" 문구.
 */
export function PushButton({ kind = "new", compact = false }: { kind?: "new" | "mine"; compact?: boolean }) {
  const t = useT();
  const [state, setState] = useState<PushState | "busy" | null>(null);

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
    ? t("✓ 알림 켜짐", "✓ Alerts on")
    : kind === "mine"
      ? t("🔔 누가 들으면 알려주기", "🔔 Tell me when someone listens")
      : t("🔔 새 목소리 올라오면 알림", "🔔 Alert me to new voices");

  const toggle = async () => {
    setState("busy");
    try {
      if (on) {
        setState(await disablePush());
      } else {
        try {
          localStorage.setItem("mimic.push.new", "on");
        } catch {}
        setState(await enablePush({ newEntries: true }));
      }
    } catch {
      setState("off");
    }
  };

  return (
    <button type="button" className={on ? styles.btnOn : compact ? styles.btnGhost : styles.btn} onClick={() => void toggle()} disabled={state === "busy"}>
      {state === "busy" ? t("잠깐만요…", "One sec…") : label}
    </button>
  );
}
