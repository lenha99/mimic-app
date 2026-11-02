"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLang, useT } from "@/components/lang";
import { expectedSeconds, type Script, type Track } from "@/lib/practice";
import { fieldName, scriptTitle } from "@/lib/script-i18n";
import styles from "./today.module.css";

/**
 * 연습실 맨 위 — "오늘의 연습" 한 편 + 목표별 바로가기.
 *
 * 81편짜리 목록 앞에서 뭘 읽을지 고르다 지친다. 그래서 하루에 한 편을 정해 준다(날짜로 정해서
 * 오늘은 누구에게나 같은 대본 — 내일 오면 바뀐다). 안 읽은 대본이 있으면 그중에서.
 *
 * 목표 칩은 장르가 아니라 "왜 연습하나"로 묶는다 — 실제 준비생은 면접·발음·감정처럼 목표로 찾는다.
 */
export type Goal = { id: string; ko: string; en: string; emoji: string; track: Track; cat: string };

export const GOALS: Goal[] = [
  { id: "interview", emoji: "💼", ko: "면접 준비", en: "Interviews", track: "speech", cat: "면접" },
  { id: "diction", emoji: "👄", ko: "발음 다지기", en: "Diction", track: "anchor", cat: "발음" },
  { id: "emotion", emoji: "🎭", ko: "감정 표현", en: "Emotion", track: "voice", cat: "감정 연기" },
  { id: "present", emoji: "📊", ko: "발표·PT", en: "Presenting", track: "speech", cat: "발표" },
  { id: "news", emoji: "📰", ko: "뉴스 리딩", en: "News reading", track: "anchor", cat: "뉴스" },
  { id: "character", emoji: "🦸", ko: "캐릭터 목소리", en: "Character voices", track: "voice", cat: "캐릭터" },
  { id: "ad", emoji: "📣", ko: "광고·내레이션", en: "Ads & narration", track: "voice", cat: "광고" },
  { id: "events", emoji: "🥂", ko: "행사·축사", en: "Events & toasts", track: "speech", cat: "행사" },
];

const DAY = 86_400_000;
const KST = 9 * 3_600_000;

function hash(n: number): number {
  let h = n | 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return (h ^ (h >>> 16)) >>> 0;
}

/** 오늘(KST)의 대본 — 안 읽은 게 있으면 그중에서, 다 읽었으면 전체에서. */
export function pickToday(scripts: Script[], done: Set<string>, at = Date.now()): Script | null {
  if (!scripts.length) return null;
  const day = Math.floor((at + KST) / DAY);
  const fresh = scripts.filter((s) => !done.has(s.id));
  const pool = fresh.length ? fresh : scripts;
  return pool[hash(day) % pool.length];
}

export function TodayCard({ scripts, done }: { scripts: Script[]; done: Set<string> }) {
  const t = useT();
  const lang = useLang();
  // 날짜는 붙은 뒤에 — 서버와 기기의 "오늘"이 다르면 하이드레이션이 깨진다.
  const [pick, setPick] = useState<Script | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPick(pickToday(scripts, done));
  }, [scripts, done]);

  if (!pick) return <div className={styles.todaySkeleton} aria-hidden="true" />;
  const first = pick.direction.split(/(?<=[.!?。])\s/)[0];
  return (
    <Link href={`/practice/${pick.id}`} className={styles.today} data-tour="practice-start">
      <span className={styles.todayGlow} aria-hidden="true" />
      <span className={styles.todayKicker}>
        <i aria-hidden="true">☀️</i>
        {t("오늘의 연습", "Today's practice")}
        <em>{t(`약 ${Math.round(expectedSeconds(pick))}초`, `~${Math.round(expectedSeconds(pick))}s`)}</em>
      </span>
      <b className={styles.todayTitle}>{scriptTitle(pick.id, pick.title, lang)}</b>
      <span className={styles.todayMeta}>{fieldName(pick.category, lang)}</span>
      {lang === "ko" && <span className={styles.todayDir}>“{first}”</span>}
      <span className={styles.todayGo}>{t("지금 읽기 →", "Read now →")}</span>
    </Link>
  );
}

export function GoalChips({ scripts, onPick }: { scripts: Script[]; onPick: (g: Goal) => void }) {
  const t = useT();
  const lang = useLang();
  const goals = GOALS.filter((g) => scripts.some((s) => s.track === g.track && s.category === g.cat));
  return (
    <section className={styles.goals} aria-label={t("목표로 고르기", "Pick by goal")}>
      <p className={styles.goalsLabel}>{t("무엇을 연습할까요?", "What are you working on?")}</p>
      <div className={styles.goalRail}>
        {goals.map((g) => {
          const n = scripts.filter((s) => s.track === g.track && s.category === g.cat).length;
          return (
            <button key={g.id} type="button" className={styles.goal} onClick={() => onPick(g)}>
              <span aria-hidden="true">{g.emoji}</span>
              <b>{lang === "en" ? g.en : g.ko}</b>
              <small>{t(`${n}편`, `${n}`)}</small>
            </button>
          );
        })}
      </div>
    </section>
  );
}
