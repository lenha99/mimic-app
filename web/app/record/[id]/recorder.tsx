"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePlaybackLevel } from "@/components/use-playback-level";
import { VoiceAvatar } from "@/components/voice-avatar";
import type { Avatar } from "@/lib/avatar";
import { addGuestClaim } from "@/lib/guest-claims";
import { extraLine, type Meme } from "@/lib/memes";
import styles from "./record.module.css";

/**
 * 원테이크 — 탭 한 번에 원본 재생 → 3·2·1 → 자동 녹음 → 자동 정지 → 채점.
 *
 * 조작이 소리보다 길면 밈이 아니라 장비가 된다. 그래서 짧은 소리는 정지 버튼 없이
 * 한 번에 흐르게 한다. 녹음 창은 원본 길이에서 계산하고, 남은 시간은 줄어드는
 * 링으로만 보여준다. 링은 타이머이면서 "언제 끝내야 하는지"를 가르치는 코치다.
 *
 * 긴 원본(10초 초과)은 규칙이 달라진다. 1분짜리를 듣자마자 1분을 따라하게 하면
 * 한 번의 시도가 2분이다. 그건 자동으로 이어붙일 일이 아니라서, 듣기와 따라하기를
 * 따로 두고 정지도 직접 하게 한다.
 *
 * 재생 순서 주의: `play()` 는 사용자 제스처가 살아 있는 동안 불러야 한다.
 * 앞에 `await` 이 하나라도 끼면 제스처 유효기간이 끝나 자동재생 정책에 막힌다.
 * (실제로 그렇게 짰다가 원본이 안 들리고 바로 녹음으로 넘어가는 버그가 났다.)
 * 그래서 탭하면 재생을 먼저 걸고, 마이크 권한은 그 뒤에 병렬로 받는다.
 */

/** 녹음 창 = 원본 길이 + 여유. 말이 늦게 시작돼도 잘리지 않을 만큼만 준다. */
const TAIL_MS = 800;
const MIN_WINDOW_MS = 1200;
/** 1분짜리 원본도 담을 수 있어야 한다. */
const MAX_WINDOW_MS = 75_000;
/** 이보다 긴 녹음은 직접 끊을 수 있어야 한다 — 기다리게만 두면 답답하다. */
const MANUAL_STOP_ABOVE_MS = 8_000;
/** 이보다 긴 원본은 듣기와 따라하기를 분리한다. */
const LONG_REF_SECONDS = 10;
/** 원본 길이를 못 읽었을 때 쓰는 값. */
const FALLBACK_REF_MS = 1400;
/** onEnded 가 안 오는 경우를 대비한 안전망 여유분. */
const LISTEN_GUARD_MS = 3_000;
/** 3 → 2 → 1 한 칸. 기다리게 하는 게 아니라 준비시키는 게 목적. */
const COUNT_STEP_MS = 320;
/** 채점이 이만큼 넘어가면 그때 "서버 깨우는 중"을 꺼낸다. */
const SLOW_AFTER_MS = 6_000;
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
  | "listening"
  | "countdown"
  | "recording"
  | "scoring"
  | "result";

/** 결과를 서버에 저장하는 단계 (이슈 #23 — 서버가 같은 오디오를 다시 채점한다). */
type PublishPhase = "idle" | "publishing" | "done";

type Props = {
  meme: Meme;
  refUrl: string;
  /** 공유 링크에 실려 온 친구 점수. 넘어야 할 기준이 있으면 화면이 달라진다. */
  beat: number | null;
  next: { id: string; title: string } | null;
  /** 게스트는 비공개 저장만 된다. 공개는 신고할 수 있는 사람들 사이에서만. */
  loggedIn: boolean;
  /** 내 목소리를 대신 내줄 캐릭터. 게스트는 기본 캐릭터. */
  avatar: Avatar;
};

const GRADE_CLASS: Record<string, string> = {
  SS: styles.gradeTop,
  S: styles.gradeTop,
  A: styles.gradeGood,
  B: styles.gradeMid,
  C: styles.gradeLow,
};

