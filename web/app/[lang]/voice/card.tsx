"use client";

import { Piano } from "@/components/piano";
import { VoiceAvatar } from "@/components/voice-avatar";
import { useLang, useT } from "@/components/lang";
import { decodeAvatar } from "@/lib/avatar";
import { noteName, summary, type RangeCard } from "@/lib/voice-range";
import styles from "./voice.module.css";

export type Step = "speak" | "low" | "high";

/**
 * 카드 한 장 — 만든 사람 화면과 공유 링크 화면이 같은 걸 그린다.
 * 아직 안 잰 칸은 onChallenge 가 있으면(만든 사람 화면) "도전" 버튼, 없으면 비워 둔다.
 */
export function RangeCardView({ card, onChallenge }: { card: RangeCard; onChallenge?: (s: Step) => void }) {
  const t = useT();
  const lang = useLang();
  const s = summary(card, lang);
  const tiles: { step: Step; label: string; value: number | null }[] = [
    { step: "low", label: t("최저음", "Lowest"), value: card.low },
    { step: "speak", label: t("평소 목소리", "Speaking"), value: card.speak },
    { step: "high", label: t("최고음", "Highest"), value: card.high },
  ];
  return (
    <article className={styles.card}>
      <p className={styles.cardKicker}>{t("MIMIC · 목소리 음역대", "MIMIC · Vocal range")}</p>
      <div className={styles.cardTop}>
        <VoiceAvatar avatar={decodeAvatar(card.avatar)} level={0.35} size={84} />
        <div>
          <p className={styles.cardLead}>{s.lead}</p>
          <h2 className={styles.cardHead}>{s.headline}</h2>
          {s.sub && <p className={styles.cardSub}>{s.sub}</p>}
        </div>
      </div>

      <div className={styles.piano}>
        <Piano low={card.low} high={card.high} speak={card.speak} lang={lang} />
      </div>

      <div className={styles.tiles}>
        {tiles.map(({ step, label, value }) => {
          const n = value === null ? null : noteName(value, lang);
          return (
            <div key={step} className={`${styles.tile} ${step === "speak" ? styles.tileSpeak : ""}`}>
              <small>{label}</small>
              {n ? (
                <b>
                  <span>{n.octave}</span>
                  {n.note}
                </b>
              ) : onChallenge ? (
                <button type="button" onClick={() => onChallenge(step)}>
                  {t("재기 →", "Measure →")}
                </button>
              ) : (
                <b className={styles.tileEmpty}>—</b>
              )}
            </div>
          );
        })}
      </div>

      {s.facts.length > 0 && (
        <ul className={styles.facts}>
          {s.facts.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      )}

      {s.instrument && (
        <div className={styles.inst}>
          <span className={styles.instEmoji} aria-hidden="true">
            {s.instrument.emoji}
          </span>
          <p>
            <small>{t("내 목소리를 악기로 치면", "If my voice were an instrument")}</small>
            <b>{t(s.instrument.ko, s.instrument.en)}</b>
            <span>{t(s.instrument.whyKo, s.instrument.whyEn)}</span>
          </p>
        </div>
      )}
    </article>
  );
}
