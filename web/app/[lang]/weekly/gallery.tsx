"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useLang, useT } from "@/components/lang";
import { TourHelp } from "@/components/onboarding/tour";
import { ScreenTour } from "@/components/onboarding/tours";
import { TopBar } from "@/components/top-bar";
import { Spotlight, VoiceCard } from "@/components/voices/cards";
import { PlayerProvider } from "@/components/voices/player";
import type { Week } from "@/lib/weekly";
import type { GalleryEntry } from "@/lib/weekly-server";
import styles from "./gallery.module.css";

/**
 * 목소리 갤러리 — 이번 주 출전작이 적을 때(순위전 전)의 챌린지 탭 첫 화면.
 *
 * 순위 · 시상대 · "출전 0명"은 사람이 많아야 의미가 있다. 0~1개일 땐 "아무도 안 하는 앱"
 * 신호가 된다. 그래서 지금은 지난 주 것까지 쌓인 목소리를 "듣는 곳"으로 보여 주고,
 * 이번 주 대본은 올리고 싶게 만드는 카드 하나로 둔다. 출전작이 RANKED_MIN 개 모이면
 * 원래의 순위판(hub)이 돌아온다 — 그 진행도도 숨기지 않고 보여 준다.
 */
type Filter = "new" | "hot" | "week";

export default function Gallery({
  week,
  entries,
  thisWeek,
  rankedMin,
  line,
}: {
  week: Week;
  entries: GalleryEntry[];
  thisWeek: number;
  rankedMin: number;
  line: string;
}) {
  const t = useT();
  const lang = useLang();
  const [filter, setFilter] = useState<Filter>("new");
  const picks = useMemo(() => entries.filter((e) => e.featured), [entries]);
  const shown = useMemo(() => {
    if (filter === "hot") return [...entries].sort((a, b) => b.likes - a.likes || b.plays - a.plays);
    if (filter === "week") return entries.filter((e) => e.week.live);
    return entries;
  }, [entries, filter]);
  const left = Math.max(0, rankedMin - thisWeek);

  const chips: { id: Filter; label: string }[] = [
    { id: "new", label: t("최신", "Latest") },
    { id: "hot", label: t("♥ 인기", "♥ Popular") },
    { id: "week", label: t(`이번 주 ${thisWeek}`, `This week ${thisWeek}`) },
  ];

  return (
    <PlayerProvider>
      <main className={`shell ${styles.page}`}>
        <TopBar
          showLang={false}
          title={
            <span className={styles.brand}>
              <span className={styles.live} aria-hidden="true" />
              VOICES
            </span>
          }
        >
          <Link href="/weekly/hall" className={styles.hall} aria-label={t("명예의 전당", "Hall of Fame")}>
            🏆
          </Link>
          <TourHelp id="voices" short />
        </TopBar>

        <header className={styles.head}>
          <h1>{t("목소리 갤러리", "Voice gallery")}</h1>
          <p>
            {entries.length > 0
              ? t(`지금까지 올라온 목소리 ${entries.length}개 · 얼굴을 누르면 바로 들려요`, `${entries.length} voices so far · tap a face to listen`)
              : t("첫 목소리를 기다리고 있어요", "Waiting for the first voice")}
          </p>
        </header>

        <Spotlight picks={picks} />

        {/* 이번 주 대본 — 올리게 만드는 카드 하나. 순위전까지 남은 개수도 솔직하게. */}
        <section className={styles.prompt} data-tour="voices-prompt">
          <div className={styles.promptTop}>
            <span className={styles.promptEmoji} aria-hidden="true">
              {week.emoji}
            </span>
            <span className={styles.promptText}>
              <small>{t(`이번 주 대본 · ${week.field}`, "This week's script")}</small>
              <b>{t(week.title, week.titleEn)}</b>
            </span>
          </div>
          {line && <p className={styles.promptLine}>“{line}”</p>}
          <Link href={`/practice/${week.scriptId}?from=weekly`} className={styles.promptGo}>
            {t("🎙 녹음하고 올리기", "🎙 Record & post")}
          </Link>
          <p className={styles.promptNote}>{t("✨ 자동 보정 · 😳 심사위원 · ⭐ 홈 추천 소개", "✨ Auto polish · 😳 Judges · ⭐ Get featured")}</p>
          <div className={styles.goal} aria-label={t(`순위전까지 ${left}개 남음`, `${left} more to unlock rankings`)}>
            <div className={styles.goalTrack}>
              <span style={{ width: `${Math.min(100, (thisWeek / rankedMin) * 100)}%` }} />
            </div>
            <small>
              {left > 0
                ? t(`이번 주 목소리 ${thisWeek}/${rankedMin} · ${left}개 더 모이면 ♥ 순위전이 열려요`, `${thisWeek}/${rankedMin} this week · ${left} more unlock the ♥ ranking`)
                : t("순위전이 열렸어요!", "Ranking unlocked!")}
            </small>
          </div>
        </section>

        {entries.length > 0 ? (
          <>
            <nav className={styles.chips} aria-label={t("정렬", "Sort")} data-tour="voices-filter">
              {chips.map((c) => (
                <button key={c.id} type="button" className={filter === c.id ? styles.chipOn : styles.chip} onClick={() => setFilter(c.id)} aria-pressed={filter === c.id}>
                  {c.label}
                </button>
              ))}
            </nav>
            {shown.length > 0 ? (
              <ul className={styles.list} data-tour="voices-list" key={filter}>
                {shown.map((e, i) => (
                  <VoiceCard key={e.id} e={e} index={i} />
                ))}
              </ul>
            ) : (
              <div className={styles.empty}>
                <span aria-hidden="true">🎙</span>
                <b>{t("이번 주엔 아직 아무도 안 올렸어요", "No one has posted this week yet")}</b>
                <p>{t("지금 올리면 이번 주 첫 목소리예요", "Post now and be this week's first voice")}</p>
              </div>
            )}
          </>
        ) : (
          <div className={styles.empty}>
            <span aria-hidden="true">🎙</span>
            <b>{t("첫 목소리의 주인공이 되어 보세요", "Be the very first voice")}</b>
            <p>{t("가입 없이 1분이면 올릴 수 있어요", "No sign-up — it takes a minute")}</p>
          </div>
        )}

        <p className={styles.foot}>
          {lang === "en"
            ? "Scripts are in Korean — a fun way to practice your Korean out loud."
            : "🔒 연습 녹음은 내 폰에만 · 🌐 올린 목소리만 여기에 보여요"}
        </p>

        <ScreenTour id="voices" />
      </main>
    </PlayerProvider>
  );
}
