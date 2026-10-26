"use client";

import { useCallback, useEffect, useState } from "react";
import { clientId } from "@/lib/client-id";
import { markHeard, readHeard, readMine, writeMine } from "@/lib/weekly";
import { useT } from "@/components/lang";

/**
 * 챌린지 화면에서 "나"에 관한 것 — 내가 ❤ 누른 것, 내 출전작, 끝까지 들은 것.
 *
 * 페이지는 정적이라 서버가 누군지 모른다. 붙은 뒤에 /api/weekly/me 로 묻고, 게스트
 * 출전작은 이 기기의 기록(readMine)으로 안다.
 */
export function useWeeklyMe(weekId: string) {
  const t = useT();
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [mineId, setMineId] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [heard, setHeard] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    // 기기에 남긴 것부터 — 서버 답을 기다리는 동안에도 내 출전작은 내 것으로 보인다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHeard(readHeard());
    const local = readMine()[weekId];
    if (local) setMineId(local.entryId);
    void fetch(`/api/weekly/me?client=${encodeURIComponent(clientId())}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { week: string; loggedIn: boolean; liked: string[]; mine: string | null } | null) => {
        if (!alive || !d) return;
        setLoggedIn(d.loggedIn);
        if (d.week === weekId) {
          setLiked(new Set(d.liked));
          if (d.mine) setMineId(d.mine);
        }
      })
      .catch(() => {})
      .finally(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, [weekId]);

  const hear = useCallback((id: string) => {
    markHeard(id);
    setHeard((s) => new Set(s).add(id));
  }, []);

  /** ❤ 토글. 성공하면 서버가 센 최신 ❤ 수를 돌려준다. 실패하면 사람이 읽을 이유를 던진다. */
  const toggleLike = useCallback(
    async (id: string): Promise<{ liked: boolean; likes: number }> => {
      const on = !liked.has(id);
      setLiked((s) => {
        const n = new Set(s);
        if (on) n.add(id);
        else n.delete(id);
        return n;
      });
      try {
        const res = await fetch(`/api/weekly/entries/${id}/like`, {
          method: on ? "POST" : "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ client: clientId() }),
        });
        const d = (await res.json().catch(() => ({}))) as { liked?: boolean; likes?: number; error?: string };
        if (!res.ok || typeof d.likes !== "number") throw new Error(d.error ?? t("❤ 가 안 눌렸어요. 다시 시도해 주세요", "Couldn't send ❤. Try again"));
        return { liked: on, likes: d.likes };
      } catch (e) {
        setLiked((s) => {
          const n = new Set(s);
          if (on) n.delete(id);
          else n.add(id);
          return n;
        });
        throw e;
      }
    },
    [liked, t],
  );

  const forgetMine = useCallback(() => {
    writeMine(weekId, null);
    setMineId(null);
  }, [weekId]);

  return { liked, mineId, loggedIn, heard, hear, toggleLike, forgetMine, ready };
}

/** 링크 공유 — 폰이면 공유 시트, 아니면 복사. 무엇을 했는지 돌려준다. */
export async function shareLink(url: string, text: string): Promise<"shared" | "copied" | "failed"> {
  try {
    if (navigator.share) {
      await navigator.share({ title: "MIMIC", text, url });
      return "shared";
    }
  } catch (e) {
    // 공유 시트를 닫은 건 실패가 아니다.
    if (e instanceof DOMException && e.name === "AbortError") return "failed";
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    return "copied";
  } catch {
    return "failed";
  }
}

export function buzz(ms = 12): void {
  try {
    navigator.vibrate?.(ms);
  } catch {}
}
