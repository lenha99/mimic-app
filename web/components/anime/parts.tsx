"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useT } from "@/components/lang";
import { Coco } from "@/components/brand/coco";
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
  return (
    <button
      type="button"
      className={s.shout}
      onClick={() => {
        stopOriginal();
        onStart();
      }}
    >
      <b>{label ?? t("🎙 바로 외치기", "🎙 Shout it")}</b>
      <small>{t("3·2·1 세고 녹음이 시작돼요", "Recording starts after 3·2·1")}</small>
    </button>
  );
}

/** 결과 — 총점(0 에서 올라가며 착) · 등급 · 칸 · 배지 · 다시 듣기 */
export function ScoreView({ score, url, name }: { score: HypeScore; url?: string; name?: string }) {
  const t = useT();
  const bars = score.bars;
  const shown = useCountUp(score.total);
  const landed = shown === score.total;
  return (
    <div className={s.score}>
      {name && <p className={s.scoreName}>{name}</p>}
      <p className={`${s.total} ${landed && !score.silent ? s.totalLand : ""}`}>
        <b>{shown}</b>
        <small>{t("점", "PTS")}</small>
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
                <em style={{ width: `${landed ? v : 0}%` }} />
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

/** 점수가 0 에서 올라가며 착 — 0.8초. 움직임 줄이기를 켠 사람은 바로 */
function useCountUp(target: number): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (target <= 0 || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setV(target);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 800);
      setV(Math.round(target * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return v;
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

// 원본은 한 번에 하나만. 녹음 버튼을 누르면 멈춘다 — 원본 소리가 녹음에 섞이면 원본과 닮은 점수가 공짜로 나온다.
let playing: HTMLAudioElement | null = null;
export function stopOriginal() {
  if (playing) {
    playing.pause();
    playing.currentTime = 0;
  }
}

const BARS = 40;

/** 원본 소리를 막대 BARS 개로 — 플레이어 모양용. 실패하면 null(평평한 막대로 그린다) */
async function peaksOf(url: string): Promise<number[] | null> {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    const ctx = new Ctor();
    const buf = await ctx.decodeAudioData(await (await fetch(url)).arrayBuffer());
    void ctx.close().catch(() => {});
    const d = buf.getChannelData(0);
    const out = Array.from({ length: BARS }, (_, i) => {
      const a = Math.floor((i * d.length) / BARS);
      const b = Math.floor(((i + 1) * d.length) / BARS);
      let sum = 0;
      for (let k = a; k < b; k += 1) sum += d[k] * d[k];
      return Math.sqrt(sum / Math.max(1, b - a));
    });
    const max = Math.max(...out, 1e-6);
    return out.map((x) => x / max);
  } catch {
    return null;
  }
}

/**
 * 원본 플레이어 — 대사 카드 바로 아래, 외치기 버튼과 같은 너비로. 예전엔 회색 글씨 옆 ▶ 하나라
 * 듣는 건지 마는 건지 알 수 없었다. 파형이 재생 위치까지 차오르고, 몇 초짜리인지 보인다.
 * 듣기는 선택이다 — 안 들어도 채점은 원본과 견준다(문구로 밝힌다).
 * autoPlay: 이 원본이 처음 준비됐을 때 한 번 틀어 본다. 브라우저가 막으면 조용히 버튼으로 남는다.
 */
export function OriginalPlayer({ url, hue, autoPlay }: { url: string | null | undefined; hue?: number; autoPlay?: boolean }) {
  const t = useT();
  const audio = useRef<HTMLAudioElement | null>(null);
  const [on, setOn] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(0);
  const [peaks, setPeaks] = useState<number[] | null>(null);

  useEffect(() => {
    if (!url) return;
    let alive = true;
    const a = new Audio(url);
    a.preload = "auto";
    audio.current = a;
    let raf = 0;
    const tick = () => {
      setPos(a.duration ? a.currentTime / a.duration : 0);
      raf = requestAnimationFrame(tick);
    };
    a.onloadedmetadata = () => {
      if (alive) setDur(a.duration);
    };
    a.onplay = () => {
      if (playing && playing !== a) {
        playing.pause();
        playing.currentTime = 0;
      }
      playing = a;
      setOn(true);
      raf = requestAnimationFrame(tick);
    };
    a.onpause = () => {
      cancelAnimationFrame(raf);
      setOn(false);
      setPos(0);
    };
    void peaksOf(url).then((p) => {
      if (alive) setPeaks(p);
    });
    // 원본이 바뀔 때만 자동 재생을 본다 — 같은 원본에서 토글을 바꿨다고 다시 틀지 않는다
    if (autoPlay) void a.play().catch(() => {});
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      a.pause();
      if (playing === a) playing = null;
      audio.current = null;
      setOn(false);
      setPos(0);
      setDur(0);
      setPeaks(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  const toggle = () => {
    const a = audio.current;
    if (!a) return;
    if (on) {
      a.pause();
      a.currentTime = 0;
    } else void a.play().catch(() => {});
  };

  const bars: number[] = peaks ?? Array(BARS).fill(0.35);
  return (
    <div className={s.orig} style={{ "--hue": hue ?? 20 } as CSSProperties}>
      <button
        type="button"
        className={`${s.origBtn} ${on ? s.origBtnOn : ""}`}
        onClick={toggle}
        disabled={!url}
        aria-label={on ? t("원본 멈춤", "Stop original") : t("원본 듣기", "Play original")}
      >
        {on ? "■" : "▶"}
      </button>
      <div className={s.origBody}>
        <p className={s.origTitle}>
          <span>
            {url === undefined
              ? t("원본 불러오는 중…", "Loading the original…")
              : url === null
                ? t("원본을 못 불러왔어요", "Couldn't load the original")
                : on
                  ? t("🎧 원본 듣는 중", "🎧 Playing original")
                  : t("🎧 원본 듣기", "🎧 Hear the original")}
          </span>
          {dur > 0 && Number.isFinite(dur) && <small>{dur.toFixed(1)}s</small>}
        </p>
        <div className={s.wave} aria-hidden="true">
          {bars.map((v, i) => (
            <i key={i} className={on && (i + 0.5) / BARS <= pos ? s.waveOn : undefined} style={{ height: `${Math.max(10, v * 100)}%` }} />
          ))}
        </div>
        <p className={s.origHint}>{t("안 들어도 돼요 — 점수는 늘 원본이랑 견줘서 나와요", "Optional — you're always scored against the original")}</p>
      </div>
    </div>
  );
}

/**
 * 채점 기다리는 동안 — 코코가 헤드셋 누르고 듣는다. 내 파형 위로 빛이 훑고 지나간다.
 * 실제 시간은 같아도 멈춘 화면보다 짧게 느껴진다. 6초가 넘으면 서버가 깨어나는 중이라고 밝힌다.
 */
export function Judging({ env, hue }: { env: number[]; hue?: number }) {
  const t = useT();
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setSlow(true), 6000);
    return () => window.clearTimeout(id);
  }, []);
  return (
    <div className={s.judge} style={{ "--hue": hue ?? 20 } as CSSProperties} aria-live="polite">
      <Coco mood="think" size={84} className={s.judgeCoco} />
      <p className={s.judgeText}>{t("코코가 원본이랑 맞춰 듣는 중…", "Coco is checking you against the original…")}</p>
      <div className={`${s.wave} ${s.waveScan}`} aria-hidden="true">
        {env.map((v, i) => (
          <i key={i} style={{ height: `${Math.max(8, v * 100)}%`, animationDelay: `${(i / env.length) * 0.9}s` }} />
        ))}
      </div>
      {slow && <p className={s.note}>{t("채점 서버가 깨어나는 중이에요. 조금만요!", "Waking up the judge — almost there!")}</p>}
    </div>
  );
}

/** 서버 채점이 실패했을 때 — 점수를 지어내지 않는다 */
export function ScoreFail({ url, onRetry, onSkip, skipLabel }: { url?: string; onRetry: () => void; onSkip?: () => void; skipLabel?: string }) {
  const t = useT();
  return (
    <div className={s.score}>
      <Coco mood="idle" size={72} />
      <p className={s.tier}>{t("채점이 안 됐어요", "Couldn't score that")}</p>
      <p className={s.note}>{t("인터넷이 잠깐 끊겼거나 서버가 바빴어요. 한 번만 다시 외쳐 주세요", "Network or server hiccup. Give it one more shout")}</p>
      {url && <Replay url={url} />}
      <div className={s.row} style={{ width: "100%" }}>
        <button type="button" className={`${s.btn} ${onSkip ? "" : s.wide}`} onClick={onRetry}>
          {t("다시 외치기", "Shout again")}
        </button>
        {onSkip && (
          <button type="button" className={s.btnAlt} onClick={onSkip}>
            {skipLabel ?? t("건너뛰기", "Skip")}
          </button>
        )}
      </div>
    </div>
  );
}
