"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/components/lang";
import { disablePush, enablePush, readPrefs, savePrefs, type PushPrefs, type PushState } from "@/lib/push-client";
import styles from "./notify-sheet.module.css";

/**
 * 알림 설정 시트 — 다른 앱들처럼 "어떤 알림을 받을지"를 한 화면에서 한 번에 고른다.
 *
 * 꺼져 있을 때: 종류를 고르고 "알림 받기"를 누르는 순간 브라우저 권한을 한 번 묻는다.
 * 켜져 있을 때: 스위치를 바꾸면 바로 저장되고, 맨 아래에서 전부 끌 수 있다.
 * 밤 11시~아침 8시(KST)엔 보내지 않는다는 것도 여기서 말해 둔다 — 걱정을 미리 덜어 준다.
 */
export function NotifySheet({
  open,
  on,
  onClose,
  onState,
}: {
  open: boolean;
  on: boolean;
  onClose: () => void;
  onState: (s: PushState) => void;
}) {
  const t = useT();
  const [prefs, setPrefs] = useState<PushPrefs>(readPrefs);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", esc);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const rows: { key: keyof PushPrefs; icon: string; title: string; sub: string }[] = [
    {
      key: "newEntries",
      icon: "🎙",
      title: t("새 목소리", "New voices"),
      sub: t("구독한 목소리 · 이번 주 새 출전작 (하루 한 번)", "Voices you follow · new entries (once a day)"),
    },
    {
      key: "mine",
      icon: "🎧",
      title: t("내 목소리 반응", "Reactions to my voice"),
      sub: t("누가 처음 듣거나 구독하면", "When someone listens or subscribes"),
    },
    { key: "dm", icon: "💬", title: t("메시지", "Messages"), sub: t("메시지 · 메시지 요청", "Messages and requests") },
  ];

  const flip = (k: keyof PushPrefs) => {
    const next = { ...prefs, [k]: !prefs[k] };
    setPrefs(next);
    if (on) void savePrefs(next);
  };

  const enable = async () => {
    setBusy(true);
    setError(null);
    try {
      const s = await enablePush(prefs);
      onState(s);
      if (s === "on") onClose();
      else if (s === "denied") setError(t("알림이 차단돼 있어요. 브라우저 설정에서 허용해 주세요.", "Notifications are blocked. Allow them in browser settings."));
    } catch {
      setError(t("알림 연결이 늦어요. 잠시 뒤 다시 눌러 주세요.", "Alerts are slow to connect. Try again in a moment."));
    } finally {
      setBusy(false);
    }
  };

  const off = async () => {
    setBusy(true);
    try {
      onState(await disablePush());
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const none = !prefs.newEntries && !prefs.mine && !prefs.dm;

  return createPortal(
    <div className={styles.backdrop} onClick={onClose} role="presentation">
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-label={t("알림 설정", "Notification settings")} onClick={(e) => e.stopPropagation()}>
        <span className={styles.handle} aria-hidden="true" />
        <div className={styles.bell} aria-hidden="true">
          🔔
        </div>
        <h2 className={styles.title}>{on ? t("알림 설정", "Notifications") : t("어떤 알림을 받을까요?", "What should we tell you about?")}</h2>
        <p className={styles.sub}>{t("언제든 여기서 바꿀 수 있어요", "You can change this anytime")}</p>

        <ul className={styles.rows}>
          {rows.map((r) => (
            <li key={r.key}>
              <button type="button" className={styles.row} onClick={() => flip(r.key)} role="switch" aria-checked={prefs[r.key]}>
                <span className={styles.icon} aria-hidden="true">
                  {r.icon}
                </span>
                <span className={styles.text}>
                  <b>{r.title}</b>
                  <small>{r.sub}</small>
                </span>
                <span className={`${styles.switch} ${prefs[r.key] ? styles.switchOn : ""}`} aria-hidden="true">
                  <i />
                </span>
              </button>
            </li>
          ))}
        </ul>

        <p className={styles.quiet}>{t("🌙 밤 11시~아침 8시엔 보내지 않아요", "🌙 Nothing between 11pm and 8am (KST)")}</p>

        {error && <p className={styles.error}>{error}</p>}

        {on ? (
          <>
            <button type="button" className={styles.primary} onClick={onClose}>
              {t("완료", "Done")}
            </button>
            <button type="button" className={styles.ghost} onClick={() => void off()} disabled={busy}>
              {t("이 기기에서 알림 모두 끄기", "Turn off all alerts on this device")}
            </button>
          </>
        ) : (
          <>
            <button type="button" className={styles.primary} onClick={() => void enable()} disabled={busy || none}>
              {busy ? t("잠깐만요…", "One sec…") : t("알림 받기", "Turn on alerts")}
            </button>
            <button type="button" className={styles.ghost} onClick={onClose}>
              {t("나중에", "Not now")}
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
