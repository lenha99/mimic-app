"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PracticeStrip } from "@/components/weekly/practice-strip";
import { listMine, type MyScript } from "@/lib/my-scripts";
import { ago, expectedSeconds, trackLabel, type Script, type Track } from "@/lib/practice";
import { useLang, useT } from "@/components/lang";
import { memeText } from "@/lib/meme-i18n";
import { fieldName, scriptTitle } from "@/lib/script-i18n";
import { summaries, type ItemSummary } from "@/lib/take-store";
import { ScreenTour } from "@/components/onboarding/tours";
import { TourHelp } from "@/components/onboarding/tour";
import type { BoardPulse } from "@/lib/board-server";
import styles from "./practice.module.css";
import { GoalChips, TodayCard, type Goal } from "./today";

/**
 * 연습실 목차.
 *
 * 대본집 목차처럼 생겼다 — 번호, 제목, 디렉션 첫 줄, 길이. 지망생은 같은 대본을
 * 며칠씩 다시 읽으니까 "어디까지 했더라"가 첫 화면에서 바로 보여야 한다. 그래서
 * 맨 위는 이어서 하기, 각 줄 끝엔 내가 몇 번 읽었는지가 붙는다.
 *
 * 대본이 늘어도 화면이 안 길어지게:
 *  - 처음엔 분류마다 세 편만 보이고 나머지는 "더 보기"로 접는다
 *  - 찾기·분류·난이도·안 읽은 것만 — 하나라도 걸면 접기 없이 결과만 한 줄로 늘어놓는다
 *  - 고른 탭·분류는 기기에 기억해서 다음에 그대로 연다
 */

type Line = { id: string; title: string; source: string; line: string };
type Tab = Track | "line" | "mine" | "all";
type Level = 0 | 1 | 2 | 3;

const TAB_KEY = "mimic.practice.filter";
const FOLD = 3;
const LEVEL_LABEL: [string, string][] = [["", ""], ["쉬움", "Easy"], ["보통", "Medium"], ["어려움", "Hard"]];

