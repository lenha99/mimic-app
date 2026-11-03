"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useT } from "@/components/lang";
import { buzz } from "@/components/weekly/use-weekly";
import { clientId } from "@/lib/client-id";
import { track } from "@/lib/track";
import ps from "@/components/pass/pass.module.css";

/**
 * 갤러리 ❤ — 목록에서 바로 누른다.
 *
 * 예전엔 목록의 ❤ 가 숫자만 보여 주는 링크라, 갤러리에서 바로 듣는 사람은 누를 길이 없었다
 * (11/3 홍보 이틀: 갤러리에서 들은 사람 약 10명, ❤ 0). 누르고 나면 "나도 이 대본 읽어 보기"로
 * 이어 준다 — 듣는 사람을 올리는 사람으로 바꾸는 길.
 */
type Likes = {
  liked: (id: string) => boolean;
  count: (id: string, base: number) => number;
  toggle: (id: string) => Promise<void>;
  /** 방금 ❤ 한 목소리 — 그 카드 아래에 "나도 읽어 보기"를 띄운다 */
  fresh: string | null;
  note: { id: string; text: string } | null;
};

const Ctx = createContext<Likes | null>(null);

export function useLikes(): Likes | null {
  return useContext(Ctx);
}

export function LikesProvider({ ids, children }: { ids: string[]; children: ReactNode }) {
  const t = useT();
  const [pop, setPop] = useState(0);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [fresh, setFresh] = useState<string | null>(null);
  const [note, setNote] = useState<{ id: string; text: string } | null>(null);
  const key = ids.join(",");

  useEffect(() => {
    if (!key) return;
    let alive = true;
    void fetch(`/api/weekly/me?client=${encodeURIComponent(clientId())}&ids=${key}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { likedAny?: string[] } | null) => {
        if (alive && d?.likedAny) setLiked(new Set(d.likedAny));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [key]);

  const toggle = useCallback(
    async (id: string) => {
      const on = !liked.has(id);
      buzz();
      const flip = (v: boolean) =>
        setLiked((s) => {
          const n = new Set(s);
          if (v) n.add(id);
          else n.delete(id);
          return n;
        });
      flip(on);
      setNote(null);
      try {
        const res = await fetch(`/api/weekly/entries/${id}/like`, {
          method: on ? "POST" : "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ client: clientId() }),
        });
        const d = (await res.json().catch(() => ({}))) as { likes?: number; error?: string; xp?: number };
        if (!res.ok || typeof d.likes !== "number") throw new Error(d.error ?? t("❤ 가 안 눌렸어요. 다시 시도해 주세요", "Couldn't send ❤. Try again"));
        setCounts((m) => new Map(m).set(id, d.likes!));
        if (on) {
          setFresh(id);
          // 게임처럼 — 누르자마자 +3 XP 가 떠오른다(VOICE PASS).
          if (d.xp) setPop((n) => n + 1);
          track("weekly_like", { via: "gallery" });
        } else if (fresh === id) setFresh(null);
      } catch (e) {
        flip(!on);
        setNote({ id, text: e instanceof Error ? e.message : String(e) });
      }
    },
    [liked, fresh, t],
  );

  const value = useMemo<Likes>(
    () => ({
      liked: (id) => liked.has(id),
      count: (id, base) => counts.get(id) ?? base,
      toggle,
      fresh,
      note,
    }),
    [liked, counts, toggle, fresh, note],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {pop > 0 && (
        <p key={pop} className={ps.xpPop} role="status">
          +3 XP
        </p>
      )}
    </Ctx.Provider>
  );
}
