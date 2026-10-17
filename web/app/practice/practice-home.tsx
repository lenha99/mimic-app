"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BackHome } from "@/components/back-home";
import { ago, expectedSeconds, TRACK_LABEL, type Script, type Track } from "@/lib/practice";
import { summaries, type ItemSummary } from "@/lib/take-store";
import styles from "./practice.module.css";

/**
 * 연습실 목차.
 *
 * 대본집 목차처럼 생겼다 — 번호, 제목, 디렉션 첫 줄, 길이. 지망생은 같은 대본을
 * 며칠씩 다시 읽으니까 "어디까지 했더라"가 첫 화면에서 바로 보여야 한다. 그래서
 * 맨 위는 이어서 하기, 각 줄 끝엔 내가 몇 번 읽었는지가 붙는다.
 */

type Line = { id: string; title: string; source: string; line: string };
type Filter = Track | "line" | "all";

const FILTER_KEY = "mimic.practice.filter";

export default function PracticeHome({ scripts, lines }: { scripts: Script[]; lines: Line[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [done, setDone] = useState<Map<string, ItemSummary>>(new Map());

  useEffect(() => {
    let alive = true;
    void summaries().then((m) => alive && setDone(m));
    try {
      const saved = localStorage.getItem(FILTER_KEY) as Filter | null;
      // 기기에 기억해둔 탭으로 연다. 저장소가 막혀 있으면 "전체" 그대로.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved && ["all", "voice", "anchor", "line"].includes(saved)) setFilter(saved);
    } catch {}
    return () => {
      alive = false;
    };
  }, []);

  const choose = (f: Filter) => {
    setFilter(f);
    try {
      localStorage.setItem(FILTER_KEY, f);
    } catch {}
  };

  const titles = useMemo(() => {
    const m = new Map<string, { title: string; meta: string }>();
    scripts.forEach((s) => m.set(s.id, { title: s.title, meta: `${TRACK_LABEL[s.track]} · ${s.category}` }));
    lines.forEach((l) => m.set(l.id, { title: l.title, meta: `명대사 · ${l.source}` }));
    return m;
  }, [scripts, lines]);

  const last = useMemo(() => {
    let best: ItemSummary | null = null;
    for (const s of done.values()) if (titles.has(s.itemId) && (!best || s.lastAt > best.lastAt)) best = s;
    return best;
  }, [done, titles]);

  const tracks: Track[] = filter === "all" ? ["voice", "anchor"] : filter === "line" ? [] : [filter];
  const showLines = filter === "all" || filter === "line";
  const sec = (id: string) => {
    const s = scripts.find((x) => x.id === id);
    return s ? expectedSeconds(s) : 0;
  };
  const practiced = [...done.values()].filter((s) => titles.has(s.itemId)).length;

  return (
    <main className="shell">
      <BackHome />

      <header className={styles.intro}>
        <p className={styles.eyebrow}>MIMIC 연습실</p>
        <h1 className={styles.h1}>읽고, 듣고, 다시 읽기</h1>
        <p className={styles.lede}>
          성우·아나운서 준비생을 위한 대본 {scripts.length}편. 녹음하면 속도·쉼·억양·말끝을
          바로 짚어줘요. 대본 녹음은 서버로 안 가고 이 폰에만 남아요.
        </p>
      </header>

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
              <small>망설임을 쉼으로 · 약 {sec("sc_v_confess")}초</small>
            </Link>
            <Link href="/practice/sc_a_news_open" className={styles.starter}>
              <span>아나운서</span>
              <b>뉴스 오프닝</b>
              <small>끝까지 단정하게 · 약 {sec("sc_a_news_open")}초</small>
            </Link>
          </div>
        </div>
      )}

      <div className={styles.tabs} role="tablist" aria-label="대본 종류">
        {(
          [
            ["all", "전체", scripts.length + lines.length],
            ["voice", "성우", scripts.filter((s) => s.track === "voice").length],
            ["anchor", "아나운서·낭독", scripts.filter((s) => s.track === "anchor").length],
            ["line", "명대사", lines.length],
          ] as const
        ).map(([key, label, n]) => (
          <button
            key={key}
            role="tab"
            aria-selected={filter === key}
            className={filter === key ? styles.tabOn : styles.tab}
            onClick={() => choose(key)}
          >
            {label} <span>{n}</span>
          </button>
        ))}
      </div>

      {practiced > 0 && (
        <p className={styles.progress}>
          {scripts.length + lines.length}편 중 <b>{practiced}편</b> 읽어봄
        </p>
      )}

      {tracks.map((track) => {
        const mine = scripts.filter((s) => s.track === track);
        const cats = [...new Set(mine.map((s) => s.category))];
        return (
          <section key={track} className={styles.track}>
            {filter === "all" && <h2 className={styles.trackTitle}>{TRACK_LABEL[track]}</h2>}
            {cats.map((cat) => (
              <div key={cat} className={styles.group}>
                <h3 className={styles.groupTitle}>
                  {cat} <span>{mine.filter((s) => s.category === cat).length}</span>
                </h3>
                <ol className={styles.rows}>
                  {mine
                    .filter((s) => s.category === cat)
                    .map((s) => (
                      <li key={s.id}>
                        <Link href={`/practice/${s.id}`} className={styles.row}>
                          <span className={styles.num}>
                            {String(mine.indexOf(s) + 1).padStart(2, "0")}
                          </span>
                          <span className={styles.rowBody}>
                            <span className={styles.rowTitle}>{s.title}</span>
                            <span className={styles.rowDir}>{s.direction}</span>
                          </span>
                          <span className={styles.rowMeta}>
                            <Level n={s.level} />
                            <span>약 {expectedSeconds(s)}초</span>
                            {done.get(s.id) && (
                              <span className={styles.count}>{done.get(s.id)!.count}회</span>
                            )}
                          </span>
                        </Link>
                      </li>
                    ))}
                </ol>
              </div>
            ))}
          </section>
        );
      })}

      {showLines && lines.length > 0 && (
        <section className={styles.track}>
          {filter === "all" && <h2 className={styles.trackTitle}>명대사</h2>}
          <div className={styles.group}>
            <h3 className={styles.groupTitle}>
              원본 따라 말하기 <span>{lines.length}</span>
            </h3>
            <p className={styles.groupNote}>
              원본 음성이 있어서 억양·타이밍을 원본과 직접 비교해 채점해요. 채점하려고
              녹음을 잠깐 서버로 보내고, 점수만 낸 뒤 바로 지워요.
            </p>
            <ol className={styles.rows}>
              {lines.map((l, i) => (
                <li key={l.id}>
                  <Link href={`/practice/${l.id}`} className={styles.row}>
                    <span className={styles.num}>{String(i + 1).padStart(2, "0")}</span>
                    <span className={styles.rowBody}>
                      <span className={styles.rowTitle}>{l.title}</span>
                      <span className={styles.rowDir}>
                        “{l.line}” · {l.source}
                      </span>
                    </span>
                    <span className={styles.rowMeta}>
                      <span className={styles.scored}>채점</span>
                      {done.get(l.id) && (
                        <span className={styles.count}>{done.get(l.id)!.count}회</span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      <footer className={styles.foot}>
        <p>
          대본은 전부 MIMIC 이 직접 썼어요. 학원 수업·스터디에서 자유롭게 써도 돼요.
        </p>
        <Link href="/probe">녹음이 안 되면 마이크 검사 →</Link>
      </footer>
    </main>
  );
}

function Level({ n }: { n: number }) {
  return (
    <span className={styles.level} aria-label={`난이도 ${n}`}>
      {[1, 2, 3].map((i) => (
        <i key={i} className={i <= n ? styles.dotOn : styles.dot} />
      ))}
    </span>
  );
}
