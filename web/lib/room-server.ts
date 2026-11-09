import { randomBytes } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";
import { notify } from "@/lib/notify-server";
import { normalizeAvatar } from "@/lib/avatar";
import { computeFinal, type FinalCut, type SceneView } from "@/lib/relay";
import { loadScene, publicView, type Viewer } from "@/lib/relay-server";
import { splitScript } from "@/lib/room-script";
import type { Json } from "@/types/database";

/**
 * 릴레이 더빙 방 — 서버 전용. 링크·목록으로 들어와 같이 찍고 채팅한다.
 *
 * 방 종류
 * - scene: 준비된 장면을 배역 나눠 찍는다. 장면은 relay_scenes.status = 'room'(찍는 중)·'room_done'(완성).
 * - script: 우리 대본 방. 배역 없이 붙여 넣은 대본을 단락별로 아무나 녹음한다(relay_room_takes).
 *
 * 보관 — 방을 나가면 그 사람 녹음을 지운다. 멤버가 아무도 없으면 방을 통째로 지운다.
 * 7일 동안 방을 안 연 멤버는 나간 것으로 본다(크론). 간직하려면 "내 기기에 저장".
 * 채팅 실시간 전달은 Supabase Realtime broadcast(REST). 실패해도 화면이 다시 읽는다.
 */
type Service = ReturnType<typeof createServiceClient>;

export const ROOM_HOURS = 72; // 장면 방은 72시간 뒤 자동 완성
export const AFTER_PARTY_MS = 24 * 3600_000; // 장면 방 완성 뒤 채팅이 남는 시간
export const MAX_MSG = 300;
export const ROOMS_PER_DAY = 5;
export const MSGS_PER_DAY = 500;
export const MAX_MEMBERS = 12;
export const IDLE_MEMBER_MS = 7 * 24 * 3600_000;
export const LIST_DAYS = 3;
const NOTIFY_GAP_MS = 30 * 60_000;

export type RoomRow = {
  code: string;
  scene_id: string | null;
  host: string;
  host_user: string | null;
  locked: boolean;
  chat_expires_at: string | null;
  created_at: string;
  title: string;
  public: boolean;
  kind: "scene" | "script";
  script: string | null;
  last_at: string;
};
export type MemberRow = { owner: string; user_id: string | null; name: string; avatar: Json; kicked: boolean; notified_at: string | null; seen_at: string | null; joined_at: string };
export type Msg = { id: number; kind: "chat" | "system"; name: string; text: string; at: string; mine?: boolean; who?: string | null };
export type ScriptTake = { id: string; part: number | null; name: string; who: string; mine: boolean; sec: number; at: string };

export const newCode = () => randomBytes(16).toString("base64url");
export const validCode = (c: unknown): c is string => typeof c === "string" && /^[A-Za-z0-9_-]{16,32}$/.test(c);
const isUuid = (c: string) => /^[0-9a-f-]{36}$/.test(c);

/** 방 표가 아직 없으면(마이그레이션 38 전) */
export const missing = (e: { code?: string; message?: string } | null | undefined) =>
  !!e && (e.code === "42P01" || e.code === "PGRST205" || /relay_room|does not exist|schema cache/i.test(e.message ?? ""));

const COLS_V1 = "code, scene_id, host, host_user, locked, chat_expires_at, created_at";
const COLS = `${COLS_V1}, title, public, kind, script, last_at`;

/** 2단계 열(마이그레이션 39)이 아직 없으면 1단계 열만 읽고 기본값을 채운다 */
export function withDefaults(r: Partial<RoomRow> & Pick<RoomRow, "code" | "host" | "created_at">): RoomRow {
  return {
    scene_id: null,
    host_user: null,
    locked: false,
    chat_expires_at: null,
    title: "",
    public: false,
    kind: "scene",
    script: null,
    last_at: r.created_at,
    ...r,
  } as RoomRow;
}

/** 마이그레이션 39 가 들어갔나 — 대본 방·목록·제목은 그 뒤에만 */
export async function roomsV2(service: Service = createServiceClient()): Promise<boolean> {
  const { error } = await service.from("relay_rooms").select("kind").limit(1);
  return !error;
}

