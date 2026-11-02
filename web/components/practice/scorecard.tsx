"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Coco } from "@/components/brand/coco";
import { useT } from "@/components/lang";
import { voiceTypeOf } from "@/lib/scorecard";
import { fixedBy, fixesOf, fixKey, type Fix, type MatchResult } from "@/lib/script-match";
import { transcribe } from "@/lib/transcribe-client";
import type { Analysis } from "@/lib/voice-analysis";
import styles from "./scorecard.module.css";

/**
 * 코코의 심사표 — 녹음 직후 카드.
 *
 *   1) 대본대로 읽었나 — 정확도와 고칠 곳 수. 어디가 틀렸는지는 위 대본에 직접 표시한다
 *      (같은 걸 아래에 목록으로 또 쓰지 않는다)
 *   2) 그 구절만 다시 — 고칠 곳을 하나씩, 그 구절만 다시 읽어 고쳐졌는지 바로
 *   3) 목소리 타입 — 공유용
 *
 * 대본 확인은 받아쓰기(서버) 비용이 들어 버튼을 누를 때만 한다. 결과는 테이크에 남아 같은 녹음을 다시 보내지 않는다.
 */
export function Scorecard({
  analysis,
  text,
  match,
  heardEmpty,
  checking,
  fixed,
  onCheck,
  onFixed,
  onShowScript,
}: {
  analysis: Analysis | null;
  text: string;
  match: MatchResult | null;
  heardEmpty: boolean;
  checking: boolean;
  /** 이미 고친 곳(fixKey) */
  fixed: string[];
  onCheck: () => void;
  onFixed: (key: string) => void;
  onShowScript: () => void;
}) {
  const L = useT();
  const type = useMemo(() => voiceTypeOf(analysis, L), [analysis, L]);
  const fixes = useMemo(() => (match ? fixesOf(text, match) : []), [match, text]);
  const left = fixes.filter((f) => !fixed.includes(fixKey(f)));
  const next = left[0] ?? null;
  const pct = match ? Math.round(match.accuracy * 100) : null;
  const mood = checking ? "think" : !match ? "idle" : left.length === 0 ? "happy" : "think";

  return (
    <section className={styles.card} aria-label={L("코코의 심사표", "Coco's scorecard")}>
      <header className={styles.head}>
        <Coco mood={mood} size={46} />
        <div className={styles.headText}>
          <p className={styles.kicker}>{L("코코의 심사표", "Coco's scorecard")}</p>
          <p className={styles.title}>
            {checking
              ? L("코코가 듣는 중…", "Coco is listening…")
              : !match
                ? L("대본대로 읽었는지 들어 볼게요", "Let me check it against the script")
                : left.length === 0
                  ? fixes.length === 0
                    ? L("한 글자도 안 틀렸어요", "Word-perfect")
                    : L("다 고쳤어요!", "All fixed!")
                  : L(`고칠 곳 ${left.length}곳`, `${left.length} to fix`)}
          </p>
        </div>
        {pct !== null && !checking && <Ring pct={pct} />}
      </header>

      {checking ? (
        <div className={styles.listening} aria-hidden="true">
          {Array.from({ length: 18 }, (_, i) => (
            <i key={i} style={{ animationDelay: `${(i % 6) * 0.12}s` }} />
          ))}
        </div>
      ) : heardEmpty ? (
        <div className={styles.body}>
          <p className={styles.note}>{L("말소리가 잘 안 들렸어요. 마이크 가까이에서 다시 녹음해 볼까요?", "Couldn't make out the words. Try again closer to the mic?")}</p>
        </div>
      ) : !match ? (
        <div className={styles.body}>
          <p className={styles.note}>{L("빠뜨린 말, 다르게 읽은 말을 대본 위에 표시해 드려요.", "I'll mark skipped and changed words right on the script.")}</p>
          <button type="button" className={styles.cta} onClick={onCheck}>
            {L("🦜 코코한테 확인받기", "🦜 Ask Coco to check")}
          </button>
        </div>
      ) : (
        <div className={styles.body}>
          {fixes.length > 0 && (
            <div className={styles.progress}>
              <div className={styles.progressTrack}>
                <span style={{ width: `${((fixes.length - left.length) / fixes.length) * 100}%` }} />
              </div>
              <button type="button" className={styles.linkBtn} onClick={onShowScript}>
                {L("대본에 표시해 뒀어요 ↑", "Marked on the script ↑")}
              </button>
            </div>
          )}
          {next ? (
            <Retry key={fixKey(next)} fix={next} n={fixes.length - left.length + 1} total={fixes.length} onFixed={() => onFixed(fixKey(next))} />
          ) : (
            <p className={styles.done}>
              {fixes.length === 0
                ? L("대본 그대로 또박또박 읽었어요 👏", "Every word, exactly as written 👏")
                : L("🎉 고칠 곳을 전부 고쳤어요. 처음부터 한 번에 쭉 읽어 볼까요?", "🎉 All fixed. Now try the whole thing in one go?")}
            </p>
          )}
        </div>
      )}

      {type && (
        <div className={styles.type}>
          <small>{L("목소리 타입", "Voice type")}</small>
          <b>{type.name}</b>
          <span>{type.desc}</span>
          <em>{type.why}</em>
        </div>
      )}
    </section>
  );
}

