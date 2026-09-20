"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Meme } from "@/lib/memes";
import styles from "./record.module.css";

/**
 * 원테이크 — 탭 한 번에 원본 재생 → 3·2·1 → 자동 녹음 → 자동 정지 → 채점.
 *
 * 이전 화면은 "원본 듣기" 탭, "녹음 시작" 탭, "정지" 탭으로 세 번을 눌러야
 * 0.7초짜리 소리 하나를 냈다. 조작이 소리보다 길면 밈이 아니라 장비가 된다.
 *
 * 정지 버튼을 없앤 것이 핵심이다. 녹음 창은 원본 길이에서 계산하고, 남은 시간은
 * 줄어드는 링으로만 보여준다. 링은 타이머이면서 동시에 "언제 끝내야 하는지"를
 * 가르치는 코치다 — 타이밍이 점수의 35% 라 이 안내가 곧 점수다.
 */

/** 녹음 창 = 원본 길이 + 여유. 말이 늦게 시작돼도 잘리지 않을 만큼만 준다. */
const TAIL_MS = 800;
const MIN_WINDOW_MS = 1200;
const MAX_WINDOW_MS = 6000;
/** 원본 길이를 못 읽었을 때 쓰는 값. 카탈로그 밈이 대체로 이 언저리다. */
const FALLBACK_REF_MS = 1400;
/** 3 → 2 → 1 한 칸. 짧게 — 기다리게 하는 게 목적이 아니라 준비시키는 게 목적. */
const COUNT_STEP_MS = 320;
/** 채점이 이만큼 넘어가면 그때 "서버 깨우는 중"을 꺼낸다. 처음부터 겁주지 않는다. */
const SLOW_AFTER_MS = 6000;
const LEVEL_BARS = 17;
const RING_R = 112;
const RING_C = 2 * Math.PI * RING_R;

type Score = {
  score: number;
  grade: string;
  breakdown: { pitch: number; tone: number; timing: number };
  waveform?: { ref: number[]; user: number[] };
  error?: string;
};

type Phase =
  | "idle"
  | "arming"
  | "listening"
  | "countdown"
  | "recording"
  | "scoring"
  | "result";

type Props = {
  meme: Meme;
  refUrl: string;
  /** 공유 링크에 실려 온 친구 점수. 넘어야 할 기준이 있으면 화면이 달라진다. */
  beat: number | null;
  next: { id: string; title: string } | null;
};

const GRADE_CLASS: Record<string, string> = {
  SS: styles.gradeTop,
  S: styles.gradeTop,
  A: styles.gradeGood,
  B: styles.gradeMid,
  C: styles.gradeLow,
};

/**
 * 숫자만으로는 웃기지 않는다. 사람이 한마디 해줘야 공유하고 싶어진다.
 * 세 축 중 제일 잘 된 것과 제일 못 된 것을 집어서 말해준다.
 * (억양/음색/타이밍 전부 받침이 있어 조사는 "이"/"은"으로 고정된다.)
 */
function verdict(score: number, bd: Score["breakdown"]): string {
  const axes: [string, number][] = [
    ["억양", bd.pitch],
    ["음색", bd.tone],
    ["타이밍", bd.timing],
  ];
  const sorted = [...axes].sort((a, b) => b[1] - a[1]);
  const best = sorted[0][0];
  const worst = sorted[sorted.length - 1][0];

  if (score >= 90) return "거의 똑같아. 소름.";
  if (score >= 80) return `${best}이 거의 붙었어`;
  if (score >= 70) return `${best}은 좋았는데 ${worst}이 아쉬워`;
  if (score >= 55) return `${worst}만 잡으면 확 올라가`;
  return "원본 한 번 더 듣고 가자";
}

