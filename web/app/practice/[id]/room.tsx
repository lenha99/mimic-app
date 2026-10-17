"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { YoutubeClip } from "@/components/youtube-clip";
import { clientId } from "@/lib/client-id";
import type { Meme } from "@/lib/memes";
import {
  ago,
  parseScript,
  pauseMarks,
  PITCH_RANGE,
  syllables,
  TRACK_LABEL,
  type Script,
} from "@/lib/practice";
import { judge, passCount, warnings, type Check, type Target } from "@/lib/practice-feedback";
import { fixesOf, matchScript, type MatchResult } from "@/lib/script-match";
import { deleteTake, listTakes, newTakeId, saveTake, updateTake, type Take } from "@/lib/take-store";
import { track } from "@/lib/track";
import { analyze, analyzeBlob, decodeMono, type Analysis } from "@/lib/voice-analysis";
import styles from "./room.module.css";

/**
 * 연습 화면 — 대본을 펴 놓고 읽고, 녹음하고, 짚어주고, 쌓는다.
 *
 * 녹음 중에도 대본은 그대로 보인다. 읽으면서 녹음하는 게 연습이라 버튼이 대본을
 * 가리면 안 된다 — 녹음 버튼은 바닥에 붙어 있고 화면은 안 바뀐다.
 *
 * 다시 보기가 이 화면의 절반이다. 지난 테이크를 누르면 그때의 진단이 그대로
 * 다시 펼쳐지고, 바로 들어볼 수 있다. "어제보다 나아졌나"가 연습을 계속하게 한다.
 *
 * 마이크는 녹음 버튼을 누를 때만 켠다. 원본을 틀면서 켜두면 폰이 통화 모드로
 * 바뀌어 원본 소리가 죽는다(record/recorder.tsx 맨 위 주석과 같은 이유).
 */

type Nav = { id: string; title: string } | null;

export type RoomItem =
  | { kind: "script"; script: Script; number: number; total: number; prev: Nav; next: Nav }
  | { kind: "line"; meme: Meme; refUrl: string; number: number; total: number; prev: Nav; next: Nav };

type Phase = "ready" | "count" | "recording" | "analyzing";

/** 대본은 1분 넘는 것도 있다. 넘기면 알아서 끊는다 — 마이크를 켜둔 채 잊는 일이 있다. */
const MAX_SCRIPT_MS = 120_000;
/** 명대사는 원본 길이 + 여유. 서버 채점 창과 같은 생각이다. */
const LINE_TAIL_MS = 2_500;
const COUNT_MS = 380;
const SIZE_KEY = "mimic.practice.size";
/** 대본 확인을 매번 자동으로 할지 — 처음 한 번은 직접 누르게 하고, 그때 고른다. */
const CHECK_KEY = "mimic.practice.check";
const MARKS_KEY = "mimic.practice.marks";

type Score = { score: number; grade?: string; breakdown: { pitch: number; tone: number; timing: number } };