function Ring({ pct }: { pct: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const tone = pct >= 95 ? styles.ringGood : pct >= 80 ? styles.ringMid : styles.ringLow;
  return (
    <div className={`${styles.ring} ${tone}`} aria-label={`${pct}%`}>
      <svg viewBox="0 0 54 54" aria-hidden="true">
        <circle cx="27" cy="27" r={r} className={styles.ringBg} />
        <circle cx="27" cy="27" r={r} className={styles.ringFg} strokeDasharray={`${(c * pct) / 100} ${c}`} />
      </svg>
      <b>{pct}</b>
    </div>
  );
}

/* ── 그 구절만 다시 ─────────────────────────────────────────────────────── */

function Retry({ fix, n, total, onFixed }: { fix: Fix; n: number; total: number; onFixed: () => void }) {
  const L = useT();
  const [phase, setPhase] = useState<"idle" | "rec" | "busy" | "miss">("idle");
  const [err, setErr] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
      stream.current?.getTracks().forEach((t) => t.stop());
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
      live = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true } });
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
      setPhase("busy");
      const res = await transcribe(new Blob(chunks, { type: r.mimeType || "audio/webm" }));
      if (!("text" in res)) {
        setErr(res.error ?? L("확인이 잠깐 안 됐어요. 다시 해 볼까요?", "Couldn't check that. Try again?"));
        setPhase("idle");
        return;
      }
      if (fixedBy(fix, res.text)) onFixed();
      else setPhase("miss");
    };
    r.start();
    setPhase("rec");
    // 구절 하나 — 길어야 몇 초다. 끄는 걸 잊어도 서버에 긴 녹음이 가지 않게.
    timer.current = window.setTimeout(stop, 12_000);
  };

  const label =
    fix.kind === "missed"
      ? L("빠뜨린 말", "Skipped")
      : fix.kind === "changed"
        ? L("다르게 읽은 말", "Read differently")
        : L("대본에 없는 말", "Not in the script");

  return (
    <div className={styles.retry}>
      <p className={styles.retryHead}>
        <span className={styles[`tag_${fix.kind}`]}>{label}</span>
        <small>
          {n} / {total}
        </small>
      </p>
      <p className={styles.phrase}>
        {fix.phrase.map((w, k) => (
          <span key={k}>
            {k > 0 && " "}
            {w.mark ? <mark>{w.text}</mark> : w.text}
          </span>
        ))}
        {fix.kind === "added" && <del> {fix.heard}</del>}
      </p>
      {phase === "rec" ? (
        <button type="button" className={styles.recBtn} onClick={stop}>
          <i aria-hidden="true" /> {L("다 읽었으면 탭", "Tap when done")}
        </button>
      ) : (
        <button type="button" className={styles.cta} onClick={() => void start()} disabled={phase === "busy"}>
          {phase === "busy"
            ? L("코코가 듣는 중…", "Coco is listening…")
            : phase === "miss"
              ? L("● 한 번 더", "● Once more")
              : L("● 이 구절만 다시 읽기", "● Re-read just this part")}
        </button>
      )}
      {phase === "miss" && (
        <p className={styles.notYet} role="status">
          {fix.kind === "added"
            ? L("아직 대본에 없는 말이 들려요. 대본 그대로만 읽어 볼까요?", "Still hearing extra words — read just what's written?")
            : L("아직 표시한 말이 또렷하게 안 들려요. 그 말에 힘을 줘서 한 번 더!", "The marked word still isn't coming through — lean on it once more!")}
        </p>
      )}
      {err && <p className={styles.notYet}>{err}</p>}
    </div>
  );
}
