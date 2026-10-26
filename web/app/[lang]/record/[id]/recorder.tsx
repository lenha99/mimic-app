"use client";

import Link from "next/link";
import { PrivacyTag } from "@/components/privacy-tag";
import { QuickFeedback } from "@/components/quick-feedback";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocalAvatar } from "@/components/use-local-avatar";
import { usePlaybackLevel } from "@/components/use-playback-level";
import { VoiceAvatar } from "@/components/voice-avatar";
import type { Avatar } from "@/lib/avatar";
import { clientId } from "@/lib/client-id";
import { addGuestClaim } from "@/lib/guest-claims";
import { createClient } from "@/lib/supabase/client";
import { extraLine, type Meme } from "@/lib/memes";
import { followMouth } from "@/lib/mouth";
import { track } from "@/lib/track";
import { useLang, useT } from "@/components/lang";
import { memeText } from "@/lib/meme-i18n";
import { localError, type T } from "@/lib/i18n";
import styles from "./record.module.css";

/**
 * 원본 재생 → (내 차례: 준비되면 직접 시작) → 3·2·1 → 녹음 → 자동 정지 → 채점.
 *
 * 예전엔 원본이 끝나면 곧바로 3·2·1 로 넘어가는 원테이크였다. 1초 남짓한 카운트다운은
 * 숨 고를 틈도 안 돼서 "너무 짧다"는 피드백이 나왔다. 그래서 원본 다음엔 멈춰서
 * 기다린다 — 시작 시점은 사람이 고르고, 원본은 그 자리에서 몇 번이고 다시 들을 수 있다.
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
 *
 * 마이크는 원본이 **끝난 뒤** 켠다. 예전엔 재생과 병렬로 받았는데, 폰은 마이크가
 * 켜지는 순간 오디오를 통화 모드로 바꿔서 원본을 끊거나 소리를 확 줄였다 —
 * "듣고 바로 따라하기"를 누르면 소리가 안 나던 원인이다. 첫 권한 창은 카운트다운
 * 자리에서 뜨고, 녹음은 그 약속을 기다렸다가 시작한다.
 *
 * 원본은 화면이 열릴 때 미리 받아 메모리(blob)에서 튼다. 아이폰은 preload 를
 * 무시해서 탭한 뒤에야 받기 시작했고, CDN 이 비어 있으면 2초 넘게 무음이었다.
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
/**
 * 원본이 이만큼 한 칸도 안 나아가면 끊긴 것으로 본다.
 *
 * 예전엔 "원본 길이 + 3초"를 벽시계로 재서 그 시간이 되면 무조건 녹음으로 넘겼다.
 * 길이를 아직 모를 땐 1.4초로 가정해서 5초짜리 원본이 4.4초에 잘렸고, 네트워크가
 * 버퍼링하거나 아이폰이 마이크를 켜며 재생을 멈추면 소리가 끊긴 채 녹음이 시작됐다.
 * 이제는 재생 위치가 끝에 닿아야만 넘어가고, 멈추면 다시 틀고, 오래 막히면 녹음 대신
 * 말해준다 — 원본을 다 못 들은 녹음은 점수도 엉터리다.
 */
const STALL_MS = 8_000;
/** 멈춘 원본을 다시 틀어보는 간격. 아이폰은 마이크 권한 창이 뜰 때 재생을 멈춘다. */
const RESUME_EVERY_MS = 600;
/** 3 → 2 → 1 한 칸. 시작은 사람이 눌러서 하니 이건 숨 들이쉴 만큼만. */
const COUNT_STEP_MS = 500;
/** 채점이 이만큼 넘어가면 그때 "서버 깨우는 중"을 꺼낸다. */
const SLOW_AFTER_MS = 6_000;
const RING_R = 112;
const RING_C = 2 * Math.PI * RING_R;

type Score = {
  score: number;
  grade: string;
  breakdown: { pitch: number; tone: number; timing: number };
  waveform?: { ref: number[]; user: number[] };
  /** 억양을 채점에 썼는가. 원본에 목소리 구간이 짧으면 서버가 뺀다. */
  pitch_scored?: boolean;
  error?: string;
};

type Phase =
  | "idle"
  | "listening"
  /** 원본을 다 들었다. 사람이 시작을 누를 때까지 기다린다. */
  | "ready"
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
  // 지금 서버는 직접 알려준다. 총점이 표시 곡선을 거치면서 아래 산수는 옛 응답에만 맞는다.
  if (typeof r.pitch_scored === "boolean") return r.pitch_scored;
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
function verdict(t: T, score: number, bd: Score["breakdown"], hasPitch = true): string {
  const axes: [string, number][] = [
    ...(hasPitch ? ([[t("억양", "pitch"), bd.pitch]] as [string, number][]) : []),
    [t("음색", "tone"), bd.tone],
    [t("타이밍", "rhythm"), bd.timing],
  ];
  const sorted = [...axes].sort((a, b) => b[1] - a[1]);
  const best = sorted[0][0];
  const worst = sorted[sorted.length - 1][0];

  if (score >= 90) return t("소름… 원본 틀어놓은 줄 알았어요 🫢", "Chills. Did you just play the original? 🫢");
  if (score >= 80) return t(`${best} 완전 찢었어요. 이건 자랑각 🔥`, `Your ${best} was spot on. Brag-worthy 🔥`);
  if (score >= 70) return t(`${best}은 거의 원본급! ${worst}만 살리면 S 가요`, `Great ${best}! Fix your ${worst} and S is yours`);
  if (score >= 55) return t(`${worst}만 잡으면 점수 확 뛰어요 📈`, `Lock in your ${worst} and watch it jump 📈`);
  return t("원본 한 번만 더 듣고 오면 바로 올라가요", "One more listen and you'll climb fast");
}

