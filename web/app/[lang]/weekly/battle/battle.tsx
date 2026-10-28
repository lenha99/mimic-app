"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { VoiceAvatar } from "@/components/voice-avatar";
import { useToast } from "@/components/weekly/toast";
import { buzz } from "@/components/weekly/use-weekly";
import { useLang, useT } from "@/components/lang";
import { normalizeAvatar } from "@/lib/avatar";
import { clientId } from "@/lib/client-id";
import { track } from "@/lib/track";
import { audioSrc, displayName } from "@/lib/weekly";
import styles from "./battle.module.css";

type Side = { id: string; duration: number; bars: number[]; v: string };
type Pair = { a: Side; b: Side; token: string };
type Reveal = Record<string, { name: string; avatar: unknown; wins: number; losses: number }>;
type Slot = "a" | "b";

/** 이만큼 들으면 "들었다"로 친다 — 첫 소절이면 목소리는 갈린다. 짧은 녹음은 절반. */
const HEAR_S = 3;

/**
 * 블라인드 보이스 배틀 — 같은 대본, 두 목소리, 이름 없음.
 *
 * ❤ 는 친구가 많은 사람이 이긴다. 여기선 누가 누군지 모른 채 소리만 듣고 고른다.
 * 둘 다 들어야 고를 수 있고, 고른 다음에야 누구였는지 보여 준다. 그 공개가
 * "한 판만 더"를 누르게 만드는 보상이다.
 */
