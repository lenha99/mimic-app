"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listMine, type MyScript } from "@/lib/my-scripts";
import Room, { type RoomItem } from "./room";
import styles from "./room.module.css";

/** 내 대본 연습 화면 — 기기에서 대본을 꺼내 일반 대본과 똑같은 연습 화면에 넘긴다. */
export function MyRoom({ id }: { id: string }) {
  const [state, setState] = useState<{ item: RoomItem | null } | null>(null);

  useEffect(() => {
    const mine = listMine();
    const i = mine.findIndex((s) => s.id === id);
    const nav = (s: MyScript | undefined) => (s ? { id: s.id, title: s.title } : null);
    // 저장소는 브라우저에만 있다 — 붙은 뒤에 읽는다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({
      item:
        i < 0
          ? null
          : {
              kind: "script",
              script: mine[i],
              number: i + 1,
              total: mine.length,
              prev: nav(mine[i - 1]),
              next: nav(mine[i + 1]),
              editHref: `/practice/new?edit=${encodeURIComponent(id)}`,
            },
    });
  }, [id]);

  if (!state) return <main className={`shell ${styles.room}`} aria-busy="true" />;
  if (!state.item) {
    return (
      <main className="shell" style={{ paddingTop: 48, textAlign: "center" }}>
        <h1 style={{ fontSize: 20 }}>이 기기에 없는 대본이에요</h1>
        <p style={{ color: "var(--ash)", fontSize: 14 }}>
          내 대본은 만든 폰(브라우저)에만 저장돼요. 지웠거나 다른 기기에서 연 것 같아요.
        </p>
        <Link href="/practice?tab=mine">연습실로 →</Link>
      </main>
    );
  }
  return <Room key={id} item={state.item} />;
}
