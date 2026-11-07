"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useT } from "@/components/lang";
import { Judging, LineCard, MicError, OriginalPlayer, Replay, ScoreFail, ScoreView, ShoutButton } from "@/components/anime/parts";
import { useTake } from "@/components/anime/use-take";
import { prefetchOriginals, scoreWithOriginal, useOriginal, useWarmScorer } from "@/components/anime/original";
import { animeLine, animeRefId, ANIME_LINES, silentScore, type AnimeLine, type HypeScore } from "@/lib/anime";
import { track } from "@/lib/track";
import s from "@/components/anime/anime.module.css";

/**
 * 오프라인 명대사 대결 — 폰 하나를 돌려 가며 외친다. 로그인 없음.
 * 대사 묶음은 영화·드라마 / 애니 / 섞어서 중에 고른다. 예전엔 "명대사 대결"이라 해 놓고 애니만
 * 나왔다(11/7) — 챌린지 "명대사" 탭에서 들어온 사람은 영화 대사를 기대한다.
 * 점수는 늘 원본과 얼마나 닮았나 하나다(서버 — 애니는 anime 기준, 영화는 /record 와 같은 밈 기준).
 * 원본을 듣는 건 선택이다. 판이 시작될 때(첫 선수 차례) 원본을 한 번 자동으로 틀어 다 같이 듣는다 —
 * 끄면 각자 알아서. 서버가 실패하면 점수를 지어내지 않고 그 차례만 다시 외친다.
 * 친구들이 모인 자리에서 링크 하나면 된다. 이름·원본 먼저 설정은 이 폰에만 기억한다.
 */
const NAMES = "mimic.duel.names";
const LISTEN = "mimic.duel.listenFirst";
export type Pack = "movie" | "anime" | "mix";
const MAX = 8;

type Shot = { score: HypeScore; url: string };
type Stage = "setup" | "turn" | "shot" | "round" | "final";

function shuffle<X>(xs: X[]): X[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function loadNames(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(NAMES) ?? "null");
    if (Array.isArray(v) && v.length >= 2) return v.slice(0, MAX).map((x) => String(x).slice(0, 12));
  } catch {}
  return ["", ""];
}

