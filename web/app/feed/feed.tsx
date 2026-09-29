"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type Ref,
} from "react";
import { usePlaybackLevel } from "@/components/use-playback-level";
import { VoiceAvatar } from "@/components/voice-avatar";
import type { FeedItem, FeedPage, FeedSort, FeedTake } from "@/lib/feed";
import { createClient } from "@/lib/supabase/client";
import { track } from "@/lib/track";
import styles from "./feed.module.css";

/**
 * 세로로 넘기는 피드. 한 장에 한 사람.
 *
 * 재생은 <audio> 하나로 한다. 모바일 브라우저는 사용자가 한 번 탭하기 전엔 소리를
 * 못 내게 하는데, 그 한 번으로 풀리는 건 "그 요소"다. 카드마다 <audio> 를 두면
 * 넘길 때마다 다시 막힌다. 그래서 첫 탭에서 이 요소를 풀고, 이후엔 src 만 바꿔 끼운다.
 *
 * 한 장의 순서: 원본 → 그 사람. 둘을 붙여 들어야 웃기다 — 따로 들으면 그냥 녹음이다.
 * 원본을 이미 외운 사람은 "원본 먼저"를 끌 수 있다(기기에 기억한다).
 */

type Phase = "ref" | "take";
type Play = {
  index: number;
  phases: Phase[];
  step: number;
  state: "playing" | "paused" | "done";
};
type Sheet =
  | { type: "menu"; item: FeedTake; confirmReport?: boolean }
  | { type: "login"; next: string; why: string };

const TABS: { sort: FeedSort; label: string }[] = [
  { sort: "hot", label: "추천" },
  { sort: "new", label: "최신" },
  { sort: "funny", label: "😂 웃긴" },
];

/** 카드마다 조명 색을 돌린다 (홈 카드와 같은 네 색). */
const ACCENTS = ["volt", "cyan", "pink", "lime"] as const;

/**
 * "원본 먼저" 설정 — 기기에 기억한다. 서버는 모르므로 서버 렌더는 늘 켜짐이고,
 * 브라우저에서 저장된 값으로 바뀐다. 저장소가 막혀 있으면(사생활 보호 모드) 켜짐.
 */
const REF_FIRST_KEY = "mimic.feed.refFirst";
const refFirstListeners = new Set<() => void>();

function readRefFirst(): boolean {
  try {
    return localStorage.getItem(REF_FIRST_KEY) !== "0";
  } catch {
    return true;
  }
}

function writeRefFirst(on: boolean) {
  try {
    localStorage.setItem(REF_FIRST_KEY, on ? "1" : "0");
  } catch {}
  refFirstListeners.forEach((fn) => fn());
}

function subscribeRefFirst(fn: () => void) {
  refFirstListeners.add(fn);
  return () => refFirstListeners.delete(fn);
}

