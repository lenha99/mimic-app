"use client";

import { useEffect } from "react";
import { track } from "@/lib/track";

/**
 * 홈이 열리면 두 가지를 한다.
 *
 * 1) 방문을 센다 (퍼널의 첫 칸).
 * 2) 채점 서버를 미리 깨운다. Modal 은 놀면 내려가고 다시 뜨는 데 40초가 넘게
 *    걸린 적이 있다. 녹음 화면에서 깨우기 시작하면 짧은 소리는 그 안에 못 깨어나서
 *    "점수 계산 중"에 오래 매달린다. 홈에서 고르는 몇 초라도 앞당긴다.
 *    화면이 다 그려진 뒤로 미뤄 첫 화면 속도와 다투지 않게 한다.
 */
export function HomeBeacon() {
  useEffect(() => {
    track("view_home");
    const warm = () => void fetch("/api/warm", { method: "POST" }).catch(() => {});
    const ric = (window as { requestIdleCallback?: (cb: () => void) => number })
      .requestIdleCallback;
    if (ric) ric(warm);
    else window.setTimeout(warm, 800);
  }, []);
  return null;
}
