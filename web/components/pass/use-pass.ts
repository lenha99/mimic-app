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

/**
 * 같은 패스를 한 화면의 여러 조각(위쪽 바·카드·레벨업)이 동시에 부른다 — 홈에서 같은 요청이 세 번 나갔다.
 * 3초 안의 같은 요청은 하나로 합친다.
 */
const inflight = new Map<string, { at: number; p: Promise<PassView | null> }>();
export function fetchPass(entry?: string): Promise<PassView | null> {
  const q = new URLSearchParams({ client: clientId() });
  if (entry) q.set("entry", entry);
  const key = q.toString();
  const hit = inflight.get(key);
  if (hit && Date.now() - hit.at < 3000) return hit.p;
  const p = fetch(`/api/pass?${key}`, { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<PassView>) : null))
    .catch(() => null);
  inflight.set(key, { at: Date.now(), p });
  return p;
}

/** VOICE PASS — entry 를 주면 그 목소리 주인의 것, 없으면 내 것. */
export function usePass(entry?: string): PassView | null {
  const [v, setV] = useState<PassView | null>(null);
  useEffect(() => {
    let alive = true;
    void fetchPass(entry).then((d) => {
      if (!alive || !d) return;
      setV(d);
    });
    return () => {
      alive = false;
    };
  }, [entry]);
  return v;
}