export default function Recorder({ meme, refUrl, beat, next }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [count, setCount] = useState(3);
  const [remain, setRemain] = useState(1);
  const [levels, setLevels] = useState<number[]>(() => new Array(LEVEL_BARS).fill(0));
  const [result, setResult] = useState<Score | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState<"ref" | "user" | null>(null);
  const [userUrl, setUserUrl] = useState<string | null>(null);
  const [refSeconds, setRefSeconds] = useState<number | null>(null);
  const [slow, setSlow] = useState(false);
  const [copied, setCopied] = useState(false);

  const refAudio = useRef<HTMLAudioElement>(null);
  const userAudio = useRef<HTMLAudioElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const timers = useRef<number[]>([]);
  const windowMs = useRef<number>(FALLBACK_REF_MS + TAIL_MS);
  /** rAF 루프와 이벤트 핸들러가 최신 phase 를 봐야 해서 따로 둔다. */
  const phaseRef = useRef<Phase>("idle");
  /** 원본 재생이 끝나 카운트다운으로 넘어갔는지 — onEnded 와 안전망 타이머 중복 방지. */
  const advanced = useRef(false);
  /** 채점 대기 중 원본 다음에 내 소리를 자동으로 한 번 틀었는지. */
  const abPlayed = useRef(false);

  // 렌더 중에 ref 를 쓰면 안 되므로 커밋 후에 맞춘다. rAF 루프와 오디오 이벤트는
  // 둘 다 커밋 이후에 돌기 때문에 이 시점으로 충분하다.
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);

  const releaseMic = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    analyser.current = null;
    void audioCtx.current?.close().catch(() => {});
    audioCtx.current = null;
  }, []);

  // 화면을 떠날 때 마이크를 놓고 blob URL 을 돌려준다.
  useEffect(
    () => () => {
      clearTimers();
      releaseMic();
    },
    [clearTimers, releaseMic],
  );

  useEffect(() => {
    if (!userUrl) return;
    return () => URL.revokeObjectURL(userUrl);
  }, [userUrl]);

  /**
   * 채점 서버 예열. 화면이 열리자마자 한 번 찌른다 — 사용자가 원본을 듣고
   * 3·2·1 을 세는 4~6초 동안 Modal 컨테이너가 깨어난다.
   */
  useEffect(() => {
    void fetch("/api/warm", { method: "POST" }).catch(() => {});
  }, []);

  const submit = useCallback(
    async (blob: Blob) => {
      if (blob.size === 0) {
        setError("소리가 안 잡혔어. 다시 해볼래?");
        setPhase("idle");
        return;
      }

      setUserUrl(URL.createObjectURL(blob));
      setPhase("scoring");
      setSlow(false);
      abPlayed.current = false;
      timers.current.push(window.setTimeout(() => setSlow(true), SLOW_AFTER_MS));

      try {
        const body = new FormData();
        body.append("file", blob, "recording.webm");
        const res = await fetch(
          `/api/score?meme_id=${encodeURIComponent(meme.id)}`,
          { method: "POST", body },
        );
        const data: Score = await res.json();
        if (!res.ok || data.error) {
          setError(data.error ?? "채점이 안 됐어. 다시 해볼래?");
          setPhase("idle");
          return;
        }
        setResult(data);
        setPhase("result");
      } catch {
        setError("네트워크가 끊겼어. 다시 해볼래?");
        setPhase("idle");
      }
    },
    [meme.id],
  );

  const beginRecording = useCallback(() => {
    const live = stream.current;
    if (!live) {
      setError("마이크가 끊겼어. 다시 눌러줘.");
      setPhase("idle");
      return;
    }

    const chunks: Blob[] = [];
    const rec = new MediaRecorder(live);
    recorder.current = rec;
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    rec.onstop = () => {
      clearTimers();
      const blob = new Blob(chunks, { type: rec.mimeType });
      releaseMic();
      void submit(blob);
    };

    // 레벨 미터. 없어도 녹음은 되므로 실패하면 조용히 넘어간다.
    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (Ctor) {
        const ctx = new Ctor();
        const node = ctx.createAnalyser();
        node.fftSize = 1024;
        ctx.createMediaStreamSource(live).connect(node);
        audioCtx.current = ctx;
        analyser.current = node;
      }
    } catch {
      analyser.current = null;
    }

    rec.start();
    setLevels(new Array(LEVEL_BARS).fill(0));
    setRemain(1);
    setPhase("recording");

    timers.current.push(
      window.setTimeout(() => {
        if (rec.state !== "inactive") rec.stop();
      }, windowMs.current),
    );
  }, [clearTimers, releaseMic, submit]);

  const beginCountdown = useCallback(() => {
    if (advanced.current) return;
    advanced.current = true;

    const seconds = refAudio.current?.duration;
    const refMs =
      typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0
        ? seconds * 1000
        : FALLBACK_REF_MS;
    windowMs.current = Math.min(
      MAX_WINDOW_MS,
      Math.max(MIN_WINDOW_MS, Math.round(refMs) + TAIL_MS),
    );

    setPhase("countdown");
    setCount(3);
    timers.current.push(window.setTimeout(() => setCount(2), COUNT_STEP_MS));
    timers.current.push(window.setTimeout(() => setCount(1), COUNT_STEP_MS * 2));
    timers.current.push(window.setTimeout(beginRecording, COUNT_STEP_MS * 3));
  }, [beginRecording]);

  const start = useCallback(async () => {
    setError(null);
    setResult(null);
    setPlaying(null);
    advanced.current = false;
    clearTimers();

    // 인앱 웹뷰는 권한 거부보다 API 자체가 없는 경우가 많다 (/probe 와 같은 이유).
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setError("이 브라우저에선 녹음이 안 돼. 크롬이나 사파리로 열어줘.");
      return;
    }

    setPhase("arming");
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("마이크를 켜줘야 점수가 나와.");
      setPhase("idle");
      return;
    }

    setPhase("listening");
    setRemain(1);
    const el = refAudio.current;
    if (el) {
      el.currentTime = 0;
      try {
        await el.play();
      } catch {
        // 재생이 막히면 듣기를 건너뛰고 바로 카운트다운으로 간다.
        beginCountdown();
        return;
      }
    } else {
      beginCountdown();
      return;
    }

    // onEnded 가 안 오는 경우(길이 미상·디코드 실패)를 대비한 안전망.
    timers.current.push(window.setTimeout(beginCountdown, MAX_WINDOW_MS));
  }, [beginCountdown, clearTimers]);

  // 링 진행도와 레벨 미터. 듣는 중엔 원본 진행도, 녹음 중엔 남은 시간.
  useEffect(() => {
    if (phase !== "listening" && phase !== "recording") return;

    let raf = 0;
    let lastLevel = 0;
    const startedAt = performance.now();
    const buffer = new Uint8Array(analyser.current?.fftSize ?? 1024);

    const loop = (now: number) => {
      if (phaseRef.current === "listening") {
        const el = refAudio.current;
        const d = el?.duration;
        if (el && typeof d === "number" && Number.isFinite(d) && d > 0) {
          setRemain(Math.max(0, 1 - el.currentTime / d));
        }
      } else {
        setRemain(Math.max(0, 1 - (now - startedAt) / windowMs.current));

        const node = analyser.current;
        if (node && now - lastLevel > 42) {
          lastLevel = now;
          node.getByteTimeDomainData(buffer);
          let sum = 0;
          for (let i = 0; i < buffer.length; i += 1) {
            const v = (buffer[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.min(1, Math.sqrt(sum / buffer.length) * 3.4);
          setLevels((prev) => [...prev.slice(1), rms]);
        }
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  const toggle = useCallback(
    (which: "ref" | "user") => {
      const el = which === "ref" ? refAudio.current : userAudio.current;
      const other = which === "ref" ? userAudio.current : refAudio.current;
      other?.pause();
      if (!el) return;
      if (playing === which) {
        el.pause();
        setPlaying(null);
        return;
      }
      el.currentTime = 0;
      el.play()
        .then(() => setPlaying(which))
        .catch(() => setPlaying(null));
    },
    [playing],
  );

  const onRefEnded = useCallback(() => {
    setPlaying(null);
    if (phaseRef.current === "listening") {
      beginCountdown();
      return;
    }
    // 채점을 기다리는 동안 원본 다음에 내 소리를 한 번 이어서 들려준다.
    if (phaseRef.current === "scoring" && !abPlayed.current) {
      abPlayed.current = true;
      toggle("user");
    }
  }, [beginCountdown, toggle]);

  // 채점이 시작되면 비교 재생을 먼저 건다. 막히면 버튼으로 직접 들으면 된다.
  useEffect(() => {
    if (phase !== "scoring" || abPlayed.current) return;
    toggle("ref");
    // toggle 은 playing 에 의존해 매번 새로 만들어지므로 의존성에서 뺀다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const share = useCallback(async () => {
    if (!result) return;
    const url = new URL(window.location.href);
    url.searchParams.set("s", String(result.score));
    const link = url.toString();
    const text = `${meme.title} ${result.score}점 (${result.grade}). 넘어봐.`;

    if (navigator.share) {
      try {
        await navigator.share({ title: "MIMIC", text, url: link });
      } catch {
        // 공유 시트를 닫은 것뿐이다. 복사로 떨어뜨리지 않는다.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${link}`);
      setCopied(true);
      timers.current.push(window.setTimeout(() => setCopied(false), 2400));
    } catch {
      setError("공유가 안 됐어. 주소창 링크를 직접 보내줘.");
    }
  }, [meme.title, result]);

  const ringOffset = RING_C * (1 - remain);
  const busy = phase === "arming" || phase === "listening" || phase === "countdown";

  return (
    <>
      <audio
        ref={refAudio}
        src={refUrl}
        preload="auto"
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) setRefSeconds(d);
        }}
        onPlay={() => setPlaying("ref")}
        onEnded={onRefEnded}
      />
      {userUrl && (
        <audio
          ref={userAudio}
          src={userUrl}
          preload="auto"
          onPlay={() => setPlaying("user")}
          onEnded={() => setPlaying(null)}
        />
      )}

      {beat !== null && phase !== "result" && (
        <div className={styles.challenge}>
          <span className={styles.challengeMark} aria-hidden="true">
            !
          </span>
          <div>
            <p className={styles.challengeTitle}>
              친구가 <strong>{beat}점</strong> 찍고 갔어
            </p>
            <p className={styles.challengeSub}>넘으면 자리 뺏기는 거야</p>
          </div>
        </div>
      )}

      {(phase === "idle" || phase === "arming") && (
        <section className={styles.stage}>
          <p className={styles.kicker}>원본</p>
          <h2 className={styles.hero}>{meme.title}</h2>
          <p className={styles.heroMeta}>
            {meme.source}
            {refSeconds !== null && ` · ${refSeconds.toFixed(1)}초`}
          </p>
        </section>
      )}

      {busy && phase !== "arming" && (
        <section className={styles.stage}>
          <div className={styles.ringWrap}>
            <svg
              className={styles.ring}
              width="256"
              height="256"
              viewBox="0 0 256 256"
              aria-hidden="true"
            >
              <circle
                cx="128"
                cy="128"
                r={RING_R}
                className={styles.ringTrack}
              />
              <circle
                cx="128"
                cy="128"
                r={RING_R}
                className={
                  phase === "listening" ? styles.ringRef : styles.ringUser
                }
                strokeDasharray={RING_C}
                strokeDashoffset={ringOffset}
              />
            </svg>
            {phase === "countdown" ? (
              <span className={styles.count} aria-live="assertive">
                {count}
              </span>
            ) : (
              <span className={styles.ringIcon} aria-hidden="true">
                <svg width="46" height="46" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M3 12h2l2-6 3 14 3-11 2 5h6"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            )}
          </div>
          <h2 className={styles.cue}>
            {phase === "listening" ? "잘 들어" : "준비"}
          </h2>
          <p className={styles.cueSub}>끝나면 바로 녹음 시작</p>
        </section>
      )}

      {phase === "recording" && (
        <section className={styles.stage}>
          <div className={styles.ringWrap}>
            <span className={styles.glow} aria-hidden="true" />
            <svg
              className={styles.ring}
              width="256"
              height="256"
              viewBox="0 0 256 256"
              aria-hidden="true"
            >
              <circle cx="128" cy="128" r={RING_R} className={styles.ringTrack} />
              <circle
                cx="128"
                cy="128"
                r={RING_R}
                className={styles.ringUser}
                strokeDasharray={RING_C}
                strokeDashoffset={ringOffset}
              />
            </svg>
            <div className={styles.meter} aria-hidden="true">
              {levels.map((v, i) => (
                <span
                  key={i}
                  className={styles.meterBar}
                  style={{ height: `${8 + v * 104}px` }}
                />
              ))}
            </div>
          </div>
          <h2 className={styles.cueLoud} aria-live="assertive">
            따라해
          </h2>
          <p className={styles.cueSub}>알아서 끊어줄게</p>
        </section>
      )}

      {phase === "scoring" && (
        <section className={styles.stage} role="status">
          <h2 className={styles.waitTitle}>
            방금 낸 소리
            <br />
            들어볼래?
          </h2>
          <p className={styles.cueSub}>점수는 계산 중이야. 그 사이 비교해봐.</p>
          <div className={styles.compare}>
            <PlayRow
              label="원본"
              tone="ref"
              active={playing === "ref"}
              onClick={() => toggle("ref")}
            />
            <PlayRow
              label="나"
              tone="user"
              active={playing === "user"}
              onClick={() => toggle("user")}
            />
          </div>
          {slow && (
            <p className={styles.slow}>서버 깨우는 중이라 몇 초만 더</p>
          )}
        </section>
      )}

      {error && (
        <p className={styles.error} role="alert">
          {error}{" "}
          <Link href="/probe" className={styles.errorLink}>
            마이크 검사 →
          </Link>
        </p>
      )}

      {phase !== "result" && phase !== "scoring" && (
        <div className={styles.dock}>
          <button className={styles.go} onClick={start} disabled={busy}>
            {phase === "arming" ? "마이크 여는 중…" : "듣고 바로 따라하기"}
          </button>
          <p className={styles.note}>
            탭 한 번이면 원본 → 3·2·1 → 녹음까지 자동
            <br />
            로그인 없이 바로 · 점수만 내고 바로 버려
          </p>
        </div>
      )}

      {phase === "result" && result && (
        <section className={styles.result}>
          <div className={styles.scoreRow}>
            <span className={styles.score}>{result.score}</span>
            <span className={styles.scoreUnit}>점</span>
            <span
              className={`${styles.grade} ${GRADE_CLASS[result.grade] ?? styles.gradeMid}`}
            >
              {result.grade}
            </span>
          </div>

          <p className={styles.verdict}>{verdict(result.score, result.breakdown)}</p>

          {beat !== null && (
            <div className={styles.beat}>
              <p className={styles.beatText}>
                {result.score > beat
                  ? `친구 ${beat}점 넘었어`
                  : `친구 ${beat}점, 아직이야`}
              </p>
              <span
                className={result.score > beat ? styles.beatUp : styles.beatDown}
              >
                {result.score > beat ? "+" : ""}
                {result.score - beat}
              </span>
            </div>
          )}

          <div className={styles.compare}>
            <PlayRow
              label="원본"
              tone="ref"
              active={playing === "ref"}
              onClick={() => toggle("ref")}
            />
            <PlayRow
              label="나"
              tone="user"
              active={playing === "user"}
              onClick={() => toggle("user")}
            />
          </div>

          {result.waveform && (
            <div className={styles.waves}>
              <Wave data={result.waveform.ref} tone="ref" />
              <Wave data={result.waveform.user} tone="user" />
            </div>
          )}

          <dl className={styles.metrics}>
            {(
              [
                ["억양", result.breakdown.pitch],
                ["음색", result.breakdown.tone],
                ["타이밍", result.breakdown.timing],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className={styles.metric}>
                <dt className={styles.metricLabel}>{label}</dt>
                <div className={styles.metricTrack}>
                  <span
                    className={styles.metricFill}
                    style={{ width: `${value}%` }}
                  />
                </div>
                <dd className={styles.metricValue}>{value}</dd>
              </div>
            ))}
          </dl>

          <div className={styles.dock}>
            <button className={styles.go} onClick={share}>
              {copied ? "링크 복사됨" : "친구한테 던지기"}
            </button>
            <div className={styles.secondary}>
              <button className={styles.ghost} onClick={start}>
                다시
              </button>
              {next ? (
                <Link className={styles.ghost} href={`/record/${next.id}`}>
                  {next.title} →
                </Link>
              ) : (
                <Link className={styles.ghost} href="/">
                  다른 소리 →
                </Link>
              )}
            </div>
          </div>
        </section>
      )}
    </>
  );
}

function PlayRow({
  label,
  tone,
  active,
  onClick,
}: {
  label: string;
  tone: "ref" | "user";
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.playRow} ${tone === "ref" ? styles.rowRef : styles.rowUser}`}
      onClick={onClick}
      aria-label={`${label} ${active ? "정지" : "재생"}`}
    >
      <span className={styles.playIcon} aria-hidden="true">
        {active ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </span>
      <span className={styles.playLabel}>{label}</span>
    </button>
  );
}

function Wave({ data, tone }: { data: number[]; tone: "ref" | "user" }) {
  return (
    <div className={styles.wave} aria-hidden="true">
      {data.map((v, i) => (
        <span
          key={i}
          className={tone === "ref" ? styles.barRef : styles.barUser}
          style={{ height: `${Math.max(4, v * 100)}%` }}
        />
      ))}
    </div>
  );
}
