"use client";

import { useEffect, useState } from "react";
import { clientId } from "./client-id";
import { syncPush } from "./push-client";

/**
 * 안 읽은 수 — 🔔 활동 · 💬 메시지. 위쪽 바와 하단 탭이 같은 값을 쓴다.
 *
 * 화면마다 따로 물으면 요청이 겹친다. 한 곳에서 30초에 한 번만 묻고, 기다리는 화면들에
 * 같은 답을 나눠 준다. 알림·메시지 화면에 들어가면(읽음 처리) 바로 다시 묻는다.
 */
export type Unread = { activity: number; dm: number };

let last: Unread = { activity: 0, dm: 0 };
let at = 0;
let inflight: Promise<Unread> | null = null;
const listeners = new Set<(u: Unread) => void>();

function load(): Promise<Unread> {
  inflight ??= (async () => {
    let claim = "";
    try {
      // 로그인 직후 한 번 — 손님일 때 한 구독을 계정으로 옮긴다(로그인 안 했으면 서버가 무시).
      if (!localStorage.getItem("mimic.claimed")) claim = clientId();
    } catch {}
    try {
      const r = await fetch(`/api/notifications?count=1${claim ? `&claim=${encodeURIComponent(claim)}` : ""}`);
      const d = (await r.json()) as { activity?: number; unread?: number; dm?: number; claimed?: boolean };
      if (d.claimed) {
        try {
          localStorage.setItem("mimic.claimed", "1");
        } catch {}
      }
      last = { activity: d.activity ?? d.unread ?? 0, dm: d.dm ?? 0 };
    } catch {}
    at = Date.now();
    inflight = null;
    listeners.forEach((fn) => fn(last));
    void syncPush();
    return last;
  })();
  return inflight;
}

export function useUnread(path: string): Unread {
  const [u, setU] = useState<Unread>(last);
  useEffect(() => {
    listeners.add(setU);
    const fresh = /\/(me|profile|notifications|messages)/.test(path);
    if (fresh || Date.now() - at > 30_000) void load();
    return () => {
      listeners.delete(setU);
    };
  }, [path]);
  return u;
}
