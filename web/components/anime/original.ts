"use client";

import { useEffect, useState } from "react";
import { fromOriginal, type HypeScore, type OriginalScore } from "@/lib/anime";
import { clientId } from "@/lib/client-id";

/**
 * 원본 클립 — 애니 혼자 외치기와 명대사 대결(영화·애니)이 같이 쓴다.
 * 여기서 받는 건 "들려주기"용일 뿐이다. 채점은 서버가 자기가 가진 원본과 견주므로,
 * 화면이 원본을 다 받기 전에 외쳐도 점수는 똑같이 원본 비교로 나온다.
 */
// 대사당 한 번만 받는다 — 대결은 판이 바뀔 때마다 다시 받느라 원본이 늦게 떴다.
// 클립은 몇십 KB 라 페이지가 살아 있는 동안 들고 있어도 된다(그래서 revoke 하지 않는다).
const cache = new Map<string, Promise<string | null>>();

function probeRef(id: string): Promise<string | null> {
  let p = cache.get(id);
  if (!p) {
    p = fetch(`/api/ref/${id}`)
      .then(async (res) => (res.ok ? URL.createObjectURL(await res.blob()) : null))
      .catch(() => null);
    // 실패는 기억하지 않는다 — 다음에 다시 시도
    void p.then((u) => {
      if (!u) cache.delete(id);
    });
    cache.set(id, p);
  }
  return p;
}

/** 대결 시작할 때 이번 판들 원본을 한꺼번에 받아 둔다 */
export function prefetchOriginals(ids: string[]) {
  ids.forEach((id) => void probeRef(id));
}

/** 원본 소리 주소(blob:) — 받는 중이면 undefined, 없으면 null. 대사가 바뀌면 다시 찾는다. */
export function useOriginal(refId: string | null): string | null | undefined {
  const [state, setState] = useState<{ id: string; url: string | null } | null>(null);
  useEffect(() => {
    if (!refId) return;
    let alive = true;
    void probeRef(refId).then((u) => {
      if (alive) setState({ id: refId, url: u });
    });
    return () => {
      alive = false;
    };
  }, [refId]);
  return state && state.id === refId ? state.url : undefined;
}

/**
 * 원본과 견준 점수 — 서버(modal_app._score). 애니는 profile="anime", 영화 대사(movie)는 밈 기준 —
 * /record 에서 받는 점수와 같다. 실패하면 null — 화면은 지어낸 점수 대신 "다시 외치기"를 띄운다.
 * 녹음이 멈추는 즉시 부른다(브라우저 분석을 기다리지 않는다).
 */
export async function scoreWithOriginal(refId: string, blob: Blob, movie = false): Promise<HypeScore | null> {
  try {
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

/** 서버 채점 컨테이너를 미리 깨운다 */
export function warmScorer() {
  void fetch("/api/warm", { method: "POST" }).catch(() => {});
}

/**
 * 화면이 열리는 순간 깨우고, 화면에 머무는 동안 4분마다 한 번 더 — 콜드 스타트가 40초를 넘긴 적이 있다.
 * 예전엔 외치기 버튼을 누를 때 처음 깨워서, 차가운 서버면 그 기다림이 점수 직전에 떨어졌다.
 * 탭이 가려져 있으면 안 찌른다(돌아오면 바로 한 번).
 */
export function useWarmScorer() {
  useEffect(() => {
    warmScorer();
    let last = Date.now();
    const poke = () => {
      if (document.visibilityState !== "visible" || Date.now() - last < 4 * 60_000) return;
      last = Date.now();
      warmScorer();
    };
    const id = window.setInterval(poke, 30_000);
    document.addEventListener("visibilitychange", poke);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", poke);
    };
  }, []);
}
