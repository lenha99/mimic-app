"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PracticeStrip } from "@/components/weekly/practice-strip";
import { listMine, type MyScript } from "@/lib/my-scripts";
import { ago, expectedSeconds, TRACK_LABEL, type Script, type Track } from "@/lib/practice";
import { summaries, type ItemSummary } from "@/lib/take-store";
import styles from "./practice.module.css";

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
const LEVEL_LABEL = ["", "쉬움", "보통", "어려움"];

export default function PracticeHome({
  scripts,
  lines,
  waiting = 0,
}: {
  scripts: Script[];
  lines: Line[];
  /** 피드백을 하나도 못 받은 게시물 수 (5분마다 갱신) */
  waiting?: number;
}) {
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
    if (want && ["all", "voice", "anchor", "line", "mine"].includes(want)) setTab(want as Tab);
    return () => {
      alive = false;
    };
  }, []);

  const choose = (t: Tab) => {
    setTab(t);
    setCat(null);
    try {
      localStorage.setItem(TAB_KEY, t);
    } catch {}
  };

  const titles = useMemo(() => {
    const m = new Map<string, { title: string; meta: string }>();
    scripts.forEach((s) => m.set(s.id, { title: s.title, meta: `${TRACK_LABEL[s.track]} · ${s.category}` }));
    lines.forEach((l) => m.set(l.id, { title: l.title, meta: `명대사 · ${l.source}` }));
    mine.forEach((s) => m.set(s.id, { title: s.title, meta: `내 대본 · ${TRACK_LABEL[s.track]}` }));
    return m;
  }, [scripts, lines, mine]);

  const last = useMemo(() => {
    let best: ItemSummary | null = null;
    for (const s of done.values()) if (titles.has(s.itemId) && (!best || s.lastAt > best.lastAt)) best = s;
    return best;
  }, [done, titles]);

  /** 트랙 안 번호 — 연습 화면 상단 "07 / 24"와 같은 번호. */
  const numberOf = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of ["voice", "anchor"] as Track[]) {
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
  const cats = tab === "voice" || tab === "anchor" ? [...new Set(scripts.filter((s) => s.track === tab).map((s) => s.category))] : [];
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
          <span className={styles.rowTitle}>{s.title}</span>
          <span className={styles.rowDir}>{s.direction}</span>
        </span>
        <span className={styles.rowMeta}>
          {s.category !== "내 대본" && <Dots n={s.level} />}
          <span>약 {expectedSeconds(s)}초</span>
          {done.get(s.id) && <span className={styles.count}>{done.get(s.id)!.count}회</span>}
        </span>
      </Link>
    </li>
  );

  const lineRow = (l: Line) => (
    <li key={l.id}>
      <Link href={`/practice/${l.id}`} className={styles.row}>
        <span className={styles.num}>{String(numberOf.get(l.id) ?? 0).padStart(2, "0")}</span>
        <span className={styles.rowBody}>
          <span className={styles.rowTitle}>{l.title}</span>
          <span className={styles.rowDir}>
            “{l.line}” · {l.source}
          </span>
        </span>
        <span className={styles.rowMeta}>
          <span className={styles.scored}>채점</span>
          {done.get(l.id) && <span className={styles.count}>{done.get(l.id)!.count}회</span>}
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
            {folded ? `${rows.length - FOLD}편 더 보기` : "접기"}
          </button>
        )}
      </div>
    );
  };

  const addMine = (
    <Link href="/practice/new" className={styles.addMine}>
      <span className={styles.addPlus} aria-hidden="true">
        +
      </span>
      <span>
        <b>내 대본 넣기</b>
        <small>오디션·학원 대본을 붙여넣고 똑같이 진단받기 · 이 폰에만 저장</small>
      </span>
    </Link>
  );

  return (
    <main className="shell">
      <header className={styles.intro}>
        <p className={styles.eyebrow}>MIMIC 연습실</p>
        <h1 className={styles.h1}>읽고, 듣고, 다시 읽기</h1>
        <p className={styles.lede}>
          성우·아나운서 준비생을 위한 대본 {scripts.length}편. 녹음하면 속도·쉼·억양·말끝을
          바로 짚어주고, 대본대로 읽었는지도 확인해줘요. 녹음은 이 폰에만 남아요.
        </p>
      </header>

      <PracticeStrip />

      {last ? (
        <Link href={`/practice/${last.itemId}`} className={styles.resume}>
          <span className={styles.resumeLabel}>이어서</span>
          <span className={styles.resumeTitle}>{titles.get(last.itemId)!.title}</span>
          <span className={styles.resumeMeta}>
            {titles.get(last.itemId)!.meta} · {last.count}번 읽음 · {ago(last.lastAt)}
          </span>
          <span className={styles.resumeGo} aria-hidden="true">
            →
          </span>
        </Link>
      ) : (
        <div className={styles.starters}>
          <p className={styles.startersLabel}>처음이라면 여기서</p>
          <div className={styles.starterRow}>
            <Link href="/practice/sc_v_confess" className={styles.starter}>
              <span>성우</span>
              <b>고백 직전</b>
              <small>망설임을 쉼으로 · 약 {sec(scripts, "sc_v_confess")}초</small>
            </Link>
            <Link href="/practice/sc_a_news_open" className={styles.starter}>
              <span>아나운서</span>
              <b>뉴스 오프닝</b>
              <small>끝까지 단정하게 · 약 {sec(scripts, "sc_a_news_open")}초</small>
            </Link>
          </div>
        </div>
      )}

      <Link href="/practice/board" className={styles.board}>
        <span className={styles.boardIcon} aria-hidden="true">
          🎧
        </span>
        <span className={styles.boardText}>
          <b>연습 피드백 · 서로 들어주기</b>
          <small>
            {waiting > 0
              ? `${waiting}명이 첫 피드백을 기다려요 — 한 줄 남겨주기`
              : "내 테이크를 올리고 다른 준비생에게 피드백 받기"}
          </small>
        </span>
        <span aria-hidden="true">→</span>
      </Link>

      <label className={styles.search}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
          <path d="m16 16 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="제목·분위기·대본 속 말로 찾기"
          aria-label="대본 찾기"
          enterKeyHint="search"
        />
      </label>

      <div className={styles.tabs} role="tablist" aria-label="대본 종류">
        {(
          [
            ["all", "전체", scripts.length + lines.length + mine.length],
            ["voice", "성우", scripts.filter((s) => s.track === "voice").length],
            ["anchor", "아나운서·낭독", scripts.filter((s) => s.track === "anchor").length],
            ["line", "명대사", lines.length],
            ["mine", "내 대본", mine.length],
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
        <div className={styles.chips} aria-label="좁히기">
          {cats.map((c) => (
            <button
              key={c}
              type="button"
              className={cat === c ? styles.chipOn : styles.chip}
              aria-pressed={cat === c}
              onClick={() => setCat(cat === c ? null : c)}
            >
              {c}
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
                {LEVEL_LABEL[n]}
              </button>
            ))}
          <button
            type="button"
            className={fresh ? styles.chipOn : styles.chip}
            aria-pressed={fresh}
            onClick={() => setFresh(!fresh)}
          >
            안 읽은 것만
          </button>
        </div>
      )}

      {narrowing ? (
        <p className={styles.progress}>
          <b>{total}편</b> 찾음
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
            조건 지우기
          </button>
        </p>
      ) : (
        practiced > 0 && (
          <p className={styles.progress}>
            {scripts.length + lines.length + mine.length}편 중 <b>{practiced}편</b> 읽어봄
          </p>
        )
      )}

      {tab === "mine" && (
        <section className={styles.track}>
          {addMine}
          {mine.length === 0 ? (
            <p className={styles.empty}>
              아직 넣은 대본이 없어요. 학원 교재나 오디션 지정 대본을 붙여넣으면 다른 대본과 똑같이
              연습할 수 있어요. 대본은 서버로 안 가고 이 폰에만 저장돼요.
            </p>
          ) : (
            group("mine", "내 대본", foundMine, scriptRow)
          )}
        </section>
      )}

      {tab !== "mine" && narrowing && (
        <section className={styles.track}>
          {total === 0 ? (
            <p className={styles.empty}>맞는 대본이 없어요. 조건을 하나 빼 보세요.</p>
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
              <h2 className={styles.trackTitle}>내 대본</h2>
              {group("all-mine", "이 폰에 넣은 대본", mine, scriptRow)}
            </section>
          )}

          {(["voice", "anchor"] as Track[])
            .filter(inTab)
            .map((t) => {
              const ofTrack = scripts.filter((s) => s.track === t);
              return (
                <section key={t} className={styles.track}>
                  {tab === "all" && <h2 className={styles.trackTitle}>{TRACK_LABEL[t]}</h2>}
                  {[...new Set(ofTrack.map((s) => s.category))].map((c) =>
                    group(`${t}:${c}`, c, ofTrack.filter((s) => s.category === c), scriptRow),
                  )}
                </section>
              );
            })}

          {showLines && lines.length > 0 && (
            <section className={styles.track}>
              {tab === "all" && <h2 className={styles.trackTitle}>명대사</h2>}
              {group(
                "lines",
                "원본 따라 말하기",
                lines,
                lineRow,
                "원본 음성이 있어서 억양·타이밍을 원본과 직접 비교해 채점해요. 채점하려고 녹음을 잠깐 서버로 보내고, 점수만 낸 뒤 바로 지워요.",
              )}
            </section>
          )}

          {tab === "all" && mine.length === 0 && <section className={styles.track}>{addMine}</section>}
        </>
      )}

      <footer className={styles.foot}>
        <p>기본 대본은 전부 MIMIC 이 직접 썼어요. 학원 수업·스터디에서 자유롭게 써도 돼요.</p>
        <Link href="/probe">녹음이 안 되면 마이크 검사 →</Link>
      </footer>
    </main>
  );
}

function sec(scripts: Script[], id: string): number {
  const s = scripts.find((x) => x.id === id);
  return s ? expectedSeconds(s) : 0;
}

function Dots({ n }: { n: number }) {
  return (
    <span className={styles.level} aria-label={`난이도 ${n}`}>
      {[1, 2, 3].map((i) => (
        <i key={i} className={i <= n ? styles.dotOn : styles.dot} />
      ))}
    </span>
  );
}
