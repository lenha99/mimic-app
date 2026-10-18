"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePlaybackLevel } from "@/components/use-playback-level";
import { VoiceAvatar } from "@/components/voice-avatar";
import { Countdown } from "@/components/weekly/countdown";
import { LikeButton } from "@/components/weekly/like-button";
import { useToast } from "@/components/weekly/toast";
import { buzz, shareLink, useWeeklyMe } from "@/components/weekly/use-weekly";
import { normalizeAvatar } from "@/lib/avatar";
import { track } from "@/lib/track";
import {
  audioSrc,
  LISTEN_RATIO,
  MIN_PODIUM,
  type Award,
  type EntryCard,
  type Week,
} from "@/lib/weekly";
import styles from "./hub.module.css";

type Props = {
  week: Week;
  label: string;
  entries: EntryCard[];
  totalLikes: number;
  script: { text: string; direction: string; seconds: number; category: string } | null;
  last: { week: Week; awards: Award[] } | null;
};

type Tab = "rank" | "fresh";

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

  const sorted = useMemo(() => {
    if (tab === "rank") return entries;
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
      showToast("재생하지 못했어요. 한 번 더 눌러 주세요.");
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
    if (id !== me.mineId && !me.liked.has(id)) showToast("다 들었어요 — 이제 ❤ 를 누를 수 있어요");
  };

  const like = async (id: string) => {
    if (id === me.mineId) return;
    if (!me.heard.has(id)) {
      if (playing !== id) play(id);
      showToast("끝까지 들으면 ❤ 를 누를 수 있어요");
      return;
    }
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
      showToast(err instanceof Error ? err.message : "❤ 를 남기지 못했어요.");
    }
  };

  const share = async () => {
    if (!mine) return;
    const r = await shareLink(
      `${location.origin}/weekly/e/${mine.id}`,
      `MIMIC 보이스 챌린지 「${week.title}」 출전했어! 들어보고 ❤ 한 번만 눌러줘 🙏`,
    );
    if (r === "copied") showToast("링크를 복사했어요. 단톡방에 붙여 넣어 보세요!");
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
        <Link href="/weekly/hall" className={styles.hallLink}>
          🏆 명예의 전당
        </Link>
      </header>

      {/* 무대 — 이번 주 대본과 마감 */}
      <section className={styles.hero}>
        <div className={styles.heroGlow} aria-hidden="true" />
        <p className={styles.heroKicker}>
          <span className={styles.seasonChip}>{label}</span>
          <span>{week.emoji} 이번 주 대본</span>
        </p>
        <h1 className={styles.heroTitle}>{week.title}</h1>
        {script && (
          <blockquote className={styles.heroScript}>
            {firstParagraph(script.text)}
            <small>
              약 {script.seconds}초 · {script.category}
            </small>
          </blockquote>
        )}

        <p className={styles.heroWhen}>{open ? "마감까지" : "시즌 오픈까지"}</p>
        <Countdown to={open ? week.endsAt : week.startsAt} />

        <dl className={styles.heroStats}>
          <div>
            <dt>출전</dt>
            <dd>{entries.length}명</dd>
          </div>
          <div>
            <dt>총 ❤</dt>
            <dd>{totalLikes.toLocaleString("ko-KR")}</dd>
          </div>
          <div>
            <dt>1위</dt>
            <dd>{entries[0] ? `❤ ${entries[0].likes}` : "비어 있음"}</dd>
          </div>
        </dl>

        {mine ? (
          <Link href={`/practice/${week.scriptId}?from=weekly`} className={styles.heroGhost}>
            다시 녹음해서 교체하기
          </Link>
        ) : (
          <Link href={`/practice/${week.scriptId}?from=weekly`} className={styles.heroGo}>
            {open ? "연습하고 출전하기" : "미리 연습해 두기"}
            <i aria-hidden="true">→</i>
          </Link>
        )}
        {!mine && <p className={styles.heroNote}>로그인 없이 바로 · 마음에 든 테이크 하나만 올라가요</p>}
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
      <section className={styles.board} aria-label="출전작">
        <div className={styles.boardHead}>
          <h2 className={styles.boardTitle}>
            출전작 <span>{entries.length}</span>
          </h2>
          <div className={styles.tabs} role="tablist">
            <button type="button" role="tab" aria-selected={tab === "rank"} onClick={() => setTab("rank")}>
              순위
            </button>
            <button type="button" role="tab" aria-selected={tab === "fresh"} onClick={() => setTab("fresh")}>
              새 목소리
            </button>
          </div>
        </div>

        {entries.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyBig}>1등 자리가 비어 있어요</p>
            <p>
              지금 출전하면 <b>첫 번째 목소리</b>예요. 끝까지 들은 사람만 ❤ 를 누를 수 있어서, 먼저 올리면 그만큼 많이
              들려요.
            </p>
          </div>
        ) : (
          <ol className={styles.rows}>
            {sorted.map((e, i) => (
              <Row
                key={e.id}
                e={e}
                cutAfter={tab === "rank" && podiumReady && i === 2 && entries.length > 3}
                now={now}
                isMine={e.id === me.mineId}
                playing={playing === e.id}
                progress={playing === e.id ? progress : null}
                level={playing === e.id ? level : 0}
                liked={me.liked.has(e.id)}
                heard={me.heard.has(e.id)}
                onPlay={() => play(e.id)}
                onLike={() => void like(e.id)}
              />
            ))}
          </ol>
        )}
      </section>

      {last && last.awards.length > 0 && <LastWeek last={last} />}

      <details className={styles.rules}>
        <summary>챌린지 규칙</summary>
        <ul>
          <li>매주 월요일 0시에 새 대본이 열리고 일요일 밤 12시에 마감돼요.</li>
          <li>한 사람(한 기기) 한 작품. 다시 녹음해서 교체할 수 있지만 교체하면 ❤ 가 0 으로 돌아가요.</li>
          <li>❤ 는 끝까지 들어야 누를 수 있고, 한 사람이 한 출전작에 한 번이에요. 내 작품엔 못 눌러요.</li>
          <li>마감 때 ❤ 순으로 1~3위가 시상대에 올라 명예의 전당과 프로필에 트로피가 남아요.</li>
          <li>로그인 없이 출전해도 돼요. 트로피를 계정에 남기려면 마감 전에 로그인하세요.</li>
        </ul>
      </details>

      <Link href="/challenges" className={styles.memeLink}>
        <span>
          <b>가볍게 놀고 싶다면 — 밈 따라하기</b>
          <small>무야호 · 어이가 없네 · 동물 소리</small>
        </span>
        <i aria-hidden="true">→</i>
      </Link>

      {toast}
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
  const third = entries[2];
  const above = entries[mine.rank - 2];
  const below = entries[mine.rank];
  let line: React.ReactNode;
  if (mine.rank === 1) {
    const lead = below ? mine.likes - below.likes : null;
    line =
      lead === null ? (
        <>지금 1위예요! 마감까지 자리를 지켜요</>
      ) : (
        <>
          지금 1위! 2위와 <b>❤ {lead}개</b> 차이
        </>
      );
  } else if (mine.rank <= 3) {
    line = (
      <>
        시상대 위예요 · {mine.rank - 1}위까지 <b>❤ {Math.max(1, above.likes - mine.likes + 1)}개</b>
      </>
    );
  } else {
    line = (
      <>
        시상대까지 <b>❤ {Math.max(1, (third?.likes ?? 0) - mine.likes + 1)}개</b>
      </>
    );
  }
  return (
    <section className={styles.mine} aria-label="내 순위">
      <div className={styles.mineRank}>
        <small>내 순위</small>
        <b>{mine.rank}</b>
        <span>/ {entries.length}</span>
      </div>
      <div className={styles.mineBody}>
        <p className={styles.mineLine}>{line}</p>
        <p className={styles.mineSub}>❤ {mine.likes} · {mine.plays}번 끝까지 들음</p>
        <div className={styles.mineActions}>
          <button type="button" className={styles.mineShare} onClick={onShare}>
            친구한테 ❤ 부탁하기
          </button>
          <Link href={`/weekly/e/${mine.id}`} className={styles.mineView}>
            내 출전작
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
  // 2위 · 1위 · 3위 순서로 세운다 — 가운데가 제일 높다.
  const order = [entries[1], entries[0], entries[2]].filter(Boolean);
  return (
    <section className={styles.podium} aria-label="시상대">
      {order.map((e) => {
        const place = e.rank;
        return (
          <button
            key={e.id}
            type="button"
            className={`${styles.step} ${styles[`step${place}`]} ${playing === e.id ? styles.stepOn : ""}`}
            onClick={() => onPlay(e.id)}
            aria-label={`${place}위 ${e.name} 듣기`}
          >
            {place === 1 && (
              <span className={styles.crown} aria-hidden="true">
                👑
              </span>
            )}
            <span className={styles.stepAvatar}>
              <VoiceAvatar avatar={normalizeAvatar(e.avatar)} level={playing === e.id ? level : 0} size={place === 1 ? 92 : 70} />
            </span>
            <span className={styles.stepName}>
              {e.name}
              {e.id === mineId && <em>나</em>}
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
  const left = Math.max(0, MIN_PODIUM - count);
  return (
    <section className={styles.recruit}>
      <p className={styles.recruitTitle}>
        시상대 오픈까지 <b>{left}명</b>
      </p>
      <div className={styles.pips} aria-hidden="true">
        {Array.from({ length: MIN_PODIUM }, (_, i) => (
          <i key={i} className={i < count ? styles.pipOn : undefined} />
        ))}
      </div>
      <p className={styles.recruitSub}>
        지금 출전하면 최소 <b>{count + 1}위</b>에서 시작해요. 아직 판이 작을 때가 시상대에 오르기 제일 쉬워요.
      </p>
    </section>
  );
}

function Row({
  e,
  cutAfter,
  now,
  isMine,
  playing,
  progress,
  level,
  liked,
  heard,
  onPlay,
  onLike,
}: {
  e: EntryCard;
  cutAfter: boolean;
  now: number | null;
  isMine: boolean;
  playing: boolean;
  progress: number | null;
  level: number;
  liked: boolean;
  heard: boolean;
  onPlay: () => void;
  onLike: () => void;
}) {
  const fresh = now !== null && now - Date.parse(e.createdAt) < 12 * 3_600_000;
  const bars = e.bars.length ? e.bars : Array.from({ length: 32 }, () => 0.3);
  return (
    <>
      <li className={`${styles.row} ${isMine ? styles.rowMine : ""} ${playing ? styles.rowOn : ""}`}>
        <span className={`${styles.rank} ${e.rank <= 3 ? styles[`rank${e.rank}`] : ""}`}>
          {String(e.rank).padStart(2, "0")}
        </span>
        <button type="button" className={styles.rowMain} onClick={onPlay} aria-label={`${e.name} ${playing ? "멈추기" : "듣기"}`}>
          <span className={styles.rowAvatar}>
            <VoiceAvatar avatar={normalizeAvatar(e.avatar)} level={level} size={46} />
            <span className={styles.rowPlay} aria-hidden="true">
              {playing ? "❚❚" : "▶"}
            </span>
          </span>
          <span className={styles.rowText}>
            <span className={styles.rowName}>
              {e.name}
              {isMine && <em className={styles.tagMine}>나</em>}
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
              {clock(e.duration)} · {e.plays}번 들음
            </span>
          </span>
        </button>
        <LikeButton
          likes={e.likes}
          liked={liked}
          locked={!heard && !isMine}
          progress={progress}
          mine={isMine}
          onPress={onLike}
        />
      </li>
      {cutAfter && (
        <li className={styles.cut} aria-hidden="true">
          <span>▲ 시상대 · 3위 ❤ {e.likes}</span>
        </li>
      )}
    </>
  );
}

function LastWeek({ last }: { last: { week: Week; awards: Award[] } }) {
  return (
    <section className={styles.last}>
      <div className={styles.lastHead}>
        <p className="eyebrow">지난주 시상대 · S{last.week.season}</p>
        <Link href="/weekly/hall">전체 보기 →</Link>
      </div>
      <p className={styles.lastTitle}>
        {last.week.emoji} {last.week.title}
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
  return (
    <>
      <span className={styles.lastMedal}>{MEDAL[a.place - 1]}</span>
      <VoiceAvatar avatar={normalizeAvatar(a.avatar)} size={40} />
      <span className={styles.lastName}>{a.name}</span>
      <span className={styles.lastLikes}>❤ {a.likes}</span>
    </>
  );
}
