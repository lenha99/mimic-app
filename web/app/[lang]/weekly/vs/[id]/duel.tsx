"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { VoiceAvatar } from "@/components/voice-avatar";
import { useToast } from "@/components/weekly/toast";
import { buzz, shareLink } from "@/components/weekly/use-weekly";
import { useLang, useT } from "@/components/lang";
import { normalizeAvatar } from "@/lib/avatar";
import { clientId } from "@/lib/client-id";
import { track } from "@/lib/track";
import { audioSrc, displayName, readMine, type EntryCard, type Week } from "@/lib/weekly";
import b from "../../battle/battle.module.css";
import styles from "./duel.module.css";

type Status = { mine: string | null; tally?: Record<string, number>; voted?: string | null; token?: string | null; ready?: boolean };
type Slot = "a" | "b";

/** 이만큼 들으면 "들었다"로 친다 — 짧은 녹음은 절반. */
const HEAR_S = 3;

/**
 * 1:1 목소리 대결.
 *
 * 상대가 없으면(b 없음) 도전장 화면 — 받은 사람이 같은 대본으로 출전해서 붙는다.
 * 둘 다 있으면 심판 화면 — 둘 다 듣고 한쪽을 고른다. 고르기 전엔 몇 대 몇인지 숨긴다
 * (이기고 있는 쪽으로 쏠리지 않게). 대결 당사자는 고를 수 없고 스코어와 공유만 본다.
 */
