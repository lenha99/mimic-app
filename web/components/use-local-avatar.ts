"use client";

import { useMemo, useSyncExternalStore } from "react";
import { LOCAL_AVATAR_KEY, parseLocalAvatar, type Avatar } from "@/lib/avatar";

const noop = () => () => {};

function readRaw(): string | null {
  try {
    return localStorage.getItem(LOCAL_AVATAR_KEY);
  } catch {
    return null;
  }
}

/**
 * 이 브라우저에 저장된 캐릭터(로그인 전에 캐릭터 탭에서 꾸민 것).
 *
 * 서버 렌더에는 localStorage 가 없으므로 서버 스냅샷은 null — 첫 화면은 기본
 * 캐릭터로 그려지고, 브라우저가 붙는 순간 내 캐릭터로 바뀐다. 문자열을 스냅샷으로
 * 쓰는 이유: 매번 새 객체를 돌려주면 React 가 바뀐 줄 알고 끝없이 다시 그린다.
 */
export function useLocalAvatar(): Avatar | null {
  const raw = useSyncExternalStore(noop, readRaw, () => null);
  return useMemo(() => parseLocalAvatar(raw), [raw]);
}