export function Feed({
  initial,
  sort,
  viewerId,
}: {
  initial: FeedPage;
  sort: FeedSort;
  viewerId: string | null;
}) {
  const loggedIn = viewerId !== null;
  const [items, setItems] = useState<FeedItem[]>(initial.items);
  const [nextOffset, setNextOffset] = useState<number | null>(initial.nextOffset);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [unlocked, setUnlocked] = useState(false);
  const refFirst = useSyncExternalStore(subscribeRefFirst, readRefFirst, () => true);
  const [play, setPlay] = useState<Play | null>(null);
  const [progress, setProgress] = useState(0);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const audio = useRef<HTMLAudioElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  // 오디오 이벤트 핸들러는 렌더 사이에 불리므로 최신 값을 ref 로 들고 있는다.
  const itemsRef = useRef(items);
  const playRef = useRef(play);
  const refFirstRef = useRef(refFirst);
  const retried = useRef(new Set<string>());
  const played = useRef(new Set<string>());
  // 커밋된 값을 ref 로 옮긴다. 아래 이펙트들보다 먼저 선언해야 그쪽이 최신 값을 본다.
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  useEffect(() => {
    playRef.current = play;
  }, [play]);
  useEffect(() => {
    refFirstRef.current = refFirst;
  }, [refFirst]);

  useEffect(() => {
    track("view_feed", { via: sort });
  }, [sort]);

  const toggleRefFirst = () => {
    const next = !refFirst;
    writeRefFirst(next);
    flash(next ? "원본 먼저 듣고 넘어갈게" : "이제 바로 그 사람 목소리부터");
  };

  // ── 알림 한 줄 ──────────────────────────────────────────────────────────
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const flash = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  // ── 재생 ────────────────────────────────────────────────────────────────
  const setState = (state: Play["state"]) =>
    setPlay((p) => (p ? { ...p, state } : p));

  const runPhase = useCallback((index: number, phases: Phase[], step: number) => {
    const el = audio.current;
    const item = itemsRef.current[index];
    if (!el || !item) return;
    const phase = phases[step];
    const url = phase === "ref" ? item.refUrl : item.kind === "take" ? item.audioUrl : null;
    setProgress(0);
    if (!url) {
      setPlay({ index, phases, step, state: "done" });
      return;
    }
    el.src = url;
    el.currentTime = 0;
    setPlay({ index, phases, step, state: "playing" });
    void el.play().catch(() => setState("paused"));

    if (phase === "take" && item.kind === "take" && !played.current.has(item.id)) {
      played.current.add(item.id);
      track("feed_play", { meme_id: item.meme.id });
    }
  }, []);

  const startAt = useCallback(
    (index: number) => {
      const item = itemsRef.current[index];
      if (!item) return;
      const phases: Phase[] =
        item.kind === "take" ? (refFirstRef.current ? ["ref", "take"] : ["take"]) : ["ref"];
      runPhase(index, phases, 0);
    },
    [runPhase],
  );

  const stop = useCallback(() => {
    audio.current?.pause();
    setPlay(null);
    setProgress(0);
  }, []);

  const onEnded = () => {
    const p = playRef.current;
    if (!p) return;
    if (p.step + 1 < p.phases.length) runPhase(p.index, p.phases, p.step + 1);
    else setState("done");
  };

  /** 재생 URL 은 30분짜리다. 오래 머물다 넘기면 만료돼 있으니 한 번만 다시 받는다. */
  const onError = async () => {
    const p = playRef.current;
    const item = p ? itemsRef.current[p.index] : null;
    if (!p || !item || item.kind !== "take" || p.phases[p.step] !== "take") {
      if (p) setState("done");
      return;
    }
    if (retried.current.has(item.id)) {
      setState("done");
      flash("이 녹음은 지금 못 불러와. 다음 거 들어볼래?");
      return;
    }
    retried.current.add(item.id);
    try {
      const res = await fetch(`/api/feed?id=${item.id}`);
      if (!res.ok) throw new Error();
      const { item: fresh } = (await res.json()) as { item: FeedTake };
      setItems((list) => list.map((x) => (x.id === fresh.id ? fresh : x)));
      itemsRef.current = itemsRef.current.map((x) => (x.id === fresh.id ? fresh : x));
      if (playRef.current?.index === p.index) runPhase(p.index, p.phases, p.step);
    } catch {
      setState("done");
    }
  };

  const onTimeUpdate = () => {
    const el = audio.current;
    if (!el) return;
    // 브라우저 녹음(webm)은 길이 정보가 없는 경우가 많다(Infinity). 그땐 진행 막대가
    // 흐르는 모양으로 바뀐다 — 가짜 퍼센트를 그리는 것보다 낫다.
    setProgress(Number.isFinite(el.duration) && el.duration > 0 ? el.currentTime / el.duration : -1);
  };

  /** 첫 탭 — 이 안에서 play() 를 불러야 모바일이 소리를 풀어준다. */
  const unlock = () => {
    setUnlocked(true);
    startAt(active);
  };

  const togglePlay = () => {
    const el = audio.current;
    if (!el) return;
    if (!unlocked) return unlock();
    const p = playRef.current;
    if (!p || p.index !== active || p.state === "done") return startAt(active);
    if (p.state === "playing") {
      el.pause();
      setState("paused");
    } else {
      setState("playing");
      void el.play().catch(() => setState("paused"));
    }
  };

  const skipRef = () => {
    const p = playRef.current;
    if (p && p.phases[p.step] === "ref" && p.step + 1 < p.phases.length) {
      runPhase(p.index, p.phases, p.step + 1);
    }
  };

  // ── 지금 보고 있는 장 ─────────────────────────────────────────────────
  // 끝에서 세 장 남으면 다음 페이지를 부른다 — 넘기다가 로딩을 마주치지 않게.
  const loadMoreRef = useRef<() => void>(() => {});
  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const i = Number((e.target as HTMLElement).dataset.index);
          setActive(i);
          if (i >= itemsRef.current.length - 3) loadMoreRef.current();
        }
      },
      { root, threshold: 0.6 },
    );
    root.querySelectorAll("[data-index]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items.length, nextOffset]);

  // 장이 바뀌면 그 장을 튼다(첫 탭 이후에만). 이 요소는 이미 풀려 있어서 제스처 없이도 된다.
  useEffect(() => {
    if (!unlocked) return;
    // 첫 탭(unlock)이 이미 이 장을 틀었다. 여기서 또 틀면 처음부터 다시 시작한다.
    if (playRef.current?.index === active) return;
    if (active < itemsRef.current.length) startAt(active);
    else stop();
  }, [active, unlocked, startAt, stop]);

  // 다른 탭으로 가면 멈춘다. 돌아와서 저절로 소리가 나면 놀란다.
  useEffect(() => {
    const onHide = () => {
      if (document.hidden && playRef.current?.state === "playing") {
        audio.current?.pause();
        setState("paused");
      }
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, []);

  // 다음 사람 녹음을 미리 받아 둔다 — 넘기자마자 나와야 넘기는 맛이 난다.
  const preloader = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const next = items[active + 1];
    const url = next ? (next.kind === "take" && !refFirst ? next.audioUrl : next.refUrl) : null;
    if (!url) return;
    const a = new Audio();
    a.preload = "auto";
    a.src = url;
    preloader.current = a;
  }, [active, items, refFirst]);

  // ── 다음 페이지 ─────────────────────────────────────────────────────────
  const loadMore = useCallback(async () => {
    if (loading || nextOffset === null) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/feed?sort=${sort}&offset=${nextOffset}`);
      if (!res.ok) throw new Error();
      const page = (await res.json()) as FeedPage;
      setItems((list) => {
        const seen = new Set(list.map((x) => x.id));
        return [...list, ...page.items.filter((x) => !seen.has(x.id))];
      });
      setNextOffset(page.nextOffset);
    } catch {
      flash("다음 걸 못 불러왔어. 잠시 뒤 다시 넘겨봐");
    } finally {
      setLoading(false);
    }
  }, [flash, loading, nextOffset, sort]);

  useEffect(() => {
    loadMoreRef.current = () => void loadMore();
  }, [loadMore]);

  // ── 키보드 (데스크톱) ──────────────────────────────────────────────────
  const goTo = useCallback((i: number) => {
    const el = scroller.current?.querySelector<HTMLElement>(`[data-index="${i}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (sheet || (e.target as HTMLElement)?.closest("input, textarea")) return;
      if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === "j") {
        e.preventDefault();
        goTo(active + 1);
      } else if (e.key === "ArrowUp" || e.key === "PageUp" || e.key === "k") {
        e.preventDefault();
        goTo(Math.max(0, active - 1));
      } else if (e.key === " ") {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ── 반응 · 신고 · 내리기 ──────────────────────────────────────────────
  const patch = (id: string, fn: (t: FeedTake) => FeedTake) =>
    setItems((list) => list.map((x) => (x.id === id && x.kind === "take" ? fn(x) : x)));

  const react = async (item: FeedTake, kind: "same" | "funny") => {
    if (!viewerId) {
      setSheet({ type: "login", next: `/feed?r=${item.id}`, why: "반응을 남기려면 로그인이 필요해" });
      return;
    }
    if (item.mine) {
      flash("내 녹음엔 반응을 못 남겨");
      return;
    }
    const on = kind === "same" ? !item.mySame : !item.myFunny;
    const apply = (t: FeedTake, dir: boolean): FeedTake =>
      kind === "same"
        ? { ...t, mySame: dir, same: Math.max(0, t.same + (dir ? 1 : -1)) }
        : { ...t, myFunny: dir, funny: Math.max(0, t.funny + (dir ? 1 : -1)) };
    patch(item.id, (t) => apply(t, on));

    const db = createClient();
    const { error } = on
      ? await db.from("reactions").insert({ recording_id: item.id, user_id: viewerId, kind })
      : await db
          .from("reactions")
          .delete()
          .match({ recording_id: item.id, user_id: viewerId, kind });
    // 23505 — 이미 눌러져 있었다(다른 탭에서). 화면이 맞는 상태라 되돌리지 않는다.
    if (error && error.code !== "23505") {
      patch(item.id, (t) => apply(t, !on));
      flash("반응이 안 남았어. 다시 눌러줄래?");
      return;
    }
    if (on) track("feed_react", { meme_id: item.meme.id, via: kind });
  };

  /** 목록에서 한 장을 빼고, 지금 자리에 온 다음 장을 튼다. */
  const drop = (id: string) => {
    const idx = itemsRef.current.findIndex((x) => x.id === id);
    const list = itemsRef.current.filter((x) => x.id !== id);
    itemsRef.current = list;
    setItems(list);
    if (idx === active && unlocked) {
      if (active < list.length) startAt(active);
      else stop();
    }
  };

  const share = async (item: FeedTake) => {
    const url = `${window.location.origin}/p/${item.id}`;
    const text = `${item.nickname ?? "누군가"}의 ${item.meme.title} ${item.score}점 — 들어봐`;
    setSheet(null);
    try {
      if (navigator.share) {
        await navigator.share({ title: text, text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      flash("링크 복사했어");
    } catch {
      // 공유 창을 닫은 것 — 아무 일도 없던 걸로.
    }
  };

  const report = async (item: FeedTake) => {
    if (!viewerId) {
      setSheet({ type: "login", next: `/feed?r=${item.id}`, why: "신고하려면 로그인이 필요해" });
      return;
    }
    const { error } = await createClient()
      .from("reports")
      .insert({ recording_id: item.id, reporter_id: viewerId, reason: "feed" });
    setSheet(null);
    if (error && error.code !== "23505") {
      flash("신고가 안 됐어. 잠시 뒤 다시 해줄래?");
      return;
    }
    drop(item.id);
    flash("신고했어. 이 녹음은 바로 가렸어");
  };

  const unpublish = async (item: FeedTake) => {
    const { error } = await createClient()
      .from("recordings")
      .update({ is_public: false })
      .eq("id", item.id);
    setSheet(null);
    if (error) {
      flash("못 내렸어. 잠시 뒤 다시 해줄래?");
      return;
    }
    drop(item.id);
    flash("피드에서 내렸어. 프로필엔 그대로 있어");
  };

  // ── 그리기 ──────────────────────────────────────────────────────────────
  const cur = play ? items[play.index] : null;
  const phase = play ? play.phases[play.step] : null;
  const src = cur && phase ? (phase === "ref" ? cur.refUrl : cur.kind === "take" ? cur.audioUrl : null) : null;
  const level = usePlaybackLevel(audio, src, play?.state === "playing");
  const ended = nextOffset === null;

  return (
    <div className={styles.root}>
      <audio
        ref={audio}
        preload="auto"
        onEnded={onEnded}
        onError={() => void onError()}
        onTimeUpdate={onTimeUpdate}
        onPlay={() => setState("playing")}
        onPause={() => {
          if (playRef.current?.state === "playing" && !audio.current?.ended) setState("paused");
        }}
      />

      <header className={styles.top}>
        <Link href="/" className={styles.home} aria-label="홈으로">
          ←
        </Link>
        <nav className={styles.tabs} aria-label="피드 정렬">
          {TABS.map((t) => (
            <Link
              key={t.sort}
              href={t.sort === "hot" ? "/feed" : `/feed?tab=${t.sort}`}
              className={`${styles.tab} ${t.sort === sort ? styles.tabOn : ""}`}
              aria-current={t.sort === sort ? "page" : undefined}
              replace
            >
              {t.label}
            </Link>
          ))}
        </nav>
        <button
          type="button"
          className={`${styles.refToggle} ${refFirst ? styles.refToggleOn : ""}`}
          onClick={toggleRefFirst}
          aria-pressed={refFirst}
          title="넘길 때마다 원본을 먼저 들을지"
        >
          원본 먼저
        </button>
      </header>

      <div ref={scroller} className={styles.scroller}>
        {items.map((item, i) => (
          <Slide
            key={item.id}
            item={item}
            index={i}
            total={items.length}
            accent={ACCENTS[i % ACCENTS.length]}
            isActive={i === active}
            unlocked={unlocked}
            phases={item.kind === "take" ? (refFirst ? ["ref", "take"] : ["take"]) : ["ref"]}
            play={play?.index === i ? play : null}
            progress={progress}
            level={play?.index === i ? level : 0}
            onTap={togglePlay}
            onSkipRef={skipRef}
            onReact={react}
            onMenu={(t) => setSheet({ type: "menu", item: t })}
          />
        ))}

        <section className={`${styles.slide} ${styles.endSlide}`} data-index={items.length}>
          {ended ? (
            <div className={styles.end}>
              <p className={styles.endEmoji} aria-hidden="true">
                👀
              </p>
              <h2 className={styles.endTitle}>여기까지 다 봤어</h2>
              <p className={styles.endText}>이제 네 차례. 올리면 여기서 사람들이 원본이랑 나란히 들어.</p>
              <Link href="/" className={styles.cta}>
                대사 골라서 따라하기
              </Link>
              <Link href="/create" className={styles.endLink}>
                🎤 내 소리로 챌린지 만들기 →
              </Link>
            </div>
          ) : (
            <p className={styles.loading} aria-live="polite">
              다음 사람 데려오는 중…
            </p>
          )}
        </section>
      </div>

      {toast && (
        <p className={styles.toast} role="status">
          {toast}
        </p>
      )}

      {sheet && (
        <SheetView
          sheet={sheet}
          onClose={() => setSheet(null)}
          onShare={share}
          onAskReport={(item) => setSheet({ type: "menu", item, confirmReport: true })}
          onReport={report}
          onUnpublish={unpublish}
          loggedIn={loggedIn}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 한 장
// ─────────────────────────────────────────────────────────────────────────

function Slide({
  item,
  index,
  total,
  accent,
  isActive,
  unlocked,
  phases,
  play,
  progress,
  level,
  onTap,
  onSkipRef,
  onReact,
  onMenu,
}: {
  item: FeedItem;
  index: number;
  total: number;
  accent: (typeof ACCENTS)[number];
  isActive: boolean;
  unlocked: boolean;
  phases: Phase[];
  play: Play | null;
  progress: number;
  level: number;
  onTap: () => void;
  onSkipRef: () => void;
  onReact: (item: FeedTake, kind: "same" | "funny") => void;
  onMenu: (item: FeedTake) => void;
}) {
  const take = item.kind === "take" ? item : null;
  const takes = item.kind === "challenge" ? item.takes : 0;
  const phase = play ? play.phases[play.step] : null;
  const state = play?.state ?? null;
  const hearingRef = phase === "ref";
  const who = take?.nickname ? `@${take.nickname}` : "익명";

  // 지금 무엇이 들리는지 — 원본과 그 사람이 번갈아 나오므로 늘 밝혀 둔다.
  const nowLabel = !play
    ? take
      ? who
      : "원본"
    : hearingRef
      ? `원본 · ${item.meme.source}`
      : who;

  return (
    <section
      className={`${styles.slide} ${styles[accent]}`}
      data-index={index}
      aria-roledescription="slide"
      aria-label={`${index + 1} / ${total} · ${item.meme.title}${take ? ` · ${who}` : " · 원본"}`}
    >
      <div className={styles.frame}>
        <div className={styles.progress} aria-hidden="true">
          {phases.map((p, i) => {
            const fill = !play
              ? 0
              : i < play.step || (i === play.step && state === "done")
                ? 1
                : i === play.step
                  ? progress
                  : 0;
            return (
              <span key={i} className={styles.seg}>
                <span
                  className={`${styles.segFill} ${fill < 0 ? styles.segFlow : ""} ${p === "ref" ? styles.segRef : ""}`}
                  style={{ width: fill < 0 ? "100%" : `${fill * 100}%` }}
                />
              </span>
            );
          })}
        </div>

        <button
          type="button"
          className={styles.stage}
          onClick={onTap}
          aria-label={state === "playing" ? "일시정지" : "재생"}
          tabIndex={isActive ? 0 : -1}
        >
          <span className={`${styles.now} ${hearingRef ? styles.nowRef : ""}`}>{nowLabel}</span>

          <span className={`${styles.bubble} ${state === "playing" ? styles.bubbleOn : ""}`}>
            {item.meme.line}
          </span>

          {take ? (
            <span className={`${styles.performer} ${hearingRef ? styles.performerWait : ""}`}>
              <VoiceAvatar avatar={take.avatar} level={hearingRef ? 0 : level} size={196} />
              {hearingRef && (
                <span className={styles.refBadge}>
                  <span style={{ transform: `scale(${1 + level * 0.45})` }}>{item.meme.emoji}</span>
                  원본 듣는 중
                </span>
              )}
            </span>
          ) : (
            <span
              className={styles.origin}
              style={{ "--lv": state === "playing" ? level : 0 } as CSSProperties}
            >
              <span>{item.meme.emoji}</span>
            </span>
          )}

          {isActive && !unlocked && (
            <span className={styles.unlock}>
              <b>▶</b>
              탭해서 소리 켜기
            </span>
          )}
          {unlocked && state === "paused" && (
            <span className={styles.pauseMark} aria-hidden="true">
              ▶
            </span>
          )}
          {unlocked && state === "done" && <span className={styles.again}>↻ 다시 듣기</span>}
        </button>

        {hearingRef && take && state !== "done" && (
          <button type="button" className={styles.skip} onClick={onSkipRef}>
            원본 건너뛰기 ⏭
          </button>
        )}

        {take && (
          <aside className={styles.rail} aria-label="반응">
            <RailButton
              icon="🎯"
              label="똑같다"
              count={take.same}
              on={take.mySame}
              disabled={take.mine}
              onClick={() => onReact(take, "same")}
            />
            <RailButton
              icon="😂"
              label="웃기다"
              count={take.funny}
              on={take.myFunny}
              disabled={take.mine}
              onClick={() => onReact(take, "funny")}
            />
            <button type="button" className={styles.railBtn} onClick={() => onMenu(take)}>
              <span className={styles.railIcon} aria-hidden="true">
                •••
              </span>
              <span className={styles.railLabel}>더보기</span>
            </button>
          </aside>
        )}

        <footer className={styles.info}>
          <p className={styles.meme}>
            <span aria-hidden="true">{item.meme.emoji}</span> {item.meme.title}
            <span className={styles.source}>{item.meme.source}</span>
          </p>
          {take ? (
            <p className={styles.byline}>
              <b>{who}</b>
              {take.mine && <span className={styles.mineTag}>내 녹음</span>}
              <span className={styles.score}>
                {take.score}
                <small>점</small>
              </span>
              {take.grade && <em className={styles.grade}>{take.grade}</em>}
              <span className={styles.ago}>{ago(take.createdAt)}</span>
            </p>
          ) : (
            <p className={styles.byline}>
              {takes === 0 ? (
                <span className={styles.first}>아직 아무도 안 올렸어 · 첫 번째 주인공 자리 비어 있음</span>
              ) : (
                <span>{takes}명이 따라했어</span>
              )}
            </p>
          )}
          <Link
            href={take ? `/record/${item.meme.id}?s=${take.score}` : `/record/${item.meme.id}`}
            className={styles.cta}
            onClick={() => track("feed_try", { meme_id: item.meme.id, via: take ? "take" : "challenge" })}
            tabIndex={isActive ? 0 : -1}
          >
            {take
              ? take.mine
                ? "다시 도전해서 점수 올리기"
                : `나도 해보기 · ${take.score}점 넘어봐`
              : takes === 0
                ? "첫 번째로 따라하기"
                : "나도 따라하기"}
          </Link>
        </footer>
      </div>
    </section>
  );
}

function RailButton({
  icon,
  label,
  count,
  on,
  disabled,
  onClick,
}: {
  icon: string;
  label: string;
  count: number;
  on: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.railBtn} ${on ? styles.railOn : ""}`}
      onClick={onClick}
      aria-pressed={on}
      aria-label={`${label} ${count}`}
      aria-disabled={disabled || undefined}
    >
      <span className={styles.railIcon} aria-hidden="true">
        {icon}
      </span>
      <span className={styles.railLabel}>{count > 0 ? compact(count) : label}</span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 아래에서 올라오는 시트
// ─────────────────────────────────────────────────────────────────────────

function SheetView({
  sheet,
  loggedIn,
  onClose,
  onShare,
  onAskReport,
  onReport,
  onUnpublish,
}: {
  sheet: Sheet;
  loggedIn: boolean;
  onClose: () => void;
  onShare: (item: FeedTake) => void;
  onAskReport: (item: FeedTake) => void;
  onReport: (item: FeedTake) => void;
  onUnpublish: (item: FeedTake) => void;
}) {
  const first = useRef<HTMLButtonElement | HTMLAnchorElement>(null);
  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label={sheet.type === "login" ? "로그인 필요" : "더보기"}
        onClick={(e) => e.stopPropagation()}
      >
        <span className={styles.grip} aria-hidden="true" />

        {sheet.type === "login" ? (
          <>
            <p className={styles.sheetTitle}>{sheet.why}</p>
            <p className={styles.sheetText}>아이디랑 비밀번호만 있으면 돼. 로그인하면 보던 데로 돌아와.</p>
            <Link
              ref={first as Ref<HTMLAnchorElement>}
              href={`/login?next=${encodeURIComponent(sheet.next)}`}
              className={styles.cta}
            >
              로그인하고 계속 보기
            </Link>
            <button type="button" className={styles.sheetBtn} onClick={onClose}>
              그냥 구경할게
            </button>
          </>
        ) : sheet.confirmReport ? (
          <>
            <p className={styles.sheetTitle}>이 녹음 신고할까?</p>
            <p className={styles.sheetText}>
              신고하면 바로 가려지고, 운영자가 듣고 판단해. 욕설·괴롭힘·남의 목소리 도용 같은 거.
            </p>
            <button
              ref={first as Ref<HTMLButtonElement>}
              type="button"
              className={`${styles.sheetBtn} ${styles.sheetDanger}`}
              onClick={() => onReport(sheet.item)}
            >
              신고하고 가리기
            </button>
            <button type="button" className={styles.sheetBtn} onClick={onClose}>
              취소
            </button>
          </>
        ) : (
          <>
            <p className={styles.sheetTitle}>
              {sheet.item.meme.emoji} {sheet.item.meme.title}
              <span className={styles.sheetSub}> · {sheet.item.nickname ? `@${sheet.item.nickname}` : "익명"}</span>
            </p>
            <button
              ref={first as Ref<HTMLButtonElement>}
              type="button"
              className={styles.sheetBtn}
              onClick={() => onShare(sheet.item)}
            >
              ↗ 친구한테 보내기
            </button>
            {sheet.item.mine ? (
              <button type="button" className={styles.sheetBtn} onClick={() => onUnpublish(sheet.item)}>
                피드에서 내리기
                <small>녹음은 프로필에 그대로 남아</small>
              </button>
            ) : (
              <button
                type="button"
                className={`${styles.sheetBtn} ${styles.sheetDanger}`}
                onClick={() => onAskReport(sheet.item)}
              >
                신고하기
                {!loggedIn && <small>로그인이 필요해</small>}
              </button>
            )}
            <button type="button" className={styles.sheetBtn} onClick={onClose}>
              닫기
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────

function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "방금";
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86_400) return `${Math.floor(s / 3600)}시간 전`;
  if (s < 86_400 * 30) return `${Math.floor(s / 86_400)}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

function compact(n: number): string {
  if (n >= 10_000) return `${(n / 10_000).toFixed(1).replace(/\.0$/, "")}만`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}천`;
  return String(n);
}
