"use client";

import { MAX_FEEDBACK_ASK, type CommentMode } from "@/lib/entry-notes";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useToast } from "@/components/weekly/toast";
import { buzz, shareLink, useWeeklyMe } from "@/components/weekly/use-weekly";
import type { Take } from "@/lib/take-store";
import { track } from "@/lib/track";
import { currentWeek, freeWeek, isLive, readMine, remaining, seasonLabel, writeMine, type Week } from "@/lib/weekly";
import { PrivacyTag } from "@/components/privacy-tag";
import { VoiceTypeCard } from "@/components/practice/voice-type-card";
import { PostGoal, UndoButton } from "@/components/practice/post-goal";
import { PushButton } from "@/components/social/push-button";
import { voiceTypeOf } from "@/lib/scorecard";
import { postTake, undoPost } from "@/lib/post-take";
import styles from "./weekly-enter.module.css";
import { useLang, useT } from "@/components/lang";
import type { T } from "@/lib/i18n";

/**
 * 연습실 → 목소리 들려주기(어떤 대본이든 이번 주 ❤ 순위).
 *
 * 11/4: 올리기 패널(공개 안내·닉네임·보정·인스타 동의 → "올리기")을 연 사람이 그대로 닫고
 * 나갔다. 두 번 누르게 하면 그 사이에 망설인다. 이제 버튼 한 번에 바로 올라가고, 마음이 바뀌면
 * 5초 안에 되돌린다. "갤러리에 올리기"는 전시·평가처럼 들려서 "들려주기"로 바꿨다.
 * 잘한 점 배지는 붙이지 않는다. 동기는 "홈 추천"(멀다) 대신 금방 닿는 XP·❤·구독자 목표로.
 * 이미 올린 대본을 다른 테이크로 바꾸는 것만은 ❤ 가 0 이 되니 한 번 더 묻는다.
 */
export function WeeklyEnter({ take, scriptId }: { take: Take; scriptId: string }) {
  const at = useNow();
  if (at === null) return null;
  const week = currentWeek(at);
  if (week.scriptId === scriptId) return <Enter week={week} take={take} live={isLive(week, at)} />;
  const free = freeWeek(scriptId);
  if (!free) return null;
  return <Enter week={free} take={take} live />;
}

