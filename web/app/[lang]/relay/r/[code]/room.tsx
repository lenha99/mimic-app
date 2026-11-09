"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLang, useT } from "@/components/lang";
import { Coco } from "@/components/brand/coco";
import { VoiceAvatar } from "@/components/voice-avatar";
import { usePlaylist } from "@/components/relay/audio";
import { itemsOfFinal, itemsOfPreview, postJson } from "@/components/relay/client";
import { AvatarDot } from "@/components/relay/parts";
import { readLocalAvatar, type Avatar } from "@/lib/avatar";
import { clientId } from "@/lib/client-id";
import { cleanNickname, readNickname } from "@/lib/nickname";
import { roleColor, TYPE_LABEL, type SceneView } from "@/lib/relay";
import { createClient } from "@/lib/supabase/client";
import { track } from "@/lib/track";
import { saveJoined } from "@/components/relay/save";
import { MAX_TITLE } from "@/lib/room-script";
import s from "@/components/relay/relay.module.css";
import r from "@/components/relay/room.module.css";
import { ScriptPanel, type ScriptTake } from "./script-panel";

type Msg = { id: number; kind: "chat" | "system"; name: string; text: string; at: string; mine?: boolean; who?: string | null };
type Member = { who: string; name: string; avatar: Avatar; host: boolean; mine: boolean; roles: string[] };
type View = {
  code: string;
  kind: "scene" | "script";
  title: string;
  public: boolean;
  scene: SceneView | null;
  parts: string[];
  partCount: number;
  takes: ScriptTake[];
  locked: boolean;
  chatExpiresAt: string | null;
  amHost: boolean;
  me: { name: string; kicked: boolean } | null;
  members: Member[];
  msgs: Msg[];
};
type Person = { key: string; name: string; avatar: Avatar };

const SEEN_KEY = (code: string) => `mimic.roomSeen.${code}`;

/**
 * 더빙 방 — 링크로 들어온 친구·구독자끼리 배역을 나눠 찍고, 같이 듣고, 실시간으로 떠든다.
 * 탭 둘: 🎭 배역·듣기 | 💬 채팅. 채팅은 Supabase Realtime broadcast 로 바로 오고, 안 붙으면 8초마다 다시 읽는다.
 */
