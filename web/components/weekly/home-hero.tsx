"use client";

import Link from "next/link";
import { useLang, useT } from "@/components/lang";
import { VoiceAvatar } from "@/components/voice-avatar";
import { normalizeAvatar } from "@/lib/avatar";
import { seasonLabel, type EntryCard, type Week } from "@/lib/weekly";
import { Countdown } from "./countdown";
import styles from "./home-hero.module.css";

/**
 * 홈 맨 위 — 이번 주 챌린지. 홈은 "뭐부터 하지"에 답하는 곳이고, 지금 답은 이거다.
 *
 * 맨 위 셋(시상대 미리보기)을 보여주는 건 "저 자리에 내가 설 수 있다"를 먼저 보이기
 * 위해서다. 아무도 없으면 빈 1등 자리를 보여준다 — 그것도 초대장이다.
 */
export function HomeHero({ week, top, count }: { week: Week; top: EntryCard[]; count: number }) {
  const t = useT();
  const lang = useLang();
  return (
    <section className={styles.hero}>
      <div className={styles.glow} aria-hidden="true" />
      <div className={styles.topRow}>
        <span className={styles.kicker}>
          <span className={styles.dot} aria-hidden="true" />
          {t("이번 주 보이스 챌린지", "This week's voice challenge")}
        </span>
        <span className={styles.chip}>{seasonLabel(week, lang)}</span>
      </div>

      <h1 className={styles.title}>
        <span aria-hidden="true">{week.emoji}</span> {t(week.title, week.titleEn ?? week.title)}
      </h1>

      <div className={styles.lineup}>
        {top.length > 0 ? (
          top.map((e) => (
            <span key={e.id} className={`${styles.seat} ${e.rank === 1 ? styles.seatFirst : ""}`}>
              <VoiceAvatar avatar={normalizeAvatar(e.avatar)} size={e.rank === 1 ? 64 : 48} />
              <small>
                {["🥇", "🥈", "🥉"][e.rank - 1]} ❤ {e.likes}
              </small>
            </span>
          ))
        ) : (
          <span className={`${styles.seat} ${styles.seatEmpty}`}>
            <b>?</b>
            <small>{t("1등 자리, 아직 주인 없어요", "#1 spot is up for grabs")}</small>
          </span>
        )}
        <span className={styles.count}>
          {t(<><b>{count}</b>명 도전 중</>, <><b>{count}</b> in the running</>)}
        </span>
      </div>

      <Countdown to={week.endsAt} opensAt={week.startsAt} compact />

      <Link href="/weekly" className={styles.go}>
        {t("나도 도전하기", "Jump in")} <i aria-hidden="true">→</i>
      </Link>
      <p className={styles.note}>{t("매주 월요일 새 대본 · 가입 없이 출전 · ❤ 많이 받으면 시상대에 올라요", "New script every Monday · no sign-up · most ❤ takes the podium")}</p>
    </section>
  );
}
