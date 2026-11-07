"use client";

import { useEffect, useMemo, useState, type ComponentProps } from "react";
import { useT } from "@/components/lang";
import { track } from "@/lib/track";
import Gallery from "./gallery";
import Hub from "./hub";
import styles from "./views.module.css";

type View = "rank" | "gallery";

/**
 * 순위판이 열린 뒤(이번 주 RANKED_MIN 명 이상)의 목소리 탭 — 순위 | 갤러리.
 *
 * 순위판만 보여 주면 갤러리에서 하던 💬 댓글 · 🎯 피드백 · 지난 목소리가 통째로 사라졌다(11/7).
 * 순위는 경쟁, 갤러리는 듣고 말 거는 곳 — 둘 다 남기고 위에서 바꿔 본다.
 * 연습실 입구 등에서 ?f=feedback(또는 ?v=gallery)으로 들어오면 갤러리부터.
 */
export default function WeeklyViews({
  hub,
  gallery,
}: {
  hub: Omit<ComponentProps<typeof Hub>, "switcher" | "talk">;
  gallery: Omit<ComponentProps<typeof Gallery>, "switcher">;
}) {
  const t = useT();
  const [view, setView] = useState<View>("rank");
  const talk = useMemo(
    () => Object.fromEntries(gallery.entries.map((e) => [e.id, { notes: e.notes, feedbacks: e.feedbacks }])),
    [gallery.entries],
  );

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (q.get("f") === "feedback" || q.get("v") === "gallery") setView("gallery");
  }, []);

  const pick = (v: View) => {
    if (v === view) return;
    setView(v);
    window.scrollTo({ top: 0 });
    track("weekly_view", { via: `tab:${v}` });
  };

  const switcher = (
    <div className={styles.seg} role="tablist" aria-label={t("보기", "View")}>
      <button type="button" role="tab" aria-selected={view === "rank"} onClick={() => pick("rank")}>
        🏆 {t("이번 주 순위", "This week's ranking")}
      </button>
      <button type="button" role="tab" aria-selected={view === "gallery"} onClick={() => pick("gallery")}>
        💬 {t("갤러리 · 댓글 · 피드백", "Gallery · comments")}
      </button>
    </div>
  );

  return view === "rank" ? <Hub {...hub} switcher={switcher} talk={talk} /> : <Gallery {...gallery} switcher={switcher} />;
}
