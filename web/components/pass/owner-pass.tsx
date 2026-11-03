"use client";

import Link from "next/link";
import { useLang, useT } from "@/components/lang";
import { LevelPill, PassBadges } from "./look";
import s from "./pass.module.css";
import { usePass } from "./use-pass";

/** 남의 목소리 화면 — 주인의 레벨 · 배지 한 줄. 내 것이면 다음 레벨까지. 누르면 /pass(어떻게 오르는지). */
export function OwnerPass({ entry }: { entry: string }) {
  const t = useT();
  const lang = useLang();
  const v = usePass(entry);
  if (!v) return null;
  const { look, progress, self } = v;
  return (
    <Link href="/pass" className={s.owner}>
      <LevelPill level={look.level} rank={look.rank} />
      <PassBadges badges={look.badges} lang={lang} />
      <small>
        {self
          ? progress.need > 0
            ? t(`다음 레벨까지 ${progress.need} XP ›`, `${progress.need} XP to next ›`)
            : "MAX ›"
          : t("VOICE PASS 란? ›", "What's Voice Pass? ›")}
      </small>
    </Link>
  );
}
