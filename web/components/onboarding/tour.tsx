"use client";

import { useCallback, useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { markSeen, seen } from "@/lib/onboarding";
import { track } from "@/lib/track";
import styles from "./tour.module.css";

/**
 * 화면 사용법 — 실제 버튼을 하나씩 비추며 "이건 뭐고, 누르면 어떻게 되는지" 말해준다.
 *
 * 처음 온 사람이 궁금한 건 "어떻게 소리를 내지"가 아니라 "이 버튼이 뭐지, 어디를 누르지,
 * 올리면 어디로 가지"다. 글로 된 설명서는 안 읽으니, 그 버튼 위에 말풍선을 띄운다.
 *
 * 화면마다 처음 한 번만 저절로 뜨고, 그 뒤엔 화면의 ? 버튼(TourHelp)으로 다시 연다.
 * 비출 대상은 `data-tour="..."` 로 찾는다. 지금 화면에 없는 대상(로그인 안 해서 안 보이는
 * 버튼 등)은 건너뛴다.
 */
export type TourStep = { target: string; title: string; body: ReactNode };

const EVENT = "mimic:tour";
const PAD = 6;

/**
 * 화면 위쪽에 두는 "?" — 누르면 그 화면 사용법을 다시 띄운다.
 * `corner` 는 머리줄 오른쪽이 비어 있는 화면용: 높이 0 줄에 띄워 레이아웃을 밀지 않는다.
 */
export function TourHelp({ id, corner = false }: { id: string; corner?: boolean }) {
  const button = (
    <button
      type="button"
      className={styles.help}
      aria-label="이 화면 사용법"
      data-tour="help"
      onClick={() => window.dispatchEvent(new CustomEvent(EVENT, { detail: id }))}
    >
      ?
    </button>
  );
  return corner ? <div className={styles.corner}>{button}</div> : button;
}

function find(target: string): HTMLElement | null {
  const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? el : null;
}

export function Tour({ id, steps, auto = true }: { id: string; steps: TourStep[]; auto?: boolean }) {
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
    const replay = new URLSearchParams(window.location.search).get("tour") === "1";
    let t = 0;
    if (replay || (auto && !seen(`tour_${id}`))) t = window.setTimeout(() => start(replay ? "replay" : "first"), 700);
    const onAsk = (e: Event) => {
      if ((e as CustomEvent).detail === id) start("help");
    };
    window.addEventListener(EVENT, onAsk);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener(EVENT, onAsk);
    };
  }, [id, start, auto]);

  const step = live?.[i] ?? null;

  // 대상을 화면 가운데로 굴린 뒤 자리를 잰다. 스크롤·회전이 일어나면 다시 잰다.
  useLayoutEffect(() => {
    if (!step) return;
    const el = find(step.target);
    if (!el) return;
    const fixed = getComputedStyle(el).position === "fixed" || !!el.closest("nav[aria-label='주 메뉴']");
    if (!fixed) el.scrollIntoView({ block: "center", behavior: "smooth" });
    const measure = () => setRect(el.getBoundingClientRect());
    measure();
    const t = window.setTimeout(measure, 380);
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
    setLive(null);
    setRect(null);
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
    ? { top: Math.min(rect.bottom + PAD + 12, vh - 200) }
    : { bottom: Math.min(vh - rect.top + PAD + 12, vh - 200) };

  return (
    <div className={styles.layer} role="dialog" aria-modal="true" aria-label="화면 사용법">
      <div
        className={styles.spot}
        style={{
          top: rect.top - PAD,
          left: rect.left - PAD,
          width: rect.width + PAD * 2,
          height: rect.height + PAD * 2,
        }}
      />
      <div className={`${styles.bubble} ${below ? styles.down : styles.up}`} style={bubble}>
        <p className={styles.count}>
          {i + 1} / {live.length}
        </p>
        <p className={styles.title}>{step.title}</p>
        <div className={styles.body}>{step.body}</div>
        <div className={styles.actions}>
          <button type="button" className={styles.skip} onClick={() => close("skip")}>
            {last ? "닫기" : "건너뛰기"}
          </button>
          {i > 0 && (
            <button type="button" className={styles.prev} onClick={() => setI(i - 1)}>
              이전
            </button>
          )}
          <button type="button" className={styles.next} onClick={() => (last ? close("done") : setI(i + 1))}>
            {last ? "알겠어요" : "다음"}
          </button>
        </div>
      </div>
    </div>
  );
}
