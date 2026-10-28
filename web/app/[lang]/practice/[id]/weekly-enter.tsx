"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useToast } from "@/components/weekly/toast";
import { buzz, shareLink, useWeeklyMe } from "@/components/weekly/use-weekly";
import { readLocalAvatar } from "@/lib/avatar";
import { clientId } from "@/lib/client-id";
import type { Take } from "@/lib/take-store";
import { track } from "@/lib/track";
import { currentWeek, isLive, readMine, remaining, seasonLabel, writeMine, type Week } from "@/lib/weekly";
import { PrivacyTag } from "@/components/privacy-tag";
import { cleanNickname, NICK_MAX, nicknameProblem, readNickname, writeNickname } from "@/lib/nickname";
import styles from "./weekly-enter.module.css";
import { useLang, useT } from "@/components/lang";
import type { T } from "@/lib/i18n";

/**
 * 연습실 → 이번 주 챌린지 출전.
 *
 * 이번 주 대본을 연습하는 중일 때만 뜬다. 연습 테이크는 원래 이 폰에만 있으니(take-store),
 * 올리기 전에 무엇이 공개되는지를 버튼 바로 위에 적는다. 출전하면 그 자리에서 몇 위로
 * 들어갔는지 보여주고 — 순위가 보여야 ❤ 를 모으고 싶어진다 — 공유 버튼을 바로 붙인다.
 */
export function WeeklyEnter({ take, scriptId }: { take: Take; scriptId: string }) {
  const at = useNow();
  if (at === null) return null;
  const week = currentWeek(at);
  if (week.scriptId !== scriptId) return null;
  return <Enter week={week} take={take} live={isLive(week, at)} />;
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

type Done = { id: string; rank: number; total: number; replaced: boolean };

function Enter({ week, take, live }: { week: Week; take: Take; live: boolean }) {
  const t = useT();
  const lang = useLang();
  const label = seasonLabel(week, lang);
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
      t(
        `MIMIC 보이스 챌린지 「${week.title}」 출전함 🎙️ 들어보고 ❤ 하나만 눌러줘 🙏`,
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
      const ext = take.blob.type.includes("mp4") ? "m4a" : "webm";
      body.append("file", take.blob, `take.${ext}`);
      body.append("week", week.id);
      body.append("client", clientId());
      if (!me.loggedIn) {
        const nick = cleanNickname(name);
        if (nick) body.append("name", nick);
        writeNickname(name);
      }
      if (local?.token) body.append("token", local.token);
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
        setNeedLogin(true);
        return;
      }
      if (!res.ok || !d.id) {
        setError(d.error ?? t("출전이 안 됐어요. 다시 시도해 주세요", "Couldn't enter. Please try again"));
        return;
      }
      const rec = { entryId: d.id, token: d.token ?? local?.token ?? null, takeId: take.id };
      writeMine(week.id, rec);
      setLocal(rec);
      setOpen(false);
      setDone({ id: d.id, rank: d.rank ?? 1, total: d.total ?? 1, replaced: Boolean(d.replaced) });
      buzz(30);
      track("weekly_enter", { via: week.id });
    } catch {
      setError(t("인터넷이 잠깐 끊겼어요. 다시 시도해 주세요", "Connection dropped. Please try again"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {entered && local ? (
        <div className={styles.entered} data-tour="room-enter">
          <span className={styles.enteredBadge}>{t("🏆 출전 중", "🏆 Entered")}</span>
          <p>{t(`이 테이크로 ${label} 챌린지에 출전 중이에요`, `This take is your ${label} entry`)}</p>
          <PrivacyTag kind="public" />
          <div className={styles.enteredActions}>
            <button type="button" className={styles.ask} onClick={() => void share(local.entryId)}>
              {t("❤ 모으러 공유하기", "Share to get ❤")}
            </button>
            <Link href="/weekly" className={styles.rankLink}>
              {t("다른 출전작 듣기", "Hear other entries")}
            </Link>
          </div>
        </div>
      ) : !open ? (
        <button
          type="button"
          className={replacing ? styles.openAlt : styles.open}
          onClick={() => setOpen(true)}
          data-tour="room-enter"
        >
          <span className={styles.openIcon} aria-hidden="true">
            🏆
          </span>
          <span>
            <b>{replacing ? t("이 테이크로 출전작 교체하기", "Replace my entry with this take") : t("이 테이크로 이번 주 챌린지 출전!", "Enter this take in this week's challenge!")}</b>
            <small>
              {replacing
                ? t("지금 출전작보다 더 잘 나온 것 같다면", "If this one's better than your current entry")
                : t(`${label} 챌린지 · 마감 전까지 언제든 교체 가능`, `${label} challenge · swap anytime before the deadline`)}
            </small>
          </span>
          <i aria-hidden="true">→</i>
        </button>
      ) : (
        <div className={styles.panel}>
          <p className={styles.title}>{replacing ? t("출전작 교체", "Replace entry") : t(`${label} 챌린지 출전`, `Enter ${label}`)}</p>
          <ul className={styles.facts}>
            <li>{t("이 녹음이 챌린지 화면에서 모두에게 공개돼요", "This take will be public on the challenge page")}</li>
            {replacing ? (
              <li className={styles.warn}>{t("교체하면 지금까지 받은 ❤ 가 0 으로 돌아가요", "Replacing resets your ❤ to 0")}</li>
            ) : (
              <li>{t("한 사람당 한 작품이에요. 더 잘 나온 테이크로 교체할 수 있어요 (교체하면 ❤ 초기화)", "One entry per person. You can swap in a better take later (❤ reset)")}</li>
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
          {!me.loggedIn && (
            <label className={styles.nick}>
              <span>{t("순위에 보일 닉네임", "Name on the leaderboard")}</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={NICK_MAX}
                placeholder={t("비워 두면 ‘익명의 목소리’", "Leave blank for ‘Anonymous voice’")}
                autoComplete="nickname"
              />
            </label>
          )}
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
                {busy ? t("올리는 중…", "Uploading…") : replacing ? t("교체하기", "Replace") : t("출전하기 🏆", "Enter 🏆")}
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
            <p className={styles.cardKicker}>{done.replaced ? t("교체 완료!", "Replaced!") : t("출전 완료! 🎉", "You're in! 🎉")}</p>
            <p className={styles.cardRank}>
              {t(<b>{done.rank}</b>, <b>#{done.rank}</b>)}
              <span>{t(`위 / ${done.total}명`, ` of ${done.total}`)}</span>
            </p>
            <p className={styles.cardLine}>
              {done.total === 1
                ? t("첫 번째 목소리예요! ❤ 하나만 받아도 1위로 시작해요.", "You're the first voice! A single ❤ puts you at #1.")
                : done.rank <= 3
                  ? t("벌써 시상대 위예요! 마감까지 자리를 지켜요 👑", "Already on the podium! Hold it till the deadline 👑")
                  : t("친구들한테 공유하면 ❤ 가 훨씬 빨리 모여요!", "Share with friends and the ❤ will pile up way faster!")}
            </p>
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
              {t("다른 출전작 듣고 ❤ 누르러 가기 →", "Listen to others and give ❤ →")}
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
                이번 주 챌린지 대본 · <b>{left(week.endsAt, at, t)}</b> 남았어요
              </>,
              <>
                This week&apos;s challenge script · <b>{left(week.endsAt, at, t)}</b> left
              </>,
            )
          : t("다음 챌린지 대본 · 월요일 0시 오픈", "Next challenge script · opens Monday 00:00 KST")}
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
