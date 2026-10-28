"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePlaybackLevel } from "@/components/use-playback-level";
import { Tip } from "@/components/onboarding/tip";
import { VoiceAvatar } from "@/components/voice-avatar";
import { Countdown } from "@/components/weekly/countdown";
import { LikeButton } from "@/components/weekly/like-button";
import { useToast } from "@/components/weekly/toast";
import { buzz, shareLink, useWeeklyMe } from "@/components/weekly/use-weekly";
import { normalizeAvatar, PRESETS } from "@/lib/avatar";
import { DEMO_TAKES } from "@/lib/examples";
import { track } from "@/lib/track";
import { audioSrc, displayName, BATTLE_OPEN, LISTEN_RATIO, MIN_BATTLES, MIN_PODIUM, type Award, type EntryCard, type Week } from "@/lib/weekly";
import { ScreenTour } from "@/components/onboarding/tours";
import { TourHelp } from "@/components/onboarding/tour";
import { useLang, useT } from "@/components/lang";
import { fieldName } from "@/lib/script-i18n";
import styles from "./hub.module.css";

type Props = {
  week: Week;
  label: string;
  entries: EntryCard[];
  totalLikes: number;
  script: {
    text: string;
    direction: string;
    seconds: number;
    category: string;
  } | null;
  last: { week: Week; awards: Award[] } | null;
};

type Tab = "rank" | "fresh" | "blind";

const battled = (e: EntryCard) => !!e.battle && e.battle.wins + e.battle.losses >= MIN_BATTLES;

/**
 * 이번 주 챌린지 — 무대 · 내 자리 · 시상대 · 순위 · 지난주.
 *
 * 순위에 들고 싶게 만드는 장치는 셋이다:
 *  1) 째깍거리는 마감 — 이번 주가 지나면 이 판은 끝난다
 *  2) "시상대까지 ❤ N개" — 막연한 순위가 아니라 손에 잡히는 거리
 *  3) 시상대와 트로피 — 이기면 다음 주에도 이름 옆에 남는다
 * 그리고 ❤ 를 얻는 길(링크 공유)이 그 거리 바로 옆에 붙어 있다.
 */
