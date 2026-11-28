"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useT } from "@/components/lang";
import { Coco } from "@/components/brand/coco";
import { useTake } from "@/components/anime/use-take";
import { AvatarFrame, LevelPill, NameFx } from "@/components/pass/look";
import { useViewer } from "@/components/viewer";
import { VoiceAvatar } from "@/components/voice-avatar";
import { buzz } from "@/components/weekly/use-weekly";
import { DEFAULT_AVATAR } from "@/lib/avatar";
import { clientId } from "@/lib/client-id";
import { rankLabel, rankOf, unlocksAt } from "@/lib/pass";
import { EXAM_TRIES_PER_DAY, examPlan, judge, rollRounds, syllables, type Grade, type Round } from "@/lib/rank-exam";
import { track } from "@/lib/track";
import { analyzeBlob } from "@/lib/voice-analysis";
import s from "./exam.module.css";

/**
 * 승급전 — 코코 심사위원의 보스전(11/28).
 *
 * 인트로(상품·하트·오늘 남은 기회) → 라운드마다 미션 카드 + 한 줄 읽기 → 판정 도장(PERFECT·GOOD·MISS)과
 * 게이지 → 다 깨면 RANK UP, 하트가 다 떨어지면 탈락. 측정이 안 된 테이크는 하트를 깎지 않고 다시.
 */
type Exam = { level: number; triesLeft: number };
type State = { ready: boolean; level?: number; exam?: Exam | null };
type Stage = "loading" | "none" | "intro" | "play" | "win" | "lose";
type Hit = { grade: Grade; value: number };

const STAMP: Record<Grade, { ko: string; en: string }> = {
  perfect: { ko: "PERFECT!", en: "PERFECT!" },
  good: { ko: "GOOD", en: "GOOD" },
  miss: { ko: "MISS", en: "MISS" },
};

