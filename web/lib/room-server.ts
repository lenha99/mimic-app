import { randomBytes } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";
import { notify } from "@/lib/notify-server";
import { normalizeAvatar } from "@/lib/avatar";
import { computeFinal, type SceneView } from "@/lib/relay";
import { loadScene, publicView, type Viewer } from "@/lib/relay-server";
import type { Json } from "@/types/database";

/**
 * 릴레이 더빙 방 — 서버 전용. 친구·구독자끼리 링크로 들어와 배역을 나눠 찍고 채팅한다.
 *
 * - 방 장면은 relay_scenes.status = 'room'(찍는 중) · 'room_done'(완성). 공개 상영관 코드는 이 상태를 안 본다.
 * - 링크(코드)가 입장권. 방장은 잠그기·내보내기·배역 비우기·완성을 한다.
 * - 채팅 실시간 전달은 Supabase Realtime broadcast(REST). 실패해도 화면이 10초마다 다시 읽는다.
 * - 완성 24시간 뒤(뒤풀이) 채팅을 지운다 — 크론(/api/cron/relay)이 sweepRooms 를 부른다.
 */
type Service = ReturnType<typeof createServiceClient>;

export const ROOM_HOURS = 72; // 방장이 완성을 안 눌러도 72시간 뒤엔 완성
export const AFTER_PARTY_MS = 24 * 3600_000; // 완성 뒤 채팅이 남는 시간
export const MAX_MSG = 300;
export const ROOMS_PER_DAY = 3;
export const MSGS_PER_DAY = 500;
const NOTIFY_GAP_MS = 30 * 60_000;
const EMPTY_ROOM_MS = 7 * 24 * 3600_000;

export type RoomRow = { code: string; scene_id: string; host: string; host_user: string | null; locked: boolean; chat_expires_at: string | null; created_at: string };
export type MemberRow = { owner: string; user_id: string | null; name: string; avatar: Json; kicked: boolean; notified_at: string | null; seen_at: string | null; joined_at: string };
export type Msg = { id: number; kind: "chat" | "system"; name: string; text: string; at: string; mine?: boolean; who?: string | null };

export const newCode = () => randomBytes(16).toString("base64url");
export const validCode = (c: unknown): c is string => typeof c === "string" && /^[A-Za-z0-9_-]{16,32}$/.test(c);
const isUuid = (c: string) => /^[0-9a-f-]{36}$/.test(c);

/** 방 표가 아직 없으면(마이그레이션 38 전) */
export const missing = (e: { code?: string; message?: string } | null | undefined) =>
  !!e && (e.code === "42P01" || e.code === "PGRST205" || /relay_room|does not exist|schema cache/i.test(e.message ?? ""));

/** 코드 또는 장면 id(알림 링크)로 방 찾기 */
export async function findRoom(codeOrScene: string, service: Service = createServiceClient()): Promise<RoomRow | null> {
  if (!validCode(codeOrScene) && !isUuid(codeOrScene)) return null;
  const col = isUuid(codeOrScene) ? "scene_id" : "code";
  const { data } = await service.from("relay_rooms").select("code, scene_id, host, host_user, locked, chat_expires_at, created_at").eq(col, codeOrScene).maybeSingle();
  return (data as RoomRow | null) ?? null;
}

export async function membersOf(code: string, service: Service = createServiceClient()): Promise<MemberRow[]> {
  const { data } = await service.from("relay_room_members").select("owner, user_id, name, avatar, kicked, notified_at, seen_at, joined_at").eq("room", code).order("joined_at");
  return (data ?? []) as MemberRow[];
}

export function memberOf(members: MemberRow[], v: Viewer): MemberRow | null {
  return members.find((m) => v.keys.includes(m.owner)) ?? null;
}

