"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DEFAULT_AVATAR, normalizeAvatar, readLocalAvatar, type Avatar } from "@/lib/avatar";
import { createClient } from "@/lib/supabase/client";
import { ShoutingAvatar } from "./shouting-avatar";
import { VoiceAvatar } from "./voice-avatar";
import styles from "./viewer.module.css";

/**
 * 지금 보는 사람 — 브라우저에서 알아낸다.
 *
 * 홈은 정적 페이지다. 서버에서 쿠키로 로그인 여부를 읽으면 요청마다 서버 함수가
 * 돌고, 트래픽이 없는 지금은 거의 매번 콜드 스타트라 첫 화면이 6초씩 걸렸다.
 * 페이지는 미리 만들어 두고, "누구인지"만 여기서 나중에 채운다.
 *
 * 예전엔 한 번 물은 답을 페이지가 살아 있는 내내 재사용했다. 그래서 홈을 한 번 본
 * 뒤 로그인하고 돌아오면 헤더가 계속 "로그인"이었다. 이제 화면이 붙을 때마다 다시
 * 묻고, 그 사이엔 마지막으로 안 답을 먼저 보여준다(깜빡임 없이). 로그인·로그아웃
 * 이벤트가 오면 바로 갱신한다.
 */
export type Viewer = { loggedIn: boolean; avatar: Avatar; nickname: string | null };

let last: Viewer | null = null;
let inflight: Promise<Viewer> | null = null;
const listeners = new Set<(v: Viewer) => void>();

async function fetchViewer(): Promise<Viewer> {
  const guest = (): Viewer => ({
    loggedIn: false,
    // 로그인 전에 캐릭터 탭에서 꾸몄으면 그 녀석이 외친다.
    avatar: readLocalAvatar() ?? DEFAULT_AVATAR,
    nickname: null,
  });
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return guest();
    const { data } = await supabase
      .from("profiles")
      .select("avatar, nickname")
      .eq("id", user.id)
      .maybeSingle();
    return { loggedIn: true, avatar: normalizeAvatar(data?.avatar), nickname: data?.nickname ?? null };
  } catch {
    return guest();
  }
}

/** 새로 묻는다. 동시에 여러 곳이 불러도 한 번만 간다. */
export function refreshViewer(): Promise<Viewer> {
  inflight ??= fetchViewer().then((v) => {
    last = v;
    inflight = null;
    listeners.forEach((fn) => fn(v));
    return v;
  });
  return inflight;
}

export function useViewer(): Viewer | null {
  const [viewer, setViewer] = useState<Viewer | null>(last);
  useEffect(() => {
    listeners.add(setViewer);
    void refreshViewer();
    const {
      data: { subscription },
    } = createClient().auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        void refreshViewer();
      }
    });
    return () => {
      listeners.delete(setViewer);
      subscription.unsubscribe();
    };
  }, []);
  return viewer;
}

/**
 * 헤더 오른쪽 — 로그인했으면 내 캐릭터 + 닉네임(로그인된 게 한눈에 보이게),
 * 아니면 로그인 알약. 모를 땐 자리만 잡는다.
 */
export function ViewerBadge() {
  const viewer = useViewer();
  if (!viewer) return <span className={styles.slot} aria-hidden="true" />;
  if (viewer.loggedIn) {
    return (
      <Link href="/profile" className={styles.me} aria-label="내 정보">
        <VoiceAvatar avatar={viewer.avatar} size={28} />
        <span>{viewer.nickname ?? "나"}</span>
      </Link>
    );
  }
  return (
    <Link href="/login" className={styles.pill}>
      로그인
    </Link>
  );
}

/** 히어로에서 외치는 캐릭터 — 로그인했으면 내가 꾸민 녀석. */
export function MyShoutingAvatar({ size }: { size?: number }) {
  const viewer = useViewer();
  return <ShoutingAvatar avatar={viewer?.avatar ?? DEFAULT_AVATAR} size={size} />;
}
