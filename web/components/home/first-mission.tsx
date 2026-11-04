"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLang, useT } from "@/components/lang";
import { VoiceAvatar } from "@/components/voice-avatar";
import { VoiceTypeCard } from "@/components/practice/voice-type-card";
import { AvatarFrame, NameLine } from "@/components/pass/look";
import type { Look } from "@/lib/pass";
import { normalizeAvatar } from "@/lib/avatar";
import { clientId } from "@/lib/client-id";
import { markSeen, seen } from "@/lib/onboarding";
import { syllables } from "@/lib/practice";
import { voiceTypeOf, type VoiceType } from "@/lib/scorecard";
import { newTakeId, saveTake } from "@/lib/take-store";
import { track } from "@/lib/track";
import { analyzeBlob } from "@/lib/voice-analysis";
import { currentWeek, displayName, freeWeek, isLive, writeMine } from "@/lib/weekly";
import { postTake, undoPost } from "@/lib/post-take";
import { PostGoal, UndoButton } from "@/components/practice/post-goal";
import type { Analysis } from "@/lib/voice-analysis";
import styles from "./first-mission.module.css";

/**
 * 첫 방문 미션 — 설명서 대신 "해 보기"로 시작한다.
 *
 * 11/3 홍보: 실제 방문 51명 중 34명이 홈만 보고 아무것도 안 누르고 나갔다. 예전 첫 화면은
 * "사용법 보기" 말풍선이라 그냥 닫혔다. 이제는 닫기 버튼 없는 시트에서
 *   1) 다른 사람 목소리 하나 듣고 ❤ (싫으면 다음 목소리)
 *   2) 내 차례 — 대사 한 줄 읽고 목소리 타입 받기 (녹음은 이 폰에만, 연습실에 테이크로 남는다)
 *   3) 결과 → 그 자리에서 버튼 한 번으로 들려주기(5초 안에 되돌리기). 11/4: 예전엔 연습실로 보냈는데
 *      거기서 다시 녹음해야 하는 줄 알고 나갔다.
 * 를 한다. 완전 강제는 바로 이탈이라, 5초 뒤 작은 "그냥 둘러볼게요"만 둔다.
 * 끝나면 "사용법" 버튼을 가리키는 인사가 뜬다(components/onboarding/tour) — 가이드 보는 법은 그때 알려 준다.
 */
export type MissionVoice = { id: string; name: string; avatar: unknown; look?: Look };

export const MISSION_DONE = "mimic:mission:done";
const MAX_MS = 12_000;
const clock = () => performance.now();

type Step = "listen" | "sent" | "record" | "recording" | "analyzing" | "result" | "posting" | "posted";

