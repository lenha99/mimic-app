"use client";

import { useCallback, useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { markSeen, seen } from "@/lib/onboarding";
import { track } from "@/lib/track";
import styles from "./tour.module.css";
import { useT } from "@/components/lang";

/**
 * 화면 사용법 — 실제 버튼을 하나씩 비추며 "이건 뭐고, 누르면 어떻게 되는지" 말해준다.
 *
 * 처음 온 사람이 궁금한 건 "어떻게 소리를 내지"가 아니라 "이 버튼이 뭐지, 어디를 누르지,
 * 올리면 어디로 가지"다. 글로 된 설명서는 안 읽으니, 그 버튼 위에 말풍선을 띄운다.
 *
 * 저절로 뜨지 않는다. 화면을 열자마자 덮어 버리면 뭘 보기도 전에 닫게 된다. 화면마다
 * "사용법 보기" 버튼(TourHelp)이 있고, 홈에 처음 온 사람에겐 그 버튼을 가리키는 인사만 한다.
 * 비출 대상은 `data-tour="..."` 로 찾고, 지금 화면에 없는 대상은 건너뛴다.
 */
export type TourStep = { target: string; title: string; body: ReactNode };

const EVENT = "mimic:tour";
const PAD = 6;

function ask(id: string) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: id }));
}

/**
 * "사용법 보기" 버튼. 그 화면 사용법을 아직 안 봤으면 살짝 숨 쉬듯 빛난다.
 * `corner` 는 머리줄 오른쪽이 비어 있는 화면용: 높이 0 줄에 띄워 레이아웃을 밀지 않는다.
 * `welcome` 은 홈 전용: 처음 온 사람에게 이 버튼을 가리키는 인사 말풍선을 붙인다.
 */
export function TourHelp({
  id,
  corner = false,
  welcome = false,
  short = false,
}: {
  id: string;
  corner?: boolean;
  welcome?: boolean;
  /** 머리줄이 빽빽한 화면에선 "사용법"만 */
  short?: boolean;
}) {
  const t = useT();
  const [fresh, setFresh] = useState(false);
  const [hello, setHello] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFresh(!seen(`tour_${id}`));
    setHello(welcome && !seen("tip_welcome") && !seen(`tour_${id}`));
    const done = (e: Event) => {
      if ((e as CustomEvent).detail === id) setFresh(false);
    };
    window.addEventListener(`${EVENT}:done`, done);
    return () => window.removeEventListener(`${EVENT}:done`, done);
  }, [id, welcome]);

  const open = () => {
    if (hello) markSeen("tip_welcome");
    setHello(false);
    ask(id);
  };

  const body = (
    <span className={styles.helpWrap}>
      <button
        type="button"
        className={`${styles.help} ${fresh ? styles.helpFresh : ""}`}
        onClick={open}
        data-tour="help"
      >
        <span aria-hidden="true">💡</span> {short ? t("사용법", "Help") : t("사용법 보기", "How it works")}
      </button>
      {hello && (
        <span className={styles.hello} role="note">
          <b>{t("반가워요! 👋", "Hey there! 👋")}</b>
          <span>{t("MIMIC 처음이세요? 이 버튼을 누르면 화면 사용법을 하나씩 알려드려요.", "New to MIMIC? Tap here for a quick tour of this screen.")}</span>
          <span className={styles.helloActions}>
            <button
              type="button"
              className={styles.helloLater}
              onClick={() => {
                markSeen("tip_welcome");
                setHello(false);
              }}
            >
              {t("나중에", "Later")}
            </button>
            <button type="button" className={styles.helloGo} onClick={open}>
              {t("사용법 보기", "Show me")}
            </button>
          </span>
        </span>
      )}
    </span>
  );
  return corner ? <div className={styles.corner}>{body}</div> : body;
}

function find(target: string): HTMLElement | null {
  const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? el : null;
}

