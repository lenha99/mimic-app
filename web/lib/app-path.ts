"use client";

import { usePathname } from "next/navigation";

/**
 * 지금 화면 주소 — 언어 칸(/ko·/en)을 뗀 것.
 *
 * proxy 가 `/x` 를 `/ko/x` 로 몰래 바꿔 그리기 때문에, Vercel 이 정적 페이지를 다시 만들 때 서버의
 * usePathname() 은 `/ko` 를, 폰은 `/` 를 돌려준다. 그대로 비교하면 서버는 하단 탭을 안 그리고 폰은
 * 그려서 화면 전체가 하이드레이션 오류(#418)로 처음부터 다시 그려졌다(11/10, 홈·연습실 등 탭 있는 모든 화면).
 */
export function useAppPath(): string {
  const raw = usePathname() ?? "/";
  return raw.replace(/^\/(ko|en)(?=\/|$)/, "") || "/";
}
