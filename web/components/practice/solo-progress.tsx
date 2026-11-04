"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useT } from "@/components/lang";
import { clientId } from "@/lib/client-id";
import { VOICE_TYPE_IDS, VOICE_TYPES } from "@/lib/scorecard";
import styles from "./solo-progress.module.css";

/**
 * 연습 녹음 한 번마다 — 혼자 하는 XP · 🔥 연속 기록 · 도감 새 칸.
 *
 * 11/4: XP 가 ❤·구독(남)으로만 쌓여서 사람이 없는 지금은 다들 Lv 1 이었다. 혼자 해도 "아주 조금" 오른다.
 * 로그인은 처음에 막지 않는다 — 잃기 싫은 게 생긴 순간(🔥 2일째 · 도감 3칸)에만 한 번씩 권한다.
 */
export type SoloResult = {
  xp: number;
  firstToday: boolean;
  streak: number;
  newType: boolean;
  type: string | null;
  dex: number;
  loggedIn: boolean;
};

export async function reportTake(typeId: string | null | undefined): Promise<SoloResult | null> {
  try {
    const res = await fetch("/api/pass/activity", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ client: clientId(), type: typeId ?? null }),
    });
    return res.ok ? ((await res.json()) as SoloResult) : null;
  } catch {
    return null;
  }
}

const ASKED = "mimic.loginAsk";

/** 이 단계에서 로그인을 권한 적이 있나 — 단계마다 한 번만. */
function askOnce(key: string): boolean {
  try {
    const seen = new Set(JSON.parse(localStorage.getItem(ASKED) ?? "[]") as string[]);
    if (seen.has(key)) return false;
    seen.add(key);
    localStorage.setItem(ASKED, JSON.stringify([...seen]));
    return true;
  } catch {
    return false;
  }
}

export function SoloToast({ r, next }: { r: SoloResult; next: string }) {
  const t = useT();
  const [open, setOpen] = useState(true);
  const [ask] = useState(() => {
    if (r.loggedIn) return null;
    if (r.streak >= 2 && askOnce(`streak${Math.min(r.streak, 7)}`)) return "streak" as const;
    if (r.dex >= 3 && r.newType && askOnce("dex3")) return "dex" as const;
    return null;
  });
  useEffect(() => {
    const ms = ask ? 9000 : 4200;
    const id = window.setTimeout(() => setOpen(false), ms);
    return () => window.clearTimeout(id);
  }, [ask]);
  if (!open || (r.xp <= 0 && !r.newType && !ask)) return null;
  const type = r.type ? VOICE_TYPES.find((v) => v.id === r.type) : null;

  return (
    <div className={styles.toast} role="status">
      <div className={styles.row}>
        {r.xp > 0 && <b className={styles.xp}>+{r.xp} XP</b>}
        {r.streak > 0 && (
          <span className={styles.streak}>
            🔥 {t(`${r.streak}일째`, `${r.streak}-day streak`)}
            {r.firstToday && r.streak > 1 ? t(" 이어짐!", " kept!") : ""}
          </span>
        )}
      </div>
      {r.newType && type && (
        <p className={styles.dex}>
          {t(<>📖 도감 새 칸 — <b>{type.ko}</b></>, <>📖 New in your dex — <b>{type.en}</b></>)}{" "}
          <small>
            {r.dex}/{VOICE_TYPE_IDS.length}
          </small>
        </p>
      )}
      {ask && (
        <Link href={`/login?next=${encodeURIComponent(next)}`} className={styles.ask}>
          {ask === "streak"
            ? t(`🔥 ${r.streak}일 기록, 폰 바꿔도 남게 로그인 →`, `Keep your ${r.streak}-day streak on any phone — log in →`)
            : t("📖 모은 도감 안 날아가게 로그인 →", "Keep your dex safe — log in →")}
        </Link>
      )}
      <button type="button" className={styles.close} onClick={() => setOpen(false)} aria-label={t("닫기", "Close")}>
        ×
      </button>
    </div>
  );
}
