"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/weekly/toast";
import { buzz, shareLink, useWeeklyMe } from "@/components/weekly/use-weekly";
import { readLocalAvatar } from "@/lib/avatar";
import { clientId } from "@/lib/client-id";
import type { Take } from "@/lib/take-store";
import { track } from "@/lib/track";
import { currentWeek, freeWeek, isLive, readMine, remaining, seasonLabel, writeMine, type Week } from "@/lib/weekly";
import { PrivacyTag } from "@/components/privacy-tag";
import { cleanNickname, NICK_MAX, nicknameProblem, readNickname, writeNickname } from "@/lib/nickname";
import { VoiceTypeCard } from "@/components/practice/voice-type-card";
import { PushButton } from "@/components/social/push-button";
import { voiceTypeOf } from "@/lib/scorecard";
import { polishVoice } from "@/lib/voice-polish";
import { badgeLabel, strengthsOf, type BadgeId } from "@/lib/badges";
import { findScript, pauseMarks } from "@/lib/practice";
import styles from "./weekly-enter.module.css";
import { useLang, useT } from "@/components/lang";
import type { T } from "@/lib/i18n";

/**
 * 연습실 → 목소리 갤러리에 올리기(어떤 대본이든 이번 주 ❤ 순위).
 *
 * 이번 주 대본이면 챌린지 출전(순위·마감), 다른 대본이면 자유 출전(갤러리에만, 순위 없음).
 * 연습실에서 건진 좋은 테이크가 갈 곳이 없으면 안 된다 — 사람이 적은 지금은 한 개라도 더 올라와야 한다. 연습 테이크는 원래 이 폰에만 있으니(take-store),
 * 올리기 전에 무엇이 공개되는지를 버튼 바로 위에 적는다. 출전하면 그 자리에서 몇 위로
 * 들어갔는지 보여주고 — 순위가 보여야 ❤ 를 모으고 싶어진다 — 공유 버튼을 바로 붙인다.
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

type Done = { id: string; rank: number; total: number; replaced: boolean; badges: BadgeId[] };

function Enter({ week, take, live }: { week: Week; take: Take; live: boolean }) {
  const t = useT();
  const lang = useLang();
  const label = seasonLabel(week, lang);
  const free = Boolean(week.free);
  const me = useWeeklyMe(week.id);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needLogin, setNeedLogin] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const [local, setLocal] = useState(() => readMine()[week.id]);
  const [name, setName] = useState(readNickname);
  // 1:1 도전장을 받고 왔으면(?vs=상대 출전작) 출전 직후 바로 대결로 보낸다.
  const [vs] = useState(() => {
    const v = new URLSearchParams(window.location.search).get("vs");
    return v && /^[0-9a-f-]{36}$/i.test(v) ? v : null;
  });
  const [toast, showToast] = useToast();
  const polish = usePolish(take.blob, open);
  // 목소리 타입 — 이 녹음에서 잰 값으로만 정한다(속도·억양 폭·음높이). 출전 버튼 바로 위.
  const vtype = voiceTypeOf(take.analysis, t);
  // 잘한 점 배지 — 공개로 붙는다. 못한 점은 배지로 만들지 않는다.
  const [strengths] = useState<BadgeId[]>(() => {
    const sc = findScript(week.scriptId);
    return strengthsOf(take.analysis, sc ? { pace: sc.pace, pitch: sc.pitch, marks: pauseMarks(sc.text) } : {});
  });
  // 인스타 소개 동의 — 기본 꺼짐. 원하는 사람만 스스로 켠다.
  const [promo, setPromo] = useState(false);

  if (!live) {
    return (
      <p className={styles.soon}>
        {t(
          <>
            🏆 이 대본은 <b>{label}</b> 챌린지예요. 월요일 0시에 열리면 이 화면에서 바로 출전할 수 있어요.
          </>,
          <>
            🏆 This script is the <b>{label}</b> challenge. Once it opens Monday 00:00 (KST), you can enter right here.
          </>,
        )}
      </p>
    );
  }

  const entered = local?.takeId === take.id && me.mineId === local.entryId;
  const replacing = Boolean(me.mineId) && !entered;

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
    if (!me.loggedIn && name.trim() && !cleanNickname(name)) {
      setError(nicknameProblem(name, lang));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const duration = take.analysis?.duration ?? (await blobDuration(take.blob));
      const body = new FormData();
      // 보정을 켰으면 보정본을 올린다. 아직 만드는 중이면 끝날 때까지 기다린다.
      const file = (await polish.fileForUpload()) ?? take.blob;
      const ext = file.type.includes("wav") ? "wav" : file.type.includes("mp4") ? "m4a" : "webm";
      body.append("file", file, `take.${ext}`);
      body.append("week", week.id);
      body.append("client", clientId());
      if (!me.loggedIn) {
        const nick = cleanNickname(name);
        if (nick) body.append("name", nick);
        writeNickname(name);
      }
      if (local?.token) body.append("token", local.token);
      body.append("badges", JSON.stringify(strengths));
      if (promo) body.append("promo", "1");
      body.append("duration", String(Math.round(duration * 10) / 10));
      body.append("bars", JSON.stringify(downsample(take.analysis?.bars ?? [], 40)));
      const avatar = readLocalAvatar();
      if (avatar) body.append("avatar", JSON.stringify(avatar));
      const res = await fetch("/api/weekly/entries", { method: "POST", body });
      const d = (await res.json().catch(() => ({}))) as {
        id?: string;
        token?: string | null;
        rank?: number;
        total?: number;
        replaced?: boolean;
        error?: string;
      };
      if (res.status === 401) {
        track("enter_fail", { via: "401" });
        setNeedLogin(true);
        return;
      }
      if (!res.ok || !d.id) {
        track("enter_fail", { via: String(res.status) });
        setError(d.error ?? t("출전이 안 됐어요. 다시 시도해 주세요", "Couldn't enter. Please try again"));
        return;
      }
      const rec = { entryId: d.id, token: d.token ?? local?.token ?? null, takeId: take.id };
      writeMine(week.id, rec);
      setLocal(rec);
      setOpen(false);
      const rank = d.rank ?? 0;
      const total = d.total ?? 1;
      setDone({ id: d.id, rank, total, replaced: Boolean(d.replaced), badges: strengths });
      buzz(30);
      track("weekly_enter", { via: free ? "free" : week.id });
    } catch {
      track("enter_fail", { via: "net" });
      setError(t("인터넷이 잠깐 끊겼어요. 다시 시도해 주세요", "Connection dropped. Please try again"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {entered && local ? (
        <div className={styles.entered} data-tour="room-enter">
          <span className={styles.enteredBadge}>{free ? t("🎙️ 갤러리에 올라감", "🎙️ In the gallery") : t("🏆 출전 중", "🏆 Entered")}</span>
          <p>
            {free
              ? t("이 테이크가 목소리 갤러리에 올라가 있어요", "This take is up in the voice gallery")
              : t(`이 테이크로 ${label} 챌린지에 출전 중이에요`, `This take is your ${label} entry`)}
          </p>
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
      ) : !open ? (
        <button
          type="button"
          className={replacing ? styles.openAlt : styles.open}
          onClick={() => {
            setOpen(true);
            track("enter_open", { via: free ? "free" : week.id });
          }}
          data-tour="room-enter"
        >
          <span className={styles.openIcon} aria-hidden="true">
            {free ? "🎙️" : "🏆"}
          </span>
          <span>
            <b>
              {free
                ? replacing
                  ? t("이 테이크로 갤러리 녹음 바꾸기", "Swap my gallery take for this one")
                  : t("이 테이크를 목소리 갤러리에 올리기", "Post this take to the voice gallery")
                : replacing
                  ? t("이 테이크로 출전작 교체하기", "Replace my entry with this take")
                  : t("이 테이크를 목소리 갤러리에 올리기", "Post this take to the voice gallery")}
            </b>
            <small>
              {replacing
                ? t("지금 올린 것보다 더 잘 나온 것 같다면", "If this one's better than what's up now")
                : t("⭐ 좋은 목소리는 홈 추천에 소개돼요 · 언제든 교체 가능", "⭐ Great voices get featured on Home · swap anytime")}
            </small>
          </span>
          <i aria-hidden="true">→</i>
        </button>
      ) : (
        <div className={styles.panel}>
          <p className={styles.title}>
            {replacing
              ? t("올린 녹음 바꾸기", "Replace my take")
              : free
                ? t("목소리 갤러리에 올리기", "Post to the voice gallery")
                : t(`${label} 챌린지 출전`, `Enter ${label}`)}
          </p>
          <ul className={styles.facts}>
            <li>
              {free
                ? t("이 녹음이 목소리 갤러리에서 모두에게 공개되고, 이번 주 ❤ 순위에 들어가요", "This take goes public in the voice gallery and joins this week's ❤ ranking")
                : t("이 녹음이 목소리 갤러리에서 모두에게 공개되고, 이번 주 ❤ 순위에 들어가요", "This take goes public in the voice gallery and joins this week's ❤ ranking")}
            </li>
            {replacing ? (
              <li className={styles.warn}>{t("교체하면 지금까지 받은 ❤ 가 0 으로 돌아가요", "Replacing resets your ❤ to 0")}</li>
            ) : (
              <li>
                {free
                  ? t("대본마다 한 작품이에요. 더 잘 나온 테이크로 바꿀 수 있어요 (바꾸면 ❤ 초기화)", "One take per script. You can swap in a better one later (❤ reset)")
                  : t("한 사람당 한 작품이에요. 더 잘 나온 테이크로 교체할 수 있어요 (교체하면 ❤ 초기화)", "One entry per person. You can swap in a better take later (❤ reset)")}
              </li>
            )}
            <li>{t("마감 전에도 언제든 내릴 수 있어요", "You can withdraw anytime")}</li>
            {me.loggedIn ? (
              <li>
                {t("프로필 닉네임으로 출전돼요", "You'll enter under your profile nickname")} ·{" "}
                <Link href="/profile">{t("닉네임 바꾸기", "Change nickname")}</Link>
              </li>
            ) : (
              <li>{t("가입 없이도 출전할 수 있어요. 로그인하면 트로피가 계정에 남아요", "No sign-up needed. Log in to keep your trophy")}</li>
            )}
          </ul>
          <PolishRow polish={polish} />
          {!me.loggedIn && (
            <label className={styles.nick}>
              <span>{free ? t("갤러리에 보일 닉네임", "Name in the gallery") : t("순위에 보일 닉네임", "Name on the leaderboard")}</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={NICK_MAX}
                placeholder={t("비워 두면 ‘익명의 목소리’", "Leave blank for ‘Anonymous voice’")}
                autoComplete="nickname"
              />
            </label>
          )}
          {strengths.length > 0 && (
            <div className={styles.strengths}>
              <small>{t("이 테이크에서 잘한 점 — 출전작에 배지로 붙어요", "What this take did well — shown as badges")}</small>
              <span>
                {strengths.map((b) => (
                  <i key={b}>{badgeLabel(b, lang)}</i>
                ))}
              </span>
            </div>
          )}
          <p className={styles.feature}>{t("⭐ 좋은 목소리는 홈 추천에 소개돼요", "⭐ Great voices get featured on Home")}</p>
          <label className={styles.promo}>
            <input type="checkbox" checked={promo} onChange={(e) => setPromo(e.target.checked)} />
            <span>
              <b>{t("MIMIC 인스타에 소개돼도 좋아요", "OK to feature me on MIMIC's Instagram")}</b>
              <small>{t("선택이에요 · 켠 사람만 릴스 후보가 돼요", "Optional · only people who tick this are considered")}</small>
            </span>
          </label>
          {needLogin ? (
            <p className={styles.login}>
              {t("이 브라우저는 저장이 막혀 있어서 로그인해야 출전할 수 있어요.", "This browser blocks storage, so you'll need to log in to enter.")}{" "}
              <Link href={`/login?next=${encodeURIComponent(`/practice/${week.scriptId}`)}`}>{t("로그인 · 가입 →", "Log in / sign up →")}</Link>
            </p>
          ) : (
            <div className={styles.actions}>
              <button type="button" className={styles.cancel} onClick={() => setOpen(false)} disabled={busy}>
                {t("취소", "Cancel")}
              </button>
              <button type="button" className={styles.go} onClick={() => void submit()} disabled={busy}>
                {busy ? t("올리는 중…", "Uploading…") : replacing ? t("교체하기", "Replace") : t("올리기 🎙️", "Post 🎙️")}
              </button>
            </div>
          )}
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
        </div>
      )}

      {done && (
        <div className={styles.celebrate} role="dialog" aria-modal="true" aria-label={t("출전 완료", "Entered")}>
          <div className={styles.confetti} aria-hidden="true">
            {Array.from({ length: 18 }, (_, i) => (
              <i key={i} style={{ "--i": i } as React.CSSProperties} />
            ))}
          </div>
          <div className={styles.card}>
            <p className={styles.cardKicker}>
              {done.replaced ? t("교체 완료!", "Replaced!") : t("갤러리에 올라갔어요! 🎉", "You're in the gallery! 🎉")}
            </p>
            {done.rank > 0 && (
              <p className={styles.cardRank}>
                {t(<b>{done.rank}</b>, <b>#{done.rank}</b>)}
                <span>{t(`위 / ${done.total}명`, ` of ${done.total}`)}</span>
              </p>
            )}
            <p className={styles.cardLine}>
              {done.rank === 0
                ? t("누가 끝까지 들으면 알려 드릴게요. 친구에게 공유하면 첫 청취가 훨씬 빨라요!", "We'll tell you when someone listens all the way. Sharing gets you that first listen much faster!")
                : done.total === 1
                ? t("첫 번째 목소리예요! ❤ 하나만 받아도 1위로 시작해요.", "You're the first voice! A single ❤ puts you at #1.")
                : done.rank <= 3
                  ? t("벌써 시상대 위예요! 마감까지 자리를 지켜요 👑", "Already on the podium! Hold it till the deadline 👑")
                  : t("친구들한테 공유하면 ❤ 가 훨씬 빨리 모여요!", "Share with friends and the ❤ will pile up way faster!")}
            </p>
            {done.badges.length > 0 && (
              <div className={styles.strengths}>
                <small>{t("획득한 배지", "Badges earned")}</small>
                <span>
                  {done.badges.map((b) => (
                    <i key={b}>{badgeLabel(b, lang)}</i>
                  ))}
                </span>
              </div>
            )}
            <VoiceTypeCard type={vtype} />
            {/* 올린 사람의 진짜 보상은 "누가 들었다"는 소식이다 — 알림을 이 순간에 켜게 한다. */}
            <PushButton kind="mine" compact />
            {!me.loggedIn && (
              <Link href={`/login?next=${encodeURIComponent(`/weekly/e/${done.id}`)}`} className={styles.cardRankLink}>
                {t("로그인하면 구독자와 메시지를 받을 수 있어요 →", "Log in to get subscribers and messages →")}
              </Link>
            )}
            <PrivacyTag kind="public" />
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
              {free ? t("다른 목소리 듣고 ❤ 누르러 가기 →", "Listen to other voices and give ❤ →") : t("다른 출전작 듣고 ❤ 누르러 가기 →", "Listen to others and give ❤ →")}
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

