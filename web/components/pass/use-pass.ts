"use client";

import { useEffect, useState } from "react";
import { clientId } from "@/lib/client-id";
import type { Look, PassStats, Unlock } from "@/lib/pass";

export type PassView = {
  stats: PassStats;
  xp: number;
  look: Look;
  progress: { level: number; into: number; need: number; ratio: number };
  next: Unlock | null;
  self: boolean;
  /** 내 것일 때만 — 도감에 모은 목소리 타입 id */
  dexIds?: string[];
};

/** VOICE PASS — entry 를 주면 그 목소리 주인의 것, 없으면 내 것. */
export function usePass(entry?: string): PassView | null {
  const [v, setV] = useState<PassView | null>(null);
  useEffect(() => {
    let alive = true;
    const q = new URLSearchParams({ client: clientId() });
    if (entry) q.set("entry", entry);
    void fetch(`/api/pass?${q}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: PassView | null) => {
        if (!alive || !d) return;
        setV(d);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [entry]);
  return v;
}
