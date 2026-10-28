"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { VoiceAvatar } from "@/components/voice-avatar";
import { useViewer } from "@/components/viewer";
import { useToast } from "@/components/weekly/toast";
import { shareLink } from "@/components/weekly/use-weekly";
import { useLang, useT } from "@/components/lang";
import { DEFAULT_AVATAR, encodeAvatar } from "@/lib/avatar";
import { track } from "@/lib/track";
import { analyzeBlob } from "@/lib/voice-analysis";
import { cardQuery, exprOf, READ_LINE, registerOf, VOICE_TYPES, type CardData } from "@/lib/voice-card";
import { VoiceCard } from "./card";
import styles from "./voice.module.css";

/** 녹음 상한 — 문장은 7~10초면 읽는다. */
const MAX_MS = 15_000;
/** 이보다 짧으면 음높이를 믿을 수 없다. */
const MIN_SPAN_S = 2.5;

type Phase = "ready" | "recording" | "analyzing" | "done";

/**
 * 보이스 카드 만들기 — 문장 하나 읽기 → 브라우저에서 측정 → 카드.
 *
 * 녹음은 어디에도 올리지 않는다. 숫자 세 개만 남고 그것도 공유할 때 링크에만 담긴다.
 * 그래서 로그인도, 서버도 필요 없다 — 첫 방문자가 10초 만에 가지고 놀 수 있는 입구다.
 */