export default function Duel({
  week,
  a,
  b: rival,
  scriptText,
}: {
  week: Week;
  a: EntryCard | null;
  b: EntryCard | null;
  scriptText: string;
}) {
  const t = useT();
  const lang = useLang();
  const [status, setStatus] = useState<Status | null>(null);
  const [myEntry, setMyEntry] = useState<string | null>(null);
  const [playing, setPlaying] = useState<Slot | null>(null);
  const [progress, setProgress] = useState<Record<Slot, number>>({ a: 0, b: 0 });
  const [heard, setHeard] = useState<Record<Slot, boolean>>({ a: false, b: false });
  const [sending, setSending] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  const [toast, showToast] = useToast();

  const load = useCallback(async () => {
    if (!a) return;
    const q = new URLSearchParams({ a: a.id, client: clientId() });
    if (rival) q.set("b", rival.id);
    try {
      const res = await fetch(`/api/weekly/duel?${q}`, { cache: "no-store" });
      if (res.ok) setStatus((await res.json()) as Status);
    } catch {}
  }, [a, rival]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMyEntry(readMine()[week.id]?.entryId ?? null);
    void load();
    track("battle_view", { via: rival ? "duel" : "duel_invite" });
  }, [load, week.id, rival]);

  if (!a) {
    return (
      <main className={`shell ${b.page}`}>
        <nav className={b.nav}>
          <Link href="/weekly">{t("← 이번 주 챌린지", "← This week")}</Link>
        </nav>
        <div className={b.empty}>
          <p className={b.emptyBig}>⚔️</p>
          <p>{t("이 대결은 끝났거나 없어진 출전작이에요.", "This duel has ended or the entry is gone.")}</p>
          <Link href="/weekly" className={b.next}>
            {t("이번 주 챌린지로", "Back to this week")}
          </Link>
        </div>
      </main>
    );
  }

  const sides: [Slot, EntryCard][] = rival ? [["a", a], ["b", rival]] : [["a", a]];
  const mine = status?.mine ?? (myEntry === a.id || myEntry === rival?.id ? myEntry : null);
  const voted = status?.voted ?? null;
  const showScore = !!rival && (!!voted || !!mine);
  const total = status?.tally ? Object.values(status.tally).reduce((s, n) => s + n, 0) : 0;
  const ready = heard.a && (!rival || heard.b);

  const play = (slot: Slot) => {
    const el = audio.current;
    const e = slot === "a" ? a : rival;
    if (!el || !e) return;
    if (playing === slot) {
      el.pause();
      setPlaying(null);
      return;
    }
    setPlaying(slot);
    el.src = audioSrc(e.id, e.createdAt);
    void el.play().catch(() => {
      setPlaying(null);
      showToast(t("재생이 안 됐어요. 한 번 더 눌러 주세요", "Couldn't play. Tap once more"));
    });
  };

  const onTime = () => {
    const el = audio.current;
    const e = playing === "a" ? a : playing === "b" ? rival : null;
    if (!el || !playing || !e) return;
    const d = el.duration && Number.isFinite(el.duration) ? el.duration : e.duration;
    setProgress((x) => ({ ...x, [playing]: d > 0 ? Math.min(1, el.currentTime / d) : 0 }));
    if (el.currentTime >= Math.min(HEAR_S, d * 0.5)) setHeard((x) => (x[playing] ? x : { ...x, [playing]: true }));
  };

  const onEnded = () => {
    if (!playing) return;
    const slot = playing;
    setHeard((x) => ({ ...x, [slot]: true }));
    setProgress((x) => ({ ...x, [slot]: 1 }));
    setPlaying(null);
  };

  const pick = async (slot: Slot) => {
    const winner = slot === "a" ? a : rival;
    if (!winner || !status?.token || sending) return;
    if (!ready) {
      showToast(t("둘 다 들어 보고 골라 주세요!", "Listen to both before picking!"));
      return;
    }
    setSending(true);
    buzz(20);
    try {
      const res = await fetch("/api/weekly/battle", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: status.token, winner: winner.id, client: clientId() }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        showToast(d.error ?? t("표가 저장되지 않았어요. 다시 시도해 주세요.", "Your vote didn't save. Please try again."));
        if (res.status === 400) void load();
        return;
      }
      audio.current?.pause();
      setPlaying(null);
      track("battle_vote", { via: "duel" });
      await load();
    } catch {
      showToast(t("연결이 불안정해요. 다시 눌러 주세요.", "Connection hiccup. Tap again."));
    } finally {
      setSending(false);
    }
  };

  const shareDuel = async () => {
    const url = rival ? `${location.origin}/weekly/vs/${a.id}?b=${rival.id}` : `${location.origin}/weekly/vs/${a.id}`;
    const text = rival
      ? t("같은 대본 두 목소리, 누가 더 잘했어? 골라 줘 🔥", "Same script, two voices. Who did it better? 🔥")
      : t("같은 대본으로 나랑 1:1 목소리 대결 ㄱ? ⚔️", "Same script, you vs me. 1:1 voice duel? ⚔️");
    const r = await shareLink(url, text);
    if (r === "copied") showToast(t("링크를 복사했어요. 단톡방에 붙여 넣어 보세요!", "Link copied. Paste it in your group chat!"));
    if (r !== "failed") track("weekly_share", { via: rival ? "duel" : "duel_invite" });
  };

  const name = (e: EntryCard) => displayName(e.name, lang);

  return (
    <main className={`shell ${b.page}`}>
      <nav className={b.nav}>
        <Link href="/weekly">{t("← 이번 주 챌린지", "← This week")}</Link>
      </nav>

      <header className={b.head}>
        <p className="eyebrow">{t("1:1 목소리 대결", "1:1 voice duel")}</p>
        <h1 className={b.title}>
          {rival
            ? t("누가 더 잘했어?", "Who did it better?")
            : mine
              ? t("친구에게 도전장을 보내세요", "Send a friend your challenge")
              : t(`${name(a)}님의 도전장이 왔어요`, `${name(a)} challenged you`)}
        </h1>
        <p className={b.sub}>
          {rival
            ? mine
              ? t("친구들한테 링크를 보내서 심판을 부탁해 보세요.", "Send the link to friends and let them judge.")
              : t("같은 대본을 읽은 두 사람이에요. 둘 다 듣고 한쪽을 골라 주세요.", "Same script, two people. Listen to both and pick one.")
            : mine
              ? t("받은 사람이 같은 대본으로 출전하면 대결이 시작돼요.", "When they enter with the same script, the duel begins.")
              : t("같은 대본으로 출전해서 맞붙어 보세요. 심판은 친구들이 봐요.", "Enter with the same script and face off. Friends are the judges.")}
        </p>
      </header>

      <div className={rival ? b.duel : styles.solo}>
        {sides.map(([slot, e]) => {
          const bars = e.bars.length ? e.bars : Array.from({ length: 28 }, () => 0.3);
          const score = status?.tally?.[e.id] ?? 0;
          const share = total > 0 ? Math.round((score / total) * 100) : 0;
          const lead = showScore && total > 0 && score * 2 > total;
          return (
            <section
              key={slot}
              className={`${b.card} ${playing === slot ? b.cardOn : ""} ${voted === e.id || lead ? b.cardWin : ""}`}
            >
              <div className={b.cardTop}>
                <VoiceAvatar avatar={normalizeAvatar(e.avatar)} level={0} size={56} />
                {voted === e.id && <span className={b.badge}>{t("내 선택", "My pick")}</span>}
                {mine === e.id && <span className={b.badge}>{t("나", "Me")}</span>}
              </div>
              <p className={b.name}>
                <b>{name(e)}</b>
                {showScore && (
                  <small>
                    {t(`${score}표`, `${score} votes`)} · {share}%
                  </small>
                )}
              </p>
              <button
                type="button"
                className={b.play}
                onClick={() => play(slot)}
                aria-label={`${name(e)} ${playing === slot ? t("멈추기", "pause") : t("듣기", "play")}`}
              >
                <span className={b.playIcon} aria-hidden="true">
                  {playing === slot ? "❚❚" : "▶"}
                </span>
                <span className={b.wave} aria-hidden="true">
                  {bars.map((h, i) => (
                    <i
                      key={i}
                      style={{ height: `${Math.max(12, h * 100)}%` }}
                      className={i / bars.length < progress[slot] ? b.waveOn : undefined}
                    />
                  ))}
                </span>
              </button>
              {rival && status?.token && (
                <button
                  type="button"
                  className={b.pick}
                  disabled={sending}
                  aria-disabled={!ready}
                  data-ready={ready}
                  onClick={() => void pick(slot)}
                >
                  {t("이쪽이 더 좋아요", "This one")}
                </button>
              )}
            </section>
          );
        })}
      </div>

      {rival && !mine && !voted && status?.token && !ready && (
        <p className={b.hint}>{t("▶ 를 눌러 둘 다 들어 보세요", "Tap ▶ and listen to both")}</p>
      )}
      {rival && status && status.ready === false && (
        <p className={b.hint}>{t("대결 심사는 곧 열려요!", "Judging opens soon!")}</p>
      )}
      {showScore && <p className={styles.total}>{t(`지금까지 ${total}명이 골랐어요`, `${total} people have picked so far`)}</p>}

      <div className={styles.actions}>
        {mine || voted ? (
          <button type="button" className={b.next} onClick={() => void shareDuel()}>
            {rival
              ? t("친구들한테 심판 부탁하기", "Ask friends to judge")
              : t("⚔️ 도전장 보내기", "⚔️ Send the challenge")}
          </button>
        ) : !rival ? (
          myEntry ? (
            <Link href={`/weekly/vs/${a.id}?b=${myEntry}`} className={b.next}>
              {t("내 출전작으로 맞붙기 ⚔️", "Duel with my entry ⚔️")}
            </Link>
          ) : (
            <Link href={`/practice/${week.scriptId}?from=weekly&vs=${a.id}`} className={b.next}>
              {t("같은 대본 연습하고 맞붙기 ⚔️", "Practice the script & duel ⚔️")}
            </Link>
          )
        ) : null}
        {rival && !mine && (
          <Link href={`/weekly/vs/${a.id}`} className={styles.ghost}>
            {t("나도 이 사람이랑 붙어 보기 →", "Duel this person myself →")}
          </Link>
        )}
      </div>

      {scriptText && (
        <details className={styles.script}>
          <summary>{t("대본 보기", "Show script")}</summary>
          <p>{scriptText.replace(/\*/g, "")}</p>
        </details>
      )}

      <p className={b.foot}>
        {t(
          "대결 결과는 ❤ 순위와 따로예요. 한 사람이 한 대결에 한 번만 고를 수 있어요.",
          "Duel results are separate from the ❤ ranking. One pick per person per duel.",
        )}
      </p>
      <audio ref={audio} onTimeUpdate={onTime} onEnded={onEnded} preload="none" />
      {toast}
    </main>
  );
}