/**
 * 목소리 보정 — 켜기/끄기 하나뿐. 기본은 켜짐(대부분은 안 바꾼다).
 * 패널을 열면 미리 만들어 두고, "들어보기"는 지금 고른 쪽을 튼다.
 */
type Polish = {
  on: boolean;
  setOn: (v: boolean) => void;
  state: "idle" | "busy" | "ready" | "failed";
  playing: boolean;
  togglePlay: () => void;
  fileForUpload: () => Promise<Blob | null>;
};

function usePolish(blob: Blob, active: boolean): Polish {
  const [on, setOnState] = useState(() => {
    try {
      return localStorage.getItem("mimic.polish") !== "off";
    } catch {
      return true;
    }
  });
  const [state, setState] = useState<Polish["state"]>("idle");
  const [playing, setPlaying] = useState(false);
  const job = useRef<Promise<Blob | null> | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const urls = useRef<{ raw?: string; pol?: string }>({});

  const start = () => {
    if (job.current) return job.current;
    setState("busy");
    job.current = polishVoice(blob)
      .then((b) => {
        setState("ready");
        return b;
      })
      .catch(() => {
        setState("failed");
        return null;
      });
    return job.current;
  };

  useEffect(() => {
    if (active && on && !job.current) void start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, on]);

  useEffect(
    () => () => {
      audio.current?.pause();
      if (urls.current.raw) URL.revokeObjectURL(urls.current.raw);
      if (urls.current.pol) URL.revokeObjectURL(urls.current.pol);
    },
    [],
  );

  const stop = () => {
    audio.current?.pause();
    setPlaying(false);
  };

  const setOn = (v: boolean) => {
    stop();
    setOnState(v);
    try {
      localStorage.setItem("mimic.polish", v ? "on" : "off");
    } catch {}
  };

  const togglePlay = async () => {
    if (playing) return stop();
    let src: string;
    if (on) {
      const b = await start();
      if (!b) return;
      urls.current.pol ??= URL.createObjectURL(b);
      src = urls.current.pol;
    } else {
      urls.current.raw ??= URL.createObjectURL(blob);
      src = urls.current.raw;
    }
    audio.current ??= new Audio();
    const a = audio.current;
    a.src = src;
    a.onended = () => setPlaying(false);
    setPlaying(true);
    a.play().catch(() => setPlaying(false));
  };

  const fileForUpload = async () => (on ? await start() : null);

  return { on, setOn, state, playing, togglePlay: () => void togglePlay(), fileForUpload };
}

