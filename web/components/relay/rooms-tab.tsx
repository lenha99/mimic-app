"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useT } from "@/components/lang";
import { Coco } from "@/components/brand/coco";
import { clientId } from "@/lib/client-id";
import { track } from "@/lib/track";
import s from "./relay.module.css";
import r from "./room.module.css";

type Card = { code: string; title: string; kind: "scene" | "script"; members: number; done: boolean; lastAt: string; locked: boolean; host?: boolean };

function ago(iso: string, t: ReturnType<typeof useT>, now: number): string {
  const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (m < 1) return t("방금", "just now");
  if (m < 60) return t(`${m}분 전`, `${m}m ago`);
  const h = Math.round(m / 60);
  if (h < 24) return t(`${h}시간 전`, `${h}h ago`);
  return t(`${Math.round(h / 24)}일 전`, `${Math.round(h / 24)}d ago`);
}

/**
 * 릴레이 "방" 탭 — 방 만들기 · 내 방 · 열린 방(공개, 최근 3일 활동).
 * 사람이 적을 때 열린 방이 비어 보이지 않게, 비면 "첫 방을 열면 여기 맨 위에 떠요".
 */
export function RoomsTab() {
  const t = useT();
  const [mine, setMine] = useState<Card[] | null>(null);
  const [open, setOpen] = useState<Card[]>([]);
  const [ready, setReady] = useState(true);
  const [now, setNow] = useState(0);

  useEffect(() => {
    let alive = true;
    void fetch(`/api/relay/room?client=${clientId()}`, { cache: "no-store" })
      .then((x) => x.json())
      .then((d: { mine?: Card[]; open?: Card[]; ready?: boolean; v2?: boolean }) => {
        if (!alive) return;
        setNow(Date.now());
        setMine(d.mine ?? []);
        setOpen(d.open ?? []);
        setReady(d.ready !== false);
      })
      .catch(() => alive && setMine([]));
    return () => {
      alive = false;
    };
  }, []);

  const row = (c: Card, via: string) => (
    <li key={c.code}>
      <Link href={`/relay/r/${c.code}`} className={s.item} onClick={() => via === "list" && track("room_join", { via: "list" })}>
        <span className={s.itemIcon} aria-hidden="true">
          {c.kind === "script" ? "📄" : c.done ? "🍿" : "🎬"}
        </span>
        <span className={s.itemText}>
          <b>{c.title}</b>
          <small>
            {c.kind === "script" ? t("대본 방", "Script") : c.done ? t("완성된 장면", "Finished scene") : t("장면 더빙", "Scene dub")} · 👥 {c.members}
            {c.host ? ` · ${t("내가 방장", "host")}` : ""}
            {c.locked ? " · 🔒" : ""} · {ago(c.lastAt, t, now)}
          </small>
        </span>
        <span aria-hidden="true">›</span>
      </Link>
    </li>
  );

  return (
    <>
      <div className={r.invite}>
        <b>{t("친구랑 같이 읽고, 찍고, 떠들어요", "Read, record and chat together")}</b>
        <span className={s.muted}>
          {t("우리 대본을 붙여 넣거나 준비된 장면을 골라 방을 열어요. 연극·발표·아나운서 연습도 돼요.", "Paste your own script or pick a scene. Works for plays, speeches and news reading too.")}
        </span>
        {ready ? (
          <Link href="/relay/new" className={s.cta} onClick={() => track("relay_cta", { via: "room_new" })}>
            ＋ {t("방 만들기", "New room")}
          </Link>
        ) : (
          <button type="button" className={s.cta} disabled>
            {t("곧 열려요 — 준비 중", "Coming soon")}
          </button>
        )}
      </div>

      <div className={s.section}>
        <h2>🙋 {t("내 방", "My rooms")}</h2>
      </div>
      {mine === null ? (
        <p className={s.muted}>{t("불러오는 중…", "Loading…")}</p>
      ) : mine.length ? (
        <ul className={s.list}>{mine.map((c) => row(c, "mine"))}</ul>
      ) : (
        <p className={s.muted}>{t("아직 들어간 방이 없어요.", "You're not in any room yet.")}</p>
      )}

      <div className={s.section}>
        <h2>🌐 {t("열린 방", "Open rooms")}</h2>
        <span className={s.tiny}>{t("최근 3일 · 공개 방", "Public · last 3 days")}</span>
      </div>
      {open.length ? (
        <ul className={s.list}>{open.map((c) => row(c, "list"))}</ul>
      ) : (
        <div className={s.okBox} style={{ background: "transparent" }}>
          <Coco mood="happy" size={64} />
          <span className={s.muted}>{t("아직 열린 방이 없어요. 첫 방을 열면 여기 맨 위에 떠요!", "No open rooms yet — yours will show up here first!")}</span>
        </div>
      )}
      <p className={s.tiny} style={{ marginTop: 14 }}>
        {t("방 녹음은 방을 나가면 지워져요. 모두 나가면 방도 사라져요. 간직하려면 방 안의 [내 기기에 저장]을 눌러요.", "Leaving a room deletes your takes there; empty rooms disappear. Use “Save to device” to keep them.")}
      </p>
    </>
  );
}