export default function Hub({ week, label, entries: initial, totalLikes, script, last }: Props) {
  const t = useT();
  const lang = useLang();
  const me = useWeeklyMe(week.id);
  const [entries, setEntries] = useState(initial);
  const [tab, setTab] = useState<Tab>("rank");
  const [playing, setPlaying] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [now, setNow] = useState<number | null>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const [toast, showToast] = useToast();

  const current = entries.find((e) => e.id === playing) ?? null;
  const src = current ? audioSrc(current.id, current.createdAt) : null;
  const level = usePlaybackLevel(audio, src, playing !== null);

  useEffect(() => {
    // 서버가 그린 뒤 시간이 흘렀다 — 오픈 전/후는 붙은 뒤의 시각으로 판단한다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    track("weekly_view", { via: week.id });
  }, [week.id]);

  const open = now === null || now >= week.startsAt;
  const mine = entries.find((e) => e.id === me.mineId) ?? null;
  const podiumReady = entries.length >= MIN_PODIUM;
  const blindOpen = entries.length >= BATTLE_OPEN;

  const sorted = useMemo(() => {
    if (tab === "rank") return entries;
    if (tab === "blind") {
      // 블라인드 — 이름 없이 들은 사람들이 고른 순서. 판 수가 모자란 작품은 아래에 "심사 중"으로.
      return [...entries].sort(
        (a, b) =>
          Number(battled(b)) - Number(battled(a)) ||
          (b.battle?.rating ?? 0) - (a.battle?.rating ?? 0) ||
          a.rank - b.rank,
      );
    }
    // 새 목소리 — 덜 들린 것부터. 늦게 들어온 사람도 들려질 기회가 있어야 판이 돈다.
    return [...entries].sort((a, b) => a.plays - b.plays || b.createdAt.localeCompare(a.createdAt));
  }, [entries, tab]);

  const play = (id: string) => {
    const el = audio.current;
    if (!el) return;
    if (playing === id) {
      el.pause();
      setPlaying(null);
      return;
    }
    const e = entries.find((x) => x.id === id);
    if (!e) return;
    setProgress(0);
    setPlaying(id);
    el.src = audioSrc(e.id, e.createdAt);
    void el.play().catch(() => {
      setPlaying(null);
      showToast(t("재생이 안 됐어요. 한 번 더 눌러 주세요", "Couldn't play. Tap once more"));
    });
    track("weekly_play", { via: id });
  };

  const onTime = () => {
    const el = audio.current;
    if (!el || !playing) return;
    const d = el.duration && Number.isFinite(el.duration) ? el.duration : (current?.duration ?? 0);
    const p = d > 0 ? el.currentTime / d : 0;
    setProgress(p);
    if (p >= LISTEN_RATIO && !me.heard.has(playing)) unlock(playing);
  };

  const unlock = (id: string) => {
    me.hear(id);
    void fetch(`/api/weekly/entries/${id}/play`, { method: "POST" }).catch(() => {});
  };

  const like = async (id: string) => {
    if (id === me.mineId) return;
    buzz();
    const before = entries.find((e) => e.id === id)?.likes ?? 0;
    const on = !me.liked.has(id);
    setEntries((list) => list.map((e) => (e.id === id ? { ...e, likes: Math.max(0, before + (on ? 1 : -1)) } : e)));
    try {
      const r = await me.toggleLike(id);
      setEntries((list) => list.map((e) => (e.id === id ? { ...e, likes: r.likes } : e)));
      if (r.liked) track("weekly_like", { via: id });
    } catch (err) {
      setEntries((list) => list.map((e) => (e.id === id ? { ...e, likes: before } : e)));
      showToast(err instanceof Error ? err.message : t("❤ 가 안 눌렸어요. 다시 시도해 주세요", "Couldn't send ❤. Try again"));
    }
  };

  const share = async () => {
    if (!mine) return;
    const r = await shareLink(
      `${location.origin}/weekly/e/${mine.id}`,
      t(
        `MIMIC 보이스 챌린지 「${week.title}」 출전함 🎙️ 들어보고 ❤ 하나만 눌러줘 🙏`,
        `I entered the MIMIC voice challenge "${week.titleEn}" 🎙️ Give it a listen and tap ❤ 🙏`,
      ),
    );
    if (r === "copied") showToast(t("링크 복사 완료! 단톡방에 붙여 넣어 보세요", "Link copied! Paste it in your group chat"));
    if (r !== "failed") track("weekly_share", { via: mine.id });
  };

  return (
    <main className={`shell ${styles.page}`}>
      <audio
        ref={audio}
        preload="none"
        onTimeUpdate={onTime}
        onEnded={() => {
          if (playing && !me.heard.has(playing)) unlock(playing);
          setPlaying(null);
          setProgress(1);
        }}
      />

      <header className={styles.top}>
        <span className={styles.brand}>
          <span className={styles.liveDot} aria-hidden="true" />
          WEEKLY VOICE
        </span>
        <span className={styles.topRight}>
          <Link href="/weekly/hall" className={styles.hallLink} data-tour="weekly-hall">
            {t("🏆 명예의 전당", "🏆 Hall of Fame")}
          </Link>
          <TourHelp id="weekly" short />
        </span>
      </header>

      {/* 무대 — 이번 주 대본과 마감 */}
      <section className={styles.hero} data-tour="weekly-hero">
        <div className={styles.heroGlow} aria-hidden="true" />
        <p className={styles.heroKicker}>
          <span className={styles.seasonChip}>{label}</span>
          <span>{week.emoji} {t("이번 주 대본", "This week's script")}</span>
        </p>
        <h1 className={styles.heroTitle}>{t(week.title, week.titleEn)}</h1>
        {script && (
          <blockquote className={styles.heroScript}>
            {firstParagraph(script.text)}
            <small>
              {t(`약 ${script.seconds}초`, `~${script.seconds}s`)} · {fieldName(script.category, lang)}
            </small>
          </blockquote>
        )}

        <p className={styles.heroWhen}>{open ? t("마감까지", "Closes in") : t("시즌 오픈까지", "Season opens in")}</p>
        <Countdown to={open ? week.endsAt : week.startsAt} />

        <dl className={styles.heroStats}>
          <div>
            <dt>{t("출전", "Entries")}</dt>
            <dd>{t(`${entries.length}명`, String(entries.length))}</dd>
          </div>
          <div>
            <dt>{t("총 ❤", "Total ❤")}</dt>
            <dd>{totalLikes.toLocaleString(t("ko-KR", "en-US"))}</dd>
          </div>
          <div>
            <dt>{t("1위", "#1")}</dt>
            <dd>{entries[0] ? `❤ ${entries[0].likes}` : t("주인 없음", "Open")}</dd>
          </div>
        </dl>

        {mine ? (
          <Link href={`/practice/${week.scriptId}?from=weekly`} className={styles.heroGhost}>
            {t("다시 녹음해서 교체하기", "Re-record & replace")}
          </Link>
        ) : (
          <Link href={`/practice/${week.scriptId}?from=weekly`} className={styles.heroGo} data-tour="weekly-go">
            {open ? t("연습하고 출전하기", "Practice & enter") : t("미리 연습해 두기", "Practice ahead")}
            <i aria-hidden="true">→</i>
          </Link>
        )}
        {!mine && (
          <p className={styles.heroNote}>
            {t(
              "가입 없이 바로 · 연습 녹음은 🔒 내 폰에만, 고른 테이크 하나만 🌐 공개돼요",
              "No sign-up · practice takes stay 🔒 on your phone, only the one you pick goes 🌐 public",
            )}
          </p>
        )}
      </section>

      {/* 내 자리 — 순위와 시상대까지의 거리, 그리고 ❤ 를 모으는 길 */}
      {mine && <MyStanding mine={mine} entries={entries} onShare={share} />}

      {/* 시상대 또는 모집 중 */}
      {entries.length > 0 &&
        (podiumReady ? (
          <Podium entries={entries.slice(0, 3)} playing={playing} level={level} onPlay={play} mineId={me.mineId} />
        ) : (
          <Recruit count={entries.length} />
        ))}

      {/* 출전작 */}
      <section className={styles.board} aria-label={t("출전작", "Entries")} data-tour="weekly-board">
        <div className={styles.boardHead}>
          <h2 className={styles.boardTitle}>
            {t("출전작", "Entries")} <span>{entries.length}</span>
          </h2>
          <div className={styles.tabs} role="tablist" data-tour="weekly-tabs">
            <button type="button" role="tab" aria-selected={tab === "rank"} onClick={() => setTab("rank")}>
              {t("순위", "Top")}
            </button>
            <button type="button" role="tab" aria-selected={tab === "fresh"} onClick={() => setTab("fresh")}>
              {t("새 목소리", "New voices")}
            </button>
            {blindOpen && (
              <button type="button" role="tab" aria-selected={tab === "blind"} onClick={() => setTab("blind")}>
                {t("블라인드", "Blind")}
              </button>
            )}
          </div>
        </div>

        {entries.length === 0 ? (
          <DemoBoard scriptId={week.scriptId} />
        ) : (
          <>
            {blindOpen && (
              <Link href="/weekly/battle" className={styles.battleCta} onClick={() => track("battle_cta", { via: tab })}>
                <span aria-hidden="true">🎧</span>
                <span>
                  <b>{t("블라인드 심사하기", "Judge blind battles")}</b>
                  <small>
                    {t(
                      "이름·캐릭터 없이 둘 중 더 좋은 목소리만 골라 주세요",
                      "No names, no avatars — just pick the better voice",
                    )}
                  </small>
                </span>
                <i aria-hidden="true">→</i>
              </Link>
            )}
            <Tip id="tip_like">
              {t(
                "▶ 로 들어 보고 마음에 든 목소리에 ❤ 를 눌러 주세요. 순위는 이 ❤ 로 정해져요",
                "Tap ▶ to listen and ❤ the voices you love — ❤ decides the ranking",
              )}
            </Tip>
            <ol className={styles.rows}>
              {sorted.map((e, i) => (
                <Row
                  key={e.id}
                  e={e}
                  place={tab === "blind" ? (battled(e) ? i + 1 : null) : e.rank}
                  blind={tab === "blind"}
                  cutAfter={tab === "rank" && podiumReady && i === 2 && entries.length > 3}
                  now={now}
                  isMine={e.id === me.mineId}
                  playing={playing === e.id}
                  progress={playing === e.id ? progress : null}
                  level={playing === e.id ? level : 0}
                  liked={me.liked.has(e.id)}
                  onPlay={() => play(e.id)}
                  onLike={() => void like(e.id)}
                />
              ))}
            </ol>
          </>
        )}
      </section>

      {last && last.awards.length > 0 && <LastWeek last={last} />}

      <details className={styles.rules}>
        <summary>{t("챌린지 규칙", "Rules")}</summary>
        {t(
          <ul>
            <li>매주 월요일 0시에 새 대본이 열리고 일요일 밤 12시에 마감돼요.</li>
            <li>한 사람(한 기기)당 한 작품이에요. 다시 녹음해 교체할 수 있지만, 교체하면 ❤ 가 0 으로 돌아가요.</li>
            <li>❤ 는 한 사람이 한 출전작에 한 번만 누를 수 있어요. 내 작품엔 못 눌러요.</li>
            <li>마감 때 ❤ 순으로 1~3위가 시상대에 올라 명예의 전당과 프로필에 트로피가 남아요.</li>
            <li>가입 없이 출전해도 돼요. 트로피를 계정에 남기려면 마감 전에 로그인해 주세요.</li>
            <li>출전하면 친구에게 1:1 대결을 신청할 수 있어요. 대결 결과는 ❤ 순위와 따로예요.</li>
            {blindOpen && <li>블라인드 순위도 따로예요. 이름 없이 두 녹음을 듣고 고른 결과로만 정해지고, {MIN_BATTLES}판 이상 치러야 올라가요.</li>}
          </ul>,
          <ul>
            <li>A new script opens Monday 00:00 and closes Sunday midnight (KST).</li>
            <li>One entry per person (device). You can replace it, but its ❤ reset to 0.</li>
            <li>One ❤ per person per entry. You can&apos;t ❤ your own.</li>
            <li>At close, the top 3 by ❤ take the podium and get trophies in the Hall of Fame and on their profiles.</li>
            <li>No sign-up needed to enter. Log in before the deadline to keep your trophy.</li>
            <li>Once you enter, you can challenge a friend to a 1:1 duel. Duel results don&apos;t affect the ❤ ranking.</li>
            {blindOpen && <li>The Blind ranking is separate too: it comes only from listeners picking between two nameless recordings. {MIN_BATTLES}+ battles to get ranked.</li>}
          </ul>,
        )}
      </details>

      <Link href="/challenges" className={styles.memeLink}>
        <span>
          <b>{t("가볍게 놀고 싶다면? 명대사 따라 하기", "Just want to play? Copy famous lines")}</b>
          <small>{t("무야호 · 어이가 없네 · 동물 소리", "Muyaho · Parasite · animal sounds")}</small>
        </span>
        <i aria-hidden="true">→</i>
      </Link>

      {toast}
      <ScreenTour id="weekly" />
    </main>
  );
}

