import Link from "next/link";
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
  return (
    <section className={styles.hero}>
      <div className={styles.glow} aria-hidden="true" />
      <div className={styles.topRow}>
        <span className={styles.kicker}>
          <span className={styles.dot} aria-hidden="true" />
          이번 주 보이스 챌린지
        </span>
        <span className={styles.chip}>{seasonLabel(week)}</span>
      </div>

      <h1 className={styles.title}>
        <span aria-hidden="true">{week.emoji}</span> {week.title}
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
            <small>1등 자리 비어 있음</small>
          </span>
        )}
        <span className={styles.count}>
          <b>{count}</b>명 출전
        </span>
      </div>

      <Countdown to={week.endsAt} opensAt={week.startsAt} compact />

      <Link href="/weekly" className={styles.go}>
        순위 보고 도전하기 <i aria-hidden="true">→</i>
      </Link>
      <p className={styles.note}>매주 월요일 새 대본 · 로그인 없이 출전 · ❤ 많이 받으면 시상대</p>
    </section>
  );
}
