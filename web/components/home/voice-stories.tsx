"use client";

import { LevelPill, NameFx } from "@/components/pass/look";
import type { Look } from "@/lib/pass";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useLang, useT } from "@/components/lang";
import { useViewer } from "@/components/viewer";
import { VoiceAvatar } from "@/components/voice-avatar";
import { DEFAULT_AVATAR, normalizeAvatar } from "@/lib/avatar";
import { displayName } from "@/lib/weekly";
import { readMyLatest, type MyLatest } from "@/lib/post-take";
import styles from "./home.module.css";

/**
 * 홈 맨 위 "목소리 스토리" — 인스타 스토리처럼 이번 주 올라온 목소리들이 동그라미로 줄 선다.
 * 안 들어 본 목소리엔 색 테두리, 들어 본 건 회색. 맨 앞은 "+ 내 목소리"(올리기) — 대본과 상관없이
 * 같은 ❤ 순위라 특정 대본이 아니라 연습실(?post=1, 아무 대본이나 고르라는 안내)로 보낸다.
 *
 * 사람이 적은 지금은 동그라미가 몇 개 없다. 그래서 빈자리를 "첫 목소리 자리"로 보여 주고,
 * 맨 앞 "+"가 늘 제일 눈에 띄게 한다 — 듣는 사람보다 올리는 사람이 먼저 필요하다.
 */
const HEARD = "mimic.heard";

function readHeard(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(HEARD) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

export function markHeard(id: string) {
  try {
    const s = readHeard();
    s.add(id);
    localStorage.setItem(HEARD, JSON.stringify([...s].slice(-300)));
  } catch {}
}

export function VoiceStories({ entries }: { entries: { id: string; name: string; avatar: unknown; look?: Look }[] }) {
  const t = useT();
  const lang = useLang();
  const viewer = useViewer();
  const [heard, setHeard] = useState<Set<string>>(new Set());
  const [latest, setLatest] = useState<MyLatest | null>(null);

  useEffect(() => {
    let alive = true;
    void Promise.resolve().then(() => {
      if (!alive) return;
      setHeard(readHeard());
      setLatest(readMyLatest());
    });
    return () => {
      alive = false;
    };
  }, []);

  // 안 들은 것부터. 방금 올린 내 목소리는 서버 목록에 아직 없어도 맨 앞에 바로 보인다.
  const sorted = [...entries].sort((a, b) => Number(heard.has(a.id)) - Number(heard.has(b.id)));
  if (latest && !entries.some((e) => e.id === latest.id)) {
    sorted.unshift({ id: latest.id, name: latest.name || t("나", "Me"), avatar: latest.avatar ?? viewer?.avatar });
  }
  const empty = Math.max(0, 4 - sorted.length);

  return (
    <div className={styles.stories} data-tour="home-stories">
      <Link href="/practice?post=1" className={styles.story}>
        <span className={styles.mine}>
          <VoiceAvatar avatar={viewer?.avatar ?? DEFAULT_AVATAR} size={58} />
          <i aria-hidden="true">+</i>
        </span>
        <small>{t("내 목소리", "Your voice")}</small>
      </Link>
      {sorted.map((e) => (
        <Link key={e.id} href={`/weekly/e/${e.id}`} className={styles.story} onClick={() => markHeard(e.id)}>
          <span className={`${styles.ring} ${heard.has(e.id) ? styles.ringSeen : ""}`}>
            {/* 스토리엔 "안 들음" 링 하나만 — 패스 프레임까지 돌면 링이 두 겹이라 뭐가 뭔지 모른다. 레벨은 아래 알약으로. */}
            <VoiceAvatar avatar={normalizeAvatar(e.avatar)} size={58} />
            {e.look && e.look.level > 1 && (
              <span style={{ position: "absolute", left: "50%", bottom: -6, transform: "translateX(-50%)", zIndex: 3, border: 0, background: "none", borderRadius: 0 }}>
                <LevelPill level={e.look.level} rank={e.look.rank} compact />
              </span>
            )}
          </span>
          <small>
            <NameFx fx={e.look?.name}>{displayName(e.name, lang).replace(/^(익명의 목소리|Anonymous voice) /, "")}</NameFx>
          </small>
        </Link>
      ))}
      {Array.from({ length: empty }, (_, i) => (
        <Link key={`e${i}`} href="/practice?post=1" className={styles.story} aria-label={t("첫 목소리 자리", "Open spot")}>
          <span className={styles.ghostRing} aria-hidden="true">
            ?
          </span>
          <small>{i === 0 && entries.length === 0 ? t("1위 자리", "#1 spot") : t("빈자리", "Open")}</small>
        </Link>
      ))}
    </div>
  );
}
