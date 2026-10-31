"use client";

import Link from "next/link";
import { useLang, useT } from "@/components/lang";
import { VoiceAvatar } from "@/components/voice-avatar";
import { normalizeAvatar } from "@/lib/avatar";
import { seasonLabel, type EntryCard, type Week } from "@/lib/weekly";
import { Countdown } from "./countdown";
import styles from "./home-hero.module.css";

/**
 * 홈 맨 위 — 이번 주 대본을 녹음해서 올리게 만드는 카드.
 *
 * 사람이 적은 지금 이 앱에 필요한 건 "올리는 사람"이다. 듣는 사람은 올라온 게 있어야 온다.
 * 그래서 순위표보다 먼저 (1) 무엇을 읽는지(대본 첫 줄), (2) 올리면 뭐가 돌아오는지
 * (보정·심사위원 반응), (3) 바로 녹음하는 버튼을 보인다. 숫자는 부풀리지 않는다 —
 * 아무도 없으면 "첫 목소리가 되면 1위로 시작"이라고 솔직하게 말한다.
 */
export function HomeHero({ week, top, count, line }: { week: Week; top: EntryCard[]; count: number; line: string }) {
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

      {line && <p className={styles.line}>“{line}”</p>}

      <ul className={styles.perks}>
        <li>{t("✨ 목소리 자동 보정", "✨ Auto voice polish")}</li>
        <li>{t("😳 심사위원 즉시 반응", "😳 Instant judge reactions")}</li>
        <li>{t("🙈 가입 없이 1분", "🙈 1 min, no sign-up")}</li>
      </ul>

      <Link href={`/practice/${week.scriptId}?from=weekly`} className={styles.go}>
        {t("🎙 녹음하고 올리기", "🎙 Record & enter")}
      </Link>
      <Countdown to={week.endsAt} opensAt={week.startsAt} compact />

      <Link href="/weekly" className={styles.listen}>
        <span className={styles.faces}>
          {top.length > 0 ? (
            top.map((e) => <VoiceAvatar key={e.id} avatar={normalizeAvatar(e.avatar)} size={34} />)
          ) : (
            <span className={styles.faceEmpty} aria-hidden="true">
              ?
            </span>
          )}
        </span>
        <span className={styles.listenText}>
          {count > 0 ? (
            <>
              <b>{t(`올라온 목소리 ${count}개 듣기`, `Hear ${count} voice${count === 1 ? "" : "s"}`)}</b>
              <small>{t("마음에 들면 ❤ 하나", "Tap ❤ on your favorite")}</small>
            </>
          ) : (
            <>
              <b>{t("아직 아무도 안 올렸어요", "No one has entered yet")}</b>
              <small>{t("첫 목소리가 되면 1위로 시작해요", "Be the first voice and start at #1")}</small>
            </>
          )}
        </span>
        <i aria-hidden="true">→</i>
      </Link>
    </section>
  );
}