function firstParagraph(text: string): string {
  return (
    text
      .replace(/\*/g, "")
      .split(/\n\s*\n/)[0]
      ?.replace(/\s*\/\s*/g, " / ")
      .trim() ?? ""
  );
}

function clock(s: number): string {
  const t = Math.max(0, Math.round(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

function MyStanding({ mine, entries, onShare }: { mine: EntryCard; entries: EntryCard[]; onShare: () => void }) {
  const t = useT();
  const third = entries[2];
  const above = entries[mine.rank - 2];
  const below = entries[mine.rank];
  let line: React.ReactNode;
  if (mine.rank === 1) {
    const lead = below ? mine.likes - below.likes : null;
    line =
      lead === null ? (
        t(<>지금 1위예요! 마감까지 자리를 지켜요 👑</>, <>You&apos;re #1! Hold it till the deadline 👑</>)
      ) : (
        t(
          <>
            지금 1위! 2위와 <b>❤ {lead}개</b> 차이예요
          </>,
          <>
            You&apos;re #1 — <b>❤ {lead}</b> ahead of #2
          </>,
        )
      );
  } else if (mine.rank <= 3) {
    line = (
      t(
        <>
          시상대 위예요! {mine.rank - 1}위까지 <b>❤ {Math.max(1, above.likes - mine.likes + 1)}개</b>
        </>,
        <>
          On the podium! <b>❤ {Math.max(1, above.likes - mine.likes + 1)}</b> more to reach #{mine.rank - 1}
        </>,
      )
    );
  } else {
    line = (
      t(
        <>
          시상대까지 <b>❤ {Math.max(1, (third?.likes ?? 0) - mine.likes + 1)}개</b> 남았어요
        </>,
        <>
          <b>❤ {Math.max(1, (third?.likes ?? 0) - mine.likes + 1)}</b> more to hit the podium
        </>,
      )
    );
  }
  return (
    <section className={styles.mine} aria-label={t("내 순위", "My rank")}>
      <div className={styles.mineRank}>
        <small>{t("내 순위", "My rank")}</small>
        <b>{mine.rank}</b>
        <span>/ {entries.length}</span>
      </div>
      <div className={styles.mineBody}>
        <p className={styles.mineLine}>{line}</p>
        <p className={styles.mineSub}>
          ❤ {mine.likes} · {t(`${mine.plays}명이 끝까지 들었어요`, `${mine.plays} full listens`)}
        </p>
        <div className={styles.mineActions}>
          <button type="button" className={styles.mineShare} onClick={onShare}>
            {t("❤ 모으러 공유하기", "Share to get ❤")}
          </button>
          <Link href={`/weekly/e/${mine.id}`} className={styles.mineView}>
            {t("내 출전작", "My entry")}
          </Link>
          <Link href={`/weekly/vs/${mine.id}`} className={styles.mineDuel}>
            {t("⚔️ 친구에게 1:1 대결 신청", "⚔️ Challenge a friend 1:1")}
          </Link>
        </div>
      </div>
    </section>
  );
}

const MEDAL = ["🥇", "🥈", "🥉"];

function Podium({
  entries,
  playing,
  level,
  onPlay,
  mineId,
}: {
  entries: EntryCard[];
  playing: string | null;
  level: number;
  onPlay: (id: string) => void;
  mineId: string | null;
}) {
  const t = useT();
  const lang = useLang();
  // 2위 · 1위 · 3위 순서로 세운다 — 가운데가 제일 높다.
  const order = [entries[1], entries[0], entries[2]].filter(Boolean);
  return (
    <section className={styles.podium} aria-label={t("시상대", "Podium")}>
      {order.map((e) => {
        const place = e.rank;
        return (
          <button
            key={e.id}
            type="button"
            className={`${styles.step} ${styles[`step${place}`]} ${playing === e.id ? styles.stepOn : ""}`}
            onClick={() => onPlay(e.id)}
            aria-label={t(`${place}위 ${displayName(e.name, lang)} 듣기`, `Play #${place} ${displayName(e.name, lang)}`)}
          >
            {place === 1 && (
              <span className={styles.crown} aria-hidden="true">
                👑
              </span>
            )}
            <span className={styles.stepAvatar}>
              <VoiceAvatar
                avatar={normalizeAvatar(e.avatar)}
                level={playing === e.id ? level : 0}
                size={place === 1 ? 92 : 70}
              />
            </span>
            <span className={styles.stepName}>
              {displayName(e.name, lang)}
              {e.id === mineId && <em>{t("나", "Me")}</em>}
            </span>
            <span className={styles.stepLikes}>❤ {e.likes}</span>
            <span className={styles.stepBlock}>
              <span>{MEDAL[place - 1]}</span>
              <b>{place}</b>
            </span>
          </button>
        );
      })}
    </section>
  );
}

function Recruit({ count }: { count: number }) {
  const t = useT();
  const left = Math.max(0, MIN_PODIUM - count);
  return (
    <section className={styles.recruit}>
      <p className={styles.recruitTitle}>
        {t(<>시상대 오픈까지 <b>{left}명</b> 남았어요</>, <><b>{left}</b> more to open the podium</>)}
      </p>
      <div className={styles.pips} aria-hidden="true">
        {Array.from({ length: MIN_PODIUM }, (_, i) => (
          <i key={i} className={i < count ? styles.pipOn : undefined} />
        ))}
      </div>
      <p className={styles.recruitSub}>
        {t(
          <>
            지금 출전하면 최소 <b>{count + 1}위</b>로 시작해요. 판이 작을 때가 시상대 오르기 제일 쉬워요 😉
          </>,
          <>
            Enter now and you start at <b>#{count + 1}</b> or better. Small field = easiest podium 😉
          </>,
        )}
      </p>
    </section>
  );
}

function Row({
  e,
  place,
  blind,
  cutAfter,
  now,
  isMine,
  playing,
  progress,
  level,
  liked,
  onPlay,
  onLike,
}: {
  e: EntryCard;
  place: number | null;
  blind: boolean;
  cutAfter: boolean;
  now: number | null;
  isMine: boolean;
  playing: boolean;
  progress: number | null;
  level: number;
  liked: boolean;
  onPlay: () => void;
  onLike: () => void;
}) {
  const t = useT();
  const lang = useLang();
  const fresh = now !== null && now - Date.parse(e.createdAt) < 12 * 3_600_000;
  const bars = e.bars.length ? e.bars : Array.from({ length: 32 }, () => 0.3);
  return (
    <>
      <li className={`${styles.row} ${isMine ? styles.rowMine : ""} ${playing ? styles.rowOn : ""}`}>
        <span className={`${styles.rank} ${place !== null && place <= 3 ? styles[`rank${place}`] : ""}`}>
          {place === null ? "–" : String(place).padStart(2, "0")}
        </span>
        <button
          type="button"
          className={styles.rowMain}
          onClick={onPlay}
          aria-label={`${displayName(e.name, lang)} ${playing ? t("멈추기", "pause") : t("듣기", "play")}`}
        >
          <span className={styles.rowAvatar}>
            <VoiceAvatar avatar={normalizeAvatar(e.avatar)} level={level} size={46} />
            <span className={styles.rowPlay} aria-hidden="true">
              {playing ? "❚❚" : "▶"}
            </span>
          </span>
          <span className={styles.rowText}>
            <span className={styles.rowName}>
              {displayName(e.name, lang)}
              {isMine && <em className={styles.tagMine}>{t("나", "Me")}</em>}
              {e.trophies > 0 && <em className={styles.tagTrophy}>🏆{e.trophies}</em>}
              {fresh && !isMine && <em className={styles.tagNew}>NEW</em>}
            </span>
            <span className={styles.wave} aria-hidden="true">
              {bars.map((b, i) => (
                <i
                  key={i}
                  style={{ height: `${Math.max(12, b * 100)}%` }}
                  className={progress !== null && i / bars.length < progress ? styles.waveOn : undefined}
                />
              ))}
            </span>
            <span className={styles.rowMeta}>
              {clock(e.duration)} ·{" "}
              {blind
                ? e.battle && e.battle.wins + e.battle.losses > 0
                  ? t(`${e.battle.wins}승 ${e.battle.losses}패`, `${e.battle.wins}W ${e.battle.losses}L`)
                  : t("심사 중", "Not judged yet")
                : t(`${e.plays}번 재생`, `${e.plays} plays`)}
            </span>
          </span>
        </button>
        <LikeButton
          likes={e.likes}
          liked={liked}
          locked={false}
          progress={progress}
          mine={isMine}
          onPress={onLike}
        />
      </li>
      {cutAfter && (
        <li className={styles.cut} aria-hidden="true">
          <span>{t(`▲ 시상대 · 3위 ❤ ${e.likes}`, `▲ Podium · #3 ❤ ${e.likes}`)}</span>
        </li>
      )}
    </>
  );
}

function LastWeek({ last }: { last: { week: Week; awards: Award[] } }) {
  const t = useT();
  return (
    <section className={styles.last}>
      <div className={styles.lastHead}>
        <p className="eyebrow">{t(`지난주 시상대 · S${last.week.season}`, `Last week's podium · S${last.week.season}`)}</p>
        <Link href="/weekly/hall">{t("전체 보기 →", "See all →")}</Link>
      </div>
      <p className={styles.lastTitle}>
        {last.week.emoji} {t(last.week.title, last.week.titleEn ?? last.week.title)}
      </p>
      <ol className={styles.lastList}>
        {last.awards.map((a) => (
          <li key={a.place}>
            {a.entryId ? (
              <Link href={`/weekly/e/${a.entryId}`} className={styles.lastItem}>
                <LastInner a={a} />
              </Link>
            ) : (
              <span className={styles.lastItem}>
                <LastInner a={a} />
              </span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

function LastInner({ a }: { a: Award }) {
  const lang = useLang();
  return (
    <>
      <span className={styles.lastMedal}>{MEDAL[a.place - 1]}</span>
      <VoiceAvatar avatar={normalizeAvatar(a.avatar)} size={40} />
      <span className={styles.lastName}>{displayName(a.name, lang)}</span>
      <span className={styles.lastLikes}>❤ {a.likes}</span>
    </>
  );
}

/**
 * 출전작이 하나도 없을 때 보여주는 예시 순위표 — "올리면 어디에, 어떻게 보이고, ❤ 는 어떻게 누르나".
 *
 * 빈 판에 "첫 번째가 되어 보세요"만 적어 두면 무엇이 생기는지 상상이 안 된다. 진짜 줄과
 * 똑같이 생긴 줄을 깔고 직접 눌러 보게 한다. 소리는 AI 가 네 목소리로 읽은 이번 주 대본 —
 * 줄마다 소리가 달라야 "사람마다 다르게 읽어 올리는 판"으로 들린다(tools/make_examples.py).
 * 누른 ❤ 는 이 화면 안에서만 움직이고 어디에도 저장되지 않는다.
 */
// take 는 DEMO_TAKES 의 몇 번째 소리인지 — 생성기의 TAKES 순서와 맞춘다.
const DEMO = [
  { id: "demo-1", name: ["새벽라디오", "LateNightRadio"], likes: 24, plays: 61, preset: 1, take: 0 },
  { id: "demo-2", name: ["뉴스하는곰", "NewsBear"], likes: 17, plays: 44, preset: 2, take: 1 },
  { id: "demo-3", name: ["목소리장인", "VoiceMaster"], likes: 9, plays: 23, preset: 6, take: 2 },
  { id: "demo-me", name: ["나 (출전하면 여기)", "You (after entry)"], likes: 2, plays: 5, preset: 0, take: 3 },
];

function DemoBoard({ scriptId }: { scriptId: string }) {
  const t = useT();
  const takes = DEMO_TAKES[scriptId] ?? [];
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [toast, showToast] = useToast();

  const rows: EntryCard[] = DEMO.map((d) => ({
    id: d.id,
    rank: 0,
    name: t(d.name[0], d.name[1]),
    guest: true,
    avatar: PRESETS[d.preset].avatar,
    duration: takes[d.take]?.duration ?? 15,
    bars: takes[d.take]?.bars ?? [],
    likes: d.likes + (liked.has(d.id) ? 1 : 0),
    plays: d.plays,
    trophies: 0,
    createdAt: "2026-01-01T00:00:00Z",
    battle: null,
  }))
    .sort((a, b) => b.likes - a.likes)
    .map((e, i) => ({ ...e, rank: i + 1 }));

  const play = (id: string) => {
    const el = audio.current;
    const src = takes[DEMO.find((d) => d.id === id)?.take ?? -1]?.src;
    if (!el || !src) return;
    if (playing === id) {
      el.pause();
      setPlaying(null);
      return;
    }
    setPlaying(id);
    setProgress(0);
    el.src = src;
    void el.play().catch(() => setPlaying(null));
  };

  const like = (id: string) => {
    buzz();
    const on = !liked.has(id);
    setLiked((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
    showToast(
      on
        ? t("이렇게 ❤ 가 올라가요! 예시라 실제 순위엔 안 남아요", "That's how ❤ works! It's a demo, so nothing is saved")
        : t("한 번 더 누르면 ❤ 가 취소돼요", "Tap again to undo ❤"),
    );
  };

  return (
    <div className={styles.demo}>
      <audio
        ref={audio}
        preload="none"
        onTimeUpdate={(e) => {
          const d = e.currentTarget.duration;
          setProgress(Number.isFinite(d) && d > 0 ? e.currentTarget.currentTime / d : 0);
        }}
        onEnded={() => {
          setPlaying(null);
          setProgress(1);
        }}
      />
      <div className={styles.demoHead}>
        <span className={styles.demoBadge}>{t("예시 화면", "Demo")}</span>
        <p>
          {t(
            <>아직 출전작이 없어서 <b>예시</b>로 보여드려요. 직접 눌러 보세요. 실제 순위엔 안 들어가요.</>,
            <>No entries yet, so here&apos;s a <b>demo</b>. Go ahead and tap — nothing counts.</>,
          )}
        </p>
      </div>
      <ol className={styles.howto}>
        <li>
          <b>1</b>{t("캐릭터 ▶ 를 누르면 들어요", "Tap ▶ on a character to listen")}
        </li>
        <li>
          <b>2</b>{t("마음에 들면 ❤ 를 눌러요", "Love it? Tap ❤")}
        </li>
        <li>
          <b>3</b>{t("❤ 많은 순서가 순위예요", "Most ❤ ranks highest")}
        </li>
      </ol>
      <ol className={styles.rows}>
        {rows.map((e) => (
          <Row
            key={e.id}
            e={e}
            place={e.rank}
            blind={false}
            cutAfter={false}
            now={null}
            isMine={e.id === "demo-me"}
            playing={playing === e.id}
            progress={playing === e.id ? progress : null}
            level={0}
            liked={liked.has(e.id)}
            onPlay={() => play(e.id)}
            onLike={() => like(e.id)}
          />
        ))}
      </ol>
      <ul className={styles.demoNotes}>
        {t(
          <>
            <li>
              🌐 출전하면 내 녹음이 <b>‘나’ 표시 줄</b>로 여기 올라가요. 내 작품엔 ❤ 를 못 눌러요.
            </li>
            <li>🏆 일요일 밤 마감 때 1~3위가 시상대와 명예의 전당에 남아요.</li>
            <li>🤖 예시 소리는 AI 가 여러 목소리로 읽은 이번 주 대본이에요.</li>
          </>,
          <>
            <li>
              🌐 Once you enter, your take shows up here as the <b>‘Me’ row</b>. You can&apos;t ❤ your own.
            </li>
            <li>🏆 At Sunday&apos;s close, the top 3 land on the podium and in the Hall of Fame.</li>
            <li>🤖 Demo audio is this week&apos;s script read by AI voices.</li>
          </>,
        )}
      </ul>
      <Link href={`/practice/${scriptId}?from=weekly`} className={styles.demoGo}>
        {t("첫 번째 출전자 되기 →", "Be the first to enter →")}
      </Link>
      {toast}
    </div>
  );
}
