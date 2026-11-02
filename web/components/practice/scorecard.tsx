"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Coco } from "@/components/brand/coco";
import { useLang, useT } from "@/components/lang";
import { badgeLabel, strengthsOf } from "@/lib/badges";
import { PITCH_RANGE, type PitchBand } from "@/lib/practice";
import { retryVerdict, rowsOf, voiceTypeOf, worstOf, type Row } from "@/lib/scorecard";
import { analyzeBlob, type Analysis } from "@/lib/voice-analysis";
import styles from "./scorecard.module.css";

/**
 * 코코의 심사표 — 녹음 직후 "내 목소리를 보여 주는" 카드.
 *
 *   1) 마디마다 높낮이 선 + 해당 대본 글자 (말끝이 처진 곳·평평한 곳 표시)
 *   2) 잘한 점 하나 · 고칠 곳 하나 — 전부 다 말하지 않는다
 *   3) 그 한 곳만 듣고, 코코가 따라 해 보고, 그 마디만 다시 녹음 → 좋아졌는지 바로
 *
 * 전부 이 기기에서 잰다. 서버·모델을 부르지 않는다.
 */
export function Scorecard({
  analysis,
  blob,
  text,
  target,
}: {
  analysis: Analysis | null;
  blob: Blob;
  text: string;
  target: { pace?: number[]; pitch?: PitchBand; pitchBand?: [number, number]; marks?: number };
}) {
  const L = useT();
  const lang = useLang();
  const pitchLo = target.pitch ? PITCH_RANGE[target.pitch][0] : target.pitchBand?.[0];
  const rows = useMemo(() => rowsOf(analysis, text, pitchLo), [analysis, text, pitchLo]);
  const fix = useMemo(() => worstOf(rows, pitchLo, L), [rows, pitchLo, L]);
  const type = useMemo(() => voiceTypeOf(analysis, L), [analysis, L]);
  const good = useMemo(
    () => strengthsOf(analysis, { pace: target.pace, pitch: target.pitch, marks: target.marks })[0] ?? null,
    [analysis, target.pace, target.pitch, target.marks],
  );
  const seg = useSegmentPlayer(blob);

  if (!analysis || rows.length === 0) return null;
  const fixRow = fix ? rows[fix.index] : null;

  return (
    <section className={styles.card} aria-label={L("심사표", "Scorecard")}>
      <header className={styles.head}>
        <Coco mood={fix ? "think" : "happy"} size={44} />
        <div className={styles.headText}>
          <p className={styles.kicker}>{L("코코의 심사표", "Coco's scorecard")}</p>
          {type && (
            <p className={styles.type}>
              <b>{type.name}</b>
              <small>{type.why}</small>
            </p>
          )}
        </div>
      </header>

      <ol className={styles.rows}>
        {rows.map((r, i) => (
          <li key={i} className={fix?.index === i ? styles.rowFix : styles.row}>
            <div className={styles.rowTop}>
              <span className={styles.rowNo}>{i + 1}</span>
              <span className={styles.rowText}>{r.text || L("(대본 밖)", "(off script)")}</span>
              {r.issue && (
                <span className={styles.issue}>{r.issue === "drop" ? L("말끝 ↓", "Fade ↓") : L("평평", "Flat")}</span>
              )}
            </div>
            <Contour row={r} />
          </li>
        ))}
      </ol>

      <div className={styles.verdicts}>
        {good && (
          <p className={styles.good}>
            <small>{L("잘한 점", "Did well")}</small>
            {badgeLabel(good, lang)}
          </p>
        )}
        {fix && fixRow ? (
          <div className={styles.fix}>
            <small>{L("고칠 곳 하나", "One thing to fix")}</small>
            <b>{fix.title}</b>
            <p>{fix.tip}</p>
            <div className={styles.fixBtns}>
              <button type="button" onClick={() => seg.play(fixRow.phrase.t0, fixRow.phrase.t1, "mine")}>
                {seg.playing === "mine" ? L("■ 멈춤", "■ Stop") : L("▶ 이 부분 듣기", "▶ Hear this part")}
              </button>
              <button type="button" onClick={() => seg.play(fixRow.phrase.t0, fixRow.phrase.t1, "coco")}>
                {seg.playing === "coco" ? L("■ 멈춤", "■ Stop") : L("🦜 코코가 따라 하기", "🦜 Coco copies you")}
              </button>
            </div>
            <Retry key={fix.index} row={fixRow} issue={fix.issue} />
          </div>
        ) : (
          <p className={styles.clean}>
            {L("고칠 곳이 안 보여요. 말끝도 억양도 고르게 나왔어요 👏", "Nothing to fix — endings and melody were even 👏")}
          </p>
        )}
      </div>
    </section>
  );
}

/* ── 마디 높낮이 선 ─────────────────────────────────────────────────────── */

const W = 240;
const H = 40;
const CLAMP = 7;

function Contour({ row }: { row: Row }) {
  const pts = row.phrase.line;
  const n = pts.length;
  const segs: string[] = [];
  let cur = "";
  let lastXY: [number, number] | null = null;
  pts.forEach((v, i) => {
    if (v === null) {
      if (cur) segs.push(cur);
      cur = "";
      return;
    }
    const x = n > 1 ? (i / (n - 1)) * W : W / 2;
    const y = H / 2 - (Math.max(-CLAMP, Math.min(CLAMP, v)) / CLAMP) * (H / 2 - 4);
    cur += `${cur ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)} `;
    lastXY = [x, y];
  });
  if (cur) segs.push(cur);
  const end = lastXY as [number, number] | null;
  return (
    <svg className={styles.contour} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <line x1="0" x2={W} y1={H / 2} y2={H / 2} className={styles.mid} />
      {segs.map((d, i) => (
        <path key={i} d={d} className={row.issue === "flat" ? styles.lineFlat : styles.line} />
      ))}
      {row.issue === "drop" && end && <circle cx={end[0]} cy={end[1]} r="3.5" className={styles.dropDot} />}
    </svg>
  );
}