/**
 * 익명 기기 식별자.
 *
 * 랭킹에서 "같은 사람이 30번 시도한 것"과 "서른 명이 한 번씩 한 것"을 구분하려면
 * 뭔가는 있어야 한다. 계정을 만들게 하면 그 자리에서 대부분 나가므로, 브라우저에
 * 난수 하나를 두고 그걸 보낸다. 사람에 대한 정보는 들어 있지 않고, 브라우저
 * 데이터를 지우면 사라진다. 저장이 막힌 환경(사생활 보호 창 등)에서는 조용히
 * 빈 값이 되고 서버는 그냥 기록하지 않는다.
 */
function clientId(): string {
  try {
    const k = "mimic.cid";
    let v = localStorage.getItem(k);
    if (!v) {
      v = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(k, v);
    }
    return v;
  } catch {
    return "";
  }
}

/**
 * 채점기가 억양 축을 실제로 썼는가.
 *
 * 원본에 유성 프레임이 5개도 없으면 서버는 억양(40%)을 빼고 나머지를 재분배해
 * 총점을 낸다(modal_app._score). 그런데 breakdown 으로는 `pitch: 0` 을 보내서,
 * 화면에는 "억양 0점"으로 뜨고 총평은 "억양이 아쉬워"라고 사용자를 탓한다.
 * 원본 클립이 문제인데 사람한테 뒤집어씌우는 셈이다.
 *
 * 총점 공식이 둘을 구분해준다 — 억양을 넣었으면 0점이 총점을 끌어내렸어야 한다.
 * 빼고 계산한 값과 총점이 맞으면 축이 빠진 것이다. 추측이 아니라 산수다.
 */
function pitchScored(r: Score): boolean {
  if (r.breakdown.pitch > 0) return true;
  const { tone, timing } = r.breakdown;
  const without = Math.round((tone * 0.4 + timing * 0.2) / 0.6);
  const with0 = Math.round(tone * 0.4 + timing * 0.2);
  return !(r.score === without && r.score !== with0);
}

/**
 * 숫자만으로는 웃기지 않는다. 사람이 한마디 해줘야 공유하고 싶어진다.
 * (억양/음색/타이밍 전부 받침이 있어 조사는 "이"/"은"으로 고정된다.)
 */
