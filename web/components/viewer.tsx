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
 * 페이지는 미리 만들어 두고, "누구인지"만 여기서 나중에 채운다. 기다리는 동안은
 * 기본 캐릭터가 먼저 외친다.
 *
 * 헤더와 히어로가 같이 쓰므로 한 번만 묻고 결과를 나눈다.
 */
type Viewer = { loggedIn: boolean; avatar: Avatar };

let pending: Promise<Viewer> | null = null;

function loadViewer(): Promise<Viewer> {
  pending ??= (async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      // 로그인 전에 캐릭터 탭에서 꾸몄으면 그 녀석이 외친다.
      if (!user) return { loggedIn: false, avatar: readLocalAvatar() ?? DEFAULT_AVATAR };
      const { data } = await supabase
        .from("profiles")
        .select("avatar")
        .eq("id", user.id)
        .maybeSingle();
      return { loggedIn: true, avatar: normalizeAvatar(data?.avatar) };
    } catch {
      return { loggedIn: false, avatar: readLocalAvatar() ?? DEFAULT_AVATAR };
    }
  })();
  return pending;
}

function useViewer(): Viewer | null {
  const [viewer, setViewer] = useState<Viewer | null>(null);
  useEffect(() => {
    let alive = true;
    void loadViewer().then((v) => alive && setViewer(v));
    return () => {
      alive = false;
    };
  }, []);
  return viewer;
}

/** 헤더 오른쪽 — 로그인했으면 내 캐릭터, 아니면 로그인 알약. 모를 땐 자리만 잡는다. */
export function ViewerBadge() {
  const viewer = useViewer();
  if (!viewer) return <span className={styles.slot} aria-hidden="true" />;
  if (viewer.loggedIn) {
    return (
      <Link href="/profile" className={styles.me} aria-label="내 프로필">
        <VoiceAvatar avatar={viewer.avatar} size={34} />
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
