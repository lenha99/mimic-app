"use client";

import { useMemo } from "react";
import { Coco } from "@/components/brand/coco";
import { useT } from "@/components/lang";
import { voiceTypeOf } from "@/lib/scorecard";
import { fixesOf, type MatchResult } from "@/lib/script-match";
import type { Analysis } from "@/lib/voice-analysis";
import styles from "./scorecard.module.css";

/**
 * 코코의 심사표 — 녹음 직후 카드.
 *
 *   1) 대본대로 읽었나 — 정확도와 빠뜨림·다르게 읽음·없는 말 수. 어디인지는 위 대본에 형광펜으로만 표시한다
 *   2) 목소리 타입 — 공유용
 *
 * 대본 확인은 받아쓰기(서버) 비용이 들어 버튼을 누를 때, 테이크당 한 번만 한다(결과는 테이크에 남는다).
 * 구절마다 다시 확인하게 하면 사람들은 결국 전체도 다시 확인받는다 — 그래서 고칠 곳은 대본 위 표시로 남기고,
 * 새 테이크를 녹음하는 동안에도 그 표시를 보이게 해서(room.tsx) 매번 확인받지 않아도 고쳐 읽을 수 있게 한다.
 */
export function Scorecard({
  analysis,
  text,
  match,
  heardEmpty,
  checking,
  onCheck,
  onShowScript,
}: {
  analysis: Analysis | null;
  text: string;
  match: MatchResult | null;
  heardEmpty: boolean;
  checking: boolean;
  onCheck: () => void;
  onShowScript: () => void;
}) {
  const L = useT();
  const type = useMemo(() => voiceTypeOf(analysis, L), [analysis, L]);
  const fixes = useMemo(() => (match ? fixesOf(text, match) : []), [match, text]);
  const pct = match ? Math.round(match.accuracy * 100) : null;
  const mood = checking ? "think" : !match ? "idle" : fixes.length === 0 ? "happy" : "think";

  return (
    <section className={styles.card} aria-label={L("코코의 심사표", "Coco's scorecard")}>
      <header className={styles.head}>
        <Coco mood={mood} size={46} />
        <div className={styles.headText}>
          <p className={styles.kicker}>{L("코코의 심사표", "Coco's scorecard")}</p>
          <p className={styles.title}>
            {checking
              ? L("코코가 듣는 중…", "Coco is listening…")
              : !match
                ? L("대본대로 읽었는지 들어 볼게요", "Let me check it against the script")
                : fixes.length === 0
                  ? L("한 글자도 안 틀렸어요", "Word-perfect")
                  : L(`고칠 곳 ${fixes.length}곳`, `${fixes.length} to fix`)}
          </p>
        </div>
        {pct !== null && !checking && <Ring pct={pct} />}
      </header>

      {checking ? (
        <div className={styles.listening} aria-hidden="true">
          {Array.from({ length: 18 }, (_, i) => (
            <i key={i} style={{ animationDelay: `${(i % 6) * 0.12}s` }} />
          ))}
        </div>
      ) : heardEmpty ? (
        <div className={styles.body}>
          <p className={styles.note}>{L("말소리가 잘 안 들렸어요. 마이크 가까이에서 다시 녹음해 볼까요?", "Couldn't make out the words. Try again closer to the mic?")}</p>
        </div>
      ) : !match ? (
        <div className={styles.body}>
          <p className={styles.note}>{L("빠뜨린 말, 다르게 읽은 말을 대본 위에 표시해 드려요.", "I'll mark skipped and changed words right on the script.")}</p>
          <button type="button" className={styles.cta} onClick={onCheck}>
            {L("🦜 코코한테 확인받기", "🦜 Ask Coco to check")}
          </button>
        </div>
      ) : fixes.length === 0 ? (
        <p className={styles.done}>{L("대본 그대로 또박또박 읽었어요 👏", "Every word, exactly as written 👏")}</p>
      ) : (
        <div className={styles.body}>
          <ul className={styles.counts}>
            {match.missed > 0 && <li className={styles.cMissed}>{L(`빠뜨림 ${match.missed}`, `Skipped ${match.missed}`)}</li>}
            {match.changed > 0 && <li className={styles.cChanged}>{L(`다르게 읽음 ${match.changed}`, `Changed ${match.changed}`)}</li>}
            {match.added.length > 0 && <li className={styles.cAdded}>{L(`없는 말 ${match.added.length}`, `Extra ${match.added.length}`)}</li>}
          </ul>
          <p className={styles.note}>
            {L(
              "대본 위에 형광펜으로 표시해 뒀어요. 다음 테이크를 녹음하는 동안에도 표시가 남아 있으니, 보면서 고쳐 읽어 보세요.",
              "They're highlighted on the script — and stay there while you record the next take, so you can fix them as you read.",
            )}
          </p>
          <button type="button" className={styles.ghost} onClick={onShowScript}>
            {L("↑ 대본에서 보기", "↑ See it on the script")}
          </button>
        </div>
      )}

      {type && (
        <div className={styles.type}>
          <small>{L("목소리 타입", "Voice type")}</small>
          <b>{type.name}</b>
          <span>{type.desc}</span>
          <em>{type.why}</em>
        </div>
      )}
    </section>
  );
}

function Ring({ pct }: { pct: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const tone = pct >= 95 ? styles.ringGood : pct >= 80 ? styles.ringMid : styles.ringLow;
  return (
    <div className={`${styles.ring} ${tone}`} aria-label={`${pct}%`}>
      <svg viewBox="0 0 54 54" aria-hidden="true">
        <circle cx="27" cy="27" r={r} className={styles.ringBg} />
        <circle cx="27" cy="27" r={r} className={styles.ringFg} strokeDasharray={`${(c * pct) / 100} ${c}`} />
      </svg>
      <b>{pct}</b>
    </div>
  );
}
