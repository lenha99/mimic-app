"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QuickFeedback } from "@/components/quick-feedback";
import { YoutubeClip } from "@/components/youtube-clip";
import { clientId } from "@/lib/client-id";
import type { Meme } from "@/lib/memes";
import { ago, parseScript, pauseMarks, PITCH_RANGE, syllables, trackLabel, type Script } from "@/lib/practice";
import { useLang, useT } from "@/components/lang";
import { localError, type T } from "@/lib/i18n";
import { memeText } from "@/lib/meme-i18n";
import { fieldName, scriptTitle } from "@/lib/script-i18n";
import { judge, passCount, warnings, type Check, type Target } from "@/lib/practice-feedback";
import { matchScript, type MatchResult } from "@/lib/script-match";
import { transcribe } from "@/lib/transcribe-client";
import { deleteTake, listTakes, newTakeId, saveTake, updateTake, type Take } from "@/lib/take-store";
import { track } from "@/lib/track";
import { Scorecard } from "@/components/practice/scorecard";
import { analyze, analyzeBlob, decodeMono, type Analysis } from "@/lib/voice-analysis";
import { WeeklyBanner, WeeklyEnter } from "./weekly-enter";
import { reportTake, SoloToast, type SoloResult } from "@/components/practice/solo-progress";
import { voiceTypeOf } from "@/lib/scorecard";
import { Tip } from "@/components/onboarding/tip";
import { PrivacyTag } from "@/components/privacy-tag";
import { readMine } from "@/lib/weekly";
import { ScreenTour } from "@/components/onboarding/tours";
import { TourHelp } from "@/components/onboarding/tour";
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
  | {
      kind: "script";
      script: Script;
      number: number;
      total: number;
      prev: Nav;
      next: Nav;
      /** 내 대본만 — 고치기 화면 주소 */
      editHref?: string;
    }
  | {
      kind: "line";
      meme: Meme;
      refUrl: string;
      number: number;
      total: number;
      prev: Nav;
      next: Nav;
    };

type Phase = "ready" | "count" | "recording" | "analyzing";

/** 대본은 1분 넘는 것도 있다. 넘기면 알아서 끊는다 — 마이크를 켜둔 채 잊는 일이 있다. */
const MAX_SCRIPT_MS = 120_000;
/** 명대사는 원본 길이 + 여유. 서버 채점 창과 같은 생각이다. */
const LINE_TAIL_MS = 2_500;
const COUNT_MS = 380;
const SIZE_KEY = "mimic.practice.size";
/** 대본 확인을 매번 자동으로 할지 — 처음 한 번은 직접 누르게 하고, 그때 고른다. */
const MARKS_KEY = "mimic.practice.marks";

type Score = {
  score: number;
  grade?: string;
  breakdown: { pitch: number; tone: number; timing: number };
};

