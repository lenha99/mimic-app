"use client";

import { VoiceAvatar } from "@/components/voice-avatar";
import { useLang, useT } from "@/components/lang";
import { decodeAvatar } from "@/lib/avatar";
import { AXES, evidence, ROLES, SEAL_FONT_CSS, sliders, verdict, type CardData } from "@/lib/voice-card";
import styles from "./voice.module.css";

/** 붉은 도장 한 글자. 서체는 한자 16자만 잘라 받는다. */
export function Seal({ char, size = 96, stamp = false }: { char: string; size?: number; stamp?: boolean }) {
  return (
    <>
      <link rel="stylesheet" href={SEAL_FONT_CSS} precedence="default" />
      <span
        className={`${styles.seal} ${stamp ? styles.sealStamp : ""}`}
        style={{ width: size, height: size, fontSize: size * 0.62 }}
        aria-hidden="true"
      >
        {char}
      </span>
    </>
  );
}

/** 카드 한 장 — 만든 사람 화면과 공유 링크 화면이 같은 걸 그린다. */
export function VoiceCard({ card, stamp = false }: { card: CardData; stamp?: boolean }) {
  const t = useT();
  const lang = useLang();
  const { role, lean } = verdict(card);
  const pos = sliders(card);
  const why = evidence(card, lang);
  const best = ROLES[role.best];
  const rival = ROLES[role.rival];
  const name = (r: { ko: string; en: string }) => t(r.ko, r.en);
  // 근거 문장은 잰 축만 순서대로 나온다 — 슬라이더도 같은 축만 남긴다.
  const rows = AXES.map((ax, i) => ({ ax, p: pos[i] })).filter((x): x is { ax: (typeof AXES)[number]; p: number } => x.p !== null);
  return (
    <article className={styles.card}>
      <p className={styles.cardKicker}>{t("MIMIC · 목소리 사극 판정", "MIMIC · Voice casting")}</p>
      <div className={styles.cardHero}>
        <VoiceAvatar avatar={decodeAvatar(card.avatar)} level={0.35} size={112} />
        <Seal char={role.seal} size={92} stamp={stamp} />
      </div>
      <p className={styles.cardLead}>{t("내 목소리, 사극에선", "In a period drama, my voice plays")}</p>
      <h2 className={styles.cardType}>{t(`「${role.ko}」 역`, role.en)}</h2>
      {lean && (
        <p className={styles.lean}>
          {t(`${ROLES[lean].ko} 기질 살짝`, `with a hint of ${ROLES[lean].en}`)}
        </p>
      )}
      <p className={styles.why}>{t(role.whyKo, role.whyEn)}</p>

      <ul className={styles.axes}>
        {rows.map(({ ax, p }, i) => {
          const labels = lang === "en" ? ax.en : ax.ko;
          const line = why[i];
          return (
            <li key={i}>
              <div className={styles.axisRow}>
                <span className={p < 0.5 ? styles.axisOn : undefined}>{labels[0]}</span>
                <span className={styles.track}>
                  <i style={{ left: `${p * 100}%` }} />
                </span>
                <span className={p >= 0.5 ? styles.axisOn : undefined}>{labels[1]}</span>
              </div>
              <small>{line}</small>
            </li>
          );
        })}
      </ul>

      <blockquote className={styles.quote}>
        <small>{t("어울리는 대사", "Your line")}</small>“{t(role.lineKo, role.lineEn)}”
      </blockquote>

      <div className={styles.pairs}>
        <p>
          <small>{t("찰떡 궁합", "Best match")}</small>
          <b>
            <span className={styles.miniSeal}>{best.seal}</span>
            {name(best)}
          </b>
        </p>
        <p>
          <small>{t("만나면 싸움", "Arch rival")}</small>
          <b>
            <span className={`${styles.miniSeal} ${styles.miniRival}`}>{rival.seal}</span>
            {name(rival)}
          </b>
        </p>
      </div>
    </article>
  );
}