function verdict(score: number, bd: Score["breakdown"], hasPitch = true): string {
  const axes: [string, number][] = [
    ...(hasPitch ? ([["억양", bd.pitch]] as [string, number][]) : []),
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

export default function Recorder({ meme, refUrl, beat, next, loggedIn, avatar }: Props) {
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
  const [canStop, setCanStop] = useState(false);
  /** 렌더에서 읽어야 하는 값이라 ref(chain) 와 짝으로 둔다. */
  const [chaining, setChaining] = useState(false);

  const [publishPhase, setPublishPhase] = useState<PublishPhase>("idle");
  const [wantsPublic, setWantsPublic] = useState(false); // 공개는 opt-in (이슈 #16)
  const [publishedPublic, setPublishedPublic] = useState(false);
  const [adjusted, setAdjusted] = useState<{ from: number; to: number } | null>(null);

  const refAudio = useRef<HTMLAudioElement>(null);
  const userAudio = useRef<HTMLAudioElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  /** getUserMedia 는 재생과 병렬로 돌린다. 녹음 시작 직전에 이 약속을 기다린다. */
  const micRequest = useRef<Promise<MediaStream> | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const timers = useRef<number[]>([]);
  const windowMs = useRef<number>(FALLBACK_REF_MS + TAIL_MS);
  const phaseRef = useRef<Phase>("idle");
  /** 원본 재생이 끝나면 이어서 녹음할지. "원본만 듣기"로 들어오면 false. */
  const chain = useRef(false);
  /** onEnded 와 안전망 타이머가 겹쳐 카운트다운이 두 번 돌지 않게. */
  const advanced = useRef(false);
  /** 채점 대기 중 원본 다음에 내 소리를 자동으로 한 번 틀었는지. */
  const abPlayed = useRef(false);
  /** 저장할 때 같은 오디오를 서버로 다시 보내야 해서 들고 있는다. */
  const blobRef = useRef<Blob | null>(null);
  /**
   * 시도 번호. 저장 요청이 걸린 채로 다시 녹음하면, 늦게 온 이전 저장 응답이
   * 새 결과의 점수를 덮어쓰면 안 된다. 응답이 왔을 때 번호가 바뀌었으면 버린다.
   */
  const attempt = useRef(0);

  // 내 소리를 틀면 캐릭터가 그 소리로 입을 연다.
  const userLevel = usePlaybackLevel(userAudio, userUrl, playing === "user");

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const isLong = refSeconds !== null && refSeconds > LONG_REF_SECONDS;

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);

  const releaseMic = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    micRequest.current = null;
    analyser.current = null;
    void audioCtx.current?.close().catch(() => {});
    audioCtx.current = null;
  }, []);

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

  /** 채점 서버 예열. 화면이 열리자마자 한 번 찌른다. */
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

      blobRef.current = blob;
      attempt.current += 1;
      setUserUrl(URL.createObjectURL(blob));
      setPublishPhase("idle");
      setWantsPublic(false);
      setPublishedPublic(false);
      setAdjusted(null);
      setPhase("scoring");
      setSlow(false);
      abPlayed.current = false;
      timers.current.push(window.setTimeout(() => setSlow(true), SLOW_AFTER_MS));

      try {
        const body = new FormData();
        body.append("file", blob, "recording.webm");
        const res = await fetch(
          `/api/score?meme_id=${encodeURIComponent(meme.id)}` +
            `&client=${encodeURIComponent(clientId())}`,
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

  const stopRecording = useCallback(() => {
    const rec = recorder.current;
    if (rec && rec.state !== "inactive") rec.stop();
  }, []);

  const beginRecording = useCallback(async () => {
    // 재생과 병렬로 받아둔 마이크를 여기서 기다린다.
    let live = stream.current;
    if (!live) {
      if (!micRequest.current) {
        setError("마이크가 준비되지 않았어. 다시 눌러줘.");
        setPhase("idle");
        return;
      }
      try {
        live = await micRequest.current;
        stream.current = live;
      } catch {
        setError("마이크를 켜줘야 점수가 나와.");
        setPhase("idle");
        return;
      }
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
    setCanStop(windowMs.current > MANUAL_STOP_ABOVE_MS);
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
    clearTimers();

    const seconds = refAudio.current?.duration;
    const refMs =
      typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0
        ? seconds * 1000
        : FALLBACK_REF_MS;
    windowMs.current = Math.min(
      MAX_WINDOW_MS,
      Math.max(MIN_WINDOW_MS, Math.round(refMs) + TAIL_MS),
    );

    refAudio.current?.pause();
    setPhase("countdown");
    setCount(3);
    timers.current.push(window.setTimeout(() => setCount(2), COUNT_STEP_MS));
    timers.current.push(window.setTimeout(() => setCount(1), COUNT_STEP_MS * 2));
    timers.current.push(
      window.setTimeout(() => void beginRecording(), COUNT_STEP_MS * 3),
    );
  }, [beginRecording, clearTimers]);

  /**
   * 마이크 요청. 재생을 막지 않도록 await 하지 않고 약속만 들고 있는다.
   * 이미 받아둔 게 있으면 그대로 쓴다.
   */
  const requestMic = useCallback(() => {
    if (stream.current || micRequest.current) return;
    if (!navigator.mediaDevices?.getUserMedia) return;
    micRequest.current = navigator.mediaDevices.getUserMedia({ audio: true });
    // 여기서 처리하지 않으면 거부 시 unhandled rejection 이 된다.
    micRequest.current.catch(() => {});
  }, []);

  /**
   * 원본 재생. **반드시 클릭 핸들러에서 동기적으로 호출해야 한다** — 앞에 await 이
   * 있으면 제스처가 만료돼 자동재생 정책에 막힌다.
   */
  const playRef = useCallback(
    (thenRecord: boolean) => {
      const el = refAudio.current;
      if (!el) {
        setError("원본을 불러오지 못했어. 새로고침 해볼래?");
        return;
      }

      setError(null);
      setResult(null);
      advanced.current = false;
      chain.current = thenRecord;
      setChaining(thenRecord);
      clearTimers();

      try {
        el.currentTime = 0;
      } catch {
        // 메타데이터가 아직이면 0 으로 못 돌릴 수 있다. 그대로 재생한다.
      }

      el.play()
        .then(() => {
          setPhase("listening");
          setRemain(1);
          // onEnded 가 안 오는 경우(길이 미상·디코드 실패)를 위한 안전망.
          const guard =
            (refSeconds !== null ? refSeconds * 1000 : FALLBACK_REF_MS) +
            LISTEN_GUARD_MS;
          if (thenRecord) {
            timers.current.push(window.setTimeout(beginCountdown, guard));
          }
        })
        .catch(() => {
          // 예전엔 여기서 조용히 녹음으로 넘어갔다. 그러면 원본을 못 들은 채로
          // 녹음이 돌아 점수만 이상하게 나온다. 이제는 말해주고 멈춘다.
          setPhase("idle");
          setError("원본이 재생되지 않았어. 한 번 더 눌러줄래?");
        });
    },
    [beginCountdown, clearTimers, refSeconds],
  );

  /** 듣고 바로 따라하기 (짧은 원본의 기본 동작). */
  const listenAndRecord = useCallback(() => {
    if (typeof MediaRecorder === "undefined") {
      setError("이 브라우저에선 녹음이 안 돼. 크롬이나 사파리로 열어줘.");
      return;
    }
    playRef(true); // 제스처가 살아 있는 동안 재생 먼저
    requestMic(); // 마이크는 병렬로
  }, [playRef, requestMic]);

  /** 원본만 듣기 — 녹음으로 이어지지 않는다. */
  const listenOnly = useCallback(() => {
    playRef(false);
  }, [playRef]);

  /** 원본을 건너뛰고 바로 따라하기. */
  const recordNow = useCallback(() => {
    if (typeof MediaRecorder === "undefined") {
      setError("이 브라우저에선 녹음이 안 돼. 크롬이나 사파리로 열어줘.");
      return;
    }
    setError(null);
    setResult(null);
    advanced.current = false;
    chain.current = false;
    setChaining(false);
    refAudio.current?.pause();
    requestMic();
    beginCountdown();
  }, [beginCountdown, requestMic]);

  // 링 진행도와 레벨 미터.
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
      if (chain.current) beginCountdown();
      else setPhase("idle");
      return;
    }
    // 채점을 기다리는 동안 원본 다음에 내 소리를 한 번 이어서 들려준다.
    if (phaseRef.current === "scoring" && !abPlayed.current) {
      abPlayed.current = true;
      toggle("user");
    }
  }, [beginCountdown, toggle]);

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
    // 도전장을 받고 왔으면 고리가 거기서 끊기면 안 된다. 이겼으면 되갚는 말이,
    // 졌으면 다시 부르는 말이 나가야 그 사람이 또 던진다.
    const text =
      beat === null
        ? `${meme.title} ${result.score}점 (${result.grade}). 넘어봐.`
        : result.score > beat
          ? `${meme.title} ${result.score}점. 니 ${beat}점 넘었다. 다시 해봐.`
          : `${meme.title} ${result.score}점. ${beat}점 아직 못 넘었어. 한 번 더 간다.`;

    if (navigator.share) {
      try {
        await navigator.share({ title: "MIMIC", text, url: link });
      } catch {
        // 공유 시트를 닫은 것뿐이다.
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
  }, [meme.title, result, beat]);

  /**
   * 결과를 서버에 저장한다 (이슈 #23).
   *
   * 점수는 보내지 않는다 — 서버가 같은 오디오를 Modal 에 다시 채점시켜 나온 값만
   * 기록한다. 그래서 화면 점수와 확정 점수가 미세하게 다를 수 있고, 다르면
   * 확정값으로 바꿔 보여준다 (랭킹에 올라가는 건 확정값이라 속이면 안 된다).
   */
  const publish = useCallback(async () => {
    const blob = blobRef.current;
    if (!blob || !result) return;
    const makePublic = loggedIn && wantsPublic;
    const mine = attempt.current;

    setPublishPhase("publishing");
    setError(null);
    try {
      const body = new FormData();
      body.append("file", blob, "recording.webm");
      body.append("is_public", String(makePublic));

      const res = await fetch(
        `/api/publish-recording?meme_id=${encodeURIComponent(meme.id)}` +
          `&client=${encodeURIComponent(clientId())}`,
        { method: "POST", body },
      );
      const data = await res.json();

      // 비로그인이면 1회용 토큰이 온다. 로그인 후 /profile 에서 귀속시킨다.
      // 그 사이 다시 녹음했더라도 이 녹음은 저장됐으니 토큰은 챙긴다.
      if (data.claimToken) addGuestClaim(data.claimToken);
      if (mine !== attempt.current) return;

      if (!res.ok || data.error) {
        setError(data.error ?? "저장이 안 됐어. 다시 눌러줄래?");
        setPublishPhase("idle");
        return;
      }

      if (typeof data.score === "number" && data.score !== result.score) {
        setAdjusted({ from: result.score, to: data.score });
      }
      setResult((prev) =>
        prev ? { ...prev, score: data.score, grade: data.grade, breakdown: data.breakdown } : prev,
      );
      setPublishedPublic(makePublic);
      setPublishPhase("done");
    } catch {
      if (mine !== attempt.current) return;
      setError("네트워크가 끊겼어. 다시 저장해줄래?");
      setPublishPhase("idle");
    }
  }, [loggedIn, meme.id, result, wantsPublic]);

  const ringOffset = RING_C * (1 - remain);

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
        onPause={() => setPlaying(null)}
        onEnded={onRefEnded}
        onError={() =>
          setError("원본을 불러오지 못했어. 잠시 뒤 다시 눌러줄래?")
        }
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

      {phase === "idle" && (
        <section className={styles.stage}>
          <p className={styles.kicker}>원본</p>
          <h2 className={styles.hero}>{meme.title}</h2>
          <p className={styles.heroMeta}>
            {meme.source}
            {refSeconds !== null && ` · ${refSeconds.toFixed(1)}초`}
          </p>
          {/* 제목이 이미 대사인 밈("무야호")은 같은 말을 두 번 찍지 않는다. */}
          {extraLine(meme) && (
            <p className={styles.line}>“{extraLine(meme)}”</p>
          )}
        </section>
      )}

      {(phase === "listening" || phase === "countdown") && (
        <section className={styles.stage}>
          <div className={styles.ringWrap}>
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
          {/* 대사가 있으면 주인공은 대사다. 안내 문구가 읽을 글자보다 크면 안 된다. */}
          <h2 className={meme.line ? styles.cueSmall : styles.cue}>
            {phase === "listening" ? "잘 들어" : "준비"}
          </h2>
          <p className={styles.cueSub}>
            {phase === "countdown"
              ? "곧 시작"
              : chaining
                ? "끝나면 바로 녹음 시작"
                : "듣기만 하는 중"}
          </p>
          {meme.line && <p className={styles.lineCue}>“{meme.line}”</p>}
          {phase === "listening" && (
            <button className={styles.skip} onClick={beginCountdown}>
              지금 따라하기 →
            </button>
          )}
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
            {/* 레벨 미터 대신 캐릭터가 입을 연다 — 소리가 잡히는지 보여주는 일은 같다. */}
            <VoiceAvatar avatar={avatar} level={levels[levels.length - 1]} size={168} />
          </div>
          <h2
            className={meme.line ? styles.cueSmallLoud : styles.cueLoud}
            aria-live="assertive"
          >
            따라해
          </h2>
          <p className={styles.cueSub}>
            {canStop ? "다 하면 끊어도 돼" : "알아서 끊어줄게"}
          </p>
          {/* 듣기 화면과 같은 자리에 같은 크기로 — 따라하는 순간 대사가 움직이면 안 된다.
              바뀌는 건 색뿐이다: 흰색(읽어둬) → 형광(지금 외쳐). */}
          {meme.line && (
            <p className={`${styles.lineCue} ${styles.lineLive}`}>
              “{meme.line}”
            </p>
          )}
          {canStop && (
            <button className={styles.skip} onClick={stopRecording}>
              다 했어 →
            </button>
          )}
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
          <VoiceAvatar avatar={avatar} level={userLevel} size={132} />
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
          {slow && <p className={styles.slow}>서버 깨우는 중이라 몇 초만 더</p>}
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

      {phase === "idle" && (
        <div className={styles.dock}>
          {isLong ? (
            <>
              <button className={styles.go} onClick={listenOnly}>
                원본 듣기
              </button>
              <div className={styles.secondary}>
                <button className={styles.ghost} onClick={recordNow}>
                  바로 따라하기
                </button>
              </div>
              <p className={styles.note}>
                {refSeconds?.toFixed(0)}초짜리라 듣기와 따라하기를 따로 뒀어
                <br />
                녹음은 직접 끊을 수 있어 · 저장 안 하면 녹음은 바로 버려
              </p>
            </>
          ) : (
            <>
              <button className={styles.go} onClick={listenAndRecord}>
                듣고 바로 따라하기
              </button>
              <div className={styles.secondary}>
                <button className={styles.ghost} onClick={listenOnly}>
                  원본만 듣기
                </button>
              </div>
              <p className={styles.note}>
                탭 한 번이면 원본 → 3·2·1 → 녹음까지 자동
                <br />
                로그인 없이 바로 · 저장 안 하면 녹음은 바로 버려
              </p>
            </>
          )}
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

          <p className={styles.verdict}>
            {verdict(result.score, result.breakdown, pitchScored(result))}
          </p>

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

          <div className={styles.performer}>
            <VoiceAvatar avatar={avatar} level={userLevel} size={112} />
            <p className={styles.performerHint}>
              {playing === "user" ? "네 목소리로 외치는 중" : "‘나’를 누르면 네 목소리로 외쳐"}
            </p>
          </div>

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

          {!pitchScored(result) && (
            <p className={styles.axisNote}>
              이 원본은 목소리 구간이 짧아 억양은 빼고 쟀어
            </p>
          )}

          <dl className={styles.metrics}>
            {[
              // 채점에 안 쓰인 축은 빼고 보여준다. 0 으로 찍으면 사용자가
              // 자기가 못한 줄 안다 — 실제로는 원본이 억양을 못 내준 것이다.
              ...(pitchScored(result)
                ? [["억양", result.breakdown.pitch] as const]
                : []),
              ["음색", result.breakdown.tone] as const,
              ["타이밍", result.breakdown.timing] as const,
            ].map(([label, value]) => (
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

          {publishPhase === "done" ? (
            <div className={styles.publish}>
              <p className={styles.publishDone}>
                저장 완료 ✓{" "}
                {publishedPublic
                  ? "이제 다른 사람들이 듣고 투표할 수 있어."
                  : loggedIn
                    ? "나만 들을 수 있게 저장했어."
                    : "로그인하면 내 녹음으로 가져올 수 있어."}
              </p>
              {adjusted && (
                <p className={styles.publishNote}>
                  서버가 다시 채점해서 점수가 확정됐어 ({adjusted.from} → {adjusted.to}점)
                </p>
              )}
              {publishedPublic ? (
                <Link href="/vote" className={styles.publishLink}>
                  투표하러 가기 →
                </Link>
              ) : (
                !loggedIn && (
                  <Link href="/login" className={styles.publishLink}>
                    로그인하고 가져오기 →
                  </Link>
                )
              )}
            </div>
          ) : (
            <div className={styles.publish}>
              {loggedIn ? (
                <label className={styles.publishToggle}>
                  <input
                    type="checkbox"
                    checked={wantsPublic}
                    onChange={(e) => setWantsPublic(e.target.checked)}
                    disabled={publishPhase === "publishing"}
                  />
                  <span>다른 사람이 듣고 투표할 수 있게 공개</span>
                </label>
              ) : (
                <p className={styles.publishNote}>
                  저장해두면 로그인한 뒤 내 캐릭터로 공개하고 투표받을 수 있어
                </p>
              )}
              {loggedIn && (
                <p className={styles.publishNote}>
                  저장 안 하면 녹음은 여기서 끝 · 저장한 건 프로필에서 언제든 지울 수 있어
                </p>
              )}
              <button
                className={styles.publishBtn}
                onClick={publish}
                disabled={publishPhase === "publishing"}
              >
                {publishPhase === "publishing"
                  ? "저장 중… 서버가 한 번 더 채점해"
                  : loggedIn && wantsPublic
                    ? "공개하고 저장"
                    : "저장하기"}
              </button>
            </div>
          )}

          <div className={styles.dock}>
            <button className={styles.go} onClick={share}>
              {copied ? "링크 복사됨" : "친구한테 던지기"}
            </button>
            <div className={styles.secondary}>
              <button
                className={styles.ghost}
                onClick={isLong ? recordNow : listenAndRecord}
              >
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