export default function Room({ item }: { item: RoomItem }) {
  // 이 파일은 `t` 가 테이크(Take)라서 번역 함수는 L 로 부른다.
  const L = useT();
  const lang = useLang();
  const itemId = item.kind === "script" ? item.script.id : item.meme.id;
  const text = item.kind === "script" ? item.script.text : (item.meme.line ?? "");
  const syl = syllables(text);

  const [phase, setPhase] = useState<Phase>("ready");
  const [count, setCount] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  // 일시정지 — 녹음기를 멈췄다가 이어 붙인다. 멈춘 시간은 녹음 길이·상한에 안 센다.
  const [paused, setPaused] = useState(false);
  const pausedAt = useRef<number | null>(null);
  const pausedTotal = useRef(0);
  // 녹음은 브라우저에서만 일어나니 서버 렌더 값과 어긋날 일이 없다
  const [canPause] = useState(() => typeof MediaRecorder !== "undefined" && typeof MediaRecorder.prototype.pause === "function");
  const [takes, setTakes] = useState<Take[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [solo, setSolo] = useState<{ r: SoloResult; key: string } | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [size, setSize] = useState(1);
  const [marks, setMarks] = useState(true);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [refAnalysis, setRefAnalysis] = useState<Analysis | null>(null);
  const [scoring, setScoring] = useState(false);
  const [checking, setChecking] = useState<string | null>(null);
  /** 대본 위에 확인 결과(빠뜨림·바꿈·덧붙임)를 겹쳐 보일지 */
  const [overlay, setOverlay] = useState(true);

  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const ctx = useRef<AudioContext | null>(null);
  const timers = useRef<number[]>([]);
  // 중단 — 이번 테이크는 버린다(결과 화면 없이). restart 면 버리고 바로 다시 센다.
  const discard = useRef(false);
  const restart = useRef(false);
  const player = useRef<HTMLAudioElement>(null);
  const playerUrl = useRef<string | null>(null);
  const refEl = useRef<HTMLAudioElement>(null);
  const [refSrc, setRefSrc] = useState<string | null>(item.kind === "line" ? item.refUrl : null);
  const resultRef = useRef<HTMLElement>(null);
  const paperRef = useRef<HTMLElement>(null);
  /** 챌린지에 출전한 테이크 — 기기에 남긴 출전 기록(lib/weekly)으로 안다. */
  const [entered, setEntered] = useState<Set<string>>(new Set());

  // 기기 설정 — 글자 크기, 쉼·강조 표시.
  useEffect(() => {
    try {
      const s = Number(localStorage.getItem(SIZE_KEY));
      const m = localStorage.getItem(MARKS_KEY);
      // 저장해둔 읽기 설정으로 연다.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if ([0, 1, 2].includes(s)) setSize(s);
      if (m === "0") setMarks(false);
      // 예전 "앞으로 자동" 설정은 지운다 — 이제 누를 때만 확인한다.
      localStorage.removeItem("mimic.practice.check");
    } catch {}
  }, []);

  useEffect(() => {
    // 테이크 목록이 바뀔 때마다(출전 직후 포함) 기기 기록을 다시 읽는다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEntered(new Set(Object.values(readMine()).flatMap((r) => (r.takeId ? [r.takeId] : []))));
  }, [takes]);

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
      return {
        track: s.track,
        pace: s.pace,
        pitch: s.pitch,
        marks: pauseMarks(s.text),
      };
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
   * 대본 확인 — 녹음을 받아써서 대본과 맞춰본다. 대본 녹음이 서버로 가는 유일한 길이고
   * 받아쓰기는 채점보다 비싸서 사용자가 버튼을 누를 때만 돈다(자동 없음). 지난 테이크에도 누를 수 있다.
   */
  const check = useCallback(
    async (t: Take) => {
      setChecking(t.id);
      setError(null);
      const res = await transcribe(t.blob);
      if ("text" in res) {
        await updateTake(t.id, { transcript: { text: res.text } });
        await refresh();
        setOverlay(true);
      } else {
        setError(localError(L, res.error ?? undefined, "대본 확인이 잠깐 안 됐어요. 잠시 뒤 다시 눌러주세요", "Couldn't check the script. Try again in a moment"));
      }
      setChecking(null);
    },
    [refresh, L],
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
      const take: Take = {
        id: newTakeId(),
        itemId,
        at: Date.now(),
        blob,
        analysis,
        score: null,
      };
      await saveTake(take);
      await refresh();
      setOpenId(take.id);
      // 혼자 하는 XP · 🔥 연속 기록 · 도감 — 숫자만 보낸다(녹음은 폰에만).
      if (analysis && analysis.span >= 0.6) {
        void reportTake(voiceTypeOf(analysis)?.id).then((r) => r && setSolo({ r, key: take.id }));
      }
      setPhase("ready");
      requestAnimationFrame(() =>
        resultRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        }),
      );

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
          } else setError(localError(L, data.error, "채점이 잠깐 안 됐어요. 진단은 그대로 볼 수 있어요", "Scoring didn't go through, but your notes are still here"));
        } catch {
          setError(L("채점 서버에 연결이 안 됐어요. 진단은 그대로 볼 수 있어요", "Couldn't reach the scoring server, but your notes are still here"));
        } finally {
          setScoring(false);
        }
      }
    },
    [item.kind, itemId, refresh, syl, L],
  );

  const stop = useCallback(() => {
    const rec = recorder.current;
    if (rec && rec.state !== "inactive") rec.stop();
  }, []);

  /** 일시정지 ↔ 이어서. 녹음기가 pause 를 못 하면(아주 오래된 브라우저) 버튼을 안 보인다. */
  const togglePause = useCallback(() => {
    const rec = recorder.current;
    if (!rec || rec.state === "inactive") return;
    if (rec.state === "recording") {
      rec.pause();
      pausedAt.current = performance.now();
      setPaused(true);
      setLevel(0);
    } else if (rec.state === "paused") {
      if (pausedAt.current !== null) pausedTotal.current += performance.now() - pausedAt.current;
      pausedAt.current = null;
      rec.resume();
      setPaused(false);
    }
  }, []);

  /** 녹음 중단 — 삑사리 났을 때. 테이크를 저장하지 않고 준비 상태로, again 이면 곧장 다시 센다. */
  const abort = useCallback(
    (again: boolean) => {
      discard.current = true;
      clearTimers();
      const rec = recorder.current;
      if (rec && rec.state !== "inactive") rec.stop();
      else discard.current = false;
      releaseMic();
      recorder.current = null;
      setElapsed(0);
      setLevel(0);
      setPaused(false);
      pausedAt.current = null;
      restart.current = again;
      setPhase("ready");
      track("practice_abort", { meme_id: itemId, via: again ? "restart" : "stop" });
    },
    [itemId, releaseMic],
  );

  const start = useCallback(async () => {
    if (phase !== "ready") return;
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError(L("이 브라우저는 녹음을 지원하지 않아요. 크롬이나 사파리로 열어주세요", "This browser can't record. Open in Chrome or Safari"));
      return;
    }
    stopAll();
    setError(null);
    setConfirmDel(null);
    let live: MediaStream;
    try {
      // 측정이 목적이라 자동 음량 보정은 끈다 — 켜두면 "끝 처짐"이 보정돼서 안 보인다.
      live = await navigator.mediaDevices.getUserMedia({
        audio: {
          autoGainControl: false,
          noiseSuppression: false,
          echoCancellation: true,
        },
      });
    } catch {
      setError(L("마이크를 허용해야 녹음할 수 있어요 🎙️", "Allow the mic to record 🎙️"));
      return;
    }
    stream.current = live;

    let analyser: AnalyserNode | null = null;
    try {
      const Ctor =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
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
          // 중단한 테이크 — 마이크·타이머는 abort 가 이미 정리했다. 여기서 또 정리하면
          // "처음부터"로 새로 잡은 마이크와 카운트다운을 끈다.
          setPaused(false);
          pausedAt.current = null;
          if (discard.current) {
            discard.current = false;
            return;
          }
          clearTimers();
          releaseMic();
          const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
          if (blob.size === 0) {
            setPhase("ready");
            setError(L("소리가 안 잡혔어요. 다시 해볼까요?", "We couldn't hear you. Try again?"));
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
        const max = item.kind === "line" ? Math.max(3000, (refSec ?? 5) * 1000 + LINE_TAIL_MS) : MAX_SCRIPT_MS;
        const t0 = performance.now();
        pausedTotal.current = 0;
        pausedAt.current = null;
        const buf = new Uint8Array(analyser?.fftSize ?? 1024);
        let smooth = 0;
        // 화면은 초당 20번만 고친다 — 매 프레임(60번) 고치면 이 큰 화면 전체를 다시 그려 저사양 폰이 버벅였다
        let lastUi = 0;
        const loop = () => {
          if (rec.state === "inactive") return;
          if (rec.state === "paused") {
            requestAnimationFrame(loop);
            return;
          }
          const ms = performance.now() - t0 - pausedTotal.current;
          const ui = ms - lastUi >= 50;
          if (ui) {
            lastUi = ms;
            setElapsed(ms);
          }
          if (analyser) {
            analyser.getByteTimeDomainData(buf);
            let s = 0;
            for (let i = 0; i < buf.length; i += 1) {
              const v = (buf[i] - 128) / 128;
              s += v * v;
            }
            const rms = Math.min(1, Math.sqrt(s / buf.length) * 4);
            smooth = smooth * 0.7 + rms * 0.3;
            if (ui) setLevel(smooth);
          }
          if (ms >= max) rec.stop();
          else requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
      }, COUNT_MS * 3),
    );
  }, [finish, item.kind, itemId, phase, refAnalysis, releaseMic, stopAll, L]);

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
    const onEsc = (e: KeyboardEvent) => {
      if (e.code === "Escape" && (phase === "recording" || phase === "count")) abort(false);
    };
    window.addEventListener("keydown", onEsc);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keydown", onEsc);
    };
  }, [phase, start, stop, abort]);

  // "처음부터" — 준비 상태로 돌아온 뒤 바로 다시 시작한다.
  useEffect(() => {
    if (phase === "ready" && restart.current) {
      restart.current = false;
      void start();
    }
  }, [phase, start]);

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
      .catch(() => setError(L("원본이 재생되지 않았어요. 한 번만 더 눌러주세요", "The original didn't play. Tap once more")));
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
  /**
   * 대본 위 형광펜은 "확인받은 마지막 테이크" 기준이다. 새 테이크를 녹음하는 동안에도 남겨 둬서, 표시를 보며
   * 고쳐 읽게 한다 — 그래야 매 테이크 다시 확인받지 않아도 된다(받아쓰기 비용).
   */
  const marked = open?.transcript ? open : (takes.find((t) => t.transcript) ?? null);
  const markedMatch: MatchResult | null = useMemo(
    () => (marked?.transcript ? matchScript(text, marked.transcript.text) : null),
    [marked, text],
  );
  const showMatch = overlay ? markedMatch : null;
  const before = open ? (takes.find((t) => t.at < open.at && t.analysis) ?? null) : null;

  const head =
    item.kind === "script"
      ? {
          crumb: `${trackLabel(item.script.track, lang)} · ${fieldName(item.script.category, lang)}`,
          title: scriptTitle(item.script.id, item.script.title, lang),
        }
      : {
          crumb: `${trackLabel("line", lang)} · ${memeText(item.meme, lang).source}`,
          title: memeText(item.meme, lang).title,
        };

  return (
    <main className={`shell ${styles.room}`}>
      <audio
        ref={player}
        onEnded={() => setPlaying(null)}
        onPause={() => setPlaying((p) => (p === "ref" ? p : null))}
      />
      {item.kind === "line" && refSrc && (
        <audio
          ref={refEl}
          src={refSrc}
          preload="auto"
          onEnded={() => setPlaying(null)}
          onPause={() => setPlaying((p) => (p === "ref" ? null : p))}
        />
      )}

      {/* 사용법 — 테이크가 생기면 결과·출전·피드백 받기 쪽 사용법으로 바뀐다. */}
      {phase === "ready" && (open ? <ScreenTour id="room_after" /> : <ScreenTour id="room" />)}
      <nav className={styles.top}>
        <Link href="/practice" className={styles.back}>
          {L("← 연습실", "← Practice")}
        </Link>
        <span className={styles.topRight}>
          <TourHelp id={open ? "room_after" : "room"} />
          {item.kind === "script" && item.editHref && (
            <Link href={item.editHref} className={styles.editLink}>
              {L("고치기", "Edit")}
            </Link>
          )}
          <span className={styles.counter}>
            {String(item.number).padStart(2, "0")} / {String(item.total).padStart(2, "0")}
          </span>
        </span>
      </nav>

      <header className={styles.head} data-tour="room-head">
        <p className={styles.crumb}>
          {head.crumb}
          {item.kind === "script" && (
            <span className={styles.level} aria-label={L(`난이도 ${item.script.level}`, `Level ${item.script.level}`)}>
              {[1, 2, 3].map((i) => (
                <i key={i} className={i <= item.script.level ? styles.dotOn : styles.dot} />
              ))}
            </span>
          )}
        </p>
        <h1 className={styles.title}>{head.title}</h1>
      </header>

      {item.kind === "script" && <WeeklyBanner scriptId={itemId} />}

      {item.kind === "script" ? (
        <section className={styles.direction} data-tour="room-script">
          <p className={styles.label}>{L("디렉션", "Direction")}</p>
          <p className={styles.directionText}>{item.script.direction}</p>
          <dl className={styles.targets}>
            <div>
              <dt>{L("속도", "Pace")}</dt>
              <dd>
                {item.script.pace[0]}–{item.script.pace[1]} {L("음절/초", "syl/s")}
              </dd>
            </div>
            <div>
              <dt>{L("억양", "Pitch")}</dt>
              <dd>
                {L(
                  { low: "절제", mid: "보통", high: "크게" }[item.script.pitch],
                  { low: "Restrained", mid: "Natural", high: "Wide" }[item.script.pitch],
                )}
                <small>
                  {" "}
                  {PITCH_RANGE[item.script.pitch][0]}–{PITCH_RANGE[item.script.pitch][1]} {L("반음", "st")}
                </small>
              </dd>
            </div>
            <div>
              <dt>{L("분량", "Length")}</dt>
              <dd>{L(`${syl}음절`, `${syl} syl`)}</dd>
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
              title={memeText(item.meme, lang).title}
            />
          )}
          <p className={styles.privacy}>
            {L(
              "채점할 때만 녹음을 잠깐 서버로 보내요. 점수만 내고 바로 지우고, 기록은 이 폰에만 남아요.",
              "Your take is sent to the server only for scoring and deleted right after. History stays on this phone.",
            )}
          </p>
          <button type="button" className={styles.refBtn} onClick={playRef}>
            {playing === "ref" ? L("■ 원본 멈춤", "■ Stop original") : L("▶ 원본 음성 듣기", "▶ Hear the original")}
            {refAnalysis && <small>{L(`${refAnalysis.span.toFixed(1)}초`, `${refAnalysis.span.toFixed(1)}s`)}</small>}
          </button>
        </section>
      )}

      <section ref={paperRef} className={`${styles.paper} ${styles[`size${size}`]}`} aria-label={L("대본", "Script")}>
        <div className={styles.paperBar}>
          <span className={styles.paperLabel}>{L("대본", "Script")}</span>
          <div className={styles.paperTools}>
            <button
              type="button"
              onClick={() => setReading(Math.max(0, size - 1), marks)}
              disabled={size === 0}
              aria-label={L("글자 작게", "Smaller text")}
            >
              가−
            </button>
            <button
              type="button"
              onClick={() => setReading(Math.min(2, size + 1), marks)}
              disabled={size === 2}
              aria-label={L("글자 크게", "Larger text")}
            >
              가+
            </button>
            {markedMatch && (
              <button
                type="button"
                onClick={() => setOverlay((v) => !v)}
                aria-pressed={overlay}
                className={overlay ? styles.toolOn : undefined}
              >
                {L("확인", "Check")}
              </button>
            )}
            {item.kind === "script" && (
              <button
                type="button"
                onClick={() => setReading(size, !marks)}
                aria-pressed={marks}
                className={marks ? styles.toolOn : undefined}
              >
                {L("쉼·강조", "Marks")}
              </button>
            )}
          </div>
        </div>
        {showMatch && marked && (
          <p className={styles.overlayNote}>
            <span className={styles.noteTitle}>
              🦜 {L(`테이크 #${order.get(marked.id)} 확인 결과`, `Take #${order.get(marked.id)} check`)}
            </span>
            <span className={styles.keyMissed}>{L("빠뜨림", "skipped")}</span>
            <span className={styles.keyChanged}>{L("다르게 읽음", "changed")}</span>
            <span className={styles.keyAdded}>{L("+없는 말", "+extra")}</span>
            {marked !== open && <span className={styles.noteHint}>{L("표시를 보면서 다시 읽어 보세요", "Read again with these in mind")}</span>}
          </p>
        )}
        <ScriptText text={text} marks={marks && item.kind === "script"} match={showMatch} />
        {item.kind === "script" && marks && (
          <p className={styles.legend}>
            <span className={styles.pauseMark}>/</span> {L("쉼", "pause")} &nbsp; <u>{L("밑줄", "underline")}</u> {L("강조", "stress")}
          </p>
        )}
        {marked?.transcript?.text && (
          <details className={styles.heard}>
            <summary>{L(`들린 그대로 보기 · 테이크 #${order.get(marked.id)}`, `What we heard · take #${order.get(marked.id)}`)}</summary>
            <p>{marked.transcript.text}</p>
          </details>
        )}
      </section>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <section ref={resultRef} className={styles.result} aria-live="polite" data-tour={open ? "room-result" : undefined}>
        {phase === "analyzing" && <p className={styles.analyzing}>{L("방금 테이크를 듣고 있어요…", "Listening to your take…")}</p>}
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
            onCheck={() => void check(open)}
            onShowScript={() => paperRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
            post={item.kind === "script" ? <WeeklyEnter key={`w-${open.id}`} take={open} scriptId={itemId} /> : null}
          />
        )}
        {phase !== "analyzing" && open && (
          // 다른 사람 피드백은 갤러리에 올릴 때 "피드백도 받기"로 받는다(11/6, 게시판을 합쳤다).
          <QuickFeedback page="practice" item={itemId} />
        )}
        {phase !== "analyzing" && !open && (
          <div className={styles.empty} data-tour="room-privacy">
            <p className={styles.emptyTitle}>{L("첫 테이크를 남겨 보세요 🎙️", "Record your first take 🎙️")}</p>
            <p>
              {L(
                "아래 버튼을 누르고 3·2·1 뒤에 읽기 시작하면 돼요. 다 읽으면 한 번 더 눌러 끝내세요. 코코가 목소리 타입을 알려 주고, 대본대로 읽었는지도 확인해 줘요.",
                "Tap the button below and start reading after 3·2·1. Tap again when you're done — Coco gives you a voice type and can check you read every word.",
              )}
            </p>
            <PrivacyTag kind="device" />
            <Tip id="tip_mic">
              {L(
                <>
                  처음 누르면 브라우저가 마이크 권한을 물어봐요. <b>허용</b>을 눌러야 녹음돼요. 안 되면{" "}
                  <Link href="/probe">마이크 점검</Link>
                </>,
                <>
                  The first time, your browser will ask for the mic — tap <b>Allow</b>. Not working?{" "}
                  <Link href="/probe">Check your mic</Link>
                </>,
              )}
            </Tip>
          </div>
        )}
      </section>

      {takes.length > 0 && (
        <section className={styles.history} data-tour="room-takes">
          <h2 className={styles.historyTitle}>
            {L("내 기록", "My takes")} <span>{takes.length}</span>
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
                    resultRef.current?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    });
                  }}
                >
                  <span className={styles.takeNo}>#{order.get(t.id)}</span>
                  <span className={styles.takeWhen}>
                    {ago(t.at, lang)}
                    {t.starred && <i className={styles.star}>★</i>}
                    {entered.has(t.id) || t.postId ? (
                      <PrivacyTag kind="public" compact />
                    ) : (
                      <PrivacyTag kind="device" compact />
                    )}
                  </span>
                  <span className={styles.takeStat}>{takeLine(t, L)}</span>
                </button>
                <button
                  type="button"
                  className={styles.iconBtn}
                  onClick={() => playTake(t)}
                  aria-label={playing === t.id ? L("정지", "Stop") : L("듣기", "Play")}
                >
                  {playing === t.id ? "■" : "▶"}
                </button>
                <button
                  type="button"
                  className={confirmDel === t.id ? styles.delSure : styles.iconBtn}
                  onClick={() => void remove(t)}
                  aria-label={L("지우기", "Delete")}
                >
                  {confirmDel === t.id ? L("지울까요?", "Delete?") : "✕"}
                </button>
              </li>
            ))}
          </ol>
          <p className={styles.keepNote}>
            {L(
              "🔒 표시는 이 폰에만 있어서 다른 사람이 들을 수 없어요 · 🌐 표시는 챌린지·게시판에 올라가 누구나 들을 수 있어요",
              "🔒 = only on this phone, no one else can hear it · 🌐 = posted to the challenge or board, anyone can listen",
            )}
          </p>
          <p className={styles.keepNote}>
            {L("녹음은 자동 저장돼요 · 대본마다 최근 12개 · ★ 베스트는 안 지워져요", "Takes save automatically · latest 12 per script · ★ best takes are never deleted")}
          </p>
        </section>
      )}

      <nav className={styles.pager}>
        {item.prev ? (
          <Link href={`/practice/${item.prev.id}`} className={styles.pageLink}>
            <small>{L("← 이전", "← Prev")}</small>
            {scriptTitle(item.prev.id, item.prev.title, lang)}
          </Link>
        ) : (
          <span />
        )}
        {item.next ? (
          <Link href={`/practice/${item.next.id}`} className={`${styles.pageLink} ${styles.pageNext}`}>
            <small>{L("다음 →", "Next →")}</small>
            {scriptTitle(item.next.id, item.next.title, lang)}
          </Link>
        ) : (
          <Link href="/practice" className={`${styles.pageLink} ${styles.pageNext}`}>
            <small>{L("끝", "Done")}</small>
            {L("목차로", "Back to list")}
          </Link>
        )}
      </nav>

      <div className={styles.dock}>
        {phase === "recording" || phase === "count" ? (
          <div className={styles.recPanel}>
            {phase === "recording" ? (
              <p className={paused ? `${styles.recStatus} ${styles.recStatusPaused}` : styles.recStatus} aria-live="polite">
                <span className={styles.recDot} aria-hidden="true" />
                <span className={styles.recTime}>{clock(elapsed)}</span>
                <span className={styles.recLevel} aria-hidden="true">
                  <i style={{ transform: `scaleX(${paused ? 0 : 0.06 + level * 0.94})` }} />
                </span>
                <span>{paused ? L("일시정지", "Paused") : L("녹음 중", "Recording")}</span>
              </p>
            ) : (
              <p className={styles.recStatus}>
                <span>{L("곧 시작해요", "Starting")}</span>
              </p>
            )}
            <div className={styles.recRow}>
              <button
                type="button"
                className={styles.recSide}
                onClick={() => abort(phase === "recording")}
                aria-label={phase === "recording" ? L("버리고 처음부터 다시", "Discard and start over") : L("취소", "Cancel")}
              >
                <span aria-hidden="true">{phase === "recording" ? "↺" : "✕"}</span>
                <small>{phase === "recording" ? L("처음부터", "Restart") : L("취소", "Cancel")}</small>
              </button>
              {phase === "recording" ? (
                canPause ? (
                  <button
                    type="button"
                    className={paused ? `${styles.recMain} ${styles.recMainPaused}` : styles.recMain}
                    onClick={togglePause}
                    aria-label={paused ? L("이어서 녹음", "Resume") : L("일시정지", "Pause")}
                  >
                    <span className={paused ? styles.icoRec : styles.icoPause} aria-hidden="true" />
                  </button>
                ) : (
                  <span className={styles.recMainSpacer} aria-hidden="true" />
                )
              ) : (
                <span className={`${styles.recMain} ${styles.recMainCount}`} aria-live="assertive">
                  {count}
                </span>
              )}
              <button type="button" className={`${styles.recSide} ${styles.recDone}`} onClick={stop} disabled={phase !== "recording"} aria-label={L("다 읽었어요 · 결과 보기", "Done · see results")}>
                <span aria-hidden="true">✓</span>
                <small>{L("완료", "Done")}</small>
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className={styles.rec}
            onClick={() => void start()}
            disabled={phase !== "ready"}
            data-tour="room-record"
          >
            {phase === "analyzing" ? (
              L("듣는 중…", "Listening…")
            ) : (
              <>
                <span className={styles.recDot} aria-hidden="true" />
                {takes.length ? L("한 번 더 읽기", "Read again") : L("녹음하고 읽기", "Record & read")}
              </>
            )}
          </button>
        )}
      </div>
      {solo && <SoloToast key={solo.key} r={solo.r} next={`/practice/${itemId}`} />}
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
  const L = useT();
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
                  // 틀린 말은 형광펜으로 — 다음 테이크에서 눈이 바로 가게. 들린 말은 작은 말풍선으로 위에.
                  const word =
                    !r || r.status === "ok" ? (
                      body
                    ) : r.status === "missed" ? (
                      <mark className={styles.missed} title={L("빠뜨림", "Skipped")}>
                        {body}
                      </mark>
                    ) : (
                      <mark className={styles.changed} title={L(`들린 말: ${r.heard ?? ""}`, `Heard: ${r.heard ?? ""}`)}>
                        {r.heard && <small>{r.heard}</small>}
                        {body}
                      </mark>
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
  onCheck,
  onShowScript,
  post,
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
  onCheck: () => void;
  onShowScript: () => void;
  /** 들려주기 — 테이크 머리 바로 아래(심사표 위). 예전엔 심사표 아래, 그 전엔 세부 지표 밑이었다. 세부 지표 밑에 두었더니 화면 세 장 아래라 아무도 못 봤다(11/3 홍보: 녹음 17명 → 올림 0명). */
  post?: React.ReactNode;
}) {
  const L = useT();
  const lang = useLang();
  const a = take.analysis;
  const checks = a ? judge(a, target, L) : [];
  const prevChecks = before?.analysis ? judge(before.analysis, target, L) : [];
  const pass = passCount(checks);
  const nextFix = checks.find((c) => c.status === "low" || c.status === "high");
  const warn = a ? warnings(a, L) : [];

  return (
    <article className={styles.report}>
      <header className={styles.reportHead}>
        <div>
          <p className={styles.label}>
            {L(`테이크 #${n}`, `Take #${n}`)} · {ago(take.at, lang)}
          </p>
          {kind === "line" && take.score ? (
            <p className={styles.headline}>
              <b>{take.score.score}</b>{L("점", " pts")}
            </p>
          ) : kind === "line" && scoring ? (
            <p className={styles.headline}>{L("채점 중…", "Scoring…")}</p>
          ) : pass.total > 0 ? (
            // "4개 중 2개 통과"는 시험 성적표처럼 읽힌다 — 잘한 것부터, 고칠 건 하나만.
            <p className={styles.headline}>
              {pass.ok === pass.total
                ? L(<>🎯 <b>전부 좋아요!</b></>, <>🎯 <b>All on target!</b></>)
                : pass.ok > 0
                  ? L(
                      <>
                        좋은 점 <b>{pass.ok}개</b> · 다음엔 {nextFix?.label} 하나만
                      </>,
                      <>
                        <b>{pass.ok}</b> good · next, just {nextFix?.label}
                      </>,
                    )
                  : L(<>다음엔 <b>{nextFix?.label}</b> 하나만 바꿔 봐요</>, <>Next take, change just <b>{nextFix?.label}</b></>)}
            </p>
          ) : (
            <p className={styles.headline}>{L("진단할 소리가 부족해요", "Not enough audio to analyze")}</p>
          )}
        </div>
        <div className={styles.reportBtns}>
          <button type="button" className={styles.pill} onClick={onPlay}>
            {playing ? L("■ 멈춤", "■ Stop") : L("▶ 재생", "▶ Play")}
          </button>
          {onRef && (
            <button type="button" className={styles.pill} onClick={onRef}>
              {refPlaying ? L("■ 멈춤", "■ Stop") : L("▶ 원본", "▶ Original")}
            </button>
          )}
          <button
            type="button"
            className={take.starred ? styles.pillOn : styles.pill}
            onClick={onStar}
            aria-pressed={!!take.starred}
          >
            {take.starred ? L("★ 베스트", "★ Best") : L("☆ 베스트로", "☆ Mark best")}
          </button>
        </div>
      </header>

      {/* 녹음 직후 눈이 닿는 자리 — 심사표·파형보다 위. 망설일 틈 없이 바로 누르게(11/4). */}
      {post}

      {a && <Wave a={a} />}

      {warn.map((w) => (
        <p key={w} className={styles.warn}>
          {w}
        </p>
      ))}

      <Scorecard
        key={take.id}
        analysis={a}
        text={text}
        match={match}
        heardEmpty={!!take.transcript && !take.transcript.text.trim()}
        checking={checking}
        onCheck={onCheck}
        onShowScript={onShowScript}
      />


      {kind === "line" && take.score && (
        <dl className={styles.axes}>
          {(
            [
              [L("억양", "Pitch"), take.score.pitch, L("원본과 높낮이 흐름이 얼마나 같은지", "How closely your melody follows the original")],
              [L("타이밍", "Rhythm"), take.score.timing, L("말이 나오고 끊기는 박자", "When words start and stop")],
              [L("음색", "Tone"), take.score.tone, L("원 배우 목소리와 닮은 정도 · 연습에선 참고만", "How much you sound like the actor · just for reference")],
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

const STATUS_WORD: Record<Check["key"], Record<"ok" | "low" | "high", [string, string]>> = {
  pace: { ok: ["좋음", "Good"], low: ["느림", "Slow"], high: ["빠름", "Fast"] },
  pause: { ok: ["좋음", "Good"], low: ["부족", "Few"], high: ["잦음", "Many"] },
  pitch: { ok: ["좋음", "Good"], low: ["평평", "Flat"], high: ["과함", "Too much"] },
  end: { ok: ["좋음", "Good"], low: ["처짐", "Fading"], high: ["좋음", "Good"] },
};

function CheckRow({ c, prev }: { c: Check; prev?: Check }) {
  const L = useT();
  const st = c.status === "na" ? "ok" : c.status;
  const delta = prev && c.scale && prev.scale ? c.scale.at - prev.scale.at : null;
  return (
    <li className={styles.check}>
      <div className={styles.checkTop}>
        <span className={styles.checkLabel}>{c.label}</span>
        <span className={styles.checkValue}>
          {c.value}
          {delta !== null && Math.abs(delta) >= 0.1 && (
            <small className={styles.delta}>
              {L("지난번", "vs last")} {delta > 0 ? "+" : ""}
              {delta.toFixed(1)}
            </small>
          )}
        </span>
        <span className={st === "ok" ? styles.badgeOk : styles.badgeOff}>{L(...STATUS_WORD[c.key][st])}</span>
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
      <span className={styles.scaleBand} style={{ left: pos(s.lo), width: `calc(${pos(s.hi)} - ${pos(s.lo)})` }} />
      <span className={styles.scaleAt} style={{ left: pos(s.at) }} />
    </div>
  );
}

function Wave({ a }: { a: Analysis }) {
  const L = useT();
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
          style={{
            left: `${s * 100}%`,
            width: `${Math.max(0.8, (e - s) * 100)}%`,
          }}
        />
      ))}
      <span className={styles.waveLen}>{L(`${a.span.toFixed(1)}초`, `${a.span.toFixed(1)}s`)}</span>
    </div>
  );
}

function takeLine(t: Take, L: T): string {
  if (t.score) return L(`${t.score.score}점`, `${t.score.score} pts`);
  const a = t.analysis;
  if (!a) return L("진단 없음", "No notes");
  const parts = [L(`${a.span.toFixed(1)}초`, `${a.span.toFixed(1)}s`)];
  if (a.pace) parts.push(L(`${a.pace.toFixed(1)}음절/초`, `${a.pace.toFixed(1)} syl/s`));
  return parts.join(" · ");
}

function clock(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

