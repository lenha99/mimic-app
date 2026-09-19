"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { addGuestClaim } from "@/lib/guest-claims";
import type { Meme } from "@/lib/memes";
import styles from "./record.module.css";

/** 6초면 어떤 밈이든 넉넉하다. 넘기면 자동으로 끊는다. */
const MAX_MS = 6000;

type Score = {
  score: number;
  grade: string;
  breakdown: { pitch: number; tone: number; timing: number };
  waveform?: { ref: number[]; user: number[] };
  error?: string;
};

type Phase = "ready" | "recording" | "scoring" | "result";

/** 결과를 서버에 저장하는 단계 (이슈 #23 — 서버가 같은 오디오를 다시 채점한다). */
type PublishPhase = "idle" | "publishing" | "done";

const GRADE_CLASS: Record<string, string> = {
  SS: styles.gradeSS,
  S: styles.gradeS,
  A: styles.gradeA,
  B: styles.gradeB,
  C: styles.gradeC,
};

export default function Recorder({ meme, refUrl }: { meme: Meme; refUrl: string }) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<Score | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [copied, setCopied] = useState(false);

  const [publishPhase, setPublishPhase] = useState<PublishPhase>("idle");
  const [wantsPublic, setWantsPublic] = useState(false); // 공개는 opt-in (이슈 #16)
  const [publishedPublic, setPublishedPublic] = useState(false);
  const [adjusted, setAdjusted] = useState<{ from: number; to: number } | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  // 저장할 때 같은 오디오를 서버로 다시 보내야 해서 들고 있는다.
  const blobRef = useRef<Blob | null>(null);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // 화면을 떠날 때 마이크를 놓아준다. 안 그러면 녹음 표시가 계속 켜져 있다.
  useEffect(
    () => () => {
      clearTimer();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  const submit = useCallback(
    async (blob: Blob) => {
      if (blob.size === 0) {
        setError("녹음된 소리가 없습니다. 다시 시도해 주세요.");
        setPhase("ready");
        return;
      }
      setPhase("scoring");
      blobRef.current = blob;
      try {
        const body = new FormData();
        body.append("file", blob, "recording.webm");
        const res = await fetch(
          `/api/score?meme_id=${encodeURIComponent(meme.id)}`,
          { method: "POST", body },
        );
        const data: Score = await res.json();
        if (!res.ok || data.error) {
          setError(data.error ?? "채점에 실패했습니다.");
          setPhase("ready");
          return;
        }
        setResult(data);
        setPhase("result");
      } catch {
        setError("네트워크 오류가 났습니다. 다시 시도해 주세요.");
        setPhase("ready");
      }
    },
    [meme.id],
  );

  const stopRecording = useCallback(() => {
    clearTimer();
    if (recRef.current && recRef.current.state !== "inactive") {
      recRef.current.stop();
    }
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    setResult(null);

    // 인앱 웹뷰는 권한 거부보다 API 자체가 없는 경우가 많다 (/probe 와 같은 이유).
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("이 브라우저에서는 녹음할 수 없습니다. 외부 브라우저로 열어 주세요.");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("마이크 권한이 필요합니다. 허용한 뒤 다시 눌러 주세요.");
      return;
    }

    streamRef.current = stream;
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(stream);
    recRef.current = rec;

    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    rec.onstop = () => {
      clearTimer();
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      void submit(new Blob(chunks, { type: rec.mimeType }));
    };

    rec.start();
    setPhase("recording");
    setElapsed(0);

    const t0 = Date.now();
    timerRef.current = window.setInterval(() => {
      const ms = Date.now() - t0;
      setElapsed(ms);
      if (ms >= MAX_MS) stopRecording();
    }, 100);
  }, [stopRecording, submit]);

  const playReference = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = 0;
    el.play().catch(() => setError("기준 음성을 재생할 수 없습니다."));
  }, []);

  const share = useCallback(async () => {
    if (!result) return;
    const text = `${meme.title} 따라하기 ${result.score}점 (${result.grade}) — MIMIC`;
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ title: "MIMIC", text, url });
      } catch {
        // 공유 시트를 닫은 것뿐이다. 복사로 떨어뜨리지 않는다.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("공유에 실패했습니다.");
    }
  }, [meme.title, result]);

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

    setPublishPhase("publishing");
    setError(null);
    try {
      const body = new FormData();
      body.append("file", blob, "recording.webm");
      body.append("is_public", String(wantsPublic));

      const res = await fetch(
        `/api/publish-recording?meme_id=${encodeURIComponent(meme.id)}`,
        { method: "POST", body },
      );
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? "저장에 실패했습니다.");
        setPublishPhase("idle");
        return;
      }

      // 비로그인이면 1회용 토큰이 온다. 로그인 후 /profile 에서 귀속시킨다.
      if (data.claimToken) addGuestClaim(data.claimToken);

      if (typeof data.score === "number" && data.score !== result.score) {
        setAdjusted({ from: result.score, to: data.score });
      }
      setResult((prev) =>
        prev ? { ...prev, score: data.score, grade: data.grade, breakdown: data.breakdown } : prev,
      );
      setPublishedPublic(wantsPublic);
      setPublishPhase("done");
    } catch {
      setError("네트워크 오류가 났습니다. 다시 시도해 주세요.");
      setPublishPhase("idle");
    }
  }, [meme.id, result, wantsPublic]);

  const retry = useCallback(() => {
    setResult(null);
    setError(null);
    setPhase("ready");
    setPublishPhase("idle");
    setWantsPublic(false);
    setPublishedPublic(false);
    setAdjusted(null);
    blobRef.current = null;
  }, []);

  const pct = Math.min(100, (elapsed / MAX_MS) * 100);

  return (
    <>
      <audio
        ref={audioRef}
        src={refUrl}
        preload="auto"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />

      <section className={styles.step}>
        <span className="eyebrow">1 · 원본 듣기</span>
        <button
          className={styles.listen}
          onClick={playReference}
          disabled={phase === "recording"}
        >
          <span className={styles.listenIcon} aria-hidden="true">
            {playing ? "❚❚" : "▶"}
          </span>
          {playing ? "재생 중" : "원본 소리 듣기"}
        </button>
      </section>

      <section className={styles.step}>
        <span className="eyebrow">2 · 따라하기</span>

        {phase === "recording" ? (
          <>
            <button className={styles.stop} onClick={stopRecording}>
              ■ 정지 ({(elapsed / 1000).toFixed(1)}초)
            </button>
            <div className={styles.bar}>
              <div className={styles.barFill} style={{ width: `${pct}%` }} />
            </div>
          </>
        ) : (
          <button
            className={styles.record}
            onClick={startRecording}
            disabled={phase === "scoring"}
          >
            {phase === "scoring"
              ? "채점 중…"
              : result
                ? "다시 녹음하기"
                : "🎙 녹음 시작"}
          </button>
        )}

        {phase === "scoring" && (
          <p className={styles.hint}>
            채점 중입니다. 서버가 자고 있으면 30초쯤 걸릴 수 있습니다.
          </p>
        )}
      </section>

      {error && (
        <p className={styles.error} role="alert">
          {error}{" "}
          <Link href="/probe" className={styles.errorLink}>
            마이크 검사 →
          </Link>
        </p>
      )}

      {result && phase === "result" && (
        <section className={styles.result}>
          <div className={styles.scoreRow}>
            <div>
              <span className="eyebrow">닮음</span>
              <div className={styles.scoreBig}>
                {result.score}
                <span className={styles.scoreUnit}>점</span>
              </div>
            </div>
            <div className={`${styles.grade} ${GRADE_CLASS[result.grade] ?? ""}`}>
              {result.grade}
            </div>
          </div>

          <dl className={styles.breakdown}>
            {([
              ["억양", result.breakdown.pitch],
              ["음색", result.breakdown.tone],
              ["타이밍", result.breakdown.timing],
            ] as const).map(([label, value]) => (
              <div key={label} className={styles.metric}>
                <dt className={styles.metricLabel}>{label}</dt>
                <dd className={styles.metricValue}>{value}</dd>
                <div className={styles.metricBar}>
                  <div className={styles.metricFill} style={{ width: `${value}%` }} />
                </div>
              </div>
            ))}
          </dl>

          {result.waveform && (
            <div className={styles.waves}>
              <Wave label="원본" data={result.waveform.ref} tone="ref" />
              <Wave label="나" data={result.waveform.user} tone="user" />
            </div>
          )}

          {publishPhase === "done" ? (
            <div className={styles.publish}>
              <p className={styles.publishDone}>
                저장 완료 ✓{" "}
                {publishedPublic
                  ? "다른 사람들이 듣고 투표할 수 있어요."
                  : "나만 볼 수 있게 저장했어요."}
              </p>
              {adjusted && (
                <p className={styles.hint}>
                  서버가 다시 채점해 점수가 확정됐어요 ({adjusted.from} → {adjusted.to}점).
                </p>
              )}
              {publishedPublic && (
                <Link href="/rank" className={styles.publishLink}>
                  랭킹 보러 가기 →
                </Link>
              )}
            </div>
          ) : (
            <div className={styles.publish}>
              <label className={styles.publishToggle}>
                <input
                  type="checkbox"
                  checked={wantsPublic}
                  onChange={(e) => setWantsPublic(e.target.checked)}
                  disabled={publishPhase === "publishing"}
                />
                <span>다른 사람이 듣고 투표할 수 있게 공개</span>
              </label>
              <p className={styles.hint}>
                공개하지 않으면 나만 볼 수 있게 저장됩니다. 공개한 녹음만 랭킹에 올라가요.
              </p>
              <button
                className={styles.publishBtn}
                onClick={publish}
                disabled={publishPhase === "publishing"}
              >
                {publishPhase === "publishing"
                  ? "저장 중… 서버가 다시 채점합니다"
                  : wantsPublic
                    ? "공개하고 저장"
                    : "저장하기"}
              </button>
            </div>
          )}

          <div className={styles.actions}>
            <button className={styles.record} onClick={retry}>
              다시 도전
            </button>
            <button className={styles.share} onClick={share}>
              {copied ? "복사됨 ✓" : "공유"}
            </button>
          </div>
        </section>
      )}
    </>
  );
}

function Wave({
  label,
  data,
  tone,
}: {
  label: string;
  data: number[];
  tone: "ref" | "user";
}) {
  return (
    <div className={styles.wave}>
      <span className={styles.waveLabel}>{label}</span>
      <div className={styles.waveBars} aria-hidden="true">
        {data.map((v, i) => (
          <span
            key={i}
            className={tone === "ref" ? styles.barRef : styles.barUser}
            style={{ height: `${Math.max(3, v * 100)}%` }}
          />
        ))}
      </div>
    </div>
  );
}