/** 코드 또는 장면 id(알림 링크)로 방 찾기 */
export async function findRoom(codeOrScene: string, service: Service = createServiceClient()): Promise<RoomRow | null> {
  if (!validCode(codeOrScene) && !isUuid(codeOrScene)) return null;
  const col = isUuid(codeOrScene) ? "scene_id" : "code";
  const { data, error } = await service.from("relay_rooms").select(COLS).eq(col, codeOrScene).maybeSingle();
  if (!error) return data ? withDefaults(data as unknown as RoomRow) : null;
  const { data: old } = await service.from("relay_rooms").select(COLS_V1).eq(col, codeOrScene).maybeSingle();
  return old ? withDefaults(old as unknown as RoomRow) : null;
}

export async function membersOf(code: string, service: Service = createServiceClient()): Promise<MemberRow[]> {
  const { data } = await service.from("relay_room_members").select("owner, user_id, name, avatar, kicked, notified_at, seen_at, joined_at").eq("room", code).order("joined_at");
  return (data ?? []) as MemberRow[];
}

export function memberOf(members: MemberRow[], v: Viewer): MemberRow | null {
  return members.find((m) => v.keys.includes(m.owner)) ?? null;
}

/** 남의 기기 이름표를 그대로 내려보내지 않는다 — 방장이 내보내기 할 때 이 값으로 가리킨다 */
export function hashKey(k: string): string {
  let h = 2166136261;
  for (let i = 0; i < k.length; i++) h = Math.imul(h ^ k.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

/** 방 화면에 내려 주는 것 — 장면 또는 대본 · 멤버 · 내 상태 */
export async function roomView(room: RoomRow, v: Viewer, service: Service = createServiceClient()) {
  const members = await membersOf(room.code, service);
  const me = memberOf(members, v);
  const inRoom = !!me && !me.kicked;
  let scene: SceneView | null = null;
  let owners: { role: string; owner: string }[] = [];
  let parts: string[] = [];
  let takes: ScriptTake[] = [];
  if (room.kind === "script") {
    parts = splitScript(room.script ?? "");
    const { data } = await service.from("relay_room_takes").select("id, owner, name, part, duration_s, created_at").eq("room", room.code).order("created_at");
    takes = (data ?? []).map((t) => ({ id: t.id, part: t.part, name: t.name, who: hashKey(t.owner), mine: v.keys.includes(t.owner), sec: t.duration_s, at: t.created_at }));
  } else if (room.scene_id) {
    const s = await loadScene(room.scene_id, v, service);
    if (!s) return null;
    owners = s.owners;
    scene = { ...publicView(s), room: inRoom ? room.code : null };
  } else return null;
  return {
    code: room.code,
    kind: room.kind,
    title: room.title || scene?.title || "",
    public: room.public,
    scene,
    // 대본은 들어온 사람만 본다 — 목록·미리보기엔 제목만
    parts: inRoom ? parts : [],
    partCount: parts.length,
    takes: inRoom ? takes : [],
    locked: room.locked,
    chatExpiresAt: room.chat_expires_at,
    amHost: v.keys.includes(room.host),
    me: me ? { name: me.name, kicked: me.kicked } : null,
    members: members
      .filter((m) => !m.kicked)
      .map((m) => ({
        who: hashKey(m.owner),
        name: m.name,
        avatar: normalizeAvatar(m.avatar, m.owner),
        host: m.owner === room.host,
        mine: v.keys.includes(m.owner),
        roles: owners.filter((o) => o.owner === m.owner).map((o) => o.role),
      })),
  };
}

export async function messages(code: string, v: Viewer, after = 0, service: Service = createServiceClient()): Promise<Msg[]> {
  let q = service.from("relay_room_msgs").select("id, owner, name, kind, text, created_at").eq("room", code).order("id", { ascending: false }).limit(100);
  if (after > 0) q = q.gt("id", after);
  const { data } = await q;
  return (data ?? []).reverse().map((m) => toMsg(m, v));
}

export function toMsg(m: { id: number; owner: string | null; name: string; kind: "chat" | "system"; text: string; created_at: string }, v: Viewer | null): Msg {
  return { id: m.id, kind: m.kind, name: m.name, text: m.text, at: m.created_at, mine: !!m.owner && !!v?.keys.includes(m.owner), who: m.owner ? hashKey(m.owner) : null };
}

/** Realtime broadcast — 방 화면들이 "room:<code>" 채널로 듣는다. 실패해도 조용히(화면이 다시 읽는다). */
export async function broadcast(code: string, event: "msg" | "scene" | "room", payload: Record<string, unknown>): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: key, authorization: `Bearer ${key}` },
      body: JSON.stringify({ messages: [{ topic: `room:${code}`, event, payload }] }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {}
}

/** 방이 살아 있다는 표시 — 공개 목록 정렬·3일 넘게 조용한 방 숨기기에 쓴다(열이 없으면 조용히 실패) */
export async function touch(code: string, service: Service = createServiceClient()): Promise<void> {
  await service.from("relay_rooms").update({ last_at: new Date().toISOString() }).eq("code", code);
}

/** 시스템 줄("○○ 입장", "○○가 3번 대사 녹음") — 저장하고 바로 알린다 */
export async function postSystem(code: string, text: string, service: Service = createServiceClient()): Promise<void> {
  const { data } = await service.from("relay_room_msgs").insert({ room: code, owner: null, name: "", kind: "system", text: text.slice(0, MAX_MSG) }).select("id, owner, name, kind, text, created_at").single();
  if (data) await broadcast(code, "msg", { msg: toMsg(data, null) });
}

/**
 * 방에 없는 멤버에게 알림 — 사람당 방마다 30분에 한 번(앱 안 알림 + 푸시).
 * 지금 방 화면을 보고 있는 사람(1분 안에 화면이 다시 읽은 사람)은 뺀다.
 */
export async function notifyOffline(room: RoomRow, title: string, except: string[], service: Service = createServiceClient()): Promise<void> {
  const members = await membersOf(room.code, service);
  const now = Date.now();
  for (const m of members) {
    if (m.kicked || except.includes(m.owner)) continue;
    if (m.seen_at && now - new Date(m.seen_at).getTime() < 60_000) continue;
    if (m.notified_at && now - new Date(m.notified_at).getTime() < NOTIFY_GAP_MS) continue;
    await service.from("relay_room_members").update({ notified_at: new Date(now).toISOString() }).eq("room", room.code).eq("owner", m.owner);
    await notify({
      userId: m.user_id ?? (m.owner.startsWith("u:") ? m.owner.slice(2) : null),
      client: m.owner.startsWith("g:") ? m.owner.slice(2) : null,
      kind: "relay_room_chat",
      sceneId: room.scene_id,
      push: { title: `💬 ${room.title || "더빙 방"}`, body: title, url: `/relay/r/${room.code}`, tag: `room-${room.code}` },
    });
  }
}

/**
 * 장면 방 완성 — 지금 녹음으로 정식판을 박제하고, 채팅은 24시간 뒤풀이 뒤에 지운다.
 * 진짜 녹음이 0개여도 무효로 돌리지 않는다(친구끼리 만든 방이다).
 */
export async function finishRoom(room: RoomRow, service: Service = createServiceClient()): Promise<boolean> {
  if (room.kind !== "scene" || !room.scene_id) return false;
  const { data: claimed } = await service.from("relay_scenes").update({ status: "room_done" }).eq("id", room.scene_id).eq("status", "room").select("id");
  if (!claimed?.length) return false;
  const s = await loadScene(room.scene_id, null, service);
  if (!s) return false;
  const final = computeFinal(s);
  await service.from("relay_scenes").update({ final: final as unknown as Json, real_actors: final.realActors, premiere_at: new Date().toISOString() }).eq("id", room.scene_id);
  await service.from("relay_rooms").update({ chat_expires_at: new Date(Date.now() + AFTER_PARTY_MS).toISOString() }).eq("code", room.code);
  await postSystem(room.code, "🍿 완성! 다 같이 들어 봐요. 채팅은 24시간 뒤에 사라져요.", service);
  await broadcast(room.code, "scene", {});
  await notifyOffline(room, `🍿 「${room.title || s.title}」 완성! 다 같이 들어 봐요`, [], service);
  return true;
}

// ---- 녹음 지우기 · 나가기 · 방 지우기 ----

async function removeAudio(paths: string[], service: Service) {
  for (let i = 0; i < paths.length; i += 100) {
    const chunk = paths.slice(i, i + 100);
    if (chunk.length) await service.storage.from("recordings").remove(chunk);
  }
}

/**
 * 한 사람의 이 방 녹음을 전부 지운다. 장면 방이면 맡은 배역도 비운다.
 * 이미 완성된 장면이면 정식판에서 그 사람 줄을 AI 목소리로 돌린다(재생이 끊기지 않게).
 */
export async function wipeMember(room: RoomRow, owner: string, service: Service = createServiceClient()): Promise<void> {
  if (room.kind === "script") {
    const { data } = await service.from("relay_room_takes").delete().eq("room", room.code).eq("owner", owner).select("audio_path");
    await removeAudio((data ?? []).map((d) => d.audio_path), service);
    return;
  }
  if (!room.scene_id) return;
  const { data } = await service.from("relay_takes").delete().eq("scene_id", room.scene_id).eq("owner", owner).select("audio_path");
  await removeAudio((data ?? []).map((d) => d.audio_path), service);
  await service.from("relay_roles").delete().eq("scene_id", room.scene_id).eq("owner", owner);
  const { data: sc } = await service.from("relay_scenes").select("final").eq("id", room.scene_id).maybeSingle();
  const final = sc?.final as unknown as FinalCut | null;
  if (final?.lines?.some((l) => l.owner === owner)) {
    const clear = <T extends { owner: string | null }>(l: T): T => (l.owner === owner ? { ...l, takeId: null, owner: null, name: null, avatar: null, adlibId: null } : l);
    const next = { ...final, lines: final.lines.map(clear), alt: (final.alt ?? []).map(clear), twist: final.twist ? clear(final.twist) : null };
    await service.from("relay_scenes").update({ final: next as unknown as Json }).eq("id", room.scene_id);
  }
}

/** 방을 통째로 지운다 — 녹음 파일 · 장면 · 멤버 · 채팅 · 대본 */
export async function deleteRoom(room: RoomRow, service: Service = createServiceClient()): Promise<void> {
  const paths: string[] = [];
  const { data: rt } = await service.from("relay_room_takes").select("audio_path").eq("room", room.code);
  paths.push(...(rt ?? []).map((t) => t.audio_path));
  if (room.scene_id) {
    const { data: st } = await service.from("relay_takes").select("audio_path").eq("scene_id", room.scene_id);
    paths.push(...(st ?? []).map((t) => t.audio_path));
  }
  await removeAudio(paths, service);
  await service.from("relay_rooms").delete().eq("code", room.code);
  // 장면 방 장면은 방과 함께 — 공개 장면은 절대 건드리지 않는다
  if (room.scene_id) await service.from("relay_scenes").delete().eq("id", room.scene_id).in("status", ["room", "room_done"]);
}

/**
 * 나가기 — 내 녹음을 지우고 멤버에서 빠진다. 아무도 안 남으면 방을 지운다.
 * 방장이 나가면 가장 먼저 들어온 사람이 방장이 된다.
 */
export async function leaveRoom(room: RoomRow, owner: string, name: string, service: Service = createServiceClient()): Promise<"left" | "deleted"> {
  await wipeMember(room, owner, service);
  await service.from("relay_room_members").delete().eq("room", room.code).eq("owner", owner);
  const rest = (await membersOf(room.code, service)).filter((m) => !m.kicked);
  if (!rest.length) {
    await deleteRoom(room, service);
    return "deleted";
  }
  if (room.host === owner) {
    const next = rest[0];
    await service.from("relay_rooms").update({ host: next.owner, host_user: next.user_id }).eq("code", room.code);
    await postSystem(room.code, `🚪 ${name}님이 나갔어요. 이제 ${next.name}님이 방장이에요.`, service);
  } else await postSystem(room.code, `🚪 ${name}님이 나갔어요`, service);
  await broadcast(room.code, "room", {});
  await broadcast(room.code, "scene", {});
  return "left";
}

// ---- 목록 ----

export type RoomCardView = { code: string; title: string; kind: "scene" | "script"; members: number; done: boolean; lastAt: string; locked: boolean; mine?: boolean; host?: boolean };

async function cardsOf(rows: RoomRow[], service: Service, v: Viewer | null): Promise<RoomCardView[]> {
  if (!rows.length) return [];
  const codes = rows.map((r) => r.code);
  const sceneIds = rows.map((r) => r.scene_id).filter((x): x is string => !!x);
  const [{ data: mem }, { data: sc }] = await Promise.all([
    service.from("relay_room_members").select("room").in("room", codes).eq("kicked", false),
    sceneIds.length ? service.from("relay_scenes").select("id, title, status").in("id", sceneIds) : Promise.resolve({ data: [] as { id: string; title: string; status: string }[] }),
  ]);
  const count = new Map<string, number>();
  for (const m of mem ?? []) count.set(m.room, (count.get(m.room) ?? 0) + 1);
  return rows.map((r) => {
    const s = (sc ?? []).find((x) => x.id === r.scene_id);
    return {
      code: r.code,
      title: r.title || s?.title || "더빙 방",
      kind: r.kind,
      members: count.get(r.code) ?? 0,
      done: s?.status === "room_done",
      lastAt: r.last_at,
      locked: r.locked,
      host: v ? v.keys.includes(r.host) : undefined,
    };
  });
}

/** 내가 들어가 있는 방 · 공개 방(최근 3일 활동, 잠기지 않은 것) */
export async function roomLists(v: Viewer, service: Service = createServiceClient()): Promise<{ mine: RoomCardView[]; open: RoomCardView[]; ready: boolean; v2: boolean }> {
  const v2 = await roomsV2(service);
  const cols = v2 ? COLS : COLS_V1;
  let mineRows: RoomRow[] = [];
  if (v.keys.length) {
    const { data, error } = await service.from("relay_room_members").select("room, joined_at").in("owner", v.keys).eq("kicked", false).order("joined_at", { ascending: false }).limit(20);
    if (missing(error)) return { mine: [], open: [], ready: false, v2: false };
    const codes = (data ?? []).map((d) => d.room);
    if (codes.length) {
      const { data: rows } = await service.from("relay_rooms").select(cols).in("code", codes);
      mineRows = codes.map((c) => (rows as unknown as RoomRow[] | null)?.find((r) => r.code === c)).filter((r): r is RoomRow => !!r).map(withDefaults);
    }
  }
  let openRows: RoomRow[] = [];
  if (v2) {
    const since = new Date(Date.now() - LIST_DAYS * 24 * 3600_000).toISOString();
    const { data } = await service.from("relay_rooms").select(COLS).eq("public", true).eq("locked", false).gte("last_at", since).order("last_at", { ascending: false }).limit(30);
    const mineSet = new Set(mineRows.map((r) => r.code));
    openRows = ((data ?? []) as unknown as RoomRow[]).map(withDefaults).filter((r) => !mineSet.has(r.code));
  }
  const [mine, open] = await Promise.all([cardsOf(mineRows, service, v), cardsOf(openRows, service, null)]);
  return { mine: mine.map((m) => ({ ...m, mine: true })), open: open.filter((o) => o.members > 0 && o.members < MAX_MEMBERS), ready: true, v2 };
}

// ---- 크론 ----

/**
 * 크론 — 장면 방 72시간 자동 완성 · 뒤풀이 끝난 채팅 삭제 ·
 * 7일 동안 방을 안 연 멤버는 나간 것으로(녹음 삭제) · 멤버가 아무도 없는 방 삭제.
 */
export async function sweepRooms(service: Service = createServiceClient()): Promise<{ finished: number; cleared: number; left: number; removed: number }> {
  const out = { finished: 0, cleared: 0, left: 0, removed: 0 };
  const v2 = await roomsV2(service);
  const { data: rows, error } = await service.from("relay_rooms").select(v2 ? COLS : COLS_V1).limit(2000);
  if (error || !rows?.length) return out;
  const now = Date.now();
  const rooms = (rows as unknown as RoomRow[]).map(withDefaults);
  const sceneIds = rooms.map((r) => r.scene_id).filter((x): x is string => !!x);
  const { data: scenes } = sceneIds.length ? await service.from("relay_scenes").select("id, status, premiere_at").in("id", sceneIds) : { data: [] };
  const byId = new Map((scenes ?? []).map((s) => [s.id, s]));
  for (const r of rooms) {
    // 오래 안 온 멤버 → 나간 것으로
    const members = await membersOf(r.code, service);
    for (const m of members) {
      if (m.kicked) continue;
      const seen = new Date(m.seen_at ?? m.joined_at).getTime();
      if (now - seen > IDLE_MEMBER_MS) {
        await leaveRoom(r, m.owner, m.name, service);
        out.left++;
      }
    }
    if (!(await membersOf(r.code, service)).some((m) => !m.kicked)) {
      const still = await findRoom(r.code, service);
      if (still) await deleteRoom(still, service);
      out.removed++;
      continue;
    }
    const s = r.scene_id ? byId.get(r.scene_id) : null;
    if (s?.status === "room" && s.premiere_at && new Date(s.premiere_at).getTime() <= now && (await finishRoom(r, service))) out.finished++;
    if (r.chat_expires_at && new Date(r.chat_expires_at).getTime() <= now) {
      const { count } = await service.from("relay_room_msgs").delete({ count: "exact" }).eq("room", r.code);
      if (count) out.cleared++;
    }
  }
  return out;
}