export function FirstMission({ voices, scriptId, line }: { voices: MissionVoice[]; scriptId: string; line: string }) {
  const t = useT();
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>(voices.length ? "listen" : "record");
  const [idx, setIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [escape, setEscape] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vtype, setVtype] = useState<VoiceType | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const audio = useRef<HTMLAudioElement | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const mic = useRef<MediaStream | null>(null);
  const last = useRef<{ id: string; blob: Blob; analysis: Analysis | null } | null>(null);
  const [posted, setPosted] = useState<{ id: string; token: string | null; weekId: string } | null>(null);
  const [undoing, setUndoing] = useState(false);
  // 서버는 2초 미만 녹음을 안 받는다 — 짧으면 버튼 대신 연습실로.
  const [longEnough, setLongEnough] = useState(false);

  useEffect(() => {
    // 처음 온 사람만. 예전 인사나 홈 사용법을 이미 본 사람(다녀간 사람)에겐 안 띄운다.
    if (seen("tip_mission") || seen("tip_welcome") || seen("tour_home")) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(true);
    track("mission_open", { via: voices.length ? "listen" : "record" });
    const e = window.setTimeout(() => setEscape(true), 5000);
    return () => window.clearTimeout(e);
  }, [voices.length]);

  // 시트가 떠 있는 동안 뒤 화면이 스크롤되지 않게.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const stopAudio = () => {
    audio.current?.pause();
    setPlaying(false);
  };

  const finish = useCallback(
    (how: "done" | "skip" | "post") => {
      stopAudio();
      if (rec.current?.state === "recording") rec.current.stop();
      mic.current?.getTracks().forEach((x) => x.stop());
      markSeen("tip_mission");
      track(how === "skip" ? "mission_skip" : "mission_done", { via: how === "skip" ? step : how });
      setOpen(false);
      window.dispatchEvent(new CustomEvent(MISSION_DONE, { detail: how }));
    },
    [step],
  );

  const voice = voices[idx];

  const play = () => {
    if (!voice) return;
    if (playing) return stopAudio();
    audio.current ??= new Audio();
    const a = audio.current;
    const src = `/api/weekly/audio/${voice.id}`;
    if (!a.src.endsWith(src)) {
      a.src = src;
      setProgress(0);
    }
    a.ontimeupdate = () => a.duration && setProgress(a.currentTime / a.duration);
    a.onended = () => {
      setProgress(1);
      setPlaying(false);
    };
    setPlaying(true);
    a.play().catch(() => {
      setPlaying(false);
      setError(t("소리를 못 틀었어요. 다음 목소리로 넘어가 볼까요?", "Couldn't play this one. Try the next voice?"));
    });
    void fetch(`/api/weekly/entries/${voice.id}/play`, { method: "POST", body: JSON.stringify({ client: clientId() }) }).catch(() => {});
  };

  const like = async () => {
    if (!voice) return;
    stopAudio();
    track("mission_like", { via: voice.id.slice(0, 16) });
    setStep("sent");
    // 실패해도(내 목소리 · 같은 와이파이 상한) 미션은 계속 간다.
    void fetch(`/api/weekly/entries/${voice.id}/like`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ client: clientId() }),
    }).catch(() => {});
    window.setTimeout(() => setStep("record"), 1600);
  };

  const next = () => {
    stopAudio();
    setError(null);
    setProgress(0);
    track("mission_next", { via: String(idx) });
    if (idx + 1 < voices.length) setIdx(idx + 1);
    else setStep("record");
  };

  const startRec = async () => {
    setError(null);
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError(t("이 브라우저는 녹음이 안 돼요. 크롬이나 사파리로 열어 주세요", "This browser can't record. Open in Chrome or Safari"));
      return;
    }
    let live: MediaStream;
    try {
      live = await navigator.mediaDevices.getUserMedia({ audio: { autoGainControl: false, noiseSuppression: false, echoCancellation: true } });
    } catch {
      setError(t("마이크를 허용해야 녹음할 수 있어요 🎙️", "Allow the mic to record 🎙️"));
      return;
    }
    mic.current = live;
    const chunks: Blob[] = [];
    const r = new MediaRecorder(live);
    rec.current = r;
    r.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
    r.onstop = () => {
      live.getTracks().forEach((x) => x.stop());
      const blob = new Blob(chunks, { type: r.mimeType || "audio/webm" });
      if (!blob.size) {
        setStep("record");
        setError(t("소리가 안 잡혔어요. 다시 해 볼까요?", "We couldn't hear you. Try again?"));
        return;
      }
      void analyzeTake(blob);
    };
    r.start();
    track("mission_rec", { via: scriptId.slice(0, 16) });
    setStep("recording");
    const t0 = clock();
    const loop = () => {
      if (r.state !== "recording") return;
      const ms = clock() - t0;
      setElapsed(ms);
      if (ms >= MAX_MS) r.stop();
      else requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  };

  const analyzeTake = async (blob: Blob) => {
    setStep("analyzing");
    let analysis = null;
    try {
      analysis = await analyzeBlob(blob, syllables(line) || null);
    } catch {
      analysis = null;
    }
    // 연습실에 테이크 #1 로 남긴다 — "올리러 가기"를 누르면 바로 그 테이크가 열려 있다.
    const id = newTakeId();
    last.current = { id, blob, analysis };
    setLongEnough((analysis?.duration ?? 0) >= 2);
    await saveTake({ id, itemId: scriptId, at: Date.now(), blob, analysis, score: null }).catch(() => {});
    setVtype(voiceTypeOf(analysis, t));
    setStep("result");
  };

  // 이 대본이 이번 주 대본이면 챌린지로, 아니면 자유 출전으로 — 연습실(WeeklyEnter)과 같은 규칙.
  const weekFor = () => {
    const w = currentWeek();
    return w.scriptId === scriptId && isLive(w) ? w : freeWeek(scriptId);
  };

  const post = async () => {
    const take = last.current;
    const week = weekFor();
    if (!take || !week) return;
    setError(null);
    setStep("posting");
    track("enter_open", { via: "mission" });
    const r = await postTake({ blob: take.blob, analysis: take.analysis, week });
    if (!r.ok) {
      track("enter_fail", { via: r.needLogin ? "401" : "mission" });
      setStep("result");
      setError(r.error ?? t("못 올렸어요. 다시 눌러 주세요", "Couldn't post. Tap again"));
      return;
    }
    writeMine(week.id, { entryId: r.id, token: r.token, takeId: take.id });
    setPosted({ id: r.id, token: r.token, weekId: week.id });
    setStep("posted");
    track("weekly_enter", { via: "mission" });
  };

  const undo = async () => {
    if (!posted) return;
    setUndoing(true);
    const ok = await undoPost(posted.id, posted.token);
    setUndoing(false);
    if (!ok) {
      setError(t("되돌리지 못했어요. 내 목소리 페이지에서 내릴 수 있어요", "Couldn't undo. You can remove it from your voice page"));
      return;
    }
    writeMine(posted.weekId, null);
    setPosted(null);
    setStep("result");
    track("post_undo", { via: "mission" });
  };

  if (!open) return null;

  const stepNo = step === "listen" || step === "sent" ? 1 : step === "result" || step === "posting" || step === "posted" ? 3 : 2;
  const name = voice ? displayName(voice.name, lang) : "";

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label={t("첫 미션", "First mission")}>
      <div className={styles.sheet}>
        <div className={styles.dots} aria-label={t(`3단계 중 ${stepNo}단계`, `Step ${stepNo} of 3`)}>
          {[1, 2, 3].map((n) => (
            <i key={n} className={n <= stepNo ? styles.dotOn : styles.dot} />
          ))}
        </div>

        {step === "listen" && voice && (
          <>
            <p className={styles.kicker}>{t("첫 미션 · 1/3", "First mission · 1/3")}</p>
            <h2 className={styles.title}>{t("다른 사람 목소리부터 들어 볼까요?", "Start by hearing someone's voice")}</h2>
            <button type="button" className={styles.voice} onClick={play} aria-label={playing ? t("멈추기", "Pause") : t(`${name} 듣기`, `Play ${name}`)}>
              <AvatarFrame frame={voice.look?.frame}>
                <VoiceAvatar avatar={normalizeAvatar(voice.avatar)} size={96} level={playing ? 0.7 : 0} />
              </AvatarFrame>
              <b>
                <NameLine name={name} look={voice.look} badges lang={lang} />
              </b>
              <span className={styles.bar}>
                <span style={{ width: `${Math.round(progress * 100)}%` }} />
              </span>
              <span className={styles.playHint}>{playing ? t("❚❚ 듣는 중", "❚❚ Playing") : progress > 0 ? t("▶ 이어 듣기", "▶ Resume") : t("▶ 눌러서 듣기", "▶ Tap to listen")}</span>
            </button>
            <div className={styles.choice}>
              <button type="button" className={`${styles.like} ${progress >= 0.6 ? styles.likeReady : ""}`} onClick={() => void like()}>
                ❤ {t("좋아요", "Love it")}
              </button>
              <button type="button" className={styles.next} onClick={next}>
                {idx + 1 < voices.length ? t("다음 목소리 ›", "Next voice ›") : t("내 차례로 ›", "My turn ›")}
              </button>
            </div>
            <p className={styles.note}>{t("❤ 는 목소리 주인에게 바로 전해져요", "Your ❤ goes straight to the voice's owner")}</p>
          </>
        )}

        {step === "sent" && voice && (
          <div className={styles.sent}>
            <span className={styles.bigHeart} aria-hidden="true">
              ❤
            </span>
            <h2 className={styles.title}>{t(`${name}님에게 ❤ 가 갔어요!`, `Your ❤ reached ${name}!`)}</h2>
            <p className={styles.note}>{t("이제 내 차례예요", "Now it's your turn")}</p>
          </div>
        )}

        {(step === "record" || step === "recording") && (
          <>
            <p className={styles.kicker}>{t("첫 미션 · 2/3", "First mission · 2/3")}</p>
            <h2 className={styles.title}>{t("이제 내 차례 — 이 한 줄만 읽어 보세요", "Your turn — read just this line")}</h2>
            <blockquote className={styles.line}>“{line}”</blockquote>
            <p className={styles.note}>{t("다 읽으면 코코가 14가지 중 내 목소리 타입을 알려 줘요 · 녹음은 이 폰에만", "Coco tells you which of 14 voice types you are · stays on your phone")}</p>
            {step === "record" ? (
              <button type="button" className={styles.rec} onClick={() => void startRec()}>
                ● {t("녹음 시작", "Start recording")}
              </button>
            ) : (
              <button type="button" className={`${styles.rec} ${styles.recOn}`} onClick={() => rec.current?.stop()}>
                ■ {t("다 읽었어요", "Done")} <small>{Math.ceil((MAX_MS - elapsed) / 1000)}</small>
              </button>
            )}
          </>
        )}

        {step === "analyzing" && (
          <div className={styles.sent}>
            <span className={styles.bigHeart} aria-hidden="true">
              🦜
            </span>
            <h2 className={styles.title}>{t("코코가 듣고 있어요…", "Coco is listening…")}</h2>
          </div>
        )}

        {(step === "result" || step === "posting") && (
          <>
            <p className={styles.kicker}>{t("첫 미션 · 3/3", "First mission · 3/3")}</p>
            <h2 className={styles.title}>{vtype ? t("내 목소리 타입이 나왔어요!", "Here's your voice type!") : t("녹음 완료!", "Recorded!")}</h2>
            {vtype ? (
              <VoiceTypeCard type={vtype} />
            ) : (
              <p className={styles.note}>{longEnough ? t("이번 녹음으론 목소리 타입을 못 정했어요", "Couldn't pick a voice type from this take") : t("소리가 짧아서 타입은 못 정했어요. 연습실에서 한 번 더 해 봐요", "Too short to tell — try again in the Practice Room")}</p>
            )}
            {longEnough && weekFor() ? (
              <>
                <button type="button" className={styles.rec} onClick={() => void post()} disabled={step === "posting"}>
                  {step === "posting" ? t("들려주는 중…", "Posting…") : t("🎧 이대로 들려주기 · +30 XP", "🎧 Let people hear it · +30 XP")}
                </button>
                <p className={styles.note}>{t("홈 맨 위 동그라미에 내 목소리가 떠요 · 언제든 내릴 수 있어요", "Your voice shows up top on Home · remove it anytime")}</p>
              </>
            ) : (
              <Link href={`/practice/${scriptId}`} className={styles.rec} onClick={() => finish("post")}>
                🎙 {t("연습실에서 한 번 더 해 보기", "Try again in the Practice Room")}
              </Link>
            )}
            <button type="button" className={styles.later} onClick={() => finish("done")} disabled={step === "posting"}>
              {t("나중에 할게요", "Maybe later")}
            </button>
          </>
        )}

        {step === "posted" && posted && (
          <>
            <UndoButton onUndo={() => void undo()} busy={undoing} className={styles.undo} />
            <div className={styles.sent}>
              <span className={styles.bigHeart} aria-hidden="true">
                🎧
              </span>
              <h2 className={styles.title}>{t("들려줬어요! +30 XP", "You're live! +30 XP")}</h2>
              <p className={styles.note}>{t("홈 맨 위 동그라미에 내 목소리가 떴어요. 누가 끝까지 들으면 알려 드릴게요", "Your voice is up top on Home. We'll tell you when someone listens all the way")}</p>
            </div>
            <PostGoal className={styles.note} />
            <Link href={`/weekly/e/${posted.id}`} className={styles.rec} onClick={() => finish("post")}>
              {t("내 목소리 보기 →", "See my voice →")}
            </Link>
            <button type="button" className={styles.later} onClick={() => finish("post")}>
              {t("홈 둘러보기", "Look around")}
            </button>
          </>
        )}

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        {escape && step !== "result" && step !== "posting" && step !== "posted" && (
          <button type="button" className={styles.escape} onClick={() => finish("skip")}>
            {t("그냥 둘러볼게요", "Just browse")}
          </button>
        )}
      </div>
    </div>
  );
}