export default function Duel({ first, movies, pack: initialPack, back }: { first: string | null; movies: AnimeLine[]; pack: Pack; back: "anime" | "challenges" }) {
  const t = useT();
  const firstLine = first ? (animeLine(first) ?? movies.find((m) => m.id === first)) : undefined;
  // 영화 대사를 못 불러왔으면(카탈로그 실패) 애니로
  const [pack, setPack] = useState<Pack>(movies.length ? initialPack : "anime");
  const poolOf = (p: Pack) => (p === "movie" ? movies : p === "anime" ? ANIME_LINES : [...movies, ...ANIME_LINES]);
  const [names, setNames] = useState<string[]>(["", ""]);
  useEffect(() => {
    // 지난 판 선수 이름을 불러온다 (서버 렌더와 맞추려고 마운트 뒤에).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNames(loadNames());
  }, []);
  const [rounds, setRounds] = useState(firstLine ? 1 : 3);
  const [stage, setStage] = useState<Stage>("setup");
  const [lines, setLines] = useState<AnimeLine[]>([]);
  const [round, setRound] = useState(0);
  const [turn, setTurn] = useState(0);
  const [shots, setShots] = useState<Shot[][]>([]); // [round][player]
  const [last, setLast] = useState<Shot | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [judging, setJudging] = useState<number[] | null>(null);
  const [listenFirst, setListenFirst] = useState(true);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(LISTEN) === "0") setListenFirst(false);
    } catch {}
  }, []);
  const chooseListen = (v: boolean) => {
    setListenFirst(v);
    try {
      localStorage.setItem(LISTEN, v ? "1" : "0");
    } catch {}
  };
  useWarmScorer();

  const players = names.map((n, i) => n.trim() || `${i + 1}P`);
  const line = lines[round];
  const take = useTake((line?.span[1] ?? 5) + 3);
  const original = useOriginal(line ? animeRefId(line) : null);
  const packName = (p: Pack) => (p === "movie" ? t("영화·드라마 명대사", "Movie & drama lines") : p === "anime" ? t("애니 명대사", "Anime lines") : t("영화+애니 명대사", "Movie + anime lines"));

  const begin = () => {
    try {
      localStorage.setItem(NAMES, JSON.stringify(names.map((n) => n.trim())));
    } catch {}
    const pool = shuffle(poolOf(pack).filter((l) => l.id !== firstLine?.id));
    const picked = firstLine ? [firstLine, ...pool].slice(0, rounds) : pool.slice(0, rounds);
    // 판이 바뀔 때 원본이 늦게 뜨지 않게 이번 대결 원본을 한꺼번에 받아 둔다
    prefetchOriginals(picked.map(animeRefId));
    setLines(picked);
    setShots(Array.from({ length: rounds }, () => []));
    setRound(0);
    setTurn(0);
    setLast(null);
    setFailed(null);
    setStage("turn");
    track("duel_start", { via: `${pack}:${players.length}p${rounds}r` });
  };

  const record = (shot: Shot) => {
    setShots((prev) => prev.map((row, i) => (i === round ? [...row.slice(0, turn), shot] : row)));
    setLast(shot);
    setFailed(null);
    setStage("shot");
  };

  const shoot = async () => {
    if (!line) return;
    setFailed(null);
    const r = await take.start();
    if (!r) return;
    if (r.silent) return record({ score: silentScore(Boolean(line.movie)), url: r.url });
    setJudging(r.env);
    const score = await scoreWithOriginal(animeRefId(line), r.blob, Boolean(line.movie));
    setJudging(null);
    if (!score) {
      setFailed(r.url);
      track("anime_take", { meme_id: animeRefId(line), via: "duel:fail" });
      return;
    }
    record({ score, url: r.url });
  };

  // 서버가 계속 안 되면 판이 멈추지 않게 — 이 차례는 0점으로 넘긴다
  const skipTurn = () => {
    if (!line) return;
    const shot = { score: silentScore(Boolean(line.movie)), url: failed ?? "" };
    setShots((prev) => prev.map((row, i) => (i === round ? [...row.slice(0, turn), shot] : row)));
    after();
  };

  function after() {
    take.reset();
    setLast(null);
    setFailed(null);
    if (turn + 1 < players.length) {
      setTurn(turn + 1);
      setStage("turn");
    } else {
      setStage(round + 1 < rounds ? "round" : "final");
      if (round + 1 >= rounds) track("duel_done", { via: `${players.length}p${rounds}r` });
    }
  }

  const nextRound = () => {
    setRound(round + 1);
    setTurn(0);
    setStage("turn");
  };

  const retry = () => {
    // 같은 차례에서 한 번 더 — 마이크 실수 구제용. 점수는 덮어쓴다.
    take.reset();
    setLast(null);
    setStage("turn");
  };

  const standings = (() => {
    const rows = players.map((name, i) => {
      const mine = shots.map((r) => r[i]).filter(Boolean) as Shot[];
      const total = mine.reduce((a, x) => a + x.score.total, 0);
      const best = mine.reduce<Shot | null>((b, x) => (!b || x.score.total > b.score.total ? x : b), null);
      return { name, i, total, best, count: mine.length };
    });
    return rows.sort((a, b) => b.total - a.total);
  })();

  const share = async () => {
    const top = standings[0];
    const text = t(
      `MIMIC ${packName(pack)} 대결 결과 🏆 1위 ${top.name} ${top.total}점 — 내가 니 이겼다\n` +
        standings.map((r) => `${1 + standings.filter((x) => x.total > r.total).length}. ${r.name} ${r.total}점`).join("\n"),
      `MIMIC ${packName(pack)} battle 🏆 Winner ${top.name} with ${top.total}\n` +
        standings.map((r) => `${1 + standings.filter((x) => x.total > r.total).length}. ${r.name} ${r.total}`).join("\n"),
    );
    const url = `${location.origin}/duel?pack=${pack}`;
    try {
      if (navigator.share) await navigator.share({ title: "MIMIC", text, url });
      else await navigator.clipboard.writeText(`${text}\n${url}`);
    } catch {}
  };

  if (stage === "setup") {
    return (
      <main className={`shell ${s.page}`}>
        <Link href={back === "anime" ? "/anime" : "/challenges"} className={s.back}>
          ‹ {back === "anime" ? t("애니 명대사", "Anime lines") : t("챌린지", "Challenges")}
        </Link>
        <p className={s.kicker}>LINE BATTLE · {players.length}P</p>
        <h1 className={s.h1}>
          {t("명대사 대결", "Line battle")} <em>{t("내가 니 이겼다", "I win")}</em>
        </h1>
        <p className={s.sub}>
          {t(
            "폰 하나로 차례대로 외치고, 점수 합계로 1등을 가려요. 점수는 누가 원본이랑 더 똑같은지예요.",
            "Take turns on one phone. Highest total wins. Scores are how close you get to the original.",
          )}
        </p>

        {!firstLine && (
          <>
            <h2 className={s.section}>{t("어떤 대사로?", "Which lines?")}</h2>
            <div className={s.opts}>
              {(
                [
                  ["movie", `🎬 ${t("영화·드라마", "Movies")}`, movies.length],
                  ["anime", `🌀 ${t("애니", "Anime")}`, ANIME_LINES.length],
                  ["mix", `🎲 ${t("섞어서", "Mix")}`, movies.length + ANIME_LINES.length],
                ] as const
              )
                .filter(([, , n]) => n > 0)
                .map(([p, label, n]) => (
                  <button key={p} type="button" className={pack === p ? s.optOn : s.opt} onClick={() => setPack(p)} aria-pressed={pack === p}>
                    {label} <small>{n}</small>
                  </button>
                ))}
            </div>
          </>
        )}

        <h2 className={s.section}>{t("누가 나와요?", "Who's playing?")}</h2>
        <ul className={s.players}>
          {names.map((n, i) => (
            <li key={i}>
              <span className={s.pnum}>{i + 1}P</span>
              <input
                id={`duel-name-${i}`}
                value={n}
                maxLength={12}
                placeholder={t(`${i + 1}번 선수 이름`, `Player ${i + 1}`)}
                onChange={(e) => setNames(names.map((x, k) => (k === i ? e.target.value : x)))}
              />
              {names.length > 2 ? (
                <button type="button" className={s.remove} aria-label={t("빼기", "Remove")} onClick={() => setNames(names.filter((_, k) => k !== i))}>
                  ✕
                </button>
              ) : (
                <span />
              )}
            </li>
          ))}
        </ul>
        {names.length < MAX && (
          <button type="button" className={s.add} onClick={() => setNames([...names, ""])}>
            + {t("선수 추가", "Add player")}
          </button>
        )}

        <h2 className={s.section}>{t("몇 판?", "Rounds")}</h2>
        <div className={s.opts}>
          {[1, 3, 5].map((n) => (
            <button key={n} type="button" className={rounds === n ? s.optOn : s.opt} onClick={() => setRounds(n)}>
              {t(`${n}판`, `${n}`)}
            </button>
          ))}
        </div>
        <p className={s.note} style={{ marginTop: 8 }}>
          {firstLine
            ? t(`첫 판은 「${firstLine.say}」, 나머지는 랜덤이에요`, `Round 1 is "${firstLine.en}", the rest are random`)
            : t(`판마다 ${packName(pack)} 중 하나가 랜덤으로 나와요`, `A random line from ${packName(pack)} each round`)}
        </p>

        <h2 className={s.section}>{t("원본은?", "The original")}</h2>
        <div className={s.opts}>
          <button type="button" className={listenFirst ? s.optOn : s.opt} onClick={() => chooseListen(true)} aria-pressed={listenFirst}>
            🎧 {t("판마다 다 같이 듣기", "Play at round start")}
          </button>
          <button type="button" className={!listenFirst ? s.optOn : s.opt} onClick={() => chooseListen(false)} aria-pressed={!listenFirst}>
            ⚡ {t("안 틀고 바로", "Go straight")}
          </button>
        </div>
        <p className={s.note} style={{ marginTop: 8 }}>
          {t("어느 쪽이든 점수는 원본이랑 견줘요. 원본 듣기 버튼은 차례마다 늘 있어요", "Either way you're scored against the original. The play button is always there")}
        </p>

        <button type="button" className={s.shout} onClick={begin}>
          <b>{t("대결 시작", "Start battle")}</b>
          <small>{t(`${players[0]}부터 시작해요`, `${players[0]} goes first`)}</small>
        </button>
      </main>
    );
  }

  if (stage === "final") {
    const top = standings[0];
    const tie = standings.length > 1 && standings[1].total === top.total;
    const bottom = standings[standings.length - 1];
    return (
      <main className={`shell ${s.page}`}>
        <div className={s.win}>
          <span className={s.crown} aria-hidden="true">
            👑
          </span>
          <p className={s.kicker}>WINNER</p>
          <p className={s.winName}>{tie ? standings.filter((r) => r.total === top.total).map((r) => r.name).join(" · ") : top.name}</p>
          <p className={s.winLine}>{tie ? t("공동 1위! 다시 붙어!", "It's a tie! Rematch!") : t("내가 니 이겼다!", "I beat you!")}</p>
          <p className={s.note}>{t(`${rounds}판 합계 ${top.total}점`, `${top.total} points over ${rounds}`)}</p>
          {!tie && standings.length > 1 && (
            <p className={s.loser}>{t(`꼴찌 ${bottom.name} — 벌칙 타임`, `Last place: ${bottom.name} — penalty time`)}</p>
          )}
        </div>
        <ol className={s.board}>
          {standings.map((r) => (
            <li key={r.i}>
              <span className={s.rank}>{1 + standings.filter((x) => x.total > r.total).length}</span>
              <span className={s.who}>
                <b>{r.name}</b>
                <small>{r.best ? t(`최고 ${r.best.score.total} · ${r.best.score.tier.ko}`, `Best ${r.best.score.total} · ${r.best.score.tier.en}`) : "—"}</small>
              </span>
              <span className={s.pts}>{r.total}</span>
              {r.best ? <Replay url={r.best.url} small /> : <span />}
            </li>
          ))}
        </ol>
        <div className={s.row}>
          <button type="button" className={s.btn} onClick={begin}>
            {t("리매치", "Rematch")}
          </button>
          <button type="button" className={s.btnAlt} onClick={share}>
            {t("결과 자랑", "Share result")}
          </button>
          <button type="button" className={`${s.btnAlt} ${s.wide}`} onClick={() => setStage("setup")}>
            {t("선수·판 수 바꾸기", "Change players")}
          </button>
        </div>
        <p className={s.note} style={{ marginTop: 14, textAlign: "center" }}>
          {t("▶ 를 누르면 각자 제일 잘한 테이크를 다시 들어요", "Tap ▶ to replay everyone's best take")}
        </p>
      </main>
    );
  }

  if (stage === "round") {
    return (
      <main className={`shell ${s.page}`}>
        <p className={s.kicker}>
          ROUND {round + 1} / {rounds}
        </p>
        <h1 className={s.h1}>{t("중간 순위", "Standings")}</h1>
        <ol className={s.board}>
          {standings.map((r) => (
            <li key={r.i}>
              <span className={s.rank}>{1 + standings.filter((x) => x.total > r.total).length}</span>
              <span className={s.who}>
                <b>{r.name}</b>
                <small>{shots[round][r.i] ? t(`이번 판 ${shots[round][r.i].score.total}`, `This round ${shots[round][r.i].score.total}`) : ""}</small>
              </span>
              <span className={s.pts}>{r.total}</span>
              {shots[round][r.i] ? <Replay url={shots[round][r.i].url} small /> : <span />}
            </li>
          ))}
        </ol>
        <button type="button" className={s.shout} onClick={nextRound}>
          <b>{t(`${round + 2}판 시작`, `Round ${round + 2}`)}</b>
          <small>{t(`${players[0]}부터`, `${players[0]} first`)}</small>
        </button>
      </main>
    );
  }

  // turn · shot
  const nextName = turn + 1 < players.length ? players[turn + 1] : null;
  return (
    <main className={`shell ${s.page}`}>
      <p className={s.kicker}>
        ROUND {round + 1} / {rounds} · {turn + 1} / {players.length}
      </p>
      <div className={s.turn}>
        <small>{t("지금 차례", "NOW UP")}</small>
        <b>{players[turn]}</b>
      </div>
      {line && <LineCard line={line} big />}
      {stage === "turn" && !judging && !failed && take.phase !== "count" && take.phase !== "rec" && (
        // key: 차례마다 새로 — 판의 첫 차례에만 자동으로 튼다
        <OriginalPlayer key={`${round}:${turn}`} url={original} hue={line?.hue} autoPlay={listenFirst && turn === 0} />
      )}
      {judging ? (
        <Judging env={judging} hue={line?.hue} />
      ) : failed ? (
        <ScoreFail url={failed} onRetry={shoot} onSkip={skipTurn} skipLabel={t("0점으로 넘기기", "Skip (0 pts)")} />
      ) : stage === "turn" || !last ? (
        <>
          <ShoutButton
            phase={take.phase}
            count={take.count}
            level={take.level}
            onStart={shoot}
            onStop={take.stop}
            label={t(`🎙 ${players[turn]}, 외쳐!`, `🎙 ${players[turn]}, shout!`)}
          />
          <MicError kind={take.error} />
        </>
      ) : (
        <>
          <ScoreView score={last.score} url={last.url} name={players[turn]} />
          <div className={s.row}>
            <button type="button" className={`${s.btn} ${last.score.silent ? "" : s.wide}`} onClick={after}>
              {nextName
                ? t(`다음: ${nextName}에게 폰 넘기기`, `Next: pass to ${nextName}`)
                : round + 1 < rounds
                  ? t("이번 판 순위 보기", "See standings")
                  : t("최종 결과", "Final result")}
            </button>
            {last.score.silent && (
              <button type="button" className={s.btnAlt} onClick={retry}>
                {t("다시 외치기", "Retry")}
              </button>
            )}
          </div>
        </>
      )}
    </main>
  );
}