export default function ExamView() {
  const t = useT();
  const viewer = useViewer();
  const avatar = viewer?.avatar ?? DEFAULT_AVATAR;
  const take = useTake(12);

  const [stage, setStage] = useState<Stage>("loading");
  const [info, setInfo] = useState<State | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [idx, setIdx] = useState(0);
  const [hearts, setHearts] = useState(2);
  const [hits, setHits] = useState<Hit[]>([]);
  const [hit, setHit] = useState<Hit | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveErr, setSaveErr] = useState(false);

  const exam = info?.exam ?? null;
  const level = exam?.level ?? (info?.level ?? 1) + 1;
  const plan = examPlan(level);
  const round = rounds[idx];

  // ?demo=<레벨> — 저장 없이 체험(운영자 확인용 · 표가 생기기 전에도 돌려 볼 수 있게)
  const [demo] = useState(() => {
    if (typeof window === "undefined") return 0;
    const n = Number(new URLSearchParams(window.location.search).get("demo"));
    return Number.isInteger(n) && n >= 2 && n <= 10 ? n : 0;
  });

  useEffect(() => {
    let alive = true;
    if (demo) {
      queueMicrotask(() => {
        if (!alive) return;
        setInfo({ ready: true, level: demo - 1, exam: { level: demo, triesLeft: EXAM_TRIES_PER_DAY } });
        setStage("intro");
      });
      return () => {
        alive = false;
      };
    }
    fetch(`/api/pass/exam?client=${clientId()}`, { cache: "no-store" })
      .then((r) => r.json() as Promise<State>)
      .then((d) => {
        if (!alive) return;
        setInfo(d);
        setStage(d.ready && d.exam ? "intro" : "none");
      })
      .catch(() => alive && setStage("none"));
    return () => {
      alive = false;
    };
  }, [demo]);

  const start = () => {
    setRounds(rollRounds(level));
    setIdx(0);
    setHearts(plan.hearts);
    setHits([]);
    setHit(null);
    setNote(null);
    setSaveErr(false);
    take.reset();
    setStage("play");
    track("exam_start", { via: String(level) });
  };

  const record = async () => {
    if (!round || busy) return;
    setNote(null);
    const tk = await take.start();
    if (!tk) return;
    if (tk.silent) {
      setNote(t("소리가 안 들렸어요 — 다시 읽어 주세요 (하트는 그대로예요)", "We couldn't hear you — try again (no heart lost)"));
      take.reset();
      return;
    }
    setBusy(true);
    try {
      const a = await analyzeBlob(tk.blob, syllables(round.line));
      const r = judge(round.mission, a, plan.d);
      if (!r) {
        setNote(t("잘 안 잡혔어요 — 한 번 더 (하트는 그대로예요)", "Didn't catch that — once more (no heart lost)"));
        take.reset();
        return;
      }
      setHit(r);
      setHits((h) => [...h, r]);
      if (r.grade === "miss") {
        setHearts((h) => h - 1);
        buzz(180);
      } else buzz(r.grade === "perfect" ? 60 : 25);
    } catch {
      setNote(t("녹음을 읽지 못했어요 — 다시 해 주세요", "Couldn't read the take — try again"));
      take.reset();
    } finally {
      setBusy(false);
    }
  };

  const finish = async (passed: boolean) => {
    setBusy(true);
    setSaveErr(false);
    if (demo) {
      setStage(passed ? "win" : "lose");
      setBusy(false);
      return;
    }
    try {
      const r = await fetch("/api/pass/exam", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ client: clientId(), level, passed }),
      });
      const d = (await r.json()) as State;
      if (!r.ok && passed) throw new Error("save");
      if (passed) {
        // 레벨업 카드(components/pass/level-up)가 다음에 또 축하하지 않게.
        try {
          localStorage.setItem("mimic.pass.level", String(level));
        } catch {}
      }
      setInfo((prev) => ({ ...(prev ?? { ready: true }), ...d, exam: passed ? (prev?.exam ?? null) : (d.exam ?? prev?.exam ?? null) }));
      setStage(passed ? "win" : "lose");
      track(passed ? "exam_pass" : "exam_fail", { via: String(level) });
    } catch {
      setSaveErr(true);
    } finally {
      setBusy(false);
    }
  };

  const next = () => {
    if (!hit) return;
    if (hit.grade === "miss" && hearts <= 0) return void finish(false);
    if (idx + 1 >= rounds.length) return void finish(true);
    setIdx(idx + 1);
    setHit(null);
    take.reset();
  };

  if (stage === "loading") {
    return (
      <main className={`shell ${s.page}`}>
        <p className={s.loading}>{t("심사장 여는 중…", "Opening the exam hall…")}</p>
      </main>
    );
  }

  if (stage === "none") {
    return (
      <main className={`shell ${s.page}`}>
        <div className={s.center}>
          <Coco mood="idle" size={120} />
          <h1 className={s.title}>{t("아직 승급전이 없어요", "No rank-up exam yet")}</h1>
          <p className={s.sub}>
            {info?.ready === false
              ? t("승급전이 곧 열려요. 조금만 기다려 주세요!", "Rank-up exams are opening soon!")
              : t("XP 를 다 모으면 다음 레벨 승급전이 열려요. 녹음하고 들려주면 XP 가 쌓여요.", "Fill your XP bar to unlock the next exam. Record and post to earn XP.")}
          </p>
          <Link href="/pass" className={s.primary}>
            {t("패스로", "Back to pass")}
          </Link>
        </div>
      </main>
    );
  }

  const rewards = unlocksAt(level);
  const newRank = rankOf(level) !== rankOf(level - 1) ? rankOf(level) : null;

  if (stage === "intro") {
    const left = exam?.triesLeft ?? 0;
    return (
      <main className={`shell ${s.page}`}>
        <div className={s.center}>
          <p className={s.kicker}>RANK-UP EXAM</p>
          <div className={s.boss}>
            <Coco mood="think" size={132} label={t("코코 심사위원", "Judge Coco")} />
            <span className={s.judge}>{t("코코 심사위원", "Judge Coco")}</span>
          </div>
          <h1 className={s.title}>
            LV.{level - 1} <span className={s.arrow}>→</span> <b>LV.{level}</b> {t("승급전", "exam")}
          </h1>
          <ul className={s.rules}>
            <li>
              🎯 {t(`미션 ${plan.rounds}라운드 — 라운드마다 한 줄 읽기`, `${plan.rounds} rounds — read one line each`)}
            </li>
            <li>
              {"❤️".repeat(plan.hearts)} {t("실수는 한 번까지. 하트가 다 떨어지면 탈락", "One mistake allowed. Lose all hearts and you're out")}
            </li>
            <li>🔇 {t("소리가 안 잡힌 건 하트를 안 깎아요", "Takes we can't hear don't cost a heart")}</li>
          </ul>

          {(rewards.length > 0 || newRank) && (
            <div className={s.prize}>
              <small>{t("통과하면", "Win")}</small>
              <div className={s.prizeRow}>
                {rewards.map((u) => (
                  <span key={u.id} className={s.prizeItem}>
                    {u.kind === "frame" ? (
                      <AvatarFrame frame={u.id}>
                        <VoiceAvatar avatar={avatar} size={40} />
                      </AvatarFrame>
                    ) : (
                      <b className={s.prizeName}>
                        <NameFx fx={u.id}>Aa</NameFx>
                      </b>
                    )}
                    <em>{t(u.ko, u.en)}</em>
                  </span>
                ))}
                {newRank && (
                  <span className={s.prizeItem}>
                    <LevelPill level={level} rank={newRank} />
                    <em>{t(`${rankLabel(newRank)} 승격`, `${rankLabel(newRank)} rank`)}</em>
                  </span>
                )}
              </div>
            </div>
          )}

          <p className={s.tries}>
            {t("오늘 남은 기회", "Tries left today")}{" "}
            {Array.from({ length: EXAM_TRIES_PER_DAY }, (_, i) => (
              <i key={i} className={i < left ? s.tryOn : s.tryOff} />
            ))}
          </p>
          {left > 0 ? (
            <button type="button" className={s.primary} onClick={start}>
              {t("도전 시작!", "Start!")}
            </button>
          ) : (
            <p className={s.sub}>{t("오늘 기회를 다 썼어요. 내일 다시 도전해요!", "No tries left today. Come back tomorrow!")}</p>
          )}
          <Link href="/pass" className={s.ghost}>
            {t("나중에", "Later")}
          </Link>
        </div>
      </main>
    );
  }

  if (stage === "win") {
    const perfects = hits.filter((h) => h.grade === "perfect").length;
    return (
      <main className={`shell ${s.page}`}>
        <div className={s.confetti} aria-hidden="true">
          {Array.from({ length: 24 }, (_, i) => (
            <i key={i} style={{ "--i": i, "--d": ((i * 37) % 24) * 0.06 } as React.CSSProperties} />
          ))}
        </div>
        <div className={s.center}>
          <p className={`${s.stamp} ${s.stampWin}`}>RANK UP!</p>
          <Coco mood="wow" size={110} />
          <div className={s.levelJump}>
            <span>LV.{level - 1}</span>
            <span className={s.arrow}>→</span>
            <b>LV.{level}</b>
          </div>
          <LevelPill level={level} rank={rankOf(level)} />
          {rewards.length > 0 && (
            <div className={s.prize}>
              <small>{t("새로 풀렸어요", "Unlocked")}</small>
              <div className={s.prizeRow}>
                {rewards.map((u) => (
                  <span key={u.id} className={`${s.prizeItem} ${s.reveal}`}>
                    {u.kind === "frame" ? (
                      <AvatarFrame frame={u.id}>
                        <VoiceAvatar avatar={avatar} size={56} />
                      </AvatarFrame>
                    ) : (
                      <b className={s.prizeName}>
                        <NameFx fx={u.id}>{viewer?.nickname || "Aa"}</NameFx>
                      </b>
                    )}
                    <em>{t(u.ko, u.en)}</em>
                  </span>
                ))}
              </div>
            </div>
          )}
          <p className={s.sub}>
            {t(`PERFECT ${perfects} / ${hits.length} · 코코 심사위원 합격 도장 꾹`, `PERFECT ${perfects} / ${hits.length} · Judge Coco approves`)}
          </p>
          <Link href="/pass" className={s.primary}>
            {t("패스 보기", "See my pass")}
          </Link>
        </div>
      </main>
    );
  }

  if (stage === "lose") {
    const left = info?.exam?.triesLeft ?? 0;
    return (
      <main className={`shell ${s.page}`}>
        <div className={s.center}>
          <p className={`${s.stamp} ${s.stampLose}`}>{t("탈락…", "FAILED")}</p>
          <Coco mood="think" size={110} />
          <h1 className={s.title}>{t("아깝다! 거의 다 왔어요", "So close!")}</h1>
          <p className={s.sub}>
            {t(`${hits.length}라운드까지 버텼어요. 미션은 판마다 바뀌어요.`, `You made it to round ${hits.length}. Missions change every run.`)}
          </p>
          <p className={s.tries}>
            {t("오늘 남은 기회", "Tries left today")}{" "}
            {Array.from({ length: EXAM_TRIES_PER_DAY }, (_, i) => (
              <i key={i} className={i < left ? s.tryOn : s.tryOff} />
            ))}
          </p>
          {left > 0 ? (
            <button type="button" className={s.primary} onClick={start}>
              {t("다시 도전", "Try again")}
            </button>
          ) : (
            <p className={s.sub}>{t("오늘은 여기까지! 내일 기회 3번이 다시 생겨요.", "That's it for today — 3 new tries tomorrow.")}</p>
          )}
          <Link href="/practice" className={s.ghost}>
            {t("연습실에서 몸풀기", "Warm up in the practice room")}
          </Link>
        </div>
      </main>
    );
  }

  // 라운드 진행
  const m = round?.mission;
  const goal = m?.goal(plan.d);
  const band = m?.band(plan.d);
  const pct = (v: number) => (m ? Math.max(0, Math.min(100, ((v - m.axis[0]) / (m.axis[1] - m.axis[0])) * 100)) : 0);
  const recording = take.phase === "rec";
  const counting = take.phase === "count";
  const combo = (() => {
    let n = 0;
    for (let i = hits.length - 1; i >= 0 && hits[i].grade === "perfect"; i--) n++;
    return n;
  })();

  return (
    <main className={`shell ${s.page}`}>
      <header className={s.hud}>
        <span className={s.hearts} aria-label={t(`하트 ${hearts}개`, `${hearts} hearts`)}>
          {Array.from({ length: plan.hearts }, (_, i) => (
            <i key={i} className={i < hearts ? s.heartOn : s.heartOff}>
              ❤
            </i>
          ))}
        </span>
        <span className={s.pips}>
          {rounds.map((_, i) => (
            <i key={i} className={i < hits.length ? s[`pip_${hits[i].grade}`] : i === idx ? s.pipNow : ""} />
          ))}
        </span>
        <span className={s.lvTag}>LV.{level}</span>
      </header>

      {m && (
        <section key={idx} className={s.mission}>
          <p className={s.round}>
            ROUND {idx + 1}
            {combo >= 2 && <span className={s.combo}>{t(`콤보 x${combo}`, `Combo x${combo}`)}</span>}
          </p>
          <div className={s.card}>
            <span className={s.cardIcon} aria-hidden="true">
              {m.icon}
            </span>
            <b>{t(m.ko, m.en)}</b>
            <small>{goal ? t(goal.ko, goal.en) : ""}</small>
          </div>
          <p className={s.line}>{round.line}</p>
        </section>
      )}

      {hit && m && band ? (
        <section className={s.result}>
          <p className={`${s.stamp} ${s[`stamp_${hit.grade}`]}`}>{t(STAMP[hit.grade].ko, STAMP[hit.grade].en)}</p>
          <div className={s.gauge}>
            <span className={s.bandPass} style={{ left: `${pct(band.pass[0])}%`, width: `${pct(band.pass[1]) - pct(band.pass[0])}%` }} />
            <span className={s.bandPerfect} style={{ left: `${pct(band.perfect[0])}%`, width: `${pct(band.perfect[1]) - pct(band.perfect[0])}%` }} />
            <span className={s.needle} style={{ "--to": `${pct(hit.value)}%` } as React.CSSProperties} />
          </div>
          <p className={s.value}>
            {hit.value.toFixed(1)} {t(m.unit.ko, m.unit.en)}
          </p>
          {hit.grade === "miss" && hearts > 0 && <p className={s.sub}>{t("하트 하나 잃었어요 — 남은 하트로 버텨요!", "Lost a heart — hang on!")}</p>}
          {saveErr && <p className={s.error}>{t("결과 저장이 안 됐어요. 다시 눌러 주세요.", "Couldn't save. Tap again.")}</p>}
          <button type="button" className={s.primary} onClick={next} disabled={busy}>
            {hit.grade === "miss" && hearts <= 0
              ? t("결과 보기", "See result")
              : idx + 1 >= rounds.length
                ? t("승급 심사 결과 보기", "Get the verdict")
                : t("다음 라운드", "Next round")}
          </button>
        </section>
      ) : (
        <section className={s.recBox}>
          {note && <p className={s.note}>{note}</p>}
          {take.error && (
            <p className={s.error}>{take.error === "nomic" ? t("마이크를 허용해 주세요", "Please allow the microphone") : t("이 브라우저는 녹음이 안 돼요", "Recording isn't supported here")}</p>
          )}
          {counting ? (
            <p className={s.count}>{take.count}</p>
          ) : busy ? (
            <p className={s.loading}>{t("코코가 듣는 중…", "Coco is listening…")}</p>
          ) : recording ? (
            <button type="button" className={s.recBtn} data-on onClick={take.stop} style={{ "--lv": take.level } as React.CSSProperties}>
              {t("다 읽었어요", "Done")}
            </button>
          ) : (
            <button type="button" className={s.recBtn} onClick={() => void record()}>
              🎙️ {t("읽기", "Read")}
            </button>
          )}
        </section>
      )}
    </main>
  );
}