export default function Recorder({ meme, refUrl, beat, next, loggedIn, avatar: accountAvatar }: Props) {
  const t = useT();
  const lang = useLang();
  const mt = memeText(meme, lang);
  const [phase, setPhase] = useState<Phase>("idle");
  const [count, setCount] = useState(3);
  const [remain, setRemain] = useState(1);
  /** 녹음 중 마이크 크기 — 캐릭터 입이 이걸 따라 움직인다 (lib/mouth 로 부드럽게). */
  const [micLevel, setMicLevel] = useState(0);
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
  /** 로그인했으면 계정 캐릭터, 아니면 캐릭터 탭에서 이 폰에 저장해둔 녀석. */
  const localAvatar = useLocalAvatar();
  const avatar: Avatar = (!loggedIn && localAvatar) || accountAvatar;

  const [publishPhase, setPublishPhase] = useState<PublishPhase>("idle");
  const [wantsPublic, setWantsPublic] = useState(false); // 공개는 opt-in (이슈 #16)
  const [publishedPublic, setPublishedPublic] = useState(false);
  const [adjusted, setAdjusted] = useState<{ from: number; to: number } | null>(null);
  /** 서버에 저장된 이번 녹음. 링크 공유는 이걸 켜기만 한다 (두 번 올리지 않게). */
  const [savedRec, setSavedRec] = useState<{ id: string; claimToken: string | null } | null>(null);
  /** 목소리 링크: 만드는 중 → 준비됨(보내기). 아이폰은 몇 초 기다린 뒤엔 공유 시트를 안 열어줘서 두 번 누르게 한다. */
  const [linkState, setLinkState] = useState<"idle" | "making" | "ready">("idle");
  const [shareUrl, setShareUrl] = useState<string | null>(null);

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
  /** 원본을 우리가 일부러 멈췄는지. 아니면(시스템이 끊었으면) 다시 튼다. */
  const pausedByUs = useRef(false);
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

  /**
   * 원본을 미리 받아 메모리에서 튼다 (맨 위 주석). 못 받으면 원래 주소 그대로 둔다.
   * 소스는 대기 화면에서만 바꾼다 — 듣는 중에 바꾸면, 전화·알림으로 잠깐 멈췄던
   * 원본이 이어지지 않고 처음부터 다시 나온다. 그땐 받아둔 걸 들고 있다가 다음에
   * 처음부터 틀 때(playRef) 바꾼다.
   */
  const [refSrc, setRefSrc] = useState(refUrl);
  const pendingSrc = useRef<string | null>(null);
  useEffect(() => {
    let blobUrl: string | null = null;
    let cancelled = false;
    void fetch(refUrl)
      .then((res) => (res.ok ? res.arrayBuffer() : null))
      .then((buf) => {
        if (cancelled || !buf) return;
        const seconds = wavSeconds(buf);
        if (seconds) setRefSeconds((prev) => prev ?? seconds);
        blobUrl = URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
        if (phaseRef.current === "idle" && refAudio.current?.paused !== false) setRefSrc(blobUrl);
        else pendingSrc.current = blobUrl;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [refUrl]);

  /** 채점 서버 예열. 화면이 열리자마자 한 번 찌른다. */
  useEffect(() => {
    void fetch("/api/warm", { method: "POST" }).catch(() => {});
  }, []);

  // 퍼널: 이 화면에 들어왔다. 친구 점수(?s=)를 달고 왔으면 도전장을 받고 온 것이다 —
  // 이 앱이 퍼지는 유일한 길이 실제로 도는지는 이 숫자가 말해준다.
  useEffect(() => {
    track("view_record", { meme_id: meme.id });
    if (beat !== null) track("arrive_challenge", { meme_id: meme.id });
    // 화면당 한 번만 센다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = useCallback(
    async (blob: Blob) => {
      if (blob.size === 0) {
        setError(t("소리가 안 잡혔어요. 마이크 가까이에서 한 번 더 해볼까요?", "We couldn't hear you. Get closer to the mic and try again?"));
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
      setSavedRec(null);
      setLinkState("idle");
      setShareUrl(null);
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
          setError(localError(t, data.error, "채점이 잠깐 삐끗했어요. 한 번만 다시 해주세요", "Scoring hiccup. Please try once more"));
          setPhase("idle");
          return;
        }
        setResult(data);
        setPhase("result");
      } catch {
        setError(t("인터넷이 잠깐 끊겼어요. 다시 해볼까요?", "Connection dropped. Try again?"));
        setPhase("idle");
      }
    },
    [meme.id, t],
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
        setError(t("마이크 준비가 덜 됐어요. 한 번 더 눌러주세요", "Mic isn't ready yet. Tap once more"));
        setPhase("idle");
        return;
      }
      try {
        live = await micRequest.current;
        stream.current = live;
      } catch {
        setError(t("마이크를 허용해야 점수가 나와요 🎙️", "Allow the mic to get your score 🎙️"));
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
    track("record_start", { meme_id: meme.id });
    setMicLevel(0);
    setRemain(1);
    setCanStop(windowMs.current > MANUAL_STOP_ABOVE_MS);
    setPhase("recording");

    timers.current.push(
      window.setTimeout(() => {
        if (rec.state !== "inactive") rec.stop();
      }, windowMs.current),
    );
  }, [clearTimers, meme.id, releaseMic, submit, t]);

  /**
   * 마이크 요청. 기다리지 않고 약속만 들고 있는다 — 녹음 시작 직전에 기다린다.
   * 이미 받아둔 게 있으면 그대로 쓴다.
   */
  const requestMic = useCallback(() => {
    if (stream.current || micRequest.current) return;
    if (!navigator.mediaDevices?.getUserMedia) return;
    micRequest.current = navigator.mediaDevices.getUserMedia({ audio: true });
    // 여기서 처리하지 않으면 거부 시 unhandled rejection 이 된다.
    micRequest.current.catch(() => {});
  }, []);

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

    pausedByUs.current = true;
    refAudio.current?.pause();
    // 원본이 끝난 지금 마이크를 켠다 (맨 위 주석 — 재생 중에 켜면 원본이 죽는다).
    requestMic();
    setPhase("countdown");
    setCount(3);
    timers.current.push(window.setTimeout(() => setCount(2), COUNT_STEP_MS));
    timers.current.push(window.setTimeout(() => setCount(1), COUNT_STEP_MS * 2));
    timers.current.push(
      window.setTimeout(() => void beginRecording(), COUNT_STEP_MS * 3),
    );
  }, [beginRecording, clearTimers, requestMic]);

  /**
   * 원본이 끝났다. 이어서 따라할 거면 "내 차례"에서 기다리고, 아니면 대기 화면으로.
   * 감시 루프와 onEnded 가 둘 다 부를 수 있어서 phaseRef 를 바로 바꿔 한 번만 돈다.
   */
  const finishListening = useCallback(() => {
    if (phaseRef.current !== "listening") return;
    const nextPhase: Phase = chain.current ? "ready" : "idle";
    phaseRef.current = nextPhase;
    pausedByUs.current = true;
    refAudio.current?.pause();
    setPhase(nextPhase);
  }, []);

  /** 내 차례에서 시작을 눌렀다. */
  const startTake = useCallback(() => {
    advanced.current = false;
    beginCountdown();
  }, [beginCountdown]);

  /**
   * 원본 재생. **반드시 클릭 핸들러에서 동기적으로 호출해야 한다** — 앞에 await 이
   * 있으면 제스처가 만료돼 자동재생 정책에 막힌다.
   */
  const playRef = useCallback(
    (thenRecord: boolean) => {
      const el = refAudio.current;
      if (!el) {
        setError(t("원본을 못 불러왔어요. 새로고침 해볼까요?", "Couldn't load the original. Refresh?"));
        return;
      }

      setError(null);
      setResult(null);
      advanced.current = false;
      pausedByUs.current = false;
      chain.current = thenRecord;
      setChaining(thenRecord);
      clearTimers();

      // 듣는 중에 받아진 원본은 처음부터 다시 트는 지금 갈아끼운다 (위 refSrc 주석).
      if (pendingSrc.current) {
        el.src = pendingSrc.current;
        setRefSrc(pendingSrc.current);
        pendingSrc.current = null;
      }

      try {
        el.currentTime = 0;
      } catch {
        // 메타데이터가 아직이면 0 으로 못 돌릴 수 있다. 그대로 재생한다.
      }

      el.play()
        .then(() => {
          track("play_ref", { meme_id: meme.id });
          setPhase("listening");
          setRemain(1);
          // 끝났는지는 아래 감시 루프가 재생 위치로 판단한다 (STALL_MS 주석 참고).
        })
        .catch(() => {
          // 예전엔 여기서 조용히 녹음으로 넘어갔다. 그러면 원본을 못 들은 채로
          // 녹음이 돌아 점수만 이상하게 나온다. 이제는 말해주고 멈춘다.
          setPhase("idle");
          setError(t("원본이 재생되지 않았어요. 한 번만 더 눌러주세요", "The original didn't play. Tap once more"));
        });
    },
    [clearTimers, meme.id, t],
  );

  /** 듣고 따라하기 (짧은 원본의 기본 동작). 원본이 끝나면 "내 차례"에서 기다린다. */
  const listenAndRecord = useCallback(() => {
    if (typeof MediaRecorder === "undefined") {
      setError(t("이 브라우저는 녹음을 지원하지 않아요. 크롬이나 사파리로 열어주세요", "This browser can't record. Open in Chrome or Safari"));
      return;
    }
    playRef(true); // 마이크는 원본이 끝나고 beginCountdown 에서 켠다
  }, [playRef, t]);

  /** 원본만 듣기 — 녹음으로 이어지지 않는다. */
  const listenOnly = useCallback(() => {
    playRef(false);
  }, [playRef]);

  /** 원본을 건너뛰고 바로 따라하기. */
  const recordNow = useCallback(() => {
    if (typeof MediaRecorder === "undefined") {
      setError(t("이 브라우저는 녹음을 지원하지 않아요. 크롬이나 사파리로 열어주세요", "This browser can't record. Open in Chrome or Safari"));
      return;
    }
    setError(null);
    setResult(null);
    advanced.current = false;
    chain.current = false;
    setChaining(false);
    refAudio.current?.pause();
    beginCountdown();
  }, [beginCountdown, t]);

  // 링 진행도 · 원본 재생 감시 · 마이크 크기.
  useEffect(() => {
    if (phase !== "listening" && phase !== "recording") return;

    let raf = 0;
    let last = performance.now();
    let mouth = 0;
    const startedAt = last;
    const buffer = new Uint8Array(analyser.current?.fftSize ?? 1024);

    // 원본 감시 상태
    let lastPos = -1;
    let lastProgressAt = last;
    let lastResumeAt = 0;

    const loop = (now: number) => {
      const dt = now - last;
      last = now;

      if (phaseRef.current === "listening") {
        const el = refAudio.current;
        if (el) {
          const d = el.duration;
          const known = Number.isFinite(d) && d > 0;
          if (known) setRemain(Math.max(0, 1 - el.currentTime / d));

          if (el.currentTime !== lastPos) {
            lastPos = el.currentTime;
            lastProgressAt = now;
          }

          const done = el.ended || (known && el.currentTime >= d - 0.04);
          if (done) {
            finishListening();
          } else if (el.paused && !pausedByUs.current && now - lastResumeAt > RESUME_EVERY_MS) {
            // 시스템이 끊었다(아이폰 마이크 권한 창, 오디오 세션 전환). 이어서 튼다.
            lastResumeAt = now;
            void el.play().catch(() => {});
          } else if (now - lastProgressAt > STALL_MS) {
            pausedByUs.current = true;
            el.pause();
            setPhase("idle");
            setError(t("원본이 중간에 멈췄어요. 한 번만 더 눌러주세요", "The original stopped midway. Tap once more"));
          }
        }
      } else {
        setRemain(Math.max(0, 1 - (now - startedAt) / windowMs.current));

        const node = analyser.current;
        if (node) {
          node.getByteTimeDomainData(buffer);
          let sum = 0;
          for (let i = 0; i < buffer.length; i += 1) {
            const v = (buffer[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.min(1, Math.sqrt(sum / buffer.length) * 3.4);
          mouth = followMouth(mouth, rms, dt);
          setMicLevel(mouth);
        }
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase, finishListening, t]);

  const toggle = useCallback(
    (which: "ref" | "user") => {
      const el = which === "ref" ? refAudio.current : userAudio.current;
      const other = which === "ref" ? userAudio.current : refAudio.current;
      pausedByUs.current = true;
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
      finishListening();
      return;
    }
    // 채점을 기다리는 동안 원본 다음에 내 소리를 한 번 이어서 들려준다.
    if (phaseRef.current === "scoring" && !abPlayed.current) {
      abPlayed.current = true;
      toggle("user");
    }
  }, [finishListening, toggle]);

  useEffect(() => {
    if (phase !== "scoring" || abPlayed.current) return;
    toggle("ref");
    // toggle 은 playing 에 의존해 매번 새로 만들어지므로 의존성에서 뺀다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  /**
   * 도전장 문구. 도전장을 받고 왔으면 고리가 거기서 끊기면 안 된다 — 이겼으면
   * 되갚는 말이, 졌으면 다시 부르는 말이 나가야 그 사람이 또 던진다.
   */
  const challengeText = useCallback(
    (voice: boolean) => {
      if (!result) return "";
      // 친구에게 "내가" 보내는 말이라 앱 말투(해요체)가 아니라 친구끼리 말투로 쓴다.
      const hook = voice ? t(" 내 목소리도 들어봐 🎧", " Hear my take 🎧") : "";
      const title = mt.title;
      return beat === null
        ? t(
            `'${title}' ${result.score}점(${result.grade}) 찍음 ㅋ 너는 몇 점 나올 듯? 😏${hook}`,
            `Scored ${result.score} (${result.grade}) on "${title}" 😏 Think you can beat me?${hook}`,
          )
        : result.score > beat
          ? t(
              `'${title}' ${result.score}점으로 니 ${beat}점 넘음 ㅋㅋ 억울하면 다시 와 🔥${hook}`,
              `Just beat your ${beat} with ${result.score} on "${title}" 😎 Your move.${hook}`,
            )
          : t(
              `'${title}' ${result.score}점… 니 ${beat}점 아직 못 넘었다. 다음 판엔 진짜 간다 😤`,
              `${result.score} on "${title}"… still short of your ${beat}. Rematch incoming 😤`,
            );
    },
    [beat, mt.title, result, t],
  );

  /** 공유 시트(없으면 복사). 제스처가 식어 막혔으면 false — 버튼을 한 번 더 누르면 된다. */
  const sendLink = useCallback(async (link: string, text: string) => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "MIMIC", text, url: link });
        return true;
      } catch (e) {
        return !(e instanceof DOMException && e.name === "NotAllowedError");
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${link}`);
      setCopied(true);
      timers.current.push(window.setTimeout(() => setCopied(false), 2400));
      return true;
    } catch {
      setError(t("공유가 안 됐어요. 링크를 길게 눌러 복사해주세요", "Couldn't share. Long-press the link to copy it"));
      return false;
    }
  }, [t]);

  /** 점수만 보내기 — 녹음은 안 나간다. */
  const shareScore = useCallback(async () => {
    if (!result) return;
    const url = new URL(window.location.href);
    url.searchParams.set("s", String(result.score));
    track("share", { meme_id: meme.id, via: "score" });
    await sendLink(url.toString(), challengeText(false));
  }, [challengeText, meme.id, result, sendLink]);

  /**
   * 결과를 서버에 저장한다 (이슈 #23).
   *
   * 점수는 보내지 않는다 — 서버가 같은 오디오를 Modal 에 다시 채점시켜 나온 값만
   * 기록한다. 그래서 화면 점수와 확정 점수가 미세하게 다를 수 있고, 다르면
   * 확정값으로 바꿔 보여준다 (랭킹에 올라가는 건 확정값이라 속이면 안 된다).
   */
  /** 이번 녹음을 서버에 올린다. 점수는 보내지 않는다 — 서버가 다시 채점한다. */
  const upload = useCallback(
    async (visibility: "private" | "link" | "public") => {
      const blob = blobRef.current;
      if (!blob || !result) return null;
      const body = new FormData();
      body.append("file", blob, "recording.webm");
      body.append("visibility", visibility);
      body.append("avatar", JSON.stringify(avatar));
      const res = await fetch(
        `/api/publish-recording?meme_id=${encodeURIComponent(meme.id)}` +
          `&client=${encodeURIComponent(clientId())}`,
        { method: "POST", body },
      );
      const data = await res.json();
      // 비로그인이면 1회용 토큰이 온다. 로그인 후 /profile 에서 귀속시킨다.
      // 그 사이 다시 녹음했더라도 이 녹음은 저장됐으니 토큰은 챙긴다.
      if (data.claimToken) addGuestClaim(data.claimToken);
      return { ok: res.ok && !data.error, data };
    },
    [avatar, meme.id, result],
  );

  /** 서버가 다시 채점한 확정 점수로 화면을 맞춘다 (랭킹·링크에 올라가는 건 확정값이다). */
  const applyConfirmed = useCallback(
    (data: { score?: number; grade?: string; breakdown?: Score["breakdown"] }) => {
      if (!result || typeof data.score !== "number") return;
      if (data.score !== result.score) setAdjusted({ from: result.score, to: data.score });
      setResult((prev) =>
        prev && data.breakdown
          ? { ...prev, score: data.score!, grade: data.grade ?? prev.grade, breakdown: data.breakdown }
          : prev,
      );
    },
    [result],
  );

  /**
   * 내 목소리로 도발하기 — 이번 녹음을 링크로 들을 수 있게 하고 보낸다.
   * 이미 저장했으면 공유만 켜고, 아니면 "링크 공개"로 저장한다.
   */
  const makeLink = useCallback(async () => {
    if (!result || linkState === "making") return;
    const mine = attempt.current;
    setLinkState("making");
    setError(null);
    try {
      let rec = savedRec;
      if (rec) {
        const res = await fetch(`/api/recordings/${rec.id}/share`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ claimToken: rec.claimToken, avatar }),
        });
        if (!res.ok) throw new Error();
      } else {
        const out = await upload("link");
        if (!out?.ok) {
          if (mine === attempt.current) {
            setLinkState("idle");
            setError(out?.data?.error ?? t("링크를 못 만들었어요. 다시 눌러주세요", "Couldn't create the link. Tap again"));
          }
          return;
        }
        rec = { id: out.data.recordingId, claimToken: out.data.claimToken ?? null };
        if (mine !== attempt.current) return;
        setSavedRec(rec);
        applyConfirmed(out.data);
        setPublishedPublic(false);
        setPublishPhase("done");
      }
      if (mine !== attempt.current) return;
      const link = `${window.location.origin}/p/${rec.id}`;
      setShareUrl(link);
      setLinkState("ready");
      track("share", { meme_id: meme.id, via: "voice" });
      // 기다리는 사이 제스처가 식었으면 여기서 막힌다 — 그땐 "보내기"를 한 번 더 누르면 된다.
      await sendLink(link, challengeText(true));
    } catch {
      if (mine !== attempt.current) return;
      setLinkState("idle");
      setError(t("링크를 못 만들었어요. 다시 눌러주세요", "Couldn't create the link. Tap again"));
    }
  }, [applyConfirmed, avatar, challengeText, linkState, meme.id, result, savedRec, sendLink, upload, t]);

  /**
   * 결과를 서버에 저장한다 (저장하기 버튼).
   * 링크로 이미 저장됐으면 다시 올리지 않고 공개 여부만 바꾼다.
   */
  const publish = useCallback(async () => {
    if (!result) return;
    const makePublic = loggedIn && wantsPublic;
    const mine = attempt.current;

    setPublishPhase("publishing");
    setError(null);
    try {
      if (savedRec) {
        if (makePublic) {
          const { error: e } = await createClient()
            .from("recordings")
            .update({ is_public: true })
            .eq("id", savedRec.id);
          if (e) throw e;
        }
        setPublishedPublic(makePublic);
        setPublishPhase("done");
        return;
      }
      const out = await upload(makePublic ? "public" : "private");
      if (!out || mine !== attempt.current) return;
      if (!out.ok) {
        setError(out.data.error ?? t("저장이 안 됐어요. 다시 눌러주세요", "Couldn't save. Tap again"));
        setPublishPhase("idle");
        return;
      }
      setSavedRec({ id: out.data.recordingId, claimToken: out.data.claimToken ?? null });
      applyConfirmed(out.data);
      setPublishedPublic(makePublic);
      setPublishPhase("done");
    } catch {
      if (mine !== attempt.current) return;
      setError(t("인터넷이 잠깐 끊겼어요. 다시 저장해주세요", "Connection dropped. Please save again"));
      setPublishPhase("idle");
    }
  }, [applyConfirmed, loggedIn, result, savedRec, upload, wantsPublic, t]);

  const ringOffset = RING_C * (1 - remain);

  return (
    <>
      <audio
        ref={refAudio}
        src={refSrc}
        preload="auto"
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) setRefSeconds(d);
        }}
        onPlay={() => setPlaying("ref")}
        onPause={() => setPlaying(null)}
        onEnded={onRefEnded}
        onError={() =>
          setError(t("원본을 못 불러왔어요. 잠시 뒤 다시 눌러주세요", "Couldn't load the original. Try again in a moment"))
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
              {t(
                <>친구가 <strong>{beat}점</strong> 찍고 도망갔어요</>,
                <>Your friend scored <strong>{beat}</strong> and dipped</>,
              )}
            </p>
            <p className={styles.challengeSub}>{t("이 점수 넘으면 자랑할 권리는 내 거예요 😏", "Beat it and the bragging rights are yours 😏")}</p>
          </div>
        </div>
      )}

      {phase === "idle" && (
        <section className={styles.stage}>
          <p className={styles.kicker}>{t("원본", "Original")}</p>
          <h2 className={styles.hero}>{mt.title}</h2>
          <p className={styles.heroMeta}>
            {mt.source}
            {refSeconds !== null && t(` · ${refSeconds.toFixed(1)}초`, ` · ${refSeconds.toFixed(1)}s`)}
          </p>
          {mt.meaning && <p className={styles.heroMeta}>{mt.meaning}</p>}
          {/* 제목이 이미 대사인 밈("무야호")은 같은 말을 두 번 찍지 않는다. */}
          {extraLine(meme) && (
            <p className={styles.line}>“{extraLine(meme)}”</p>
          )}
          {mt.roman && <p className={styles.heroMeta}>🗣️ {mt.roman}</p>}
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
            {phase === "listening" ? t("귀 쫑긋 👂", "Listen up 👂") : t("준비!", "Get ready!")}
          </h2>
          <p className={styles.cueSub}>
            {phase === "countdown"
              ? t("곧 시작해요", "Starting soon")
              : chaining
                ? t("다 들으면 바로 내 차례예요", "Your turn right after this")
                : t("감상 모드예요", "Just listening")}
          </p>
          {meme.line && <p className={styles.lineCue}>“{meme.line}”</p>}
          {mt.roman && <p className={styles.cueSub}>{mt.roman}</p>}
          {phase === "listening" && (
            <button className={styles.skip} onClick={beginCountdown}>
              {t("바로 따라 하기 →", "Go now →")}
            </button>
          )}
        </section>
      )}

      {phase === "ready" && (
        <section className={styles.stage}>
          <VoiceAvatar avatar={avatar} level={0} size={168} />
          <h2 className={meme.line ? styles.cueSmall : styles.cue}>{t("이제 내 차례!", "Your turn!")}</h2>
          <p className={styles.cueSub}>{t("준비되면 눌러주세요 · 3·2·1 뒤에 녹음돼요", "Tap when ready · recording starts after 3·2·1")}</p>
          {meme.line && <p className={styles.lineCue}>“{meme.line}”</p>}
          {mt.roman && <p className={styles.cueSub}>{mt.roman}</p>}
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
            <VoiceAvatar avatar={avatar} level={micLevel} size={168} />
          </div>
          <h2
            className={meme.line ? styles.cueSmallLoud : styles.cueLoud}
            aria-live="assertive"
          >
            {t("지금! 🎤", "Go! 🎤")}
          </h2>
          <p className={styles.cueSub}>
            {canStop ? t("다 했으면 끊어도 돼요", "Done? Stop anytime") : t("끝나면 알아서 멈춰요", "Stops automatically")}
          </p>
          {/* 듣기 화면과 같은 자리에 같은 크기로 — 따라하는 순간 대사가 움직이면 안 된다.
              바뀌는 건 색뿐이다: 흰색(읽어둬) → 형광(지금 외쳐). */}
          {meme.line && (
            <p className={`${styles.lineCue} ${styles.lineLive}`}>
              “{meme.line}”
            </p>
          )}
          {mt.roman && <p className={styles.cueSub}>{mt.roman}</p>}
          {canStop && (
            <button className={styles.skip} onClick={stopRecording}>
              {t("다 했어요 →", "Done →")}
            </button>
          )}
        </section>
      )}

      {phase === "scoring" && (
        <section className={styles.stage} role="status">
          <h2 className={styles.waitTitle}>
            {t("방금 내 목소리,", "Wanna hear")}
            <br />
            {t("들어볼까요?", "your take?")}
          </h2>
          <p className={styles.cueSub}>{t("AI가 채점하는 동안 원본이랑 비교해보세요", "Scoring… compare it with the original meanwhile")}</p>
          <VoiceAvatar avatar={avatar} level={userLevel} size={132} />
          <div className={styles.compare}>
            <PlayRow
              label={t("원본", "Original")}
              tone="ref"
              active={playing === "ref"}
              onClick={() => toggle("ref")}
            />
            <PlayRow
              label={t("나", "Me")}
              tone="user"
              active={playing === "user"}
              onClick={() => toggle("user")}
            />
          </div>
          {slow && <p className={styles.slow}>{t("서버 깨우는 중이에요. 몇 초만요!", "Waking up the server — just a sec!")}</p>}
        </section>
      )}

      {error && (
        <p className={styles.error} role="alert">
          {error}{" "}
          <Link href="/probe" className={styles.errorLink}>
            {t("마이크 점검 →", "Check mic →")}
          </Link>
        </p>
      )}

      {phase === "idle" && (
        <div className={styles.dock}>
          {isLong ? (
            <>
              <button className={styles.go} onClick={listenOnly} data-tour="record-listen">
                {t("원본 듣기", "Hear the original")}
              </button>
              <div className={styles.secondary}>
                <button className={styles.ghost} onClick={recordNow} data-tour="record-go">
                  {t("바로 따라 하기", "Skip to my turn")}
                </button>
              </div>
              <p className={styles.note}>
                {t(
                  `${refSeconds?.toFixed(0)}초짜리 긴 대사라 듣기와 따라 하기를 나눠뒀어요`,
                  `It's a ${refSeconds?.toFixed(0)}s line, so listening and recording are split`,
                )}
                <br />
                {t("녹음은 직접 끊을 수 있어요 · 저장 안 하면 바로 사라져요", "Stop whenever you like · unsaved takes vanish instantly")}
              </p>
            </>
          ) : (
            <>
              <button className={styles.go} onClick={listenAndRecord} data-tour="record-go">
                {t("듣고 따라 하기", "Listen & copy")}
              </button>
              <div className={styles.secondary}>
                <button className={styles.ghost} onClick={listenOnly} data-tour="record-listen">
                  {t("원본만 듣기", "Just listen")}
                </button>
              </div>
              <p className={styles.note}>
                {t("원본 듣고, 준비되면 시작을 눌러주세요", "Hear it, then tap start when you're ready")}
                <br />
                {t("가입 없이 바로 · 저장 안 하면 녹음은 바로 사라져요", "No sign-up · unsaved takes vanish instantly")}
              </p>
            </>
          )}
        </div>
      )}

      {phase === "ready" && (
        <div className={styles.dock}>
          <button className={styles.go} onClick={startTake}>
            {t("따라 하기 시작", "Start")}
          </button>
          <div className={styles.secondary}>
            <button className={styles.ghost} onClick={listenAndRecord}>
              {t("원본 다시 듣기", "Replay original")}
            </button>
          </div>
        </div>
      )}

      {phase === "result" && result && (
        <section className={styles.result}>
          <div className={styles.scoreRow}>
            <span className={styles.score}>{result.score}</span>
            <span className={styles.scoreUnit}>{t("점", "pts")}</span>
            <span
              className={`${styles.grade} ${GRADE_CLASS[result.grade] ?? styles.gradeMid}`}
            >
              {result.grade}
            </span>
          </div>

          <p className={styles.verdict}>
            {verdict(t, result.score, result.breakdown, pitchScored(result))}
          </p>

          {beat !== null && (
            <div className={styles.beat}>
              <p className={styles.beatText}>
                {result.score > beat
                  ? t(`친구 ${beat}점 넘었어요 🎉`, `You beat your friend's ${beat} 🎉`)
                  : t(`친구 ${beat}점까지 조금만 더!`, `Almost there — friend's score: ${beat}`)}
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
              {playing === "user"
                ? t("내 목소리로 외치는 중 🔊", "Shouting in your voice 🔊")
                : t("‘나’를 누르면 캐릭터가 내 목소리로 외쳐요", "Tap ‘Me’ to hear your character shout it")}
            </p>
          </div>

          <div className={styles.compare}>
            <PlayRow
              label={t("원본", "Original")}
              tone="ref"
              active={playing === "ref"}
              onClick={() => toggle("ref")}
            />
            <PlayRow
              label={t("나", "Me")}
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
              {t("이 원본은 목소리 구간이 짧아서 억양은 빼고 채점했어요", "This clip is too short for pitch, so it's scored on tone & rhythm")}
            </p>
          )}

          <dl className={styles.metrics}>
            {[
              // 채점에 안 쓰인 축은 빼고 보여준다. 0 으로 찍으면 사용자가
              // 자기가 못한 줄 안다 — 실제로는 원본이 억양을 못 내준 것이다.
              ...(pitchScored(result)
                ? [[t("억양", "Pitch"), result.breakdown.pitch] as const]
                : []),
              [t("음색", "Tone"), result.breakdown.tone] as const,
              [t("타이밍", "Rhythm"), result.breakdown.timing] as const,
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
              <PrivacyTag kind={publishedPublic ? "public" : linkState === "ready" ? "link" : "private"} />
              <p className={styles.publishDone}>
                {t("저장 완료 ✓", "Saved ✓")}{" "}
                {publishedPublic
                  ? t("피드에 올라갔어요! 사람들이 원본이랑 비교해 듣고 반응을 남길 거예요", "It's live on the feed! People will compare it with the original and react")
                  : linkState === "ready"
                    ? t("링크를 받은 사람만 들을 수 있어요", "Only people with the link can listen")
                    : loggedIn
                    ? t("나만 들을 수 있게 저장했어요", "Saved privately — only you can hear it")
                    : t("로그인하면 내 기록으로 가져올 수 있어요", "Log in to keep it on your profile")}
              </p>
              {adjusted && (
                <p className={styles.publishNote}>
                  {t(
                    `서버에서 한 번 더 채점해 점수가 확정됐어요 (${adjusted.from} → ${adjusted.to}점)`,
                    `Final score confirmed by the server (${adjusted.from} → ${adjusted.to})`,
                  )}
                </p>
              )}
              {publishedPublic && savedRec ? (
                <Link href={`/feed?r=${savedRec.id}`} className={styles.publishLink}>
                  {t("피드에서 내 녹음 보기 →", "See it on the feed →")}
                </Link>
              ) : (
                !loggedIn && (
                  <Link href="/login" className={styles.publishLink}>
                    {t("로그인하고 가져오기 →", "Log in to keep it →")}
                  </Link>
                )
              )}
            </div>
          ) : (
            <div className={styles.publish}>
              <PrivacyTag kind="unsaved" />
              {loggedIn ? (
                <label className={styles.publishToggle}>
                  <input
                    type="checkbox"
                    checked={wantsPublic}
                    onChange={(e) => setWantsPublic(e.target.checked)}
                    disabled={publishPhase === "publishing"}
                  />
                  <span>{t("피드에 올리기 · 다른 사람들이 듣고 반응할 수 있어요", "Post to feed · others can listen & react")}</span>
                </label>
              ) : (
                <p className={styles.publishNote}>
                  {t("저장해두면 로그인 후 내 캐릭터로 피드에 올릴 수 있어요", "Save it now, post it with your character after logging in")}
                </p>
              )}
              {loggedIn && (
                <p className={styles.publishNote}>
                  {t("저장 안 하면 여기서 사라져요 · 저장한 건 프로필에서 언제든 지울 수 있어요", "Unsaved takes disappear · delete saved ones anytime from your profile")}
                </p>
              )}
              <button
                className={styles.publishBtn}
                onClick={publish}
                disabled={publishPhase === "publishing"}
              >
                {publishPhase === "publishing"
                  ? t("저장 중… 서버가 점수를 한 번 더 확인하고 있어요", "Saving… double-checking your score")
                  : loggedIn && wantsPublic
                    ? t("저장하고 피드에 올리기", "Save & post")
                    : t("저장하기", "Save")}
              </button>
            </div>
          )}

          <div className={styles.dock}>
            <button
              className={styles.go}
              onClick={
                linkState === "ready" && shareUrl
                  ? () => void sendLink(shareUrl, challengeText(true))
                  : makeLink
              }
              disabled={linkState === "making"}
            >
              {linkState === "making"
                ? t("링크 만드는 중…", "Making link…")
                : linkState === "ready"
                  ? copied
                    ? t("링크 복사 완료!", "Link copied!")
                    : t("보내기 ↗", "Send ↗")
                  : t("🔥 친구한테 도전장 보내기", "🔥 Challenge a friend")}
            </button>
            <p className={styles.shareNote}>
              {linkState === "ready"
                ? t("링크를 연 친구는 내 캐릭터가 내 목소리로 외치는 걸 듣게 돼요", "Your friend will hear your character shout it in your voice")
                : t("내 캐릭터가 내 목소리로 외치는 링크가 가요 · 링크 받은 사람만 들어요", "Sends a link where your character shouts it in your voice")}
              {" · "}
              <button type="button" className={styles.textBtn} onClick={shareScore}>
                {t("점수만 보내기", "Send score only")}
              </button>
            </p>
            <div className={styles.secondary}>
              <button
                className={styles.ghost}
                onClick={isLong ? recordNow : listenAndRecord}
              >
                {t("한 번 더", "Try again")}
              </button>
              {next ? (
                <Link className={styles.ghost} href={`/record/${next.id}`}>
                  {memeText({ id: next.id, title: next.title, source: "" }, lang).title} →
                </Link>
              ) : (
                <Link className={styles.ghost} href="/">
                  {t("다른 대사 →", "More clips →")}
                </Link>
              )}
            </div>
          </div>
          <QuickFeedback page="record" item={meme.id} />
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
  const t = useT();
  return (
    <button
      type="button"
      className={`${styles.playRow} ${tone === "ref" ? styles.rowRef : styles.rowUser}`}
      onClick={onClick}
      aria-label={`${label} ${active ? t("정지", "pause") : t("재생", "play")}`}
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

/**
 * WAV 헤더에서 길이(초)를 읽는다. 아이폰은 재생 전엔 메타데이터를 안 읽어서
 * 긴 원본인지(듣기/따라하기 분리)를 첫 탭 전에 알 수 없었다. WAV 가 아니면 null.
 */
function wavSeconds(buf: ArrayBuffer): number | null {
  if (buf.byteLength < 44) return null;
  const v = new DataView(buf);
  const tag = (at: number) =>
    String.fromCharCode(v.getUint8(at), v.getUint8(at + 1), v.getUint8(at + 2), v.getUint8(at + 3));
  if (tag(0) !== "RIFF" || tag(8) !== "WAVE") return null;
  let byteRate = 0;
  for (let at = 12; at + 8 <= buf.byteLength; ) {
    const id = tag(at);
    const size = v.getUint32(at + 4, true);
    if (id === "fmt ") byteRate = v.getUint32(at + 16, true);
    if (id === "data") {
      const bytes = Math.min(size, buf.byteLength - at - 8);
      return byteRate > 0 ? bytes / byteRate : null;
    }
    at += 8 + size + (size % 2);
  }
  return null;
}
