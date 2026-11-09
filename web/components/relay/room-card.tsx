"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useLang, useT } from "@/components/lang";
import { postJson } from "@/components/relay/client";
import { Poster } from "@/components/relay/parts";
import { readLocalAvatar } from "@/lib/avatar";
import { clientId } from "@/lib/client-id";
import { cleanNickname, readNickname } from "@/lib/nickname";
import { genreLabel } from "@/lib/relay";
import { track } from "@/lib/track";
import s from "./relay.module.css";
import r from "./room.module.css";

type Pick = { key: string; title: string; logline: string; genre: string; roles: number; lines: number };

/**
 * 허브의 "친구랑 방 만들기" — 장면 하나 고르면 방이 생기고, 링크를 카톡으로 보내 배역을 나눈다.
 * 내가 들어가 있는 방도 여기서 다시 연다.
 */
export function RoomCard() {
  const t = useT();
  const ko = useLang() === "ko";
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [scenes, setScenes] = useState<Pick[]>([]);
  const [mine, setMine] = useState<{ code: string; title: string; done: boolean }[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(true);

  useEffect(() => {
    let alive = true;
    void fetch(`/api/relay/room?client=${clientId()}`, { cache: "no-store" })
      .then((x) => x.json())
      .then((d: { scenes?: Pick[]; mine?: typeof mine; ready?: boolean }) => {
        if (!alive) return;
        setReady(d.ready !== false);
        setScenes(d.scenes ?? []);
        setMine(d.mine ?? []);
        // "새 방 만들기"(/relay#rooms)로 왔으면 장면 고르기를 바로 연다
        if (window.location.hash === "#rooms") {
          setOpen(true);
          document.getElementById("rooms")?.scrollIntoView({ block: "start" });
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const create = async (key: string) => {
    setBusy(key);
    setError(null);
    const res = await postJson<{ code?: string }>("/api/relay/room", { stockKey: key, name: cleanNickname(readNickname()) ?? undefined, avatar: readLocalAvatar() ?? undefined });
    if (!res.ok || !res.data.code) {
      setBusy(null);
      return setError(res.data.error ?? t("방을 만들지 못했어요.", "Couldn't make the room."));
    }
    track("room_create", { meme_id: key });
    router.push(`/relay/r/${res.data.code}`);
  };

  return (
    <section id="rooms" className={s.card} style={{ marginBottom: 18 }}>
      <b style={{ fontSize: 17 }}>👯 {t("친구랑 방 만들어 더빙하기", "Dub with friends in a room")}</b>
      <span className={s.muted}>
        {t("장면 하나 골라 방을 열고 링크를 보내요. \"너는 악당, 나는 용사\" — 배역을 나눠 찍고, 채팅으로 떠들고, 완성본을 같이 들어요.", "Open a room, send the link, split the roles, chat, and play the final cut together.")}
      </span>
      {mine.length > 0 && (
        <div className={s.row} style={{ flexWrap: "wrap" }}>
          {mine.map((m) => (
            <Link key={m.code} href={`/relay/r/${m.code}`} className={s.ctaSmall}>
              {m.done ? "🍿" : "🎙"} {m.title}
            </Link>
          ))}
        </div>
      )}
      {!open ? (
        <button type="button" className={s.cta} disabled={!ready} onClick={() => setOpen(true)}>
          {ready ? `🎬 ${t("방 만들기", "Open a room")}` : t("곧 열려요 — 준비 중", "Coming soon")}
        </button>
      ) : (
        <>
          <span className={s.tiny}>{t("어떤 장면을 같이 찍을까요?", "Which scene?")}</span>
          {scenes.map((sc) => (
            <button key={sc.key} type="button" className={r.pick} disabled={!!busy} onClick={() => void create(sc.key)}>
              <Poster genre={sc.genre} title={sc.title} sub={sc.logline} />
              <small>
                {genreLabel(sc.genre, ko)} · {t(`배역 ${sc.roles}명 · 대사 ${sc.lines}줄`, `${sc.roles} roles · ${sc.lines} lines`)}
                {busy === sc.key ? ` · ${t("방 여는 중…", "Opening…")}` : ""}
              </small>
            </button>
          ))}
        </>
      )}
      {error && <div className={s.error}>{error}</div>}
    </section>
  );
}