/** 방 화면에 내려 주는 것 — 장면(남의 이름표는 가림) · 멤버 · 내 상태 */
export async function roomView(room: RoomRow, v: Viewer, service: Service = createServiceClient()) {
  const [scene, members] = await Promise.all([loadScene(room.scene_id, v, service), membersOf(room.code, service)]);
  if (!scene) return null;
  const me = memberOf(members, v);
  const pv: SceneView = { ...publicView(scene), room: me && !me.kicked ? room.code : null };
  return {
    code: room.code,
    scene: pv,
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
        roles: scene.owners.filter((o) => o.owner === m.owner).map((o) => o.role),
      })),
  };
}

/** 남의 기기 이름표를 그대로 내려보내지 않는다 — 방장이 내보내기 할 때 이 값으로 가리킨다 */
export function hashKey(k: string): string {
  let h = 2166136261;
  for (let i = 0; i < k.length; i++) h = Math.imul(h ^ k.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
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
      push: { title: "💬 더빙 방", body: title, url: `/relay/r/${room.code}`, tag: `room-${room.code}` },
    });
  }
}

/**
 * 방 완성 — 지금 녹음으로 정식판을 박제하고, 채팅은 24시간 뒤풀이 뒤에 지운다.
 * 진짜 녹음이 0개여도 무효로 돌리지 않는다(친구끼리 만든 방이다).
 */
export async function finishRoom(room: RoomRow, service: Service = createServiceClient()): Promise<boolean> {
  const { data: claimed } = await service.from("relay_scenes").update({ status: "room_done" }).eq("id", room.scene_id).eq("status", "room").select("id");
  if (!claimed?.length) return false;
  const s = await loadScene(room.scene_id, null, service);
  if (!s) return false;
  const final = computeFinal(s);
  await service.from("relay_scenes").update({ final: final as unknown as Json, real_actors: final.realActors, premiere_at: new Date().toISOString() }).eq("id", room.scene_id);
  await service.from("relay_rooms").update({ chat_expires_at: new Date(Date.now() + AFTER_PARTY_MS).toISOString() }).eq("code", room.code);
  await postSystem(room.code, "🍿 완성! 다 같이 들어 봐요. 채팅은 24시간 뒤에 사라져요.", service);
  await broadcast(room.code, "scene", {});
  await notifyOffline(room, `🍿 「${s.title}」 완성! 다 같이 들어 봐요`, [], service);
  return true;
}

/** 크론 — 72시간 지난 방 완성 · 뒤풀이 끝난 방 채팅 삭제 · 녹음 없이 7일 지난 방 삭제 */
export async function sweepRooms(service: Service = createServiceClient()): Promise<{ finished: number; cleared: number; removed: number }> {
  const out = { finished: 0, cleared: 0, removed: 0 };
  const { data: rooms, error } = await service.from("relay_rooms").select("code, scene_id, host, host_user, locked, chat_expires_at, created_at").limit(1000);
  if (error || !rooms?.length) return out;
  const now = Date.now();
  const ids = rooms.map((r) => r.scene_id);
  const { data: scenes } = await service.from("relay_scenes").select("id, status, premiere_at").in("id", ids);
  const byId = new Map((scenes ?? []).map((s) => [s.id, s]));
  for (const r of rooms as RoomRow[]) {
    const s = byId.get(r.scene_id);
    if (!s) continue;
    if (s.status === "room") {
      const age = now - new Date(r.created_at).getTime();
      if (age > EMPTY_ROOM_MS) {
        const { count } = await service.from("relay_takes").select("id", { count: "exact", head: true }).eq("scene_id", r.scene_id);
        if (!count) {
          await service.from("relay_scenes").delete().eq("id", r.scene_id).eq("status", "room");
          out.removed++;
          continue;
        }
      }
      if (s.premiere_at && new Date(s.premiere_at).getTime() <= now && (await finishRoom(r, service))) out.finished++;
    } else if (r.chat_expires_at && new Date(r.chat_expires_at).getTime() <= now) {
      const { count } = await service.from("relay_room_msgs").delete({ count: "exact" }).eq("room", r.code);
      if (count) out.cleared++;
    }
  }
  return out;
}
