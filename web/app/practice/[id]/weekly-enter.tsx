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
import styles from "./weekly-enter.module.css";

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
  const me = useWeeklyMe(week.id);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needLogin, setNeedLogin] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const [local, setLocal] = useState(() => readMine()[week.id]);
  const [toast, showToast] = useToast();

  if (!live) {
    return (
      <p className={styles.soon}>
        🏆 이 대본은 <b>{seasonLabel(week)}</b> 챌린지예요. 월요일 0시에 열리면 이 화면에서 바로 출전할 수 있어요.
      </p>
    );
  }

  const entered = local?.takeId === take.id && me.mineId === local.entryId;
  const replacing = Boolean(me.mineId) && !entered;

  const share = async (id: string) => {
    const r = await shareLink(
      `${location.origin}/weekly/e/${id}`,
      `MIMIC 보이스 챌린지 「${week.title}」 출전했어! 들어보고 ❤ 한 번만 눌러줘 🙏`,
    );
    if (r === "copied") showToast("링크를 복사했어요. 단톡방에 붙여 넣어 보세요!");
    if (r !== "failed") track("weekly_share", { via: id });
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const duration = take.analysis?.duration ?? (await blobDuration(take.blob));
      const body = new FormData();
      const ext = take.blob.type.includes("mp4") ? "m4a" : "webm";
      body.append("file", take.blob, `take.${ext}`);
      body.append("week", week.id);
      body.append("client", clientId());
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
        setError(d.error ?? "출전하지 못했어요. 다시 해주세요.");
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
      setError("네트워크가 끊겼어요. 다시 해주세요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {entered && local ? (
        <div className={styles.entered} data-tour="room-enter">
          <span className={styles.enteredBadge}>🏆 출전 중</span>
          <p>이 테이크로 {seasonLabel(week)} 챌린지에 나가 있어요.</p>
          <PrivacyTag kind="public" />
          <div className={styles.enteredActions}>
            <button type="button" className={styles.ask} onClick={() => void share(local.entryId)}>
              내 출전작 공유하기
            </button>
            <Link href="/weekly" className={styles.rankLink}>
              다른 출전작 듣기
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
            <b>{replacing ? "이 테이크로 출전작 교체하기" : "이 테이크로 이번 주 챌린지 출전"}</b>
            <small>
              {replacing ? "지금 출전작보다 나은 것 같다면" : `${seasonLabel(week)} 챌린지 · 마감 전까지 언제든 교체 가능`}
            </small>
          </span>
          <i aria-hidden="true">→</i>
        </button>
      ) : (
        <div className={styles.panel}>
          <p className={styles.title}>{replacing ? "출전작 교체" : `${seasonLabel(week)} 챌린지 출전`}</p>
          <ul className={styles.facts}>
            <li>이 녹음이 챌린지 화면에서 모두에게 들려요</li>
            {replacing ? (
              <li className={styles.warn}>교체하면 지금까지 받은 ❤ 가 0 으로 돌아가요</li>
            ) : (
              <li>한 사람 한 작품 — 더 나은 테이크가 나오면 교체할 수 있어요 (교체하면 ❤ 초기화)</li>
            )}
            <li>마감 전에도 언제든 내릴 수 있어요</li>
            {!me.loggedIn && <li>로그인 없이 &lsquo;익명의 목소리&rsquo;로 출전돼요. 로그인하면 트로피가 계정에 남아요</li>}
          </ul>
          {needLogin ? (
            <p className={styles.login}>
              이 브라우저는 저장이 막혀 있어서 로그인해야 출전할 수 있어요.{" "}
              <Link href={`/login?next=${encodeURIComponent(`/practice/${week.scriptId}`)}`}>로그인 · 가입 →</Link>
            </p>
          ) : (
            <div className={styles.actions}>
              <button type="button" className={styles.cancel} onClick={() => setOpen(false)} disabled={busy}>
                취소
              </button>
              <button type="button" className={styles.go} onClick={() => void submit()} disabled={busy}>
                {busy ? "올리는 중…" : replacing ? "교체하기" : "출전하기"}
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
        <div className={styles.celebrate} role="dialog" aria-modal="true" aria-label="출전 완료">
          <div className={styles.confetti} aria-hidden="true">
            {Array.from({ length: 18 }, (_, i) => (
              <i key={i} style={{ "--i": i } as React.CSSProperties} />
            ))}
          </div>
          <div className={styles.card}>
            <p className={styles.cardKicker}>{done.replaced ? "교체 완료" : "출전 완료!"}</p>
            <p className={styles.cardRank}>
              <b>{done.rank}</b>
              <span>위 / {done.total}명</span>
            </p>
            <p className={styles.cardLine}>
              {done.total === 1
                ? "첫 번째 목소리예요. 다른 사용자가 ❤ 하나만 눌러도 1위로 시작해요."
                : done.rank <= 3
                  ? "벌써 시상대 위예요! 마감까지 자리를 지켜요."
                  : "❤ 는 다른 사용자들이 듣고 눌러줘요. 당신도 다른 출전작을 듣고 ❤ 를 눌러 보세요."}
            </p>
            <PrivacyTag kind="public" />
            <button type="button" className={styles.cardShare} onClick={() => void share(done.id)}>
              내 출전작 공유하기
            </button>
            <Link href="/weekly" className={styles.cardRankLink}>
              다른 출전작 듣고 ❤ 누르러 가기 →
            </Link>
            <button type="button" className={styles.cardClose} onClick={() => setDone(null)}>
              연습 계속하기
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
  const at = useNow();
  if (at === null) return null;
  const week = currentWeek(at);
  if (week.scriptId !== scriptId) return null;
  const live = isLive(week, at);
  return (
    <Link href="/weekly" className={styles.banner}>
      <span className={styles.bannerChip}>{seasonLabel(week)}</span>
      <span className={styles.bannerText}>
        {live ? (
          <>
            이번 주 챌린지 대본 · <b>{left(week.endsAt, at)}</b> 남음
          </>
        ) : (
          <>다음 챌린지 대본 · 월요일 0시 오픈</>
        )}
      </span>
      <i aria-hidden="true">순위 →</i>
    </Link>
  );
}

function left(end: number, now: number): string {
  const r = remaining(end - now);
  return r.d > 0 ? `${r.d}일 ${r.h}시간` : r.h > 0 ? `${r.h}시간 ${r.m}분` : `${r.m}분`;
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
