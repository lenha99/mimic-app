"use client";

import { useEffect, useState } from "react";
import { fromOriginal, type HypeScore, type OriginalScore } from "@/lib/anime";
import { clientId } from "@/lib/client-id";

/**
 * 원본 클립 — 애니 혼자 외치기와 명대사 대결(영화·애니)이 같이 쓴다.
 * /api/ref 가 200 이면 원본이 올라가 있다(anime_<id>, draft 라 밈 목록엔 안 뜬다).
 * 없으면 404 이고, 그땐 브라우저 기합 점수(최대 89)로 간다.
 */
async function probeRef(id: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/ref/${id}`);
    if (!res.ok) return null;
    return URL.createObjectURL(await res.blob());
  } catch {
    return null;
  }
}

/** 원본 소리 주소(blob:) — 없으면 null. 대사가 바뀌면 다시 찾는다. */
export function useOriginal(refId: string | null): string | null {
  const [state, setState] = useState<{ id: string; url: string | null } | null>(null);
  useEffect(() => {
    if (!refId) return;
    let alive = true;
    let made: string | null = null;
    void probeRef(refId).then((u) => {
      made = u;
      if (alive) setState({ id: refId, url: u });
      else if (u) URL.revokeObjectURL(u);
    });
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [refId]);
  return state && state.id === refId ? state.url : null;
}

/**
 * 원본과 견준 점수 — 서버(modal_app._score). 애니는 profile="anime", 영화 대사(movie)는 밈 기준 —
 * /record 에서 받는 점수와 같다. 실패하면 null(추정치로 간다).
 */
export async function scoreWithOriginal(refId: string, takeUrl: string, movie = false): Promise<HypeScore | null> {
  try {
    const blob = await (await fetch(takeUrl)).blob();
    const body = new FormData();
    body.append("file", blob, "recording.webm");
    const res = await fetch(`/api/score?meme_id=${encodeURIComponent(refId)}${movie ? "" : "&profile=anime"}&client=${encodeURIComponent(clientId())}`, {
      method: "POST",
      body,
    });
    const data = (await res.json()) as OriginalScore & { error?: string };
    if (!res.ok || data.error || typeof data.score !== "number") return null;
    return fromOriginal(data, movie);
  } catch {
    return null;
  }
}

/** 서버 채점 컨테이너를 미리 깨운다 — 녹음하는 동안 데워 둔다 */
export function warmScorer() {
  void fetch("/api/warm", { method: "POST" }).catch(() => {});
}