export default function Battle() {
  const t = useT();
  const lang = useLang();
  const [pair, setPair] = useState<Pair | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [info, setInfo] = useState({ total: 0, judged: 0 });
  const [playing, setPlaying] = useState<Slot | null>(null);
  const [progress, setProgress] = useState<Record<Slot, number>>({ a: 0, b: 0 });
  const [heard, setHeard] = useState<Record<Slot, boolean>>({ a: false, b: false });
  const [picked, setPicked] = useState<Slot | null>(null);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [sending, setSending] = useState(false);
  const [count, setCount] = useState(0);
  const audio = useRef<HTMLAudioElement>(null);
  const [toast, showToast] = useToast();

  const load = useCallback(async () => {
    audio.current?.pause();
    setPlaying(null);
    setState("loading");
    setPicked(null);
    setReveal(null);
    setProgress({ a: 0, b: 0 });
    setHeard({ a: false, b: false });
    try {
      const res = await fetch(`/api/weekly/battle?client=${encodeURIComponent(clientId())}`, { cache: "no-store" });
      const data = (await res.json()) as { pair: Pair | null; total: number; judged: number; error?: string };
      if (!res.ok) throw new Error(data.error);
      setInfo({ total: data.total, judged: data.judged });
      setPair(data.pair);
      setState(data.pair ? "ready" : "empty");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    track("battle_view");
  }, [load]);

  const play = (slot: Slot) => {
    const el = audio.current;
    if (!el || !pair) return;
    if (playing === slot) {
      el.pause();
      setPlaying(null);
      return;
    }
    const side = pair[slot];
    setPlaying(slot);
    el.src = audioSrc(side.id, side.v);
    void el.play().catch(() => {
      setPlaying(null);
      showToast(t("재생이 안 됐어요. 한 번 더 눌러 주세요", "Couldn't play. Tap once more"));
    });
  };

  const onTime = () => {
    const el = audio.current;
    if (!el || !playing || !pair) return;
    const d = el.duration && Number.isFinite(el.duration) ? el.duration : pair[playing].duration;
    const p = d > 0 ? Math.min(1, el.currentTime / d) : 0;
    setProgress((x) => ({ ...x, [playing]: p }));
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
    if (!pair || sending || picked) return;
    if (!heard.a || !heard.b) {
      showToast(t("둘 다 들어 보고 골라 주세요!", "Listen to both before picking!"));
      return;
    }
    setSending(true);
    buzz(20);
    try {
      const res = await fetch("/api/weekly/battle", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: pair.token, winner: pair[slot].id, client: clientId() }),
      });
      const data = (await res.json()) as { reveal?: Reveal; dup?: boolean; error?: string };
      if (!res.ok || !data.reveal) {
        showToast(data.error ?? t("표가 저장되지 않았어요. 다시 시도해 주세요.", "Your vote didn't save. Please try again."));
        // 만료·삭제된 짝은 붙잡고 있어 봐야 소용없다 — 다음 판으로.
        if (res.status === 400 || res.status === 404 || res.status === 403) void load();
        return;
      }
      audio.current?.pause();
      setPlaying(null);
      setPicked(slot);
      setReveal(data.reveal);
      if (!data.dup) setCount((n) => n + 1);
      track("battle_vote", { via: data.dup ? "dup" : "ok" });
    } catch {
      showToast(t("연결이 불안정해요. 다시 눌러 주세요.", "Connection hiccup. Tap again."));
    } finally {
      setSending(false);
    }
  };

  const ready = heard.a && heard.b;

  return (
    <main className={`shell ${styles.page}`}>
      <nav className={styles.nav}>
        <Link href="/weekly">{t("← 이번 주 챌린지", "← This week")}</Link>
        {count > 0 && <span className={styles.count}>{t(`${count}판 심사`, `${count} judged`)}</span>}
      </nav>

      <header className={styles.head}>
        <p className="eyebrow">{t("블라인드 보이스 배틀", "Blind voice battle")}</p>
        <h1 className={styles.title}>{t("어느 목소리가 더 좋아요?", "Which voice is better?")}</h1>
        <p className={styles.sub}>
          {t(
            "같은 대본을 읽은 두 사람이에요. 누군지는 고른 다음에 알려 드려요.",
            "Two people, same script. You'll see who they are after you pick.",
          )}
        </p>
      </header>

      {state === "loading" && <div className={styles.skeleton} aria-label={t("불러오는 중", "Loading")} />}

      {state === "error" && (
        <div className={styles.empty}>
          <p>{t("대결을 불러오지 못했어요.", "Couldn't load a battle.")}</p>
          <button type="button" className={styles.next} onClick={() => void load()}>
            {t("다시 시도", "Try again")}
          </button>
        </div>
      )}

      {state === "empty" && (
        <div className={styles.empty}>
          <p className={styles.emptyBig}>🎧</p>
          <p>
            {info.total < 2
              ? t("아직 붙일 목소리가 모자라요. 먼저 출전해 보는 건 어때요?", "Not enough voices to battle yet. Why not enter first?")
              : t("지금 심사할 수 있는 대결은 다 봤어요. 새 출전작이 들어오면 또 열려요!", "You've judged every battle for now. New ones open as entries come in!")}
          </p>
          <Link href="/weekly" className={styles.next}>
            {t("이번 주 챌린지로", "Back to this week")}
          </Link>
        </div>
      )}

      {state === "ready" && pair && (
        <>
          <div className={styles.duel}>
            {(["a", "b"] as const).map((slot) => {
              const side = pair[slot];
              const who = reveal?.[side.id];
              const bars = side.bars.length ? side.bars : Array.from({ length: 28 }, () => 0.3);
              const win = picked === slot;
              return (
                <section
                  key={slot}
                  className={`${styles.card} ${playing === slot ? styles.cardOn : ""} ${win ? styles.cardWin : ""} ${
                    picked && !win ? styles.cardLose : ""
                  }`}
                >
                  <div className={styles.cardTop}>
                    {who ? (
                      <VoiceAvatar avatar={normalizeAvatar(who.avatar)} size={56} />
                    ) : (
                      <span className={styles.letter}>{slot.toUpperCase()}</span>
                    )}
                    {heard[slot] && !who && <span className={styles.heard}>✓ {t("들음", "Heard")}</span>}
                    {win && <span className={styles.badge}>{t("내 선택", "My pick")}</span>}
                  </div>
                  {who && (
                    <p className={styles.name}>
                      <b>{displayName(who.name, lang)}</b>
                      <small>{t(`${who.wins}승 ${who.losses}패`, `${who.wins}W ${who.losses}L`)}</small>
                    </p>
                  )}
                  <button
                    type="button"
                    className={styles.play}
                    onClick={() => play(slot)}
                    aria-label={`${slot.toUpperCase()} ${playing === slot ? t("멈추기", "pause") : t("듣기", "play")}`}
                  >
                    <span className={styles.playIcon} aria-hidden="true">
                      {playing === slot ? "❚❚" : "▶"}
                    </span>
                    <span className={styles.wave} aria-hidden="true">
                      {bars.map((b, i) => (
                        <i
                          key={i}
                          style={{ height: `${Math.max(12, b * 100)}%` }}
                          className={i / bars.length < progress[slot] ? styles.waveOn : undefined}
                        />
                      ))}
                    </span>
                  </button>
                  {!picked && (
                    <button
                      type="button"
                      className={styles.pick}
                      disabled={sending}
                      aria-disabled={!ready}
                      data-ready={ready}
                      onClick={() => void pick(slot)}
                    >
                      {t(`${slot.toUpperCase()}가 더 좋아요`, `${slot.toUpperCase()} is better`)}
                    </button>
                  )}
                </section>
              );
            })}
          </div>

          {!picked && !ready && (
            <p className={styles.hint}>{t("▶ 를 눌러 둘 다 들어 보세요", "Tap ▶ and listen to both")}</p>
          )}

          {picked && (
            <button type="button" className={styles.next} onClick={() => void load()}>
              {t("다음 대결 →", "Next battle →")}
            </button>
          )}
        </>
      )}

      <p className={styles.foot}>
        {t(
          "고른 결과는 블라인드 순위에만 쌓여요. ❤ 순위와 시상대는 그대로예요.",
          "Picks only count toward the Blind ranking. The ❤ ranking and podium stay as they are.",
        )}
      </p>

      <audio ref={audio} onTimeUpdate={onTime} onEnded={onEnded} preload="none" />
      {toast}
    </main>
  );
}
