"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Coco } from "@/components/brand/coco";
import { currentWeek, type Week } from "@/lib/weekly";
import styles from "./weekly.module.css";
import { useT } from "@/components/lang";

/**
 * 연습실 목차 맨 위 — "올리기" 안내와 이번 주 추천 대본.
 *
 * 목소리 갤러리의 ❤ 순위는 대본과 상관없다(lib/weekly-server weekRows). 그래서 "+ 내 목소리"(홈 스토리)는
 * 특정 대본이 아니라 연습실로 온다(?post=1) — 그때는 "아무 대본이나 골라도 된다"는 안내를 크게 보인다.
 * 평소엔 뭘 읽을지 모르는 사람을 위한 추천 대본 한 줄만.
 */
export function PracticeStrip() {
  const t = useT();
  const [state, setState] = useState<{ week: Week; post: boolean } | null>(null);
  useEffect(() => {
    // 정적 페이지 — 지금이 어느 주인지, 어디서 왔는지는 붙은 뒤에 안다.
    const post = new URLSearchParams(location.search).get("post") === "1";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ week: currentWeek(), post });
  }, []);
  if (!state) return null;
  const { week, post } = state;

  const pick = (
    <Link href={`/practice/${week.scriptId}?from=weekly`} className={styles.strip}>
      <span className={styles.stripIcon} aria-hidden="true">
        {week.emoji}
      </span>
      <span className={styles.stripText}>
        <small>{t("이번 주 추천 대본", "This week's pick")}</small>
        <b>{t(week.title, week.titleEn)}</b>
      </span>
      <span className={styles.stripGo}>{t("이걸로 →", "Use this →")}</span>
    </Link>
  );

  if (!post) return pick;
  return (
    <section className={styles.postGuide} aria-label={t("목소리 올리는 법", "How to post your voice")}>
      <div className={styles.postHead}>
        <Coco mood="happy" size={52} />
        <div>
          <p className={styles.postTitle}>{t("아무 대본이나 골라도 돼요!", "Pick any script you like!")}</p>
          <p className={styles.postSub}>
            {t("어떤 대본으로 올려도 이번 주 ❤ 순위에 똑같이 들어가요.", "Whatever you read, it joins this week's ❤ ranking.")}
          </p>
        </div>
      </div>
      <ol className={styles.postSteps}>
        <li>{t("아래에서 마음에 드는 대본 고르기", "Choose a script below")}</li>
        <li>{t("녹음하면 코코가 대본대로 읽었는지 짚어 줘요", "Record — Coco checks it against the script")}</li>
        <li>{t("잘 나온 테이크를 「목소리 갤러리에 올리기」", "Post your best take to the voice gallery")}</li>
      </ol>
      <p className={styles.postOr}>{t("고르기 어렵다면", "Can't decide?")}</p>
      {pick}
    </section>
  );
}