/**
 * 대상이 화면 가운데쯤 오게 세로로만 굴린다. scrollIntoView 는 가로로 넘치는 줄(캐릭터
 * 고르기 같은)이 있으면 페이지까지 옆으로 밀어서, 안내를 닫은 뒤 화면이 잘려 보였다.
 */
function reveal(el: HTMLElement) {
  if (el.closest("[data-tour='nav']") || getComputedStyle(el).position === "fixed") return;
  const r = el.getBoundingClientRect();
  const vh = window.innerHeight;
  const top = r.height > vh * 0.6 ? r.top - 80 : r.top - (vh - r.height) / 2 + 60;
  window.scrollTo({ top: Math.max(0, window.scrollY + top), left: 0, behavior: "smooth" });
}

export function Tour({ id, steps }: { id: string; steps: TourStep[] }) {
  const t = useT();
  const [live, setLive] = useState<TourStep[] | null>(null);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const start = useCallback(
    (how: string) => {
      const on = steps.filter((s) => find(s.target));
      if (!on.length) return;
      setI(0);
      setLive(on);
      track("intro_view", { via: `${id}:${how}` });
    },
    [id, steps],
  );

  useEffect(() => {
    // "사용법 다시 보기"(/?tour=1)로 왔을 때만 바로 연다.
    const replay = new URLSearchParams(window.location.search).get("tour") === "1";
    const t = replay ? window.setTimeout(() => start("replay"), 500) : 0;
    const onAsk = (e: Event) => {
      if ((e as CustomEvent).detail === id) start("help");
    };
    window.addEventListener(EVENT, onAsk);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener(EVENT, onAsk);
    };
  }, [id, start]);

  const step = live?.[i] ?? null;

  useLayoutEffect(() => {
    if (!step) return;
    const el = find(step.target);
    if (!el) return;
    reveal(el);
    const measure = () => setRect(el.getBoundingClientRect());
    measure();
    const t = window.setTimeout(measure, 420);
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [step]);

  if (!live || !step || !rect) return null;

  const close = (how: "skip" | "done") => {
    markSeen(`tour_${id}`);
    window.dispatchEvent(new CustomEvent(`${EVENT}:done`, { detail: id }));
    setLive(null);
    setRect(null);
    if (window.scrollX) window.scrollTo({ left: 0, top: window.scrollY });
    track(how === "done" ? "intro_done" : "intro_skip", { via: `${id}:${i + 1}` });
    if (window.location.search.includes("tour=1")) {
      const u = new URL(window.location.href);
      u.searchParams.delete("tour");
      window.history.replaceState(null, "", u.pathname + u.search);
    }
  };

  const last = i === live.length - 1;
  const vh = window.innerHeight;
  const below = rect.top + rect.height / 2 < vh * 0.55;
  const bubble: React.CSSProperties = below
    ? { top: Math.min(rect.bottom + PAD + 12, vh - 220) }
    : { bottom: Math.min(vh - rect.top + PAD + 12, vh - 220) };

  return (
    <div className={styles.layer} role="dialog" aria-modal="true" aria-label={t("화면 사용법", "Screen guide")}>
      <div
        className={styles.spot}
        style={{
          top: rect.top - PAD,
          left: rect.left - PAD,
          width: rect.width + PAD * 2,
          height: rect.height + PAD * 2,
        }}
      />
      <div className={styles.bubble} style={bubble}>
        <p className={styles.count}>
          {i + 1} / {live.length}
        </p>
        <p className={styles.title}>{step.title}</p>
        <div className={styles.body}>{step.body}</div>
        <div className={styles.actions}>
          <button type="button" className={styles.skip} onClick={() => close("skip")}>
            {last ? t("닫기", "Close") : t("그만 보기", "Skip")}
          </button>
          {i > 0 && (
            <button type="button" className={styles.prev} onClick={() => setI(i - 1)}>
              {t("이전", "Back")}
            </button>
          )}
          <button type="button" className={styles.next} onClick={() => (last ? close("done") : setI(i + 1))}>
            {last ? t("알겠어요", "Got it") : t("다음", "Next")}
          </button>
        </div>
      </div>
    </div>
  );
}