/** 정적 페이지라 "지금 어느 주인가"는 붙은 뒤에 정한다. 1분마다 다시 본다. */
function useNow(): number | null {
  const [at, setAt] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAt(Date.now());
    const t = window.setInterval(() => setAt(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  return at;
}

type Done = { id: string; token: string | null; rank: number; total: number; replaced: boolean };

function Enter({ week, take, live }: { week: Week; take: Take; live: boolean }) {
  const t = useT();
  const lang = useLang();
  const label = seasonLabel(week, lang);
  const free = Boolean(week.free);
  const me = useWeeklyMe(week.id);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [busy, setBusy] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needLogin, setNeedLogin] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const [local, setLocal] = useState<ReturnType<typeof readMine>[string] | undefined>(() => readMine()[week.id]);
  // 1:1 도전장을 받고 왔으면(?vs=상대 출전작) 출전 직후 바로 대결로 보낸다.
  const [vs] = useState(() => {
    const v = new URLSearchParams(window.location.search).get("vs");
    return v && /^[0-9a-f-]{36}$/i.test(v) ? v : null;
  });
  const [toast, showToast] = useToast();
  // 올린 뒤 받을 것 — ❤ 만 / 💬 댓글 / 🎯 피드백 요청. 이 기기에서 마지막으로 고른 걸 기억한다.
  const [mode, setModeState] = useState<CommentMode>(() => {
    try {
      const v = localStorage.getItem("mimic.cmode");
      if (v === "off" || v === "comments" || v === "feedback") return v;
      return localStorage.getItem("mimic.feedback") === "off" ? "off" : "comments";
    } catch {
      return "comments";
    }
  });
  const setMode = (m: CommentMode) => {
    setModeState(m);
    try {
      localStorage.setItem("mimic.cmode", m);
    } catch {}
  };
  const [ask, setAsk] = useState("");
  // 목소리 타입 — 이 녹음에서 잰 값으로만 정한다(속도·억양 폭·음높이).
  const vtype = voiceTypeOf(take.analysis, t);

  if (!live) {
    return (
      <p className={styles.soon}>
        {t(
          <>
            🏆 이 대본은 <b>{label}</b> 챌린지예요. 월요일 0시에 열리면 이 화면에서 바로 들려줄 수 있어요.
          </>,
          <>
            🏆 This script is the <b>{label}</b> challenge. Once it opens Monday 00:00 (KST), you can post right here.
          </>,
        )}
      </p>
    );
  }

  const entered = local?.takeId === take.id && me.mineId === local.entryId;
  const replacing = Boolean(me.mineId) && !entered;
  // 하루 새 목소리 상한(도배 방지) — 바꾸기는 안 센다. 막히기 전에 버튼 위에서 미리 알린다.
  const daily = me.daily;
  const full = !replacing && daily !== null && daily.today >= daily.max;

  const share = async (id: string) => {
    const r = await shareLink(
      `${location.origin}/weekly/e/${id}`,
      free
        ? t(`MIMIC 에 「${week.title}」 녹음 올렸어 🎙️${vtype ? ` 내 목소리 타입은 ${vtype.name}!` : ""} 들어보고 ❤ 하나만 눌러줘 🙏`, `I posted my take on "${week.titleEn}" on MIMIC 🎙️${vtype ? ` My voice type: ${vtype.name}!` : ""} Give it a listen and tap ❤ 🙏`)
        : t(
            `MIMIC에 내 목소리 올렸어 「${week.title}」 🎙️ 들어보고 ❤ 하나만 눌러줘 🙏`,
            `I entered the MIMIC voice challenge "${week.titleEn}" 🎙️ Give it a listen and tap ❤ 🙏`,
          ),
    );
    if (r === "copied") showToast(t("링크 복사 완료! 단톡방에 붙여 넣어 보세요", "Link copied! Paste it in your group chat"));
    if (r !== "failed") track("weekly_share", { via: id });
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    track("enter_open", { via: free ? "free" : week.id });
    const r = await postTake({ blob: take.blob, analysis: take.analysis, week, token: local?.token, mode, ask });
    setBusy(false);
    setConfirmReplace(false);
    if (!r.ok) {
      track("enter_fail", { via: r.needLogin ? "401" : "err" });
      if (r.needLogin) setNeedLogin(true);
      else setError(r.error ?? t("못 올렸어요. 다시 눌러 주세요", "Couldn't post. Tap again"));
      return;
    }
    const rec = { entryId: r.id, token: r.token, takeId: take.id };
    writeMine(week.id, rec);
    setLocal(rec);
    setDone({ id: r.id, token: r.token, rank: r.rank, total: r.total, replaced: r.replaced });
    buzz(30);
    track("weekly_enter", { via: free ? "free" : week.id });
  };

  const undo = async () => {
    if (!done) return;
    setUndoing(true);
    const ok = await undoPost(done.id, done.token);
    setUndoing(false);
    if (!ok) {
      showToast(t("되돌리지 못했어요. 내 목소리 페이지에서 내릴 수 있어요", "Couldn't undo. You can remove it from your voice page"));
      return;
    }
    writeMine(week.id, null);
    setLocal(undefined);
    setDone(null);
    track("post_undo", { via: free ? "free" : week.id });
    showToast(t("되돌렸어요. 이 녹음은 다시 이 폰에만 있어요", "Undone. This take is back to being only on your phone"));
  };

  return (
    <>
      {entered && local ? (
        <div className={styles.entered} data-tour="room-enter">
          <span className={styles.enteredBadge}>{t("🎧 들려주는 중", "🎧 Live")}</span>
          <p>{t("이 테이크를 모두가 들을 수 있어요", "Everyone can hear this take")}</p>
          <PrivacyTag kind="public" />
          <div className={styles.enteredActions}>
            <button type="button" className={styles.ask} onClick={() => void share(local.entryId)}>
              {t("❤ 모으러 공유하기", "Share to get ❤")}
            </button>
            <Link href={free ? `/weekly/e/${local.entryId}` : "/weekly"} className={styles.rankLink}>
              {free ? t("내 목소리 보기", "View my voice") : t("다른 출전작 듣기", "Hear other entries")}
            </Link>
          </div>
        </div>
      ) : needLogin ? (
        <p className={styles.login}>
          {t("이 브라우저는 저장이 막혀 있어서 로그인해야 들려줄 수 있어요.", "This browser blocks storage, so log in to post.")}{" "}
          <Link href={`/login?next=${encodeURIComponent(`/practice/${week.scriptId}`)}`}>{t("로그인 · 가입 →", "Log in / sign up →")}</Link>
        </p>
      ) : (
        <>
          <div className={styles.modeBox}>
            <p className={styles.modeLabel}>{t("올린 뒤 받을 것", "What you'd like back")}</p>
            <div className={styles.modes} role="radiogroup" aria-label={t("올린 뒤 받을 것", "What you'd like back")}>
              {(
                [
                  ["off", "❤", t("❤ 만", "❤ only")],
                  ["comments", "💬", t("댓글", "Comments")],
                  ["feedback", "🎯", t("피드백 요청", "Ask feedback")],
                ] as const
              ).map(([id, ico, label]) => (
                <button key={id} type="button" role="radio" aria-checked={mode === id} className={styles.modeBtn} onClick={() => setMode(id)}>
                  <span aria-hidden="true">{ico}</span>
                  {label}
                </button>
              ))}
            </div>
            <small className={styles.modeHint}>
              {mode === "off"
                ? t("댓글 없이 ❤ 만 받아요. 나중에 바꿀 수 있어요", "Just ❤. You can change this later")
                : mode === "comments"
                  ? t("응원 · 한마디를 댓글로 받아요", "Get cheers and comments")
                  : t("갤러리 🎯 피드백 칸에 올라가고, 듣는 사람이 고칠 곳까지 솔직하게 남겨 줘요", "Shows in the 🎯 Feedback tab. Listeners leave honest notes")}
            </small>
            {mode === "feedback" && (
              <input
                className={styles.askInput}
                value={ask}
                maxLength={MAX_FEEDBACK_ASK}
                onChange={(e) => setAsk(e.target.value)}
                placeholder={t("특히 봐 줬으면 하는 곳 (선택) · 예: 끝 문장 톤이 어색한지", "Anything specific? (optional) · e.g. Is the last line's tone off?")}
                aria-label={t("특히 봐 줬으면 하는 곳", "What to listen for")}
              />
            )}
          </div>
          <button
            type="button"
            className={replacing ? styles.openAlt : styles.open}
            onClick={() => (replacing && !confirmReplace ? setConfirmReplace(true) : void submit())}
            disabled={busy || full}
            data-tour="room-enter"
          >
            <span className={styles.openIcon} aria-hidden="true">
              🎧
            </span>
            <span>
              <b>
                {busy
                  ? t("들려주는 중…", "Posting…")
                  : replacing
                    ? confirmReplace
                      ? t("한 번 더 누르면 바꿔요 · 받은 ❤ 는 0 이 돼요", "Tap again to swap · your ❤ resets to 0")
                      : t("이 테이크로 바꿔 들려주기", "Swap in this take")
                    : t("이 목소리 들려주기", "Let people hear this")}
              </b>
              <small>
                {full
                  ? t(`오늘은 ${daily.max}개 다 올렸어요 · 내일 다시 열려요`, `You've posted ${daily.max} today · opens again tomorrow`)
                  : daily && !replacing && daily.today >= daily.max - 3
                    ? t(`오늘 ${daily.today}/${daily.max}개 올렸어요 · 하루 ${daily.max}개까지`, `${daily.today}/${daily.max} posted today · ${daily.max} a day max`)
                    : t("모두가 들을 수 있어요 · 언제든 내릴 수 있어요", "Anyone can listen · remove it anytime")}
              </small>
            </span>
            {!replacing && <i className={styles.xp}>+30 XP</i>}
          </button>
          {!replacing && <PostGoal className={styles.goal} />}
        </>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {done && (
        <div className={styles.celebrate} role="dialog" aria-modal="true" aria-label={t("들려주기 완료", "Posted")}>
          <div className={styles.confetti} aria-hidden="true">
            {Array.from({ length: 18 }, (_, i) => (
              <i key={i} style={{ "--i": i } as React.CSSProperties} />
            ))}
          </div>
          <div className={styles.card}>
            {!done.replaced && <UndoButton onUndo={() => void undo()} busy={undoing} className={styles.undo} />}
            <p className={styles.cardKicker}>
              {done.replaced ? t("바꿨어요!", "Swapped!") : t("들려줬어요! 🎧 +30 XP", "You're live! 🎧 +30 XP")}
            </p>
            {done.rank > 0 && (
              <p className={styles.cardRank}>
                {t(<b>{done.rank}</b>, <b>#{done.rank}</b>)}
                <span>{t(`위 / ${done.total}명`, ` of ${done.total}`)}</span>
              </p>
            )}
            <p className={styles.cardLine}>
              {t("홈 맨 위 동그라미에 내 목소리가 떴어요. 누가 끝까지 들으면 알려 드릴게요.", "Your voice is up top on Home. We'll tell you when someone listens all the way.")}
            </p>
            <PostGoal className={styles.cardGoal} />
            <VoiceTypeCard type={vtype} />
            {/* 올린 사람의 진짜 동기는 "누가 들었다"는 소식이다 — 알림을 이 순간에 켜게 한다. */}
            <PushButton kind="mine" compact />
            {!me.loggedIn && (
              <Link href={`/login?next=${encodeURIComponent(`/weekly/e/${done.id}`)}`} className={styles.cardRankLink}>
                {t("로그인하면 구독자와 메시지를 받을 수 있어요 →", "Log in to get subscribers and messages →")}
              </Link>
            )}
            {vs && vs !== done.id ? (
              <Link href={`/weekly/vs/${vs}?b=${done.id}`} className={styles.cardShare}>
                {t("⚔️ 대결 시작! 심판 부르러 가기", "⚔️ Duel on! Go get judges")}
              </Link>
            ) : (
              <button type="button" className={styles.cardShare} onClick={() => void share(done.id)}>
                {t("❤ 모으러 공유하기", "Share to get ❤")}
              </button>
            )}
            <Link href="/weekly" className={styles.cardRankLink}>
              {t("다른 목소리 듣고 ❤ 누르러 가기 →", "Listen to other voices and give ❤ →")}
            </Link>
            <button type="button" className={styles.cardClose} onClick={() => setDone(null)}>
              {t("연습 계속하기", "Keep practicing")}
            </button>
          </div>
        </div>
      )}
      {toast}
    </>
  );
}

/** 이번 주 대본이면 연습실 맨 위에 띠를 건다. */
export function WeeklyBanner({ scriptId }: { scriptId: string }) {
  const t = useT();
  const lang = useLang();
  const at = useNow();
  if (at === null) return null;
  const week = currentWeek(at);
  if (week.scriptId !== scriptId) return null;
  const live = isLive(week, at);
  return (
    <Link href="/weekly" className={styles.banner}>
      <span className={styles.bannerChip}>{seasonLabel(week, lang)}</span>
      <span className={styles.bannerText}>
        {live
          ? t(
              <>
                이번 주 추천 대본 · ❤ 순위 마감까지 <b>{left(week.endsAt, at, t)}</b>
              </>,
              <>
                This week&apos;s pick · ❤ ranking closes in <b>{left(week.endsAt, at, t)}</b>
              </>,
            )
          : t("다음 주 추천 대본 · 월요일 0시 오픈", "Next week's pick · opens Monday 00:00 KST")}
      </span>
      <i aria-hidden="true">{t("순위 →", "Ranking →")}</i>
    </Link>
  );
}

function left(end: number, now: number, t: T): string {
  const r = remaining(end - now);
  return r.d > 0
    ? t(`${r.d}일 ${r.h}시간`, `${r.d}d ${r.h}h`)
    : r.h > 0
      ? t(`${r.h}시간 ${r.m}분`, `${r.h}h ${r.m}m`)
      : t(`${r.m}분`, `${r.m}m`);
}