/* ── 구간 재생 — 내 소리 그대로 / 코코(빠르고 높게) ───────────────────────── */

function useSegmentPlayer(blob: Blob) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const url = useRef<string | null>(null);
  const [playing, setPlaying] = useState<"mine" | "coco" | null>(null);

  useEffect(
    () => () => {
      audio.current?.pause();
      if (url.current) URL.revokeObjectURL(url.current);
    },
    [],
  );

  const stop = () => {
    audio.current?.pause();
    setPlaying(null);
  };

  const play = (t0: number, t1: number, who: "mine" | "coco") => {
    if (playing === who) return stop();
    url.current ??= URL.createObjectURL(blob);
    audio.current ??= new Audio(url.current);
    const a = audio.current as HTMLAudioElement & { preservesPitch?: boolean; webkitPreservesPitch?: boolean };
    a.pause();
    // 코코는 음높이를 지키지 않고 빨리 돌린다 — 앵무새가 흉내 내는 소리.
    a.preservesPitch = who === "mine";
    a.webkitPreservesPitch = who === "mine";
    a.playbackRate = who === "coco" ? 1.45 : 1;
    const begin = Math.max(0, t0 - 0.15);
    const end = t1 + 0.2;
    a.ontimeupdate = () => {
      if (a.currentTime >= end) stop();
    };
    a.onended = () => setPlaying(null);
    const go = () => {
      a.currentTime = begin;
      setPlaying(who);
      a.play().catch(() => setPlaying(null));
    };
    if (a.readyState >= 1) go();
    else a.addEventListener("loadedmetadata", go, { once: true });
  };

  return { playing, play };
}

/* ── 그 마디만 다시 ─────────────────────────────────────────────────────── */

function Retry({ row, issue }: { row: Row; issue: "drop" | "flat" }) {
  const L = useT();
  const [phase, setPhase] = useState<"idle" | "rec" | "busy" | "done">("idle");
  const [line, setLine] = useState<{ better: boolean; text: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<number | null>(null);
  const take = useRef<Blob | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);
  const takeUrl = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
      stream.current?.getTracks().forEach((t) => t.stop());
      player.current?.pause();
      if (takeUrl.current) URL.revokeObjectURL(takeUrl.current);
    },
    [],
  );

  const stop = () => {
    if (timer.current) window.clearTimeout(timer.current);
    if (rec.current && rec.current.state !== "inactive") rec.current.stop();
  };

  const start = async () => {
    setErr(null);
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setErr(L("이 브라우저는 녹음을 지원하지 않아요", "This browser can't record"));
      return;
    }
    let live: MediaStream;
    try {
      live = await navigator.mediaDevices.getUserMedia({
        audio: { autoGainControl: false, noiseSuppression: false, echoCancellation: true },
      });
    } catch {
      setErr(L("마이크를 허용해야 녹음할 수 있어요 🎙️", "Allow the mic to record 🎙️"));
      return;
    }
    stream.current = live;
    const chunks: Blob[] = [];
    const r = new MediaRecorder(live);
    rec.current = r;
    r.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    r.onstop = async () => {
      live.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks, { type: r.mimeType || "audio/webm" });
      take.current = blob;
      if (takeUrl.current) URL.revokeObjectURL(takeUrl.current);
      takeUrl.current = null;
      setPhase("busy");
      try {
        const a = await analyzeBlob(blob, row.syllables || null);
        const v = retryVerdict(row.phrase, a, issue, L);
        setLine({ better: v.better, text: v.line });
      } catch {
        setLine({ better: false, text: L("소리가 잘 안 잡혔어요. 다시 해 볼까요?", "Couldn't hear that. Try again?") });
      }
      setPhase("done");
    };
    r.start();
    setPhase("rec");
    const max = Math.min(20, (row.phrase.t1 - row.phrase.t0) * 2.5 + 2) * 1000;
    timer.current = window.setTimeout(stop, max);
  };

  const listen = () => {
    if (!take.current) return;
    takeUrl.current ??= URL.createObjectURL(take.current);
    player.current ??= new Audio();
    player.current.src = takeUrl.current;
    void player.current.play().catch(() => {});
  };

  return (
    <div className={styles.retry}>
      {phase === "rec" ? (
        <button type="button" className={styles.retryRec} onClick={stop}>
          <i aria-hidden="true" /> {L("다 읽었으면 탭", "Tap when done")}
        </button>
      ) : (
        <button type="button" className={styles.retryGo} onClick={() => void start()} disabled={phase === "busy"}>
          {phase === "busy"
            ? L("듣는 중…", "Listening…")
            : phase === "done"
              ? L("● 한 번 더", "● Once more")
              : L("● 이 마디만 다시 읽기", "● Re-read just this phrase")}
        </button>
      )}
      {phase === "rec" && row.text && <p className={styles.retryText}>{row.text}</p>}
      {phase === "done" && line && (
        <p className={line.better ? styles.better : styles.notYet} role="status">
          {line.better ? "🎉 " : ""}
          {line.text}{" "}
          <button type="button" className={styles.linkBtn} onClick={listen}>
            {L("▶ 방금 것 듣기", "▶ Hear it")}
          </button>
        </p>
      )}
      {err && <p className={styles.notYet}>{err}</p>}
    </div>
  );
}