export default function PracticeHome({
  scripts,
  lines,
  pulse = { waiting: 0, fresh: 0, latest: null },
}: {
  scripts: Script[];
  lines: Line[];
  /** 게시판 소식 — 첫 피드백 기다리는 수 · 새 글 (5분마다 갱신) */
  pulse?: BoardPulse;
}) {
  const { waiting, latest } = pulse;
  const t = useT();
  const lang = useLang();
  const [tab, setTab] = useState<Tab>("all");
  const [cat, setCat] = useState<string | null>(null);
  const [level, setLevel] = useState<Level>(0);
  const [fresh, setFresh] = useState(false);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [done, setDone] = useState<Map<string, ItemSummary>>(new Map());
  const [mine, setMine] = useState<MyScript[]>([]);

  useEffect(() => {
    let alive = true;
    void summaries().then((m) => alive && setDone(m));
    // 기기에만 있는 것들(내 대본, 기억해둔 탭)은 붙은 뒤에 읽는다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMine(listMine());
    const fromUrl = new URLSearchParams(location.search).get("tab");
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(TAB_KEY);
    } catch {}
    const want = fromUrl ?? saved;
    if (want && ["all", "voice", "anchor", "speech", "line", "mine"].includes(want)) setTab(want as Tab);
    return () => {
      alive = false;
    };
  }, []);

  const doneIds = useMemo(() => new Set(done.keys()), [done]);

  /** 목표 칩 — 그 트랙·분류로 좁혀서 목록으로 내려간다. */
  const pickGoal = (g: Goal) => {
    choose(g.track);
    setCat(g.cat);
    setLevel(0);
    setQ("");
    setFresh(false);
    requestAnimationFrame(() => document.getElementById("practice-list")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const choose = (next: Tab) => {
    setTab(next);
    setCat(null);
    try {
      localStorage.setItem(TAB_KEY, next);
    } catch {}
  };

  const titles = useMemo(() => {
    const m = new Map<string, { title: string; meta: string }>();
    scripts.forEach((s) =>
      m.set(s.id, { title: scriptTitle(s.id, s.title, lang), meta: `${trackLabel(s.track, lang)} · ${fieldName(s.category, lang)}` }),
    );
    lines.forEach((l) => {
      const mt = memeText(l, lang);
      m.set(l.id, { title: mt.title, meta: `${trackLabel("line", lang)} · ${mt.source}` });
    });
    mine.forEach((s) => m.set(s.id, { title: s.title, meta: `${t("내 대본", "My script")} · ${trackLabel(s.track, lang)}` }));
    return m;
  }, [scripts, lines, mine, lang, t]);

  const last = useMemo(() => {
    let best: ItemSummary | null = null;
    for (const s of done.values()) if (titles.has(s.itemId) && (!best || s.lastAt > best.lastAt)) best = s;
    return best;
  }, [done, titles]);

  /** 트랙 안 번호 — 연습 화면 상단 "07 / 24"와 같은 번호. */
  const numberOf = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of ["voice", "anchor", "speech"] as Track[]) {
      scripts.filter((s) => s.track === t).forEach((s, i) => m.set(s.id, i + 1));
    }
    lines.forEach((l, i) => m.set(l.id, i + 1));
    mine.forEach((s, i) => m.set(s.id, i + 1));
    return m;
  }, [scripts, lines, mine]);

  const needle = q.trim().toLowerCase();
  const narrowing = Boolean(needle || cat || level || fresh);

  const hit = (s: { id: string; title: string; text?: string; direction?: string; category?: string; line?: string; source?: string; level?: number }) =>
    (!needle ||
      [s.title, s.direction, s.category, s.line, s.source, s.text?.replace(/[/*]/g, "")]
        .some((f) => f?.toLowerCase().includes(needle))) &&
    (!level || s.level === level) &&
    (!fresh || !done.has(s.id));

  const inTab = (t: Track) => tab === "all" || tab === t;
  const pool = scripts.filter((s) => inTab(s.track) && (!cat || s.category === cat));
  const cats = tab === "voice" || tab === "anchor" || tab === "speech" ? [...new Set(scripts.filter((s) => s.track === tab).map((s) => s.category))] : [];
  const showLines = (tab === "all" || tab === "line") && !cat && !level;
  const showMine = (tab === "all" || tab === "mine") && !cat && !level;

  const foundScripts = pool.filter(hit);
  const foundLines = showLines ? lines.filter((l) => hit(l)) : [];
  const foundMine = showMine ? mine.filter(hit) : [];
  const total = foundScripts.length + foundLines.length + foundMine.length;
  const practiced = [...done.values()].filter((s) => titles.has(s.itemId)).length;

  const toggle = (key: string) =>
    setOpen((cur) => {
      const n = new Set(cur);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  const scriptRow = (s: Script) => (
    <li key={s.id}>
      <Link href={`/practice/${s.id}`} className={styles.row}>
        <span className={styles.num}>{String(numberOf.get(s.id) ?? 0).padStart(2, "0")}</span>
        <span className={styles.rowBody}>
          <span className={styles.rowTitle}>{scriptTitle(s.id, s.title, lang)}</span>
          <span className={styles.rowDir}>{s.direction}</span>
        </span>
        <span className={styles.rowMeta}>
          {s.category !== "내 대본" && <Dots n={s.level} />}
          <span>{t(`약 ${expectedSeconds(s)}초`, `~${expectedSeconds(s)}s`)}</span>
          {done.get(s.id) && <span className={styles.count}>{t(`${done.get(s.id)!.count}회`, `${done.get(s.id)!.count}×`)}</span>}
        </span>
      </Link>
    </li>
  );

  const lineRow = (l: Line) => (
    <li key={l.id}>
      <Link href={`/practice/${l.id}`} className={styles.row}>
        <span className={styles.num}>{String(numberOf.get(l.id) ?? 0).padStart(2, "0")}</span>
        <span className={styles.rowBody}>
          <span className={styles.rowTitle}>{memeText(l, lang).title}</span>
          <span className={styles.rowDir}>
            “{l.line}” · {memeText(l, lang).source}
          </span>
        </span>
        <span className={styles.rowMeta}>
          <span className={styles.scored}>{t("채점", "Scored")}</span>
          {done.get(l.id) && <span className={styles.count}>{t(`${done.get(l.id)!.count}회`, `${done.get(l.id)!.count}×`)}</span>}
        </span>
      </Link>
    </li>
  );

  /** 접힌 묶음 — 세 편만 보이고 나머지는 "더 보기". 찾는 중엔 접지 않는다. */
  const group = <T,>(key: string, title: string, rows: T[], render: (r: T) => React.ReactNode, note?: string) => {
    if (rows.length === 0) return null;
    const folded = !narrowing && !open.has(key) && rows.length > FOLD + 1;
    return (
      <div key={key} className={styles.group}>
        <h3 className={styles.groupTitle}>
          {title} <span>{rows.length}</span>
        </h3>
        {note && <p className={styles.groupNote}>{note}</p>}
        <ol className={styles.rows}>{(folded ? rows.slice(0, FOLD) : rows).map(render)}</ol>
        {rows.length > FOLD + 1 && !narrowing && (
          <button type="button" className={styles.more} onClick={() => toggle(key)} aria-expanded={!folded}>
            {folded ? t(`${rows.length - FOLD}편 더 보기`, `Show ${rows.length - FOLD} more`) : t("접기", "Show less")}
          </button>
        )}
      </div>
    );
  };

  const addMine = (
    <Link href="/practice/new" className={styles.addMine} data-tour="practice-add">
      <span className={styles.addPlus} aria-hidden="true">
        +
      </span>
      <span>
        <b>{t("내 대본으로 연습하기", "Practice with my own script")}</b>
        <small>{t("오디션·학원·발표 대본을 붙여넣으면 똑같이 녹음하고 코코가 확인해 줘요 · 이 폰에만 저장", "Paste an audition, class or presentation script — record and get Coco's check the same way · saved on this phone only")}</small>
      </span>
    </Link>
  );

  return (
    <main className="shell">
      <TourHelp id="practice" corner />
      <header className={styles.intro} data-tour="practice-intro">
        <p className={styles.eyebrow}>{t("MIMIC 연습실", "MIMIC Practice Room")}</p>
        <h1 className={styles.h1}>{t("읽고, 듣고, 다시 읽기", "Read. Listen. Again.")}</h1>
        <p className={styles.lede}>
          {t(
            `성우·아나운서·스피치 대본 ${scripts.length}편. 녹음하면 코코가 대본대로 읽었는지 짚어 주고 목소리 타입도 알려 줘요. 녹음은 이 폰에만 남고, 잘 나온 테이크는 목소리 갤러리에 올릴 수 있어요.`,
            `${scripts.length} Korean scripts for voice actors, anchors and speakers. Record and Coco checks you read every word, plus your voice type. Takes stay on your phone — post your best one to the voice gallery.`,
          )}
        </p>
      </header>

      <PracticeStrip />

      {/* 게시판 입구 — 연습실 맨 위에서 빛나게. 새 글이 있으면 누가 올렸는지까지 보여 준다. */}
      <Link
        href={latest ? `/practice/board/${latest.id}` : "/practice/board"}
        className={latest ? `${styles.board} ${styles.boardLive}` : styles.board}
        data-tour="practice-board"
      >
        <span className={styles.boardIcon} aria-hidden="true">
          🎧
        </span>
        <span className={styles.boardText}>
          <b>
            {t("연습 피드백 · 서로 들어주기", "Feedback board · listen to each other")}
            {latest && <i className={styles.boardNew}>{latest.firstPost ? t("첫 연습", "FIRST") : "NEW"}</i>}
          </b>
          {latest ? (
            <small className={styles.boardNews}>
              {latest.firstPost
                ? t(`🎉 새로운 사람이 올렸어요! ${latest.nickname} 님의 첫 연습 · 들어주러 가기`, `🎉 Someone new posted! ${latest.nickname}'s first take · go listen`)
                : t(`✨ ${latest.nickname} 님이 새 연습을 올렸어요 · ${ago(Date.parse(latest.createdAt), lang)}`, `✨ ${latest.nickname} posted a new take · ${ago(Date.parse(latest.createdAt), lang)}`)}
            </small>
          ) : (
            <small>
              {waiting > 0
                ? t(`${waiting}명이 첫 피드백을 기다리고 있어요. 한 줄 남겨볼까요?`, `${waiting} people are waiting for their first note. Leave one?`)
                : t("내 테이크를 올리고 다른 준비생에게 피드백 받아보세요", "Post a take and get notes from other learners")}
            </small>
          )}
        </span>
        <span aria-hidden="true">→</span>
      </Link>

      <TodayCard scripts={scripts} done={doneIds} />

      {last && (
        <Link href={`/practice/${last.itemId}`} className={styles.resume}>
          <span className={styles.resumeLabel}>{t("이어서", "Continue")}</span>
          <span className={styles.resumeTitle}>{titles.get(last.itemId)!.title}</span>
          <span className={styles.resumeMeta}>
            {titles.get(last.itemId)!.meta} · {t(`${last.count}번 읽음`, `read ${last.count}×`)} · {ago(last.lastAt, lang)}
          </span>
          <span className={styles.resumeGo} aria-hidden="true">
            →
          </span>
        </Link>
      )}

      <GoalChips scripts={scripts} onPick={pickGoal} />

      {/* 예전엔 "내 대본" 탭 안에만 있어서 아무도 못 찾았다. 위쪽에 늘 보이게 둔다. */}
      {tab !== "mine" && addMine}


      <label className={styles.search}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
          <path d="m16 16 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("제목·분위기·대본 속 말로 찾기", "Search by title, mood or words")}
          aria-label={t("대본 찾기", "Search scripts")}
          enterKeyHint="search"
        />
      </label>

      <div id="practice-list" className={styles.tabs} role="tablist" aria-label={t("대본 종류", "Script type")} data-tour="practice-filter">
        {(
          [
            ["all", t("전체", "All"), scripts.length + lines.length + mine.length],
            ["voice", trackLabel("voice", lang), scripts.filter((s) => s.track === "voice").length],
            ["anchor", trackLabel("anchor", lang), scripts.filter((s) => s.track === "anchor").length],
            ["speech", trackLabel("speech", lang), scripts.filter((s) => s.track === "speech").length],
            ["line", trackLabel("line", lang), lines.length],
            ["mine", t("내 대본", "Mine"), mine.length],
          ] as const
        ).map(([key, label, n]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? styles.tabOn : styles.tab}
            onClick={() => choose(key)}
          >
            {label} <span>{n}</span>
          </button>
        ))}
      </div>

      {tab !== "mine" && (
        <div className={styles.chips} aria-label={t("좁히기", "Filters")}>
          {cats.map((c) => (
            <button
              key={c}
              type="button"
              className={cat === c ? styles.chipOn : styles.chip}
              aria-pressed={cat === c}
              onClick={() => setCat(cat === c ? null : c)}
            >
              {fieldName(c, lang)}
            </button>
          ))}
          {cats.length > 0 && <span className={styles.chipRule} aria-hidden="true" />}
          {tab !== "line" &&
            ([1, 2, 3] as const).map((n) => (
              <button
                key={n}
                type="button"
                className={level === n ? styles.chipOn : styles.chip}
                aria-pressed={level === n}
                onClick={() => setLevel(level === n ? 0 : n)}
              >
                {t(LEVEL_LABEL[n][0], LEVEL_LABEL[n][1])}
              </button>
            ))}
          <button
            type="button"
            className={fresh ? styles.chipOn : styles.chip}
            aria-pressed={fresh}
            onClick={() => setFresh(!fresh)}
          >
            {t("안 읽은 것만", "Unread only")}
          </button>
        </div>
      )}

      {narrowing ? (
        <p className={styles.progress}>
          {t(<><b>{total}편</b> 찾았어요</>, <><b>{total}</b> found</>)}
          <button
            type="button"
            className={styles.clear}
            onClick={() => {
              setQ("");
              setCat(null);
              setLevel(0);
              setFresh(false);
            }}
          >
            {t("조건 지우기", "Clear filters")}
          </button>
        </p>
      ) : (
        practiced > 0 && (
          <p className={styles.progress}>
            {t(
              <>
                {scripts.length + lines.length + mine.length}편 중 <b>{practiced}편</b> 읽어봤어요
              </>,
              <>
                <b>{practiced}</b> of {scripts.length + lines.length + mine.length} practiced
              </>,
            )}
          </p>
        )
      )}

      {tab === "mine" && (
        <section className={styles.track}>
          {addMine}
          {mine.length === 0 ? (
            <p className={styles.empty}>
              {t(
                "아직 넣은 대본이 없어요. 학원 교재나 오디션 지정 대본을 붙여넣으면 다른 대본과 똑같이 연습할 수 있어요. 대본은 서버로 가지 않고 이 폰에만 저장돼요.",
                "No scripts yet. Paste a class or audition script and practice it just like the others. It never leaves your phone.",
              )}
            </p>
          ) : (
            group("mine", t("내 대본", "My scripts"), foundMine, scriptRow)
          )}
        </section>
      )}

      {tab !== "mine" && narrowing && (
        <section className={styles.track}>
          {total === 0 ? (
            <p className={styles.empty}>{t("맞는 대본이 없어요. 조건을 하나 빼 보세요", "No matches. Try removing a filter")}</p>
          ) : (
            <ol className={styles.rows}>
              {foundMine.map(scriptRow)}
              {foundScripts.map(scriptRow)}
              {foundLines.map(lineRow)}
            </ol>
          )}
        </section>
      )}

      {tab !== "mine" && !narrowing && (
        <>
          {tab === "all" && mine.length > 0 && (
            <section className={styles.track}>
              <h2 className={styles.trackTitle}>{t("내 대본", "My scripts")}</h2>
              {group("all-mine", t("이 폰에 넣은 대본", "Saved on this phone"), mine, scriptRow)}
            </section>
          )}

          {(["voice", "anchor", "speech"] as Track[])
            .filter(inTab)
            .map((tk) => {
              const ofTrack = scripts.filter((s) => s.track === tk);
              return (
                <section key={tk} className={styles.track}>
                  {tab === "all" && <h2 className={styles.trackTitle}>{trackLabel(tk, lang)}</h2>}
                  {[...new Set(ofTrack.map((s) => s.category))].map((c) =>
                    group(`${tk}:${c}`, fieldName(c, lang), ofTrack.filter((s) => s.category === c), scriptRow),
                  )}
                </section>
              );
            })}

          {showLines && lines.length > 0 && (
            <section className={styles.track}>
              {tab === "all" && <h2 className={styles.trackTitle}>{trackLabel("line", lang)}</h2>}
              {group(
                "lines",
                t("원본 따라 말하기", "Copy the original"),
                lines,
                lineRow,
                t(
                  "원본 음성이 있어서 억양·타이밍을 원본과 직접 비교해 채점해요. 채점할 때만 녹음을 잠깐 서버로 보내고, 점수만 낸 뒤 바로 지워요.",
                  "These have original audio, so you're scored directly against it on pitch and rhythm. Your take is sent to the server only for scoring and deleted right after.",
                ),
              )}
            </section>
          )}

          {tab === "all" && mine.length === 0 && <section className={styles.track}>{addMine}</section>}
        </>
      )}

      <footer className={styles.foot}>
        <p>{t("기본 대본은 전부 MIMIC 이 직접 썼어요. 학원 수업·스터디에서 자유롭게 써도 돼요.", "All built-in scripts are written by MIMIC. Feel free to use them in classes and study groups.")}</p>
        <Link href="/probe">{t("녹음이 안 되나요? 마이크 점검하기 →", "Mic not working? Check it →")}</Link>
      </footer>
      <ScreenTour id="practice" />
    </main>
  );
}


function Dots({ n }: { n: number }) {
  const t = useT();
  return (
    <span className={styles.level} aria-label={t(`난이도 ${n}`, `Level ${n}`)}>
      {[1, 2, 3].map((i) => (
        <i key={i} className={i <= n ? styles.dotOn : styles.dot} />
      ))}
    </span>
  );
}
