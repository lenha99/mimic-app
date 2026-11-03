"use client";

import { useEffect, useState } from "react";
import { useLang, useT } from "@/components/lang";
import { clientId } from "@/lib/client-id";
import { rewardDef, type RewardId } from "@/lib/rewards";
import styles from "./rewards.module.css";

type Data = { earned: RewardId[]; self: boolean; next: { id: RewardId; left: number; unitKo: string; unitEn: string }[] };

/**
 * 보상 선반 — entry 를 주면 그 목소리 주인의 보상(남이 보면 받은 것만, 주인이 보면 다음 목표까지),
 * 없으면 지금 보는 사람 자신의 보상.
 */
export function RewardShelf({ entry, title }: { entry?: string; title?: string }) {
  const t = useT();
  const lang = useLang();
  const [d, setD] = useState<Data | null>(null);

  useEffect(() => {
    let alive = true;
    const q = new URLSearchParams({ client: clientId() });
    if (entry) q.set("entry", entry);
    void fetch(`/api/rewards?${q}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((v: Data | null) => alive && v && setD(v))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [entry]);

  if (!d || (!d.earned.length && !d.self)) return null;
  const name = (id: RewardId) => (lang === "en" ? rewardDef(id).en : rewardDef(id).ko);

  return (
    <section className={styles.shelf} aria-label={t("보상", "Rewards")}>
      <p className={styles.shelfTitle}>{title ?? (d.self ? t("🏅 내 보상", "🏅 My rewards") : t("🏅 받은 보상", "🏅 Rewards"))}</p>
      {d.earned.length > 0 ? (
        <div className={styles.chips}>
          {d.earned.map((id) => (
            <span key={id} className={styles.chip} title={lang === "en" ? rewardDef(id).howEn : rewardDef(id).howKo}>
              {rewardDef(id).icon} {name(id)}
            </span>
          ))}
        </div>
      ) : (
        <p className={styles.shelfTitle} style={{ fontWeight: 600 }}>
          {t("아직 받은 보상이 없어요. 첫 ❤ 부터 시작해요!", "No rewards yet — it starts with your first ❤!")}
        </p>
      )}
      {d.self && d.next.length > 0 && (
        <ul className={styles.goals}>
          {d.next.map((g) => (
            <li key={g.id}>
              {rewardDef(g.id).icon} {name(g.id)}
              {t(
                <>
                  까지 <b>{g.left}{g.unitKo}</b> 남았어요
                </>,
                <>
                  {" "}— <b>{g.left}{g.unitEn}</b> to go
                </>,
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
