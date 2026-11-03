"use client";

import Link from "next/link";
import { useLang, useT } from "@/components/lang";
import { PushButton } from "@/components/social/push-button";
import { VoiceAvatar } from "@/components/voice-avatar";
import { normalizeAvatar } from "@/lib/avatar";
import { Coco } from "@/components/brand/coco";
import type { EntryCard, Week } from "@/lib/weekly";
import styles from "./home-hero.module.css";

/**
 * 홈 가운데 큰 카드 — 연습실로 들어가는 문. 그 아래 붙은 줄이 목소리 갤러리(이번 주 ❤ 순위)다.
 *
 * 예전엔 "이번 주 보이스 챌린지"가 주인공이고 연습실은 "더 놀거리" 타일 하나였다. 처음 온 사람은
 * 챌린지·갤러리·순위전이 각각 뭔지 몰랐고, 정작 매일 쓸 만한 연습실은 안 보였다. 그래서 흐름을
 * 한 줄로 만든다: 연습실에서 읽는다 → 코코가 짚어 준다 → 마음에 들면 올린다 → ❤ 를 받는다.
 * 이번 주 대본은 "뭘 읽지?"에 대한 추천일 뿐, 어떤 대본으로 올려도 같은 순위다.
 * 숫자는 부풀리지 않는다 — 아무도 없으면 "첫 목소리가 되면 1위로 시작"이라고 솔직하게 말한다.
 */
export function HomeHero({
  week,
  top,
  count,
  line,
  scripts,
  total = 0,
  faces = [],
}: {
  week: Week;
  top: EntryCard[];
  count: number;
  line: string;
  /** 연습실 대본 수 */
  scripts: number;
  /** 지난 주까지 쌓인 목소리 수 — 이번 주가 비어도 들을 게 있다 */
  total?: number;
  faces?: unknown[];
}) {
  const t = useT();
  const lang = useLang();
  return (
    <section className={styles.hero}>
      <div className={styles.glow} aria-hidden="true" />
      <div className={styles.topRow}>
        <span className={styles.kicker}>
          <span className={styles.dot} aria-hidden="true" />
          {t("연습실", "Practice Room")}
        </span>
        <span className={styles.chip}>{t(`대본 ${scripts}편 · 무료`, `${scripts} scripts · free`)}</span>
      </div>

      <div className={styles.headRow}>
        <h1 className={styles.title}>
          {t(
            <>
              읽으면
              <br />
              코코가 짚어 줘요
            </>,
            <>
              Read it.
              <br />
              Coco coaches you.
            </>,
          )}
        </h1>
        <Coco mood="sing" size={84} className={styles.coco} />
      </div>
      {lang === "en" && <p className={styles.enNote}>🇰🇷 Scripts are in Korean — a fun way to practice your Korean out loud</p>}

      <ul className={styles.perks}>
        <li>{t("🖍 틀린 곳 형광펜", "🖍 Mistakes highlighted")}</li>
        <li>{t("🦜 내 목소리 타입", "🦜 Your voice type")}</li>
        <li>{t("🔒 녹음은 내 폰에만", "🔒 Takes stay on your phone")}</li>
      </ul>

      <Link href="/practice" className={styles.go} data-tour="home-practice">
        {t("🎙 연습실 들어가기", "🎙 Open the Practice Room")}
      </Link>

      {/* 뭘 읽을지 모르는 사람을 위한 추천 하나 */}
      <Link href={`/practice/${week.scriptId}?from=weekly`} className={styles.pick}>
        <span className={styles.pickEmoji} aria-hidden="true">
          {week.emoji}
        </span>
        <span className={styles.pickText}>
          <small>{t("이번 주 추천 대본", "This week's pick")}</small>
          <b>{t(week.title, week.titleEn ?? week.title)}</b>
          {line && <span>“{line}”</span>}
        </span>
        <i aria-hidden="true">→</i>
      </Link>

      <Link href="/weekly" className={styles.listen} data-tour="home-weekly">
        <span className={styles.faces}>
          {top.length > 0 ? (
            top.map((e) => <VoiceAvatar key={e.id} avatar={normalizeAvatar(e.avatar)} size={34} />)
          ) : faces.length > 0 ? (
            faces.slice(0, 3).map((a, i) => <VoiceAvatar key={i} avatar={normalizeAvatar(a)} size={34} />)
          ) : (
            <span className={styles.faceEmpty} aria-hidden="true">
              ?
            </span>
          )}
        </span>
        <span className={styles.listenText}>
          <b>{t("목소리 갤러리", "Voice gallery")}</b>
          <small>
            {count > 0
              ? t(`이번 주 ${count}명 올림 · ❤ 많으면 시상대`, `${count} posted this week · most ❤ takes the podium`)
              : total > 0
                ? t(`올라온 목소리 ${total}개 · 이번 주 첫 목소리는 1위로 시작`, `${total} voices · this week's first starts at #1`)
                : t("마음에 드는 테이크를 올리면 ❤ 를 받아요", "Post your best take and collect ❤")}
          </small>
        </span>
        <i aria-hidden="true">→</i>
      </Link>
      <div className={styles.alert}>
        <PushButton kind="new" compact />
      </div>
    </section>
  );
}