export default function Room({ item }: { item: RoomItem }) {
  const itemId = item.kind === "script" ? item.script.id : item.meme.id;
  const text = item.kind === "script" ? item.script.text : (item.meme.line ?? "");
  const syl = syllables(text);

  const [phase, setPhase] = useState<Phase>("ready");
  const [count, setCount] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [takes, setTakes] = useState<Take[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [size, setSize] = useState(1);
  const [marks, setMarks] = useState(true);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [refAnalysis, setRefAnalysis] = useState<Analysis | null>(null);
  const [scoring, setScoring] = useState(false);
  const [checking, setChecking] = useState<string | null>(null);
  const [autoCheck, setAutoCheck] = useState(false);
  /** 대본 위에 확인 결과(빠뜨림·바꿈·덧붙임)를 겹쳐 보일지 */
  const [overlay, setOverlay] = useState(true);

  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const ctx = useRef<AudioContext | null>(null);
  const timers = useRef<number[]>([]);
  const player = useRef<HTMLAudioElement>(null);
  const playerUrl = useRef<string | null>(null);
  const refEl = useRef<HTMLAudioElement>(null);
  const [refSrc, setRefSrc] = useState<string | null>(item.kind === "line" ? item.refUrl : null);
  const resultRef = useRef<HTMLElement>(null);

  // 기기 설정 — 글자 크기, 쉼·강조 표시.
  useEffect(() => {
    try {
      const s = Number(localStorage.getItem(SIZE_KEY));
      const m = localStorage.getItem(MARKS_KEY);
      // 저장해둔 읽기 설정으로 연다.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if ([0, 1, 2].includes(s)) setSize(s);
      if (m === "0") setMarks(false);
      if (localStorage.getItem(CHECK_KEY) === "1") setAutoCheck(true);
    } catch {}
  }, []);

  const refresh = useCallback(async () => {
    const rows = await listTakes(itemId);
    setTakes(rows);
    return rows;
  }, [itemId]);

  useEffect(() => {
    let alive = true;
    void listTakes(itemId).then((rows) => {
      if (!alive) return;
      setTakes(rows);
      setOpenId(rows[0]?.id ?? null);
    });
    track("practice_view", { meme_id: itemId });
    return () => {
      alive = false;
    };
  }, [itemId]);

  // 명대사: 원본을 미리 받아 메모리에서 틀고, 같은 방식으로 재서 기준으로 쓴다.
  useEffect(() => {
    if (item.kind !== "line") return;
    let url: string | null = null;
    let alive = true;
    void fetch(item.refUrl)
      .then((r) => (r.ok ? r.blob() : null))
      .then(async (blob) => {
        if (!blob || !alive) return;
        url = URL.createObjectURL(blob);
        setRefSrc(url);
        try {
          const pcm = await decodeMono(blob);
          const a = await analyze(pcm.data, pcm.rate, syllables(item.meme.line ?? ""));
          if (alive) setRefAnalysis(a);
        } catch {}
      })
      .catch(() => {});
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [item]);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  const releaseMic = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    void ctx.current?.close().catch(() => {});
    ctx.current = null;
  }, []);

  useEffect(
    () => () => {
      clearTimers();
      releaseMic();
      if (playerUrl.current) URL.revokeObjectURL(playerUrl.current);
    },
    [releaseMic],
  );

  const stopAll = useCallback(() => {
    player.current?.pause();
    refEl.current?.pause();
    setPlaying(null);
  }, []);

  const target: Target = useMemo(() => {
    if (item.kind === "script") {
      const s = item.script;
      return { track: s.track, pace: s.pace, pitch: s.pitch, marks: pauseMarks(s.text) };
    }
    // 명대사 — 원본을 같은 자로 잰 값이 기준이다.
    const r = refAnalysis;
    return {
      track: "line",
      pace: r?.pace ? [r.pace * 0.85, r.pace * 1.15] : undefined,
      pitchBand: r?.pitchRange ? [r.pitchRange * 0.7, r.pitchRange * 1.3] : undefined,
    };
  }, [item, refAnalysis]);

  /**
   * 대본 확인 — 녹음을 받아써서 대본과 맞춰본다. 대본 녹음이 서버로 가는 유일한 길이라
   * 사용자가 누를 때(또는 "매번"을 골랐을 때)만 돈다. 지난 테이크에도 누를 수 있다.
   */
  const check = useCallback(
    async (t: Take, always?: boolean) => {
      if (always !== undefined) {
        setAutoCheck(always);
        try {
          localStorage.setItem(CHECK_KEY, always ? "1" : "0");
        } catch {}
      }
      setChecking(t.id);
      setError(null);
      try {
        const body = new FormData();
        body.append("file", t.blob, "recording.webm");
        const res = await fetch(`/api/transcribe?client=${encodeURIComponent(clientId())}`, {
          method: "POST",
          body,
        });
        const data = (await res.json()) as { text?: string; error?: string };
        if (!res.ok || typeof data.text !== "string") {
          setError(data.error ?? "대본 확인이 안 됐어. 잠시 뒤 다시 눌러줄래?");
          return;
        }
        await updateTake(t.id, { transcript: { text: data.text } });
        await refresh();
        setOverlay(true);
      } catch {
        setError("받아쓰기 서버에 못 닿았어. 잠시 뒤 다시 눌러줄래?");
      } finally {
        setChecking(null);
      }
    },
    [refresh],
  );

  const finish = useCallback(
    async (blob: Blob) => {
      setPhase("analyzing");
      let analysis: Analysis | null = null;
      try {
        analysis = await analyzeBlob(blob, syl || null);
      } catch {
        analysis = null;
      }
      const take: Take = { id: newTakeId(), itemId, at: Date.now(), blob, analysis, score: null };
      await saveTake(take);
      await refresh();
      setOpenId(take.id);
      setPhase("ready");
      requestAnimationFrame(() =>
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );

      if (autoCheck) void check(take);

      if (item.kind === "line") {
        setScoring(true);
        try {
          const body = new FormData();
          body.append("file", blob, "recording.webm");
          const res = await fetch(
            `/api/score?meme_id=${encodeURIComponent(itemId)}&client=${encodeURIComponent(clientId())}`,
            { method: "POST", body },
          );
          const data = (await res.json()) as Score & { error?: string };
          if (res.ok && !data.error && data.breakdown) {
            const score = { score: data.score, ...data.breakdown };
            await updateTake(take.id, { score });
            await refresh();
          } else setError(data.error ?? "채점이 안 됐어. 진단은 그대로 볼 수 있어.");
        } catch {
          setError("채점 서버에 못 닿았어. 진단은 그대로 볼 수 있어.");
        } finally {
          setScoring(false);
        }
      }
    },
    [autoCheck, check, item.kind, itemId, refresh, syl],
  );

  const stop = useCallback(() => {
    const rec = recorder.current;
    if (rec && rec.state !== "inactive") rec.stop();
  }, []);

  const start = useCallback(async () => {
    if (phase !== "ready") return;
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("이 브라우저에선 녹음이 안 돼. 크롬이나 사파리로 열어줘.");
      return;
    }
    stopAll();
    setError(null);
    setConfirmDel(null);
    let live: MediaStream;
    try {
      // 측정이 목적이라 자동 음량 보정은 끈다 — 켜두면 "끝 처짐"이 보정돼서 안 보인다.
      live = await navigator.mediaDevices.getUserMedia({
        audio: { autoGainControl: false, noiseSuppression: false, echoCancellation: true },
      });
    } catch {
      setError("마이크를 켜줘야 녹음할 수 있어.");
      return;
    }
    stream.current = live;

    let analyser: AnalyserNode | null = null;
    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctor) {
        const c = new Ctor();
        analyser = c.createAnalyser();
        analyser.fftSize = 1024;
        c.createMediaStreamSource(live).connect(analyser);
        ctx.current = c;
      }
    } catch {
      analyser = null;
    }

    setPhase("count");
    setCount(3);
    timers.current.push(window.setTimeout(() => setCount(2), COUNT_MS));
    timers.current.push(window.setTimeout(() => setCount(1), COUNT_MS * 2));
    timers.current.push(
      window.setTimeout(() => {
        const chunks: Blob[] = [];
        const rec = new MediaRecorder(live);
        recorder.current = rec;
        rec.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };
        rec.onstop = () => {
          clearTimers();
          releaseMic();
          const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
          if (blob.size === 0) {
            setPhase("ready");
            setError("소리가 안 잡혔어. 다시 해볼래?");
            return;
          }
          void finish(blob);
        };
        rec.start();
        track("practice_take", { meme_id: itemId });
        setPhase("recording");

        // 원본 길이를 아직 모르면(메타데이터 전이면 duration 이 NaN) 5초로 본다.
        // NaN 이 섞이면 아래 비교가 영원히 거짓이 돼서 녹음이 안 멈춘다.
        const refSec = [refAnalysis?.duration, refEl.current?.duration].find(
          (v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0,
        );
        const max =
          item.kind === "line" ? Math.max(3000, (refSec ?? 5) * 1000 + LINE_TAIL_MS) : MAX_SCRIPT_MS;
        const t0 = performance.now();
        const buf = new Uint8Array(analyser?.fftSize ?? 1024);
        let smooth = 0;
        const loop = () => {
          if (rec.state === "inactive") return;
          const ms = performance.now() - t0;
          setElapsed(ms);
          if (analyser) {
            analyser.getByteTimeDomainData(buf);
            let s = 0;
            for (let i = 0; i < buf.length; i += 1) {
              const v = (buf[i] - 128) / 128;
              s += v * v;
            }
            const rms = Math.min(1, Math.sqrt(s / buf.length) * 4);
            smooth = smooth * 0.7 + rms * 0.3;
            setLevel(smooth);
          }
          if (ms >= max) rec.stop();
          else requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
      }, COUNT_MS * 3),
    );
  }, [finish, item.kind, itemId, phase, refAnalysis, releaseMic, stopAll]);

  // 스페이스바 — 책상에서 연습할 땐 손이 대본에 있다.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|BUTTON|A)$/.test(el.tagName)) return;
      e.preventDefault();
      if (phase === "ready") void start();
      else if (phase === "recording") stop();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, start, stop]);

  const playTake = (t: Take) => {
    const el = player.current;
    if (!el) return;
    if (playing === t.id) {
      el.pause();
      setPlaying(null);
      return;
    }
    refEl.current?.pause();
    if (playerUrl.current) URL.revokeObjectURL(playerUrl.current);
    playerUrl.current = URL.createObjectURL(t.blob);
    el.src = playerUrl.current;
    el.play()
      .then(() => setPlaying(t.id))
      .catch(() => setPlaying(null));
  };

  const playRef = () => {
    const el = refEl.current;
    if (!el) return;
    if (playing === "ref") {
      el.pause();
      setPlaying(null);
      return;
    }
    player.current?.pause();
    try {
      el.currentTime = 0;
    } catch {}
    el.play()
      .then(() => setPlaying("ref"))
      .catch(() => setError("원본이 재생되지 않았어. 한 번 더 눌러줄래?"));
  };

  const toggleStar = async (t: Take) => {
    await updateTake(t.id, { starred: !t.starred });
    await refresh();
  };

  const remove = async (t: Take) => {
    if (confirmDel !== t.id) {
      setConfirmDel(t.id);
      return;
    }
    if (playing === t.id) stopAll();
    await deleteTake(t.id);
    const rows = await refresh();
    setConfirmDel(null);
    if (openId === t.id) setOpenId(rows[0]?.id ?? null);
  };

  const setReading = (s: number, m: boolean) => {
    setSize(s);
    setMarks(m);
    try {
      localStorage.setItem(SIZE_KEY, String(s));
      localStorage.setItem(MARKS_KEY, m ? "1" : "0");
    } catch {}
  };

  const open = takes.find((t) => t.id === openId) ?? null;
  // 번호는 오래된 것부터 1번 — 지워도 "몇 번째 테이크"가 흔들리지 않게 시각순으로 매긴다.
  const order = useMemo(() => {
    const m = new Map<string, number>();
    [...takes].sort((a, b) => a.at - b.at).forEach((t, i) => m.set(t.id, i + 1));
    return m;
  }, [takes]);
  const match: MatchResult | null = useMemo(
    () => (open?.transcript ? matchScript(text, open.transcript.text) : null),
    [open, text],
  );
  const showMatch = overlay && phase !== "recording" && phase !== "count" ? match : null;
  const before = open ? takes.find((t) => t.at < open.at && t.analysis) ?? null : null;

  const head =
    item.kind === "script"
      ? {
          crumb: `${TRACK_LABEL[item.script.track]} · ${item.script.category}`,
          title: item.script.title,
        }
      : { crumb: `명대사 · ${item.meme.source}`, title: item.meme.title };

  return (
    <main className={`shell ${styles.room}`}>
      <audio ref={player} onEnded={() => setPlaying(null)} onPause={() => setPlaying((p) => (p === "ref" ? p : null))} />
      {item.kind === "line" && refSrc && (
        <audio
          ref={refEl}
          src={refSrc}
          preload="auto"
          onEnded={() => setPlaying(null)}
          onPause={() => setPlaying((p) => (p === "ref" ? null : p))}
        />
      )}

      <nav className={styles.top}>
        <Link href="/practice" className={styles.back}>
          ← 연습실
        </Link>
        <span className={styles.counter}>
          {String(item.number).padStart(2, "0")} / {String(item.total).padStart(2, "0")}
        </span>
      </nav>

      <header className={styles.head}>
        <p className={styles.crumb}>
          {head.crumb}
          {item.kind === "script" && (
            <span className={styles.level} aria-label={`난이도 ${item.script.level}`}>
              {[1, 2, 3].map((i) => (
                <i key={i} className={i <= item.script.level ? styles.dotOn : styles.dot} />
              ))}
            </span>
          )}
        </p>
        <h1 className={styles.title}>{head.title}</h1>
      </header>

      {item.kind === "script" ? (
        <section className={styles.direction}>
          <p className={styles.label}>디렉션</p>
          <p className={styles.directionText}>{item.script.direction}</p>
          <dl className={styles.targets}>
            <div>
              <dt>속도</dt>
              <dd>
                {item.script.pace[0]}–{item.script.pace[1]} 음절/초
              </dd>
            </div>
            <div>
              <dt>억양</dt>
              <dd>
                {{ low: "절제", mid: "보통", high: "크게" }[item.script.pitch]}
                <small>
                  {" "}
                  {PITCH_RANGE[item.script.pitch][0]}–{PITCH_RANGE[item.script.pitch][1]} 반음
                </small>
              </dd>
            </div>
            <div>
              <dt>분량</dt>
              <dd>{syl}음절</dd>
            </div>
          </dl>
        </section>
      ) : (
        <section className={styles.lineRef}>
          {item.meme.youtube && (
            <YoutubeClip
              id={item.meme.youtube.id}
              start={item.meme.youtube.start}
              end={item.meme.youtube.end}
              title={item.meme.title}
            />
          )}
          <p className={styles.privacy}>
            채점하려고 녹음을 잠깐 서버로 보내요. 점수만 내고 바로 지우고, 기록은 이 폰에만 남아요.
          </p>
          <button type="button" className={styles.refBtn} onClick={playRef}>
            {playing === "ref" ? "■ 원본 멈춤" : "▶ 채점 기준 음성 듣기"}
            {refAnalysis && <small>{refAnalysis.span.toFixed(1)}초</small>}
          </button>
        </section>
      )}

      <section className={`${styles.paper} ${styles[`size${size}`]}`} aria-label="대본">
        <div className={styles.paperBar}>
          <span className={styles.paperLabel}>대본</span>
          <div className={styles.paperTools}>
            <button
              type="button"
              onClick={() => setReading(Math.max(0, size - 1), marks)}
              disabled={size === 0}
              aria-label="글자 작게"
            >
              가−
            </button>
            <button
              type="button"
              onClick={() => setReading(Math.min(2, size + 1), marks)}
              disabled={size === 2}
              aria-label="글자 크게"
            >
              가+
            </button>
            {match && (
              <button
                type="button"
                onClick={() => setOverlay((v) => !v)}
                aria-pressed={overlay}
                className={overlay ? styles.toolOn : undefined}
              >
                확인
              </button>
            )}
            {item.kind === "script" && (
              <button
                type="button"
                onClick={() => setReading(size, !marks)}
                aria-pressed={marks}
                className={marks ? styles.toolOn : undefined}
              >
                쉼·강조
              </button>
            )}
          </div>
        </div>
        {showMatch && open && (
          <p className={styles.overlayNote}>
            테이크 #{order.get(open.id)} 확인 결과 · <s>빠뜨림</s>{" "}
            <span className={styles.changedKey}>바꿈</span> <ins>+덧붙임</ins>
          </p>
        )}
        <ScriptText text={text} marks={marks && item.kind === "script"} match={showMatch} />
        {item.kind === "script" && marks && (
          <p className={styles.legend}>
            <span className={styles.pauseMark}>/</span> 쉼 &nbsp; <u>밑줄</u> 강조
          </p>
        )}
        {open?.transcript?.text && (
          <details className={styles.heard}>
            <summary>들린 그대로 보기 · 테이크 #{order.get(open.id)}</summary>
            <p>{open.transcript.text}</p>
          </details>
        )}
      </section>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <section ref={resultRef} className={styles.result} aria-live="polite">
        {phase === "analyzing" && <p className={styles.analyzing}>방금 테이크를 듣는 중…</p>}
        {phase !== "analyzing" && open && (
          <TakeReport
            take={open}
            n={order.get(open.id) ?? 0}
            before={before}
            target={target}
            kind={item.kind}
            scoring={scoring && open.id === takes[0]?.id}
            playing={playing === open.id}
            onPlay={() => playTake(open)}
            onRef={item.kind === "line" ? playRef : undefined}
            refPlaying={playing === "ref"}
            onStar={() => void toggleStar(open)}
            text={text}
            match={match}
            checking={checking === open.id}
            autoCheck={autoCheck}
            onCheck={(always) => void check(open, always)}
          />
        )}
        {phase !== "analyzing" && !open && (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>첫 테이크를 남겨봐</p>
            <p>
              아래 버튼을 누르고 3·2·1 뒤에 읽기 시작하면 돼. 다 읽으면 한 번 더 눌러서 끝내.
              속도·쉼·억양·말끝을 바로 짚어줄게.
            </p>
          </div>
        )}
      </section>

      {takes.length > 0 && (
        <section className={styles.history}>
          <h2 className={styles.historyTitle}>
            내 기록 <span>{takes.length}</span>
          </h2>
          <ol className={styles.takes}>
            {takes.map((t) => (
              <li key={t.id} className={t.id === openId ? styles.takeOn : styles.take}>
                <button
                  type="button"
                  className={styles.takeMain}
                  onClick={() => {
                    setOpenId(t.id);
                    setConfirmDel(null);
                    resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                >
                  <span className={styles.takeNo}>#{order.get(t.id)}</span>
                  <span className={styles.takeWhen}>
                    {ago(t.at)}
                    {t.starred && <i className={styles.star}>★</i>}
                  </span>
                  <span className={styles.takeStat}>{takeLine(t)}</span>
                </button>
                <button
                  type="button"
                  className={styles.iconBtn}
                  onClick={() => playTake(t)}
                  aria-label={playing === t.id ? "정지" : "듣기"}
                >
                  {playing === t.id ? "■" : "▶"}
                </button>
                <button
                  type="button"
                  className={confirmDel === t.id ? styles.delSure : styles.iconBtn}
                  onClick={() => void remove(t)}
                  aria-label="지우기"
                >
                  {confirmDel === t.id ? "지울까?" : "✕"}
                </button>
              </li>
            ))}
          </ol>
          <p className={styles.keepNote}>
            대본마다 최근 12개까지 남아요 · ★ 표시한 건 지워지지 않아요 · 이 폰에만 저장돼요
          </p>
        </section>
      )}

      <nav className={styles.pager}>
        {item.prev ? (
          <Link href={`/practice/${item.prev.id}`} className={styles.pageLink}>
            <small>← 이전</small>
            {item.prev.title}
          </Link>
        ) : (
          <span />
        )}
        {item.next ? (
          <Link href={`/practice/${item.next.id}`} className={`${styles.pageLink} ${styles.pageNext}`}>
            <small>다음 →</small>
            {item.next.title}
          </Link>
        ) : (
          <Link href="/practice" className={`${styles.pageLink} ${styles.pageNext}`}>
            <small>끝</small>
            목차로
          </Link>
        )}
      </nav>

      <div className={styles.dock}>
        {phase === "recording" ? (
          <button type="button" className={styles.recStop} onClick={stop}>
            <span className={styles.meter} style={{ transform: `scaleX(${0.08 + level * 0.92})` }} />
            <span className={styles.recDot} aria-hidden="true" />
            <span className={styles.recTime}>{clock(elapsed)}</span>
            <span>다 읽었으면 탭</span>
          </button>
        ) : (
          <button
            type="button"
            className={styles.rec}
            onClick={() => void start()}
            disabled={phase !== "ready"}
          >
            {phase === "count" ? (
              <span className={styles.countNum}>{count}</span>
            ) : phase === "analyzing" ? (
              "듣는 중…"
            ) : (
              <>
                <span className={styles.recDot} aria-hidden="true" />
                {takes.length ? "한 번 더 읽기" : "녹음하고 읽기"}
              </>
            )}
          </button>
        )}
      </div>
    </main>
  );
}

function ScriptText({
  text,
  marks,
  match,
}: {
  text: string;
  marks: boolean;
  match: MatchResult | null;
}) {
  const paras = useMemo(() => parseScript(text), [text]);

  // 어절 번호는 lib/script-match 의 scriptWords 와 같은 규칙으로 센다(표시를 뺀 공백 단위,
  // 한글·숫자가 있는 조각만). 그래야 확인 결과가 제자리에 붙는다.
  const numbered = useMemo(() => {
    let wi = 0;
    return paras.map((para) =>
      para.map((p) =>
        p.kind === "pause"
          ? p
          : {
              ...p,
              parts: p.text.split(/(\s+)/).map((part) => ({
                part,
                idx: /[가-힣0-9]/.test(part) ? wi++ : -1,
              })),
            },
      ),
    );
  }, [paras]);

  const addedAt = (after: number) =>
    match?.added
      .filter((a) => a.after === after)
      .map((a, k) => (
        <ins key={`a${after}-${k}`} className={styles.added}>
          +{a.text}
        </ins>
      ));

  return (
    <div className={styles.script}>
      {match && addedAt(-1)}
      {numbered.map((para, i) => (
        <p key={i}>
          {para.map((p, j) => {
            if (p.kind === "pause") {
              return marks ? (
                <span key={j} className={styles.pauseMark} aria-hidden="true">
                  {" / "}
                </span>
              ) : (
                <span key={j}> </span>
              );
            }
            const strong = p.strong && marks;
            if (!match) return strong ? <u key={j}>{p.text}</u> : <span key={j}>{p.text}</span>;
            return (
              <span key={j}>
                {p.parts.map(({ part, idx }, k) => {
                  if (idx < 0) return <span key={k}>{part}</span>;
                  const r = match.words[idx];
                  const body = strong ? <u>{part}</u> : part;
                  const word =
                    !r || r.status === "ok" ? (
                      body
                    ) : r.status === "missed" ? (
                      <s className={styles.missed} title="빠뜨림">
                        {body}
                      </s>
                    ) : (
                      <span className={styles.changed} title={`들린 말: ${r.heard ?? ""}`}>
                        {body}
                        {r.heard && <small>{r.heard}</small>}
                      </span>
                    );
                  return (
                    <span key={k}>
                      {word}
                      {addedAt(idx)}
                    </span>
                  );
                })}
              </span>
            );
          })}
        </p>
      ))}
    </div>
  );
}

function TakeReport({
  take,
  n,
  before,
  target,
  kind,
  scoring,
  playing,
  onPlay,
  onRef,
  refPlaying,
  onStar,
  text,
  match,
  checking,
  autoCheck,
  onCheck,
}: {
  take: Take;
  n: number;
  before: Take | null;
  target: Target;
  kind: "script" | "line";
  scoring: boolean;
  playing: boolean;
  onPlay: () => void;
  onRef?: () => void;
  refPlaying: boolean;
  onStar: () => void;
  text: string;
  match: MatchResult | null;
  checking: boolean;
  autoCheck: boolean;
  onCheck: (always?: boolean) => void;
}) {
  const a = take.analysis;
  const checks = a ? judge(a, target) : [];
  const prevChecks = before?.analysis ? judge(before.analysis, target) : [];
  const pass = passCount(checks);
  const warn = a ? warnings(a) : [];

  return (
    <article className={styles.report}>
      <header className={styles.reportHead}>
        <div>
          <p className={styles.label}>
            테이크 #{n} · {ago(take.at)}
          </p>
          {kind === "line" && take.score ? (
            <p className={styles.headline}>
              <b>{take.score.score}</b>점
            </p>
          ) : kind === "line" && scoring ? (
            <p className={styles.headline}>채점 중…</p>
          ) : pass.total > 0 ? (
            <p className={styles.headline}>
              기준 {pass.total}개 중 <b>{pass.ok}개</b>
            </p>
          ) : (
            <p className={styles.headline}>진단할 소리가 부족해</p>
          )}
        </div>
        <div className={styles.reportBtns}>
          <button type="button" className={styles.pill} onClick={onPlay}>
            {playing ? "■ 멈춤" : "▶ 내 테이크"}
          </button>
          {onRef && (
            <button type="button" className={styles.pill} onClick={onRef}>
              {refPlaying ? "■ 멈춤" : "▶ 원본"}
            </button>
          )}
          <button
            type="button"
            className={take.starred ? styles.pillOn : styles.pill}
            onClick={onStar}
            aria-pressed={!!take.starred}
          >
            {take.starred ? "★ 남김" : "☆ 남기기"}
          </button>
        </div>
      </header>

      <ScriptCheck
        text={text}
        match={match}
        heardEmpty={!!take.transcript && !take.transcript.text.trim()}
        checking={checking}
        autoCheck={autoCheck}
        onCheck={onCheck}
      />

      {a && <Wave a={a} />}

      {warn.map((w) => (
        <p key={w} className={styles.warn}>
          {w}
        </p>
      ))}

      {kind === "line" && take.score && (
        <dl className={styles.axes}>
          {(
            [
              ["억양", take.score.pitch, "원본과 높낮이 흐름이 얼마나 같은지"],
              ["타이밍", take.score.timing, "말이 나오고 끊기는 박자"],
              ["음색", take.score.tone, "원 배우 목소리와 닮은 정도 · 연습에선 참고만"],
            ] as const
          ).map(([label, v, hint]) => (
            <div key={label} className={styles.axis}>
              <dt>
                {label} <small>{hint}</small>
              </dt>
              <dd>
                <span className={styles.axisTrack}>
                  <span style={{ width: `${v}%` }} />
                </span>
                <b>{v}</b>
              </dd>
            </div>
          ))}
        </dl>
      )}

      {checks.length > 0 && (
        <ul className={styles.checks}>
          {checks.map((c) => (
            <CheckRow key={c.key} c={c} prev={prevChecks.find((p) => p.key === c.key)} />
          ))}
        </ul>
      )}
    </article>
  );
}

const STATUS_WORD: Record<Check["key"], Record<"ok" | "low" | "high", string>> = {
  pace: { ok: "좋음", low: "느림", high: "빠름" },
  pause: { ok: "좋음", low: "부족", high: "잦음" },
  pitch: { ok: "좋음", low: "평평", high: "과함" },
  end: { ok: "좋음", low: "처짐", high: "좋음" },
};

function CheckRow({ c, prev }: { c: Check; prev?: Check }) {
  const st = c.status === "na" ? "ok" : c.status;
  const delta =
    prev && c.scale && prev.scale ? c.scale.at - prev.scale.at : null;
  return (
    <li className={styles.check}>
      <div className={styles.checkTop}>
        <span className={styles.checkLabel}>{c.label}</span>
        <span className={styles.checkValue}>
          {c.value}
          {delta !== null && Math.abs(delta) >= 0.1 && (
            <small className={styles.delta}>
              지난번 {delta > 0 ? "+" : ""}
              {delta.toFixed(1)}
            </small>
          )}
        </span>
        <span className={st === "ok" ? styles.badgeOk : styles.badgeOff}>{STATUS_WORD[c.key][st]}</span>
      </div>
      {c.scale && <Scale s={c.scale} />}
      <p className={styles.tip}>{c.tip}</p>
    </li>
  );
}

function Scale({ s }: { s: NonNullable<Check["scale"]> }) {
  const pos = (v: number) => `${Math.max(0, Math.min(100, ((v - s.min) / (s.max - s.min)) * 100))}%`;
  return (
    <div className={styles.scale} aria-hidden="true">
      <span
        className={styles.scaleBand}
        style={{ left: pos(s.lo), width: `calc(${pos(s.hi)} - ${pos(s.lo)})` }}
      />
      <span className={styles.scaleAt} style={{ left: pos(s.at) }} />
    </div>
  );
}

function Wave({ a }: { a: Analysis }) {
  return (
    <div className={styles.wave} aria-hidden="true">
      <div className={styles.waveBars}>
        {a.bars.map((v, i) => (
          <span key={i} style={{ height: `${Math.max(6, v * 100)}%` }} />
        ))}
      </div>
      {a.gaps.map(([s, e], i) => (
        <span
          key={i}
          className={styles.waveGap}
          style={{ left: `${s * 100}%`, width: `${Math.max(0.8, (e - s) * 100)}%` }}
        />
      ))}
      <span className={styles.waveLen}>{a.span.toFixed(1)}초</span>
    </div>
  );
}

function takeLine(t: Take): string {
  if (t.score) return `${t.score.score}점`;
  const a = t.analysis;
  if (!a) return "진단 없음";
  const parts = [`${a.span.toFixed(1)}초`];
  if (a.pace) parts.push(`${a.pace.toFixed(1)}음절/초`);
  return parts.join(" · ");
}

function clock(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * 대본 확인 — 결과는 "고칠 곳" 목록으로 준다. 틀린 말과 그 말이 든 구절을 같이 보여서
 * 다음 테이크에 그 구절만 다시 읽으면 되게 한다.
 *
 * 녹음이 서버로 가는 일이라 처음 한 번은 묻는다. 기본 버튼이 "앞으로 자동"이다 —
 * 연습할 때마다 누르게 하면 아무도 안 누른다.
 */
function ScriptCheck({
  text,
  match,
  heardEmpty,
  checking,
  autoCheck,
  onCheck,
}: {
  text: string;
  match: MatchResult | null;
  heardEmpty: boolean;
  checking: boolean;
  autoCheck: boolean;
  onCheck: (always?: boolean) => void;
}) {
  const fixes = useMemo(() => (match ? fixesOf(text, match) : []), [match, text]);

  if (checking) {
    return <p className={styles.checkBusy}>대본이랑 맞춰보는 중… 처음 한 번은 10초쯤 걸려</p>;
  }

  if (heardEmpty) {
    return (
      <div className={styles.scriptCheck}>
        <p className={styles.scriptCheckHead}>말소리를 못 알아들었어</p>
        <p className={styles.checkNote}>마이크 가까이에서 또박또박 다시 읽어볼래?</p>
      </div>
    );
  }

  if (!match) {
    if (autoCheck) {
      return (
        <div className={styles.scriptCheck}>
          <button type="button" className={styles.pill} onClick={() => onCheck()}>
            이 테이크 대본 확인
          </button>
        </div>
      );
    }
    return (
      <div className={styles.scriptCheck}>
        <p className={styles.scriptCheckHead}>대본대로 읽었는지도 볼까?</p>
        <p className={styles.checkNote}>
          빠뜨린 말·바꾼 말을 찾아서 고칠 곳을 알려줘. 테이크를 잠깐 서버로 보내 글자로 바꾸고,
          녹음도 글자도 바로 지워.
        </p>
        <div className={styles.checkBtns}>
          <button type="button" className={styles.pillOn} onClick={() => onCheck(true)}>
            확인하기 · 앞으로 자동
          </button>
          <button type="button" className={styles.textBtn} onClick={() => onCheck()}>
            이번만
          </button>
        </div>
      </div>
    );
  }

  const pct = Math.round(match.accuracy * 100);
  const SHOW = 5;
  return (
    <div className={styles.scriptCheck}>
      <div className={styles.checkTop}>
        <span className={styles.checkLabel}>대본</span>
        <span className={styles.checkValue}>{pct}%</span>
        <span className={fixes.length ? styles.badgeOff : styles.badgeOk}>
          {fixes.length ? `고칠 곳 ${fixes.length}` : "그대로"}
        </span>
      </div>
      {fixes.length === 0 ? (
        <p className={styles.tip}>한 마디도 안 빼고 대본대로 읽었어.</p>
      ) : (
        <ol className={styles.fixes}>
          {fixes.slice(0, SHOW).map((f, k) => (
            <li key={k}>
              <p className={styles.fixWhat}>
                {f.kind === "missed" ? (
                  <>
                    <b>“{f.words}”</b>{josa(f.words, "을", "를")} 빠뜨렸어
                  </>
                ) : f.kind === "changed" ? (
                  <>
                    <b>“{f.words}”</b>{josa(f.words, "이", "가")}{" "}
                    <span className={styles.fixHeard}>“{f.heard}”</span>
                    {josa(f.heard, "으로", "로")} 들렸어
                  </>
                ) : (
                  <>
                    대본에 없는 <span className={styles.fixHeard}>“{f.heard}”</span>
                    {josa(f.heard, "을", "를")} 넣었어
                  </>
                )}
              </p>
              {f.phrase.length > 0 && (
                <p className={styles.fixAgain}>
                  <span>다시</span>
                  <span>
                    {f.phrase.map((w, k) => (
                      <span key={k}>
                        {k > 0 && " "}
                        {w.mark ? <u>{w.text}</u> : w.text}
                      </span>
                    ))}
                  </span>
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
      {fixes.length > SHOW && (
        <p className={styles.checkFine}>나머지 {fixes.length - SHOW}곳은 대본 위에 표시해 뒀어.</p>
      )}
      <p className={styles.checkFine}>
        받아쓰기라 살짝 뭉개진 발음까지는 못 잡아. 빠뜨리거나 바꾼 말을 잡는 용도야.
      </p>
    </div>
  );
}

/** 받침에 맞는 조사. "으로/로"는 ㄹ 받침도 "로"다. 숫자로 끝나면 읽는 소리로 본다. */
function josa(word: string, withFinal: string, without: string): string {
  const last = word.trim().slice(-1);
  const DIGIT_FINAL = { "0": 1, "1": 8, "3": 1, "6": 1, "7": 8, "8": 8 } as Record<string, number>;
  let tail = 0;
  if (/[가-힣]/.test(last)) tail = (last.charCodeAt(0) - 0xac00) % 28;
  else if (last in DIGIT_FINAL) tail = DIGIT_FINAL[last];
  if (!tail) return without;
  if (withFinal === "으로" && tail === 8) return without; // ㄹ 받침
  return withFinal;
}
