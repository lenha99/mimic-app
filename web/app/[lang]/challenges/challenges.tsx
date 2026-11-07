"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ScreenTour } from "@/components/onboarding/tours";
import { TourHelp } from "@/components/onboarding/tour";
import { useLang, useT } from "@/components/lang";
import { memeText } from "@/lib/meme-i18n";
import { LineCard } from "@/components/anime/parts";
import { ANIME_LINES } from "@/lib/anime";
import an from "@/components/anime/anime.module.css";
import styles from "./challenges.module.css";

/**
 * 챌린지 목록 — 명대사 · 친구가 만든 것 · 몸풀기.
 *
 * 홈에선 명대사(옆으로 넘기는 카드)와 동물 소리(타일)가 한 화면에 나란히 있었다.
 * 동물 소리는 실제로 거의 안 했다(30일 4회 vs 명대사 45회). 그래서 고르는 곳을
 * 한 화면으로 모으고, 동물 소리는 "몸풀기" 칩 하나로 접었다.
 */

export type Card = {
  id: string;
  title: string;
  source: string;
  emoji: string;
  line: string | null;
  plays: number | null;
};

type Tab = "lines" | "anime" | "friends" | "warmups";
const TAB_KEY = "mimic.challenges.tab";
const ACCENTS = ["volt", "cyan", "pink", "lime"] as const;

const bare = (s: string) => s.replace(/[\s~!?.,·'"“”‘’]/g, "");

export default function Challenges({
  lines,
  friends,
  warmups,
}: {
  lines: Card[];
  friends: Card[];
  warmups: Card[];
}) {
  const t = useT();
  const lang = useLang();
  const [tab, setTab] = useState<Tab>("lines");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(TAB_KEY);
      // 지난번에 보던 칩으로 연다.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved === "friends" || saved === "warmups" || saved === "anime") setTab(saved);
    } catch {}
  }, []);

  const choose = (next: Tab) => {
    setTab(next);
    try {
      localStorage.setItem(TAB_KEY, next);
    } catch {}
  };

  const tabs: [Tab, string, number][] = [
    ["lines", t("명대사", "Movie lines"), lines.length],
    ["anime", t("애니", "Anime"), ANIME_LINES.length],
  ];
  if (friends.length) tabs.push(["friends", t("친구가 만든", "By friends"), friends.length]);
  tabs.push(["warmups", t("몸풀기", "Warm-ups"), warmups.length]);
  const current = tab === "friends" && !friends.length ? "lines" : tab;
  const list = current === "lines" ? lines : current === "friends" ? friends : warmups;

  return (
    <main className="shell">
      <TourHelp id="challenges" corner />
      <header className={styles.head} data-tour="challenges-head">
        <h1 className={styles.title}>{t("챌린지", "Challenges")}</h1>
        <p className={styles.sub}>
          {t(
            "영화·예능·애니 레전드 대사를 외치면 바로 점수가 나와요. 잘하면 멋지고 못해도 웃겨요 — 점수 찍고 친구랑 붙어 보세요",
            "Shout legendary lines from movies, shows and anime and get scored instantly. Then take on your friends",
          )}
        </p>
        <nav className={styles.links}>
          <Link href="/voice">{t("목소리 음역대 테스트", "Vocal range test")}</Link>
        </nav>
      </header>

      <div className={styles.chips} role="tablist" aria-label={t("챌린지 종류", "Challenge type")} data-tour="challenges-tabs">
        {tabs.map(([key, label, n]) => (
          <button
            key={key}
            role="tab"
            aria-selected={current === key}
            className={current === key ? styles.chipOn : styles.chip}
            onClick={() => choose(key)}
          >
            {label} <span>{n}</span>
          </button>
        ))}
      </div>

      {/* 보고 있는 탭의 대사로 대결한다 — 명대사 탭에서 눌렀는데 애니만 나오던 것(11/7)을 고쳤다 */}
      {(current === "lines" || current === "anime") && (
        <Link href={current === "anime" ? "/anime/duel" : "/duel?pack=movie"} className={an.duel} style={{ margin: "0 0 16px" }}>
          <i>2~8P</i>
          <b>{current === "anime" ? t("친구랑 애니 명대사 대결", "Anime line battle") : t("친구랑 영화 명대사 대결", "Movie line battle")}</b>
          <span>
            {current === "anime"
              ? t("폰 하나로 돌려 가며 원어로 외치고, 원본과 누가 더 똑같은지로 1등을 가려요", "Pass one phone around and see who sounds most like the original")
              : t("「어이가 없네」「드루와」… 폰 하나로 돌려 가며 외치고, 원본과 누가 더 똑같은지로 1등을 가려요", "Pass one phone around and see who sounds most like the original")}
          </span>
        </Link>
      )}

      {current === "anime" ? (
        <>
          <p className={styles.note}>
            {t("원어 그대로 외쳐요. 성량·억양·길이·끝 처리로 기합 점수를 매겨요 🌀", "Shout it in the original. Scored on power, range, timing and ending 🌀")}
          </p>
          <ul className={an.grid} data-tour="challenges-list">
            {ANIME_LINES.map((l) => (
              <li key={l.id}>
                <Link href={`/anime/${l.id}`}>
                  <LineCard line={l} />
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : current === "warmups" ? (
        <>
          <p className={styles.note}>{t("짧고 웃긴 소리로 목부터 풀어요. 채점은 똑같이 해드려요 🐓", "Warm up with short, silly sounds. Same scoring 🐓")}</p>
          <ul className={styles.tiles} data-tour="challenges-list">
            {list.map((m) => (
              <li key={m.id}>
                <Link href={`/record/${m.id}`} className={styles.tile}>
                  <span className={styles.tileFace} aria-hidden="true">
                    {m.emoji}
                  </span>
                  <span className={styles.tileTitle}>{memeText(m, lang).title}</span>
                  <span className={styles.tileMeta}>{memeText(m, lang).source}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <ul className={styles.grid} data-tour="challenges-list">
          {list.map((m, i) => (
            <li key={m.id}>
              <Link
                href={`/record/${m.id}`}
                className={`${styles.card} ${styles[ACCENTS[i % ACCENTS.length]]}`}
              >
                <span className={styles.cardFace} aria-hidden="true">
                  {m.emoji}
                </span>
                <span className={styles.cardTitle}>{memeText(m, lang).title}</span>
                {/* 제목이 곧 대사인 밈("무야호")은 같은 말을 두 번 찍지 않는다. */}
                {m.line && bare(m.line) !== bare(m.title) && (
                  <span className={styles.cardLine}>“{m.line}”</span>
                )}
                <span className={styles.cardFoot}>
                  <span>{memeText(m, lang).source}</span>
                  {m.plays !== null && (
                    <span>{t(`${m.plays.toLocaleString("ko-KR")}명 도전`, `${m.plays.toLocaleString("en-US")} tries`)}</span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Link href="/create" className={styles.create} data-tour="challenges-create">
        <b>{t("내 목소리로 챌린지 만들기", "Make a challenge with your voice")}</b>
        <span>
          {t(
            "자신 있는 성대모사, 5초만 올려 보세요. 이제 내 목소리가 정답 — 다들 따라 하고, 나랑 얼마나 똑같은지 점수를 받아요. 원조를 이겨 볼 사람? →",
            "Got an impression you're proud of? Post 5 seconds. Your voice becomes the answer key — everyone copies it and gets scored on how close they get to you →",
          )}
        </span>
      </Link>
      <ScreenTour id="challenges" />
    </main>
  );
}
