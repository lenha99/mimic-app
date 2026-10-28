"use client";

import { VoiceAvatar } from "@/components/voice-avatar";
import { useT } from "@/components/lang";
import { decodeAvatar } from "@/lib/avatar";
import {
  EXPR_LABEL,
  exprOf,
  PACE_LABEL,
  paceOf,
  REGISTER_LABEL,
  registerOf,
  VOICE_TYPES,
  type CardData,
} from "@/lib/voice-card";
import type { Lang } from "@/lib/i18n";
import styles from "./voice.module.css";

/** 카드 한 장 — 만든 사람 화면과 공유 링크 화면이 같은 걸 그린다. */
export function VoiceCard({ card, readLang, level = 0 }: { card: CardData; readLang: Lang; level?: number }) {
  const t = useT();
  const type = VOICE_TYPES[card.type];
  const reg = REGISTER_LABEL[registerOf(card.hz)];
  const expr = EXPR_LABEL[exprOf(card.st10 / 10)];
  const pace = card.pace10 !== null ? PACE_LABEL[paceOf(card.pace10 / 10, readLang)] : null;
  return (
    <article className={styles.card}>
      <p className={styles.cardKicker}>{t("MIMIC 보이스 카드", "MIMIC voice card")}</p>
      <div className={styles.cardAvatar}>
        <VoiceAvatar avatar={decodeAvatar(card.avatar)} level={level} size={132} />
      </div>
      <p className={styles.cardLead}>{t("내 목소리 유형은", "My voice type is")}</p>
      <h2 className={styles.cardType}>{t(type.ko, type.en)}</h2>
      <ul className={styles.tags}>
        <li>{t(reg[0], reg[1])}</li>
        <li>{t(expr[0], expr[1])}</li>
        {pace && <li>{t(pace[0], pace[1])}</li>}
      </ul>
      <dl className={styles.stats}>
        <div>
          <dt>{t("평균 음높이", "Avg pitch")}</dt>
          <dd>
            {card.hz}
            <small>Hz</small>
          </dd>
        </div>
        <div>
          <dt>{t("억양 폭", "Pitch range")}</dt>
          <dd>
            {(card.st10 / 10).toFixed(1)}
            <small>{t("반음", "st")}</small>
          </dd>
        </div>
        <div>
          <dt>{t("말 속도", "Pace")}</dt>
          <dd>
            {card.pace10 !== null ? (card.pace10 / 10).toFixed(1) : "–"}
            <small>{t("음절/초", "syl/s")}</small>
          </dd>
        </div>
      </dl>
      <p className={styles.role}>
        <span>{t("어울리는 배역", "Cast me as")}</span>
        <b>{t(type.roleKo, type.roleEn)}</b>
      </p>
    </article>
  );
}