export default function Maker() {
  const t = useT();
  const lang = useLang();
  const viewer = useViewer();
  const avatar = viewer?.avatar ?? DEFAULT_AVATAR;
  const line = READ_LINE[lang];
  const [phase, setPhase] = useState<Phase>("ready");
  const [level, setLevel] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [card, setCard] = useState<CardData | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const ctx = useRef<AudioContext | null>(null);
  const [toast, showToast] = useToast();

  const release = useCallback(() => {
    stream.current?.getTracks().forEach((x) => x.stop());
    stream.current = null;
    void ctx.current?.close().catch(() => {});
    ctx.current = null;
  }, []);

  useEffect(() => () => release(), [release]);

  const finish = async (blob: Blob) => {
    setPhase("analyzing");
    try {
      const a = await analyzeBlob(blob, line.syllables);
      if (a.span < MIN_SPAN_S || a.pitchHz === null || a.pitchRange === null) {
        setPhase("ready");
        setError(t("목소리가 잘 안 들렸어요. 조용한 곳에서 문장을 끝까지 읽어 주세요.", "We couldn't hear enough. Read the whole line somewhere quiet."));
        return;
      }
      const type = `${registerOf(a.pitchHz)}-${exprOf(a.pitchRange)}` as const;
      const next: CardData = {
        type,
        hz: Math.round(a.pitchHz),
        st10: Math.round(a.pitchRange * 10),
        pace10: a.pace !== null ? Math.round(a.pace * 10) : null,
        avatar: encodeAvatar(avatar),
      };
      setCard(next);
      setPhase("done");
      track("voice_card_done", { via: type });
    } catch {
      setPhase("ready");
      setError(t("분석하다 문제가 생겼어요. 한 번 더 해 볼까요?", "Something went wrong while analyzing. Try again?"));
    }
  };

  const start = async () => {
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError(t("이 브라우저는 녹음을 지원하지 않아요. 크롬이나 사파리로 열어 주세요", "This browser can't record. Open in Chrome or Safari"));
      return;
    }
    setError(null);
    let live: MediaStream;
    try {
      // 음높이·억양 폭을 재는 게 목적이라 자동 음량 보정은 끈다.
      live = await navigator.mediaDevices.getUserMedia({
        audio: { autoGainControl: false, noiseSuppression: false, echoCancellation: true },
      });
    } catch {
      setError(t("마이크를 허용해야 녹음할 수 있어요 🎙️", "Allow the mic to record 🎙️"));
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

    const chunks: Blob[] = [];
    const rec = new MediaRecorder(live);
    recorder.current = rec;
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    rec.onstop = () => {
      release();
      setLevel(0);
      const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
      if (blob.size === 0) {
        setPhase("ready");
        setError(t("소리가 안 잡혔어요. 다시 해 볼까요?", "We couldn't hear you. Try again?"));
        return;
      }
      void finish(blob);
    };
    rec.start();
    setPhase("recording");
    track("voice_card_start", { via: lang });

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
        smooth = smooth * 0.7 + Math.min(1, Math.sqrt(s / buf.length) * 4) * 0.3;
        setLevel(smooth);
      }
      if (ms >= MAX_MS) rec.stop();
      else requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  };

  const stop = () => {
    const rec = recorder.current;
    if (rec && rec.state !== "inactive") rec.stop();
  };

  const shareUrl = card ? `${location.origin}/voice/c?${cardQuery(card, lang)}` : "";
  const imageUrl = card ? `/api/og/voice?${cardQuery(card, lang)}` : "";

  // 공유 시트는 누른 그 순간에만 열린다(사파리). 이미지를 누른 뒤에 받으면 늦으니 미리 받아 둔다.
  useEffect(() => {
    if (!imageUrl) return;
    let alive = true;
    fetch(imageUrl)
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => {
        if (alive && b) setImage(new File([b], "mimic-voice-card.png", { type: "image/png" }));
      })
      .catch(() => {});
    return () => {
      alive = false;
      setImage(null);
    };
  }, [imageUrl]);

  const share = async () => {
    if (!card) return;
    const type = VOICE_TYPES[card.type];
    const text = t(
      `내 목소리 유형은 「${type.ko}」래. 너는 뭐 나와?`,
      `My voice type is "${type.en}". What's yours?`,
    );
    track("voice_card_share", { via: card.type });
    try {
      if (image && navigator.canShare?.({ files: [image] })) {
        await navigator.share({ files: [image], text: `${text}\n${shareUrl}` });
        return;
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
    }
    const r = await shareLink(shareUrl, text);
    if (r === "copied") showToast(t("링크를 복사했어요. 단톡방에 붙여 넣어 보세요!", "Link copied. Paste it in your group chat!"));
  };

  if (phase === "done" && card) {
    const type = VOICE_TYPES[card.type];
    return (
      <main className={`shell ${styles.page}`}>
        <VoiceCard card={card} readLang={lang} />
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={() => void share()}>
            {t("카드 자랑하기", "Share my card")}
          </button>
          <Link href={`/practice/${type.script}`} className={styles.secondary}>
            {t("이 유형에 맞는 대본 연습하기 →", "Practice a script made for this type →")}
          </Link>
          <Link href="/weekly" className={styles.secondary}>
            {t("이 목소리로 이번 주 챌린지 출전 →", "Enter this week's challenge →")}
          </Link>
          <button
            type="button"
            className={styles.ghost}
            onClick={() => {
              setCard(null);
              setPhase("ready");
            }}
          >
            {t("다시 녹음하기", "Record again")}
          </button>
        </div>
        <p className={styles.note}>
          {t(
            "유형은 평균 음높이와 억양 폭을 구간으로 나눈 거예요. 목소리의 좋고 나쁨을 매기는 점수가 아니에요. 녹음은 이 기기 밖으로 나가지 않아요.",
            "Your type comes from bands of average pitch and pitch range. It's not a grade of how good your voice is. The recording never leaves this device.",
          )}
        </p>
        {toast}
      </main>
    );
  }

  return (
    <main className={`shell ${styles.page}`}>
      <nav className={styles.nav}>
        <Link href="/">{t("← 홈", "← Home")}</Link>
      </nav>
      <header className={styles.head}>
        <p className="eyebrow">{t("보이스 카드", "Voice card")}</p>
        <h1 className={styles.title}>{t("내 목소리는 무슨 유형일까?", "What type is your voice?")}</h1>
        <p className={styles.sub}>
          {t(
            "아래 문장을 평소 말투로 읽어 주세요. 10초면 카드가 나와요.",
            "Read the line below in your normal voice. Your card is ready in 10 seconds.",
          )}
        </p>
      </header>

      <div className={styles.stage}>
        <VoiceAvatar avatar={avatar} level={level} size={150} />
        <p className={styles.line}>{line.text}</p>
        {phase === "recording" && (
          <div className={styles.meter} aria-hidden="true">
            <i style={{ width: `${Math.min(100, (elapsed / MAX_MS) * 100)}%` }} />
          </div>
        )}
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {phase === "ready" && (
        <button type="button" className={styles.primary} onClick={() => void start()}>
          {t("🎙️ 읽기 시작", "🎙️ Start reading")}
        </button>
      )}
      {phase === "recording" && (
        <button type="button" className={`${styles.primary} ${styles.rec}`} onClick={stop}>
          {t("다 읽었어요", "Done")}
        </button>
      )}
      {phase === "analyzing" && (
        <button type="button" className={styles.primary} disabled>
          {t("목소리 분석 중…", "Analyzing your voice…")}
        </button>
      )}
      <p className={styles.note}>
        {t("녹음은 서버로 보내지 않고 이 기기에서만 분석해요.", "Your recording is analyzed on this device and never uploaded.")}
      </p>
      {toast}
    </main>
  );
}