export default function RelayRoom({ code, targetRole }: { code: string; targetRole: string | null }) {
  const t = useT();
  const ko = useLang() === "ko";
  const router = useRouter();
  const pl = usePlaylist();
  const [view, setView] = useState<View | null>(null);
  const [gone, setGone] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [tab, setTab] = useState<"cast" | "chat">("cast");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [online, setOnline] = useState(0);
  // 처음 그릴 땐 방을 불러오는 화면이라 서버·브라우저 결과가 같다 — 읽음 위치는 기기에서 바로 읽는다
  const [seen, setSeen] = useState(() => {
    try {
      return typeof window === "undefined" ? 0 : Number(localStorage.getItem(SEEN_KEY(code)) ?? 0) || 0;
    } catch {
      return 0;
    }
  });
  const [now, setNow] = useState(0);
  const [joining, setJoining] = useState(false);
  const [sheet, setSheet] = useState<"invite" | "host" | null>(null);
  const [people, setPeople] = useState<Person[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [hiddenMsgs, setHiddenMsgs] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [focus, setFocus] = useState<number | null>(null);
  const [follow, setFollow] = useState(false);
  const chRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
  const lastId = useRef(0);
  const bottom = useRef<HTMLDivElement | null>(null);

  const addMsgs = useCallback((incoming: Msg[]) => {
    if (!incoming.length) return;
    setMsgs((cur) => {
      const ids = new Set(cur.map((m) => m.id));
      const next = [...cur, ...incoming.filter((m) => !ids.has(m.id))].sort((a, b) => a.id - b.id).slice(-200);
      lastId.current = next.length ? next[next.length - 1].id : lastId.current;
      return next;
    });
  }, []);

  const load = useCallback(
    async (full = false) => {
      try {
        const after = full ? 0 : lastId.current;
        const res = await fetch(`/api/relay/room/${code}?client=${clientId()}&after=${after}`, { cache: "no-store" });
        if (res.status === 404) return setGone(true);
        if (!res.ok) return;
        const d = (await res.json()) as View;
        setNow(Date.now());
        setView(d);
        addMsgs(d.msgs);
      } catch {}
    },
    [code, addMsgs],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 비동기 불러오기(effect 안에서 바로 바뀌지 않는다)
    void load(true);
  }, [load]);

  const inRoom = !!view?.me && !view.me.kicked;
  const myName = view?.me?.name ?? "";

  // 실시간 — 같은 방 화면끼리 "room:<code>" 채널. 서버가 broadcast 로 메시지·장면 갱신을 쏜다.
  useEffect(() => {
    if (!inRoom) return;
    let supa: ReturnType<typeof createClient> | null = null;
    try {
      supa = createClient();
    } catch {
      return;
    }
    const ch = supa.channel(`room:${code}`, { config: { presence: { key: clientId() } } });
    ch.on("broadcast", { event: "msg" }, ({ payload }) => {
      const m = (payload as { msg?: Msg }).msg;
      if (m) addMsgs([m]);
    })
      .on("broadcast", { event: "scene" }, () => void load())
      .on("broadcast", { event: "room" }, () => void load())
      .on("broadcast", { event: "focus" }, ({ payload }) => {
        const n = Number((payload as { part?: unknown }).part);
        if (Number.isInteger(n) && n > 0) setFocus(n);
      })
      .on("presence", { event: "sync" }, () => setOnline(Object.keys(ch.presenceState()).length))
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setLive(true);
          void ch.track({ name: myName });
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") setLive(false);
      });
    chRef.current = ch;
    return () => {
      chRef.current = null;
      setLive(false);
      void supa?.removeChannel(ch);
    };
  }, [inRoom, code, myName, addMsgs, load]);

  // 다시 읽기 — 실시간이 붙어 있으면 25초(놓친 것 메우기·"보는 중" 표시), 아니면 8초. 화면을 떠나 있으면 쉰다.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, live ? 25_000 : 8_000);
    const onVis = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [live, load]);

  // 채팅 탭을 보고 있으면 읽음 처리 + 맨 아래로
  const lastChat = msgs.length ? msgs[msgs.length - 1].id : 0;
  useEffect(() => {
    if (tab !== "chat" || !lastChat) return;
    bottom.current?.scrollIntoView({ block: "end" });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 읽음 표시
    setSeen(lastChat);
    try {
      localStorage.setItem(SEEN_KEY(code), String(lastChat));
    } catch {}
  }, [tab, lastChat, code]);
  const unread = msgs.filter((m) => m.id > seen && !m.mine && m.kind === "chat").length;

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(id);
  }, [toast]);

  const scene = view?.scene ?? null;
  const done = scene?.status === "room_done";
  const base = useMemo(() => (scene ? scene.lines.filter((l) => !l.candidate) : []), [scene]);
  const filled = scene ? base.filter((l) => scene.takes.some((x) => x.lineId === l.id && x.kind === "line")).length : 0;
  const play = useMemo(() => (scene ? (done && scene.final ? itemsOfFinal(scene.final) : itemsOfPreview(scene)) : null), [scene, done]);
  const nowLine = play && pl.index >= 0 ? play.lines[pl.index]?.lineId : null;
  const target = scene?.roles.find((x) => x.id === targetRole) ?? null;
  const host = view?.members.find((m) => m.host);

  const join = async () => {
    setJoining(true);
    setError(null);
    const res = await postJson(`/api/relay/room/${code}/join`, { name: cleanNickname(readNickname()) ?? undefined, avatar: readLocalAvatar() ?? undefined });
    setJoining(false);
    if (!res.ok) return setError(res.data.error ?? t("들어가지 못했어요.", "Couldn't join."));
    track("room_join", { meme_id: scene?.stockKey ?? undefined, via: targetRole ? "role" : document.referrer.includes("/notifications") ? "invite" : "link" });
    await load(true);
    // 배역을 지목받고 왔으면 그 배역 녹음으로 바로
    if (target && scene) {
      const first = base.filter((l) => l.role === target.id).sort((a, b) => a.n - b.n)[0];
      if (first && !scene.owners.some((o) => o.role === target.id)) router.push(`/relay/rec?scene=${scene.id}&line=${first.id}&room=${code}`);
    }
  };

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    const res = await postJson<{ msg?: Msg }>(`/api/relay/room/${code}/msg`, { text: body });
    setSending(false);
    if (!res.ok || !res.data.msg) return setError(res.data.error ?? t("보내지 못했어요.", "Couldn't send."));
    setText("");
    addMsgs([res.data.msg]);
    track("room_msg");
  };

  const shareLink = async (roleId?: string) => {
    const url = `${window.location.origin}/relay/r/${code}${roleId ? `?role=${roleId}` : ""}`;
    const role = roleId ? scene?.roles.find((x) => x.id === roleId) : null;
    const name = view?.title || scene?.title || "";
    const msg = role
      ? t(`「${name}」 더빙 같이 하자! 너는 「${role.name}」 역 🎙`, `Dub "${name}" with me — you're ${role.name}!`)
      : view?.kind === "script"
        ? t(`「${name}」 같이 읽자! 대본 넣어 놨어 📄`, `Let's read "${name}" together!`)
        : t(`「${name}」 더빙 방 열었어! 배역 하나 골라 줘 🎬`, `I opened a dubbing room for "${name}" — pick a role!`);
    track("room_share", { meme_id: scene?.stockKey ?? "script", via: roleId ? "role" : "room" });
    try {
      if (navigator.share) {
        await navigator.share({ title: name, text: msg, url });
        return;
      }
    } catch {
      return; // 공유 창을 닫았다
    }
    try {
      await navigator.clipboard.writeText(`${msg}\n${url}`);
      setToast(t("링크를 복사했어요. 카톡에 붙여 넣어 보내세요!", "Link copied!"));
    } catch {
      setToast(url);
    }
  };

  const openInvite = async () => {
    setSheet("invite");
    setPicked(new Set());
    setPeople(null);
    try {
      const res = await fetch(`/api/relay/room/${code}/invite?client=${clientId()}`, { cache: "no-store" });
      const d = (await res.json()) as { people?: Person[] };
      setPeople(d.people ?? []);
    } catch {
      setPeople([]);
    }
  };

  const sendInvites = async () => {
    const res = await postJson<{ sent?: number }>(`/api/relay/room/${code}/invite`, { keys: [...picked] });
    setSheet(null);
    if (!res.ok) return setToast(res.data.error ?? t("보내지 못했어요.", "Couldn't send."));
    track("room_invite", { via: String(res.data.sent ?? 0) });
    setToast(t(`${res.data.sent ?? 0}명에게 초대를 보냈어요`, `Invited ${res.data.sent ?? 0}`));
  };

  const hostDo = async (action: string, extra: Record<string, unknown> = {}) => {
    const res = await postJson(`/api/relay/room/${code}/host`, { action, ...extra });
    if (!res.ok) return setToast(res.data.error ?? t("하지 못했어요.", "Failed."));
    if (action === "finish") track("room_complete", { meme_id: scene?.stockKey ?? undefined, via: `${filled}/${base.length}` });
    setSheet(null);
    await load();
  };

  const report = async (m: Msg) => {
    setHiddenMsgs((cur) => new Set(cur).add(m.id));
    await postJson(`/api/relay/room/${code}/report`, { id: m.id });
    setToast(t("신고했어요. 운영자가 확인해요.", "Reported."));
  };

  const playAll = () => {
    if (!play) return;
    if (pl.playing) return pl.stop();
    track("room_play", { meme_id: scene?.stockKey ?? undefined, via: done ? "final" : "preview" });
    void pl.play(play.items);
  };

  const saveCut = async () => {
    if (!play) return;
    setToast(t("이어 붙이는 중…", "Joining…"));
    const res = await saveJoined(
      play.items.map((i) => i.url),
      view?.title || scene?.title || "mimic",
    );
    setToast(
      res.ok
        ? res.skipped
          ? t(`저장했어요 (AI가 읽는 ${res.skipped}줄은 빠졌어요)`, `Saved (${res.skipped} AI lines skipped)`)
          : t("내 기기에 저장했어요", "Saved to your device")
        : t("저장할 녹음이 아직 없어요", "Nothing to save yet"),
    );
  };

  const rename = async () => {
    const next = (editing ?? "").trim();
    if (!next || next === view?.title) return setEditing(null);
    const res = await postJson(`/api/relay/room/${code}/host`, { action: "rename", title: next });
    if (!res.ok) return setToast(res.data.error ?? t("바꾸지 못했어요.", "Couldn't rename."));
    setEditing(null);
    await load();
  };

  const leave = async () => {
    if (!leaving) {
      setLeaving(true);
      return;
    }
    pl.stop();
    const res = await postJson<{ deleted?: boolean }>(`/api/relay/room/${code}/leave`, {});
    if (!res.ok) {
      setLeaving(false);
      return setToast(res.data.error ?? t("나가지 못했어요.", "Couldn't leave."));
    }
    try {
      localStorage.removeItem(SEEN_KEY(code));
    } catch {}
    router.push("/relay?tab=rooms");
  };

  const sendFocus = (part: number) => {
    setFocus(part);
    void chRef.current?.send({ type: "broadcast", event: "focus", payload: { part } });
  };

  if (gone) {
    return (
      <main className={`shell ${s.page}`}>
        <div className={s.okBox} style={{ marginTop: 40 }}>
          <Coco mood="think" size={88} />
          <b>{t("없거나 사라진 방이에요", "This room is gone")}</b>
          <span className={s.muted}>{t("모두 나가면 방은 사라져요. 새 방을 열어 보세요!", "Rooms disappear when everyone leaves. Open a new one!")}</span>
        </div>
        <Link href="/relay/new" className={s.cta} style={{ marginTop: 16 }}>
          {t("새 방 만들기", "Open a new room")}
        </Link>
      </main>
    );
  }

  if (!view || (view.kind !== "script" && !scene)) {
    return (
      <main className={`shell ${s.page}`}>
        <div className={s.okBox} style={{ marginTop: 40, background: "transparent", border: 0 }}>
          <Coco mood="think" size={88} />
          <span className={s.muted}>{t("방을 여는 중…", "Opening the room…")}</span>
        </div>
      </main>
    );
  }

  const chatClosed = !!view.chatExpiresAt && new Date(view.chatExpiresAt).getTime() <= now;
  const hoursLeft = view.chatExpiresAt ? Math.max(0, Math.ceil((new Date(view.chatExpiresAt).getTime() - now) / 3_600_000)) : null;
  const visible = msgs.filter((m) => !hiddenMsgs.has(m.id));
  const isScript = view.kind === "script";
  const myTakes = isScript ? view.takes.filter((x) => x.mine).length : (scene?.takes.filter((x) => x.mine).length ?? 0);

  return (
    <main className={`shell ${s.page}`}>
      <div className={s.spread}>
        <Link href="/relay?tab=rooms" className={s.back} onClick={() => pl.stop()}>
          ‹ {t("방 목록", "Rooms")}
        </Link>
        {inRoom && (
          <span className={s.row}>
            <button type="button" className={s.ctaSmall} onClick={() => void shareLink()}>
              🔗 {t("친구 부르기", "Invite")}
            </button>
            {view.amHost && (
              <button type="button" className={s.ctaSmall} onClick={() => setSheet("host")} aria-label={t("방장 메뉴", "Host menu")}>
                ⚙
              </button>
            )}
          </span>
        )}
      </div>

      <header className={r.head}>
        <p className={s.kicker}>{isScript ? t("대본 방", "SCRIPT ROOM") : done ? t("완성!", "FINISHED") : t("더빙 방", "DUBBING ROOM")}</p>
        {editing !== null ? (
          <form
            className={r.composer}
            style={{ position: "static" }}
            onSubmit={(e) => {
              e.preventDefault();
              void rename();
            }}
          >
            <input value={editing} maxLength={MAX_TITLE} autoFocus onChange={(e) => setEditing(e.target.value)} aria-label={t("방 제목", "Room title")} />
            <button type="submit">{t("저장", "Save")}</button>
          </form>
        ) : (
          <h1 className={r.title}>
            {view.title}
            {view.amHost && (
              <button type="button" className={r.linkBtn} onClick={() => setEditing(view.title)} aria-label={t("방 제목 바꾸기", "Rename room")}>
                ✏️
              </button>
            )}
          </h1>
        )}
        {scene && <span className={s.muted}>{scene.title !== view.title ? `🎬 ${scene.title} · ` : ""}{scene.logline}</span>}
        {isScript && <span className={s.muted}>📄 {t(`단락 ${view.partCount}개 · 배역 없이 각자 읽고 싶은 곳을 녹음해요`, `${view.partCount} paragraphs · record whichever you like`)}</span>}
        <span className={r.meta}>
          <span>
            👥 {view.members.length}
            {t("명", "")}
            {host ? ` · ${t("방장", "host")} ${host.name}` : ""}
          </span>
          {inRoom && online > 0 && (
            <span className={r.live}>
              <i aria-hidden="true" />
              {t(`지금 ${online}명 보는 중`, `${online} here now`)}
            </span>
          )}
          {view.locked && <span>🔒 {t("잠김", "Locked")}</span>}
          <span>{view.public ? `🌐 ${t("공개", "Public")}` : `🔗 ${t("링크로만", "Link only")}`}</span>
          {done && hoursLeft !== null && !chatClosed && <span>{t(`채팅은 ${hoursLeft}시간 뒤 사라져요`, `Chat clears in ${hoursLeft}h`)}</span>}
        </span>
      </header>

      {!inRoom && (
        <div className={r.invite}>
          {view.me?.kicked ? (
            <b>{t("방장이 이 방에서 내보냈어요", "The host removed you from this room")}</b>
          ) : (
            <>
              <b>
                {target
                  ? t(`「${target.name}」 역으로 초대받았어요 🎙`, `You're invited to play ${target.name} 🎙`)
                  : isScript
                    ? t(`${host?.name ?? "친구"}님의 대본 방이에요`, `${host?.name ?? "A friend"}'s script room`)
                    : t(`${host?.name ?? "친구"}님의 더빙 방이에요`, `${host?.name ?? "A friend"}'s dubbing room`)}
              </b>
              <span className={s.muted}>
                {isScript
                  ? t(`대본 ${view.partCount}단락을 같이 읽고 녹음해요. 들어오면 대본이 보여요.`, `Read and record ${view.partCount} paragraphs together. Join to see the script.`)
                  : target
                  ? `${target.desc} · ${t(`대사 ${base.filter((l) => l.role === target.id).length}줄`, `${base.filter((l) => l.role === target.id).length} lines`)}`
                  : t("배역을 하나 골라 대사를 녹음하면, 친구들 목소리와 이어져 한 장면이 돼요. 빈 배역은 AI 목소리가 읽어요.", "Pick a role and record — your voice joins your friends' into one scene. Empty roles are read by AI.")}
              </span>
              {view.locked ? (
                <span className={s.muted}>🔒 {t("방장이 방을 잠갔어요. 새로 들어갈 수 없어요.", "The host locked this room.")}</span>
              ) : (
                <button type="button" className={s.cta} disabled={joining} onClick={join}>
                  {joining ? t("들어가는 중…", "Joining…") : target ? t(`🎙 「${target.name}」 녹음하러 가기`, `🎙 Record as ${target.name}`) : t("🎬 방에 들어가기", "🎬 Join the room")}
                </button>
              )}
              <span className={s.tiny}>{t("로그인 없이 바로 돼요 · 녹음은 이 방 멤버에게만 들려요", "No login needed · takes are only heard in this room")}</span>
            </>
          )}
          {error && <div className={s.error}>{error}</div>}
        </div>
      )}

      {inRoom && (
        <nav className={r.tabs} aria-label={t("방 화면", "Room")}>
          <button type="button" className={`${r.tab} ${tab === "cast" ? r.tabOn : ""}`} onClick={() => setTab("cast")}>
            {isScript ? `📄 ${t("대본", "Script")}` : `🎭 ${t("배역·듣기", "Cast & listen")}`}
          </button>
          <button type="button" className={`${r.tab} ${tab === "chat" ? r.tabOn : ""}`} onClick={() => setTab("chat")}>
            💬 {t("채팅", "Chat")}
            {unread > 0 && tab !== "chat" && <span className={r.badge}>{unread > 99 ? "99+" : unread}</span>}
          </button>
        </nav>
      )}

      {inRoom && isScript && tab === "cast" && (
        <ScriptPanel
          code={code}
          title={view.title}
          parts={view.parts}
          takes={view.takes}
          onChanged={() => void load()}
          focus={focus}
          follow={follow}
          setFollow={setFollow}
          sendFocus={sendFocus}
          toast={setToast}
        />
      )}

      {(tab === "cast" || !inRoom) && scene && !isScript && (
        <>
          <div className={s.card}>
            <span className={s.spread}>
              <b>
                {done ? t("🍿 완성본", "🍿 Final cut") : t(`녹음 ${filled}/${base.length}줄`, `${filled}/${base.length} lines recorded`)}
              </b>
              <button type="button" className={s.ctaSmall} onClick={playAll}>
                {pl.playing ? t("■ 멈춤", "■ Stop") : done ? t("▶ 같이 듣기", "▶ Play") : t("▶ 지금까지 듣기", "▶ Preview")}
              </button>
            </span>
            {!done && (
              <span className={r.progress} aria-hidden="true">
                <i style={{ width: `${base.length ? Math.round((filled / base.length) * 100) : 0}%` }} />
              </span>
            )}
            {!done && <span className={s.tiny}>{t("빈 줄은 AI 목소리가 읽어요. 다 차면 방장이 [완성]을 눌러요.", "Empty lines are read by AI. The host taps Finish when it's full.")}</span>}
            {inRoom && filled > 0 && (
              <button type="button" className={r.linkBtn} style={{ alignSelf: "flex-start" }} onClick={() => void saveCut()}>
                💾 {done ? t("완성본 내 기기에 저장", "Save the final cut") : t("지금까지 녹음 내 기기에 저장", "Save takes so far")}
              </button>
            )}
            {pl.playing && play && (
              <ol className={r.script}>
                {play.lines.map((l) => (
                  <li key={l.lineId} className={nowLine === l.lineId ? r.now : undefined} style={{ ["--role" as string]: roleColor(scene.roles, l.role) }}>
                    <small>
                      {l.roleName} · {l.name ?? "AI"}
                    </small>
                    {l.text}
                  </li>
                ))}
              </ol>
            )}
          </div>

          {inRoom && !done && view.amHost && filled === base.length && base.length > 0 && (
            <button type="button" className={s.cta} style={{ marginTop: 12 }} onClick={() => void hostDo("finish")}>
              🍿 {t("완성! 다 같이 듣기", "Finish & play together")}
            </button>
          )}

          <div className={s.section}>
            <h2>🎭 {t("배역", "Roles")}</h2>
            {inRoom && !done && <span className={s.tiny}>{t("여러 배역을 맡아도 돼요", "You can take more than one")}</span>}
          </div>
          <ul className={s.roles}>
            {scene.roles.map((role) => {
              const owner = scene.owners.find((o) => o.role === role.id);
              const lines = base.filter((l) => l.role === role.id).sort((a, b) => a.n - b.n);
              const mine = !!owner?.mine;
              const todo = lines.filter((l) => !scene.takes.some((x) => x.lineId === l.id && x.kind === "line" && x.mine));
              const take = owner ? scene.takes.find((x) => x.owner === owner.owner && x.kind === "line") : undefined;
              const next = mine ? todo[0] : !owner ? lines[0] : undefined;
              return (
                <li
                  key={role.id}
                  className={`${s.role} ${mine ? s.roleMine : ""} ${targetRole === role.id ? r.roleTarget : ""}`}
                  style={{ ["--role" as string]: roleColor(scene.roles, role.id) }}
                >
                  <span className={s.roleFace}>{owner ? <AvatarDot avatar={take?.avatar} seed={owner.owner} size={34} /> : <b>{role.name.slice(0, 1)}</b>}</span>
                  <span className={s.roleInfo}>
                    <b>
                      {role.name} <small>{ko ? TYPE_LABEL[role.type].ko : TYPE_LABEL[role.type].en}</small>
                    </b>
                    <span className={s.roleDesc}>{role.desc}</span>
                    <span className={s.roleState}>
                      {mine
                        ? todo.length
                          ? t(`내 배역 · ${todo.length}줄 남음`, `Mine · ${todo.length} left`)
                          : t("내 배역 · 다 녹음했어요 ✓", "Mine · all done ✓")
                        : owner
                          ? t(`${owner.name || "멤버"} 맡음`, `${owner.name || "A member"} has it`)
                          : t(`대사 ${lines.length}줄 · 비어 있어요 (AI가 읽는 중)`, `${lines.length} lines · open (AI reads it)`)}
                    </span>
                  </span>
                  <span className={r.roleBtns}>
                    {inRoom && !done && next && (
                      <Link href={`/relay/rec?scene=${scene.id}&line=${next.id}&room=${code}`} className={s.roleBtn} onClick={() => pl.stop()}>
                        {mine ? t("이어서", "Continue") : t("이 배역 하기", "Play this")}
                      </Link>
                    )}
                    {inRoom && !done && !owner && (
                      <button type="button" className={r.linkBtn} onClick={() => void shareLink(role.id)}>
                        {t("친구에게 맡기기", "Give to a friend")}
                      </button>
                    )}
                    {inRoom && !done && owner && view.amHost && !mine && (
                      <button type="button" className={r.linkBtn} onClick={() => void hostDo("free_role", { role: role.id })}>
                        {t("배역 비우기", "Free role")}
                      </button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {tab === "cast" && (
        <>
          {inRoom && (
            <>
              <div className={s.section}>
                <h2>💬 {t("채팅", "Chat")}</h2>
              </div>
              <button type="button" className={r.preview} onClick={() => setTab("chat")}>
                {visible
                  .filter((m) => m.kind === "chat")
                  .slice(-2)
                  .map((m) => (
                    <span key={m.id}>
                      <b>{m.mine ? t("나", "me") : m.name}</b> {m.text}
                    </span>
                  ))}
                {!visible.some((m) => m.kind === "chat") && <span>{t("아직 조용해요. 먼저 한마디 남겨 보세요!", "Quiet so far — say hi!")}</span>}
                <span className={s.tiny}>{t("채팅 열기 ›", "Open chat ›")}</span>
              </button>

              <div className={s.row} style={{ marginTop: 14, flexWrap: "wrap" }}>
                <button type="button" className={s.ctaSmall} onClick={() => void shareLink()}>
                  🔗 {t("카톡·링크로 부르기", "Share link")}
                </button>
                {!view.locked && (
                  <button type="button" className={s.ctaSmall} onClick={() => void openInvite()}>
                    📨 {t("구독한 사람 부르기", "Invite subscribers")}
                  </button>
                )}
              </div>
              {done && (
                <Link href="/relay/new" className={s.ctaGhost} style={{ marginTop: 14 }}>
                  🎬 {t("다른 장면으로 새 방 열기", "Open a new room")}
                </Link>
              )}

              <div className={r.danger}>
                {leaving ? (
                  <>
                    <b>{t("정말 나갈까요?", "Leave this room?")}</b>
                    <span className={s.tiny}>
                      {myTakes > 0
                        ? t(`이 방에 올린 내 녹음 ${myTakes}개가 지워져요. 간직하려면 먼저 💾로 저장하세요.`, `Your ${myTakes} take(s) here will be deleted. Save them first with 💾.`)
                        : t("나가면 이 방 목록에서 빠져요.", "The room will leave your list.")}
                      {view.members.length <= 1 ? ` ${t("마지막 사람이라 방도 같이 사라져요.", "You're the last one — the room will be deleted.")}` : ""}
                      {view.amHost && view.members.length > 1 ? ` ${t("방장은 다음 사람에게 넘어가요.", "Host passes to the next member.")}` : ""}
                    </span>
                    <div className={s.twoBtn}>
                      <button type="button" className={s.ctaGhost} onClick={() => setLeaving(false)}>
                        {t("취소", "Cancel")}
                      </button>
                      <button type="button" className={s.cta} onClick={() => void leave()}>
                        {t("나가기", "Leave")}
                      </button>
                    </div>
                  </>
                ) : (
                  <button type="button" className={r.linkBtn} onClick={() => void leave()}>
                    🚪 {t("방 나가기", "Leave room")}
                  </button>
                )}
              </div>
            </>
          )}
        </>
      )}

      {inRoom && tab === "chat" && (
        <>
          <div className={r.chat} role="log" aria-live="polite">
            {visible.length === 0 && <p className={r.system}>{chatClosed ? t("뒤풀이가 끝나 채팅이 지워졌어요.", "The chat has been cleared.") : t("아직 조용해요. 먼저 한마디!", "Quiet so far — say hi!")}</p>}
            {visible.map((m) =>
              m.kind === "system" ? (
                <p key={m.id} className={r.system}>
                  {m.text}
                </p>
              ) : (
                <div key={m.id} className={`${r.msg} ${m.mine ? r.mine : ""}`}>
                  {!m.mine && <small>{m.name}</small>}
                  <span>{m.text}</span>
                  <small>
                    {new Date(m.at).toLocaleTimeString(ko ? "ko-KR" : "en-US", { hour: "numeric", minute: "2-digit" })}
                    {!m.mine && (
                      <button type="button" className={r.report} onClick={() => void report(m)}>
                        {t("신고", "Report")}
                      </button>
                    )}
                  </small>
                </div>
              ),
            )}
            {/* 아래 고정 입력창에 가리지 않게 — 맨 아래로 내릴 때 입력창 높이만큼 여유 */}
            <div ref={bottom} style={{ scrollMarginBottom: 96 }} />
          </div>
          {error && <div className={s.error}>{error}</div>}
          {chatClosed ? (
            <p className={s.tiny} style={{ textAlign: "center" }}>
              {t("뒤풀이가 끝나 채팅이 닫혔어요. 완성본은 계속 들을 수 있어요.", "Chat is closed. You can still play the final cut.")}
            </p>
          ) : (
            <form
              className={r.composer}
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
            >
              <input value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder={t("메시지 보내기", "Message")} aria-label={t("메시지", "Message")} enterKeyHint="send" />
              <button type="submit" disabled={!text.trim() || sending}>
                {t("보내기", "Send")}
              </button>
            </form>
          )}
          {!live && (
            <p className={s.tiny} style={{ textAlign: "center" }}>
              {t("연결이 느려 몇 초마다 새 메시지를 확인하고 있어요", "Checking for new messages every few seconds")}
            </p>
          )}
        </>
      )}

      {sheet && (
        <div className={r.sheetBack} onClick={() => setSheet(null)}>
          <div className={r.sheet} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            {sheet === "invite" && (
              <>
                <h3>📨 {t("구독한 사람 부르기", "Invite subscribers")}</h3>
                <span className={s.tiny}>{t("내가 구독했거나 나를 구독한 사람만 부를 수 있어요. 알림으로 방 링크가 가요.", "Only people you follow or who follow you. They get a notification.")}</span>
                {people === null && <span className={s.muted}>{t("불러오는 중…", "Loading…")}</span>}
                {people?.length === 0 && (
                  <span className={s.muted}>{t("아직 구독 사이인 사람이 없어요. 카톡·링크로 불러 보세요!", "No subscribers yet — share the link instead!")}</span>
                )}
                {people?.map((p) => (
                  <label key={p.key} className={r.person}>
                    <VoiceAvatar avatar={p.avatar} size={36} />
                    <span>{p.name}</span>
                    <input
                      type="checkbox"
                      checked={picked.has(p.key)}
                      onChange={(e) =>
                        setPicked((cur) => {
                          const n = new Set(cur);
                          if (e.target.checked) n.add(p.key);
                          else n.delete(p.key);
                          return n;
                        })
                      }
                    />
                  </label>
                ))}
                <button type="button" className={s.cta} disabled={!picked.size} onClick={() => void sendInvites()}>
                  {t(`${picked.size}명 부르기`, `Invite ${picked.size}`)}
                </button>
              </>
            )}
            {sheet === "host" && (
              <>
                <h3>⚙ {t("방장 메뉴", "Host tools")}</h3>
                <button type="button" className={s.ctaGhost} onClick={() => void hostDo(view.locked ? "unlock" : "lock")}>
                  {view.locked ? t("🔓 방 열기 (새 사람 들어올 수 있게)", "🔓 Unlock room") : t("🔒 방 잠그기 (새 사람 못 들어오게)", "🔒 Lock room")}
                </button>
                <button type="button" className={s.ctaGhost} onClick={() => void hostDo(view.public ? "private" : "public")}>
                  {view.public ? t("🔗 링크로만 들어오게 (목록에서 숨기기)", "🔗 Link only (hide from list)") : t("🌐 방 목록에 공개하기", "🌐 Show in the room list")}
                </button>
                <button type="button" className={s.ctaGhost} onClick={() => { setSheet(null); setEditing(view.title); }}>
                  ✏️ {t("방 제목 바꾸기", "Rename room")}
                </button>
                {!done && !isScript && (
                  <button type="button" className={s.ctaGhost} onClick={() => void hostDo("finish")}>
                    🍿 {t(`지금 완성하기 (${filled}/${base.length}줄 · 빈 줄은 AI)`, `Finish now (${filled}/${base.length})`)}
                  </button>
                )}
                <span className={s.tiny}>{t("멤버 내보내기 — 그 사람 녹음도 지워져요", "Remove a member — their takes are deleted")}</span>
                {view.members
                  .filter((m) => !m.host)
                  .map((m) => (
                    <div key={m.who} className={r.person}>
                      <VoiceAvatar avatar={m.avatar} size={36} />
                      <span>{m.name}</span>
                      <button type="button" className={s.ctaSmall} onClick={() => void hostDo("kick", { who: m.who })}>
                        {t("내보내기", "Remove")}
                      </button>
                    </div>
                  ))}
                {view.members.length <= 1 && <span className={s.muted}>{t("아직 들어온 사람이 없어요.", "Nobody else yet.")}</span>}
              </>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div className={s.toast} role="status">
          {toast}
        </div>
      )}
    </main>
  );
}
