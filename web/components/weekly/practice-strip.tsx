"use client";

import { useEffect, useState } from "react";
import { Coco } from "@/components/brand/coco";
import styles from "./weekly.module.css";
import { useT } from "@/components/lang";

/**
 * 연습실 목차 맨 위 — 홈 스토리 "+ 내 목소리"로 왔을 때(?post=1)만 보이는 올리기 안내.
 *
 * 목소리 갤러리의 ❤ 순위는 대본과 상관없다(lib/weekly-server weekRows). 그래서 "+ 내 목소리"는 특정 대본이
 * 아니라 연습실로 오고, 여기서 "아무 대본이나 골라도 된다"고 알려 준다. 뭘 읽을지는 바로 아래 "오늘의 연습"이
 * 추천한다 — 예전엔 "이번 주 추천 대본" 띠도 같이 있어 추천이 두 개였다.
 */
export function PracticeStrip() {
  const t = useT();
  const [post, setPost] = useState(false);
  useEffect(() => {
    // 정적 페이지 — 어디서 왔는지는 붙은 뒤에 안다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPost(new URLSearchParams(location.search).get("post") === "1");
  }, []);
  if (!post) return null;
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
        <li>{t("아래에서 마음에 드는 대본 고르기 — 고민되면 「오늘의 연습」", "Choose a script below — or just take Today's practice")}</li>
        <li>{t("녹음하면 코코가 대본대로 읽었는지 짚어 줘요", "Record — Coco checks it against the script")}</li>
        <li>{t("잘 나온 테이크 아래 「이 목소리 들려주기」 한 번", "One tap on \"Let people hear this\" under your take")}</li>
      </ol>
    </section>
  );
}
