"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useT } from "@/components/lang";
import { LineCard } from "@/components/anime/parts";
import { ANIME_LINES } from "@/lib/anime";
import { track } from "@/lib/track";
import s from "@/components/anime/anime.module.css";

/** 애니 명대사 — 대결 배너가 먼저, 혼자 연습은 그 아래 카드 */
export default function AnimeHub() {
  const t = useT();
  useEffect(() => track("anime_view"), []);
  return (
    <main className={`shell ${s.page}`}>
      <Link href="/challenges" className={s.back}>
        ‹ {t("챌린지", "Challenges")}
      </Link>
      <p className={s.kicker}>ANIME LINES · HYPE BATTLE</p>
      <h1 className={s.h1}>
        {t("애니 명대사,", "Anime lines,")} <em>{t("외치면 점수", "shout for points")}</em>
      </h1>
      <p className={s.sub}>
        {t(
          "잘하면 멋지고, 못해도 웃겨요. 원어 그대로 외치면 원본이랑 얼마나 똑같은지로 점수를 매겨요.",
          "Nail it and you look cool, miss and it's hilarious. You are scored on how close you get to the original.",
        )}
      </p>

      <Link href="/anime/duel" className={s.duel}>
        <i>2~8P</i>
        <b>{t("친구랑 대결하기", "Battle your friends")}</b>
        <span>{t("폰 하나로 돌려 가며 외치고 1등을 가려요. 진 사람이 쏘기", "Pass one phone, shout in turns, crown a winner")}</span>
      </Link>

      <ul className={s.grid}>
        {ANIME_LINES.map((l) => (
          <li key={l.id}>
            <Link href={`/anime/${l.id}`}>
              <LineCard line={l} />
            </Link>
          </li>
        ))}
      </ul>
      <p className={s.note} style={{ marginTop: 16, textAlign: "center" }}>
        {t("녹음은 이 폰에서만 재고 어디에도 올라가지 않아요", "Takes are measured on this phone and never uploaded")}
      </p>
    </main>
  );
}
