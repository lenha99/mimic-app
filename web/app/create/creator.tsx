"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePlaybackLevel } from "@/components/use-playback-level";
import { useViewer } from "@/components/viewer";
import { VoiceAvatar } from "@/components/voice-avatar";
import { DEFAULT_AVATAR } from "@/lib/avatar";
import { followMouth } from "@/lib/mouth";
import { track } from "@/lib/track";
import styles from "./create.module.css";

/**
 * 녹음 → 들어보기 → 이름 붙이기 → 링크.
 *
 * 녹음은 5초에서 자동으로 끊는다. 챌린지는 짧을수록 따라하기 쉽고, 짧을수록 웃기다.
 * 앞뒤 무음은 서버가 자르므로 사용자는 "대충 눌렀다 떼기"만 하면 된다.
 */
const MAX_MS = 5_000;
const MIN_MS = 500;
const EMOJIS = ["🎤", "😂", "🔥", "😤", "🥹", "🍚", "🐶", "🐱", "👻", "🤖", "🎉", "💀"];

type Step = "ready" | "recording" | "review" | "making" | "done";

export function Creator() {
  const viewer = useViewer();
  const avatar = viewer?.avatar ?? DEFAULT_AVATAR;

  const [step, setStep] = useState<Step>("ready");
  const [error, setError] = useState<string | null>(null);
  const [mic, setMic] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [title, setTitle] = useState("");
  const [line, setLine] = useState("");
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [made, setMade] = useState<{ id: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const ctx = useRef<AudioContext | null>(null);
  const raf = useRef(0);
  const player = useRef<HTMLAudioElement>(null);
  const level = usePlaybackLevel(player, blobUrl, playing);

  const cleanup = useCallback(() => {
    cancelAnimationFrame(raf.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    void ctx.current?.close().catch(() => {});
    ctx.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);
  useEffect(() => {
    if (!blobUrl) return;
    return () => URL.revokeObjectURL(blobUrl);
  }, [blobUrl]);

  const stop = useCallback(() => {
    if (rec.current && rec.current.state !== "inactive") rec.current.stop();
  }, []);

  const start = async () => {
    setError(null);
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("이 브라우저에선 녹음이 안 돼. 크롬이나 사파리로 열어줘.");
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = s;
      const chunks: Blob[] = [];
      const r = new MediaRecorder(s);
      rec.current = r;
      r.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);

      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      const node = Ctor ? (ctx.current = new Ctor()).createAnalyser() : null;
      if (node && ctx.current) {
        node.fftSize = 1024;
        ctx.current.createMediaStreamSource(s).connect(node);
      }
      const buf = new Uint8Array(1024);
      const t0 = performance.now();
      let last = t0;
      let mouth = 0;

      r.onstop = () => {
        const took = performance.now() - t0;
        cleanup();
        setMic(0);
        if (took < MIN_MS) {
          setStep("ready");
          setError("너무 짧아. 한 번 더 길게 외쳐줘.");
          return;
        }
        const b = new Blob(chunks, { type: r.mimeType });
        setBlob(b);
        setBlobUrl(URL.createObjectURL(b));
        setStep("review");
      };

      const loop = (now: number) => {
        const t = now - t0;
        setElapsed(t);
        if (node) {
          node.getByteTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i += 1) {
            const v = (buf[i] - 128) / 128;
            sum += v * v;
          }
          mouth = followMouth(mouth, Math.min(1, Math.sqrt(sum / buf.length) * 3.4), now - last);
          last = now;
          setMic(mouth);
        }
        if (t >= MAX_MS) {
          stop();
          return;
        }
        raf.current = requestAnimationFrame(loop);
      };

      r.start();
      setStep("recording");
      raf.current = requestAnimationFrame(loop);
    } catch {
      cleanup();
      setError("마이크를 켜줘야 녹음할 수 있어.");
    }
  };

  const listen = () => {
    const el = player.current;
    if (!el) return;
    el.currentTime = 0;
    void el.play().catch(() => {});
  };

  const redo = () => {
    setBlob(null);
    setBlobUrl(null);
    setStep("ready");
  };

  const submit = async () => {
    if (!blob) return;
    if (!title.trim()) {
      setError("제목을 적어줘. 친구가 뭘 따라하는지 알아야 해.");
      return;
    }
    setStep("making");
    setError(null);
    try {
      const body = new FormData();
      body.append("file", blob, "challenge.webm");
      body.append("title", title);
      body.append("line", line);
      body.append("emoji", emoji);
      const res = await fetch("/api/challenges", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.id) {
        setError(data.error ?? "챌린지를 못 만들었어. 다시 해줄래?");
        setStep("review");
        return;
      }
      setMade({ id: data.id, url: `${window.location.origin}/record/${data.id}` });
      setStep("done");
      track("share", { meme_id: data.id, via: "create" });
    } catch {
      setError("네트워크가 끊겼어. 다시 해줄래?");
      setStep("review");
    }
  };

  const send = async () => {
    if (!made) return;
    const text = `내 목소리 따라해봐 ${emoji} "${line || title}"`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "MIMIC", text, url: made.url });
      } catch {
        // 시트를 닫은 것뿐이다.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${made.url}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2400);
    } catch {
      setError("복사가 안 됐어. 아래 링크를 길게 눌러 복사해줘.");
    }
  };

  if (step === "done" && made) {
    return (
      <section className={styles.done}>
        <VoiceAvatar avatar={avatar} level={0.7} size={150} />
        <h2>
          {emoji} {title}
        </h2>
        <p>챌린지 완성! 링크는 지금 바로 돼.</p>
        <button type="button" className={styles.primary} onClick={send}>
          {copied ? "링크 복사됨" : "친구한테 따라해보라고 던지기"}
        </button>
        <Link href={`/record/${made.id}`} className={styles.secondary}>
          내가 먼저 해보기 →
        </Link>
        <p className={styles.small}>
          홈 목록에는 운영자가 한 번 듣고 올려요. 프로필 &gt; 내 챌린지에서 상태를 볼 수 있어요.
        </p>
        <code className={styles.link}>{made.url}</code>
      </section>
    );
  }

  const recording = step === "recording";
  const remain = Math.max(0, 1 - elapsed / MAX_MS);

  return (
    <>
      {blobUrl && (
        <audio
          ref={player}
          src={blobUrl}
          preload="auto"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
        />
      )}

      <section className={styles.stage}>
        <VoiceAvatar avatar={avatar} level={recording ? mic : level} size={170} />
        {step === "ready" && (
          <>
            <p className={styles.cue}>따라하고 싶어지는 소리 하나</p>
            <p className={styles.hint}>말버릇 · 성대모사 · 사투리 · 동물 흉내 · 유행어 — 5초 안으로</p>
            <button type="button" className={styles.rec} onClick={start}>
              ● 녹음 시작
            </button>
          </>
        )}
        {recording && (
          <>
            <div className={styles.bar}>
              <span style={{ width: `${remain * 100}%` }} />
            </div>
            <button type="button" className={styles.recStop} onClick={stop}>
              ■ 다 했어
            </button>
          </>
        )}
        {(step === "review" || step === "making") && (
          <div className={styles.reviewBtns}>
            <button type="button" className={styles.ghost} onClick={listen} disabled={step === "making"}>
              {playing ? "외치는 중…" : "▶ 들어보기"}
            </button>
            <button type="button" className={styles.ghost} onClick={redo} disabled={step === "making"}>
              ↻ 다시 녹음
            </button>
          </div>
        )}
      </section>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {(step === "review" || step === "making") && (
        <section className={styles.form}>
          <label className={styles.field}>
            <span>제목</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={20}
              placeholder="예: 우리 엄마 전화 받을 때"
            />
          </label>
          <label className={styles.field}>
            <span>따라 외칠 말 (선택)</span>
            <input
              value={line}
              onChange={(e) => setLine(e.target.value)}
              maxLength={40}
              placeholder='예: "여보세요오~?"'
            />
          </label>
          <div className={styles.field}>
            <span>이모지</span>
            <div className={styles.emojis}>
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  aria-pressed={e === emoji}
                  className={`${styles.emoji} ${e === emoji ? styles.emojiOn : ""}`}
                  onClick={() => setEmoji(e)}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <p className={styles.rules}>
            내 목소리로만 만들어요. 방송·노래 음원, 남의 목소리, 욕설·비하는 올리지 마세요 — 운영자가
            듣고 내릴 수 있어요.
          </p>
          <button type="button" className={styles.primary} onClick={submit} disabled={step === "making"}>
            {step === "making" ? "소리 다듬는 중…" : "챌린지 만들기"}
          </button>
        </section>
      )}
    </>
  );
}
