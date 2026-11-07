"use client";

import { useRef, useState, type CSSProperties } from "react";
import { useT } from "@/components/lang";
import type { AnimeLine, HypeScore } from "@/lib/anime";
import type { TakePhase } from "./use-take";
import s from "./anime.module.css";

/** 대사 카드 — 원어 발음을 크게, 뜻을 작게 */
export function LineCard({ line, big }: { line: AnimeLine; big?: boolean }) {
  const t = useT();
  return (
    <div className={`${s.line} ${big ? s.lineBig : ""}`} style={{ "--hue": line.hue } as CSSProperties}>
      <p className={s.lineMeta}>
        <span aria-hidden="true">{line.emoji}</span> {t(line.series, line.seriesEn)}
        {line.who && ` · ${t(line.who, line.whoEn)}`}
      </p>
      <p className={s.say}>{line.say}</p>
      {t(line.ko, line.en) && <p className={s.ko}>{t(line.ko, line.en)}</p>}
      {big && <p className={s.tip}>{t(line.tip, line.tipEn)}</p>}
    </div>
  );
}

/** 녹음 버튼 — 카운트다운 · 소리 막대 · 멈춤 */
export function ShoutButton({
  phase,
  count,
  level,
  onStart,
  onStop,
  label,
}: {
  phase: TakePhase;
  count: number;
  level: number;
  onStart: () => void;
  onStop: () => void;
  label?: string;
}) {
  const t = useT();
  if (phase === "count") {
    return (
      <div className={s.countWrap} aria-live="assertive">
        <span key={count} className={s.count}>
          {count}
        </span>
      </div>
    );
  }
  if (phase === "rec") {
    return (
      <button type="button" className={`${s.shout} ${s.shoutOn}`} onClick={onStop} style={{ "--lv": level } as CSSProperties}>
        <span className={s.meter} aria-hidden="true" />
        <b>{t("외쳐!", "SHOUT!")}</b>
        <small>{t("다 했으면 눌러서 멈추기", "Tap when you're done")}</small>
      </button>
    );
  }
  if (phase === "busy") {
    return (
      <div className={s.shout} aria-live="polite">
        <b>{t("기합 재는 중…", "Measuring…")}</b>
      </div>
    );
  }
  return (
    <button type="button" className={s.shout} onClick={onStart}>
      <b>{label ?? t("🎙 외치기", "🎙 Shout it")}</b>
      <small>{t("3초 세고 녹음이 시작돼요", "Recording starts after 3·2·1")}</small>
    </button>
  );
}

/** 결과 — 총점 · 등급 · 네 칸 · 배지 · 다시 듣기 */
export function ScoreView({ score, url, name }: { score: HypeScore; url?: string; name?: string }) {
  const t = useT();
  const bars = score.bars;
  return (
    <div className={s.score}>
      {name && <p className={s.scoreName}>{name}</p>}
      <p className={s.total}>
        <b>{score.total}</b>
        <small>{t("기합", "HYPE")}</small>
      </p>
      <p className={s.tier}>{t(score.tier.ko, score.tier.en)}</p>
      <p className={s.note}>{t(score.tier.note, score.tier.noteEn)}</p>
      {!score.silent && score.burstMiss && (
        <p className={s.note}>
          {t(
            `원본은 ${score.burstMiss.ref}번 끊어 외치는데 ${score.burstMiss.user}번이었어요 — 박자부터 맞춰 봐요`,
            `The original hits ${score.burstMiss.ref} beats, you hit ${score.burstMiss.user} — match the beats first`,
          )}
        </p>
      )}
      {!score.silent && score.estimate && (
        <p className={s.note}>
          {t("원본 없이 잰 기합 점수예요 (최대 89). 100점은 원본과 견줄 때만 나와요", "Estimated without the original (max 89). 100 only comes from matching the original")}
        </p>
      )}
      {score.badges.length > 0 && (
        <ul className={s.badges}>
          {score.badges.map((b) => (
            <li key={b.ko}>{t(b.ko, b.en)}</li>
          ))}
        </ul>
      )}
      {!score.silent && (
        <ul className={s.bars}>
          {bars.map(([ko, en, v]) => (
            <li key={ko}>
              <span>{t(ko, en)}</span>
              <i>
                <em style={{ width: `${v}%` }} />
              </i>
              <b>{v}</b>
            </li>
          ))}
        </ul>
      )}
      {url && <Replay url={url} />}
    </div>
  );
}

export function Replay({ url, small }: { url: string; small?: boolean }) {
  const t = useT();
  const audio = useRef<HTMLAudioElement | null>(null);
  const [on, setOn] = useState(false);
  const toggle = () => {
    if (!audio.current) {
      audio.current = new Audio(url);
      audio.current.onended = () => setOn(false);
    }
    if (on) {
      audio.current.pause();
      audio.current.currentTime = 0;
      setOn(false);
    } else {
      void audio.current.play();
      setOn(true);
    }
  };
  return (
    <button type="button" className={small ? s.replaySm : s.replay} onClick={toggle}>
      {on ? t("■ 멈춤", "■ Stop") : small ? "▶" : t("▶ 다시 듣기", "▶ Play back")}
    </button>
  );
}

export function MicError({ kind }: { kind: "nomic" | "unsupported" | null }) {
  const t = useT();
  if (!kind) return null;
  return (
    <p className={s.err}>
      {kind === "nomic"
        ? t("마이크를 허용해야 외칠 수 있어요. 주소창 옆 🔒 에서 마이크를 켜 주세요", "Allow the mic to play — tap the lock icon by the address bar")
        : t("이 브라우저는 녹음이 안 돼요. 크롬이나 사파리로 열어 주세요", "This browser can't record. Open in Chrome or Safari")}
    </p>
  );
}