function PolishRow({ polish }: { polish: Polish }) {
  const t = useT();
  const sub = !polish.on
    ? t("원래 녹음 그대로 올라가요", "Your original take will be uploaded")
    : polish.state === "busy"
      ? t("목소리 다듬는 중…", "Polishing your voice…")
      : polish.state === "failed"
        ? t("이 기기에선 보정이 안 돼요 · 원래 녹음으로 올라가요", "Can't polish on this device · original will be used")
        : t("잡음은 빼고 목소리는 또렷하게", "Less noise, clearer voice");
  return (
    <div className={styles.polish}>
      <button
        type="button"
        role="switch"
        aria-checked={polish.on}
        className={polish.on ? styles.polishOn : styles.polishOff}
        onClick={() => polish.setOn(!polish.on)}
      >
        <span className={styles.polishKnob} aria-hidden="true" />
        <span className={styles.polishText}>
          <b>{t("✨ 목소리 보정", "✨ Voice polish")}</b>
          <small>{sub}</small>
        </span>
      </button>
      <button
        type="button"
        className={styles.polishPlay}
        onClick={polish.togglePlay}
        disabled={polish.on && polish.state === "busy"}
      >
        {polish.playing ? t("■ 멈춤", "■ Stop") : t("▶ 들어보기", "▶ Listen")}
      </button>
    </div>
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

function downsample(bars: number[], n: number): number[] {
  if (bars.length <= n) return bars.map((b) => Math.round(b * 100) / 100);
  const out: number[] = [];
  const step = bars.length / n;
  for (let i = 0; i < n; i++) {
    const slice = bars.slice(Math.floor(i * step), Math.floor((i + 1) * step));
    out.push(Math.round(Math.max(...slice) * 100) / 100);
  }
  return out;
}

function blobDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const a = new Audio();
    a.preload = "metadata";
    a.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(a.duration) ? a.duration : 15);
    };
    a.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(15);
    };
    a.src = url;
  });
}
