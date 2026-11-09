import { normalizeAvatar } from "@/lib/avatar";
import { cleanNickname } from "@/lib/nickname";
import { allow, clientIp, tooMany } from "@/lib/rate-limit";
import { requestT } from "@/lib/i18n";
import { RELAY_STOCK } from "@/lib/relay-stock";
import { createServiceClient } from "@/lib/supabase/service";
import { displayName, insertStockLines, ownerOf } from "@/lib/relay-server";
import { json, requestViewer } from "@/lib/relay-req";
import { missing, newCode, postSystem, ROOM_HOURS, ROOMS_PER_DAY } from "@/lib/room-server";
import type { Json } from "@/types/database";

/** 방 만들 때 고를 장면들 + 내가 들어가 있는 방 */
export async function GET(req: Request) {
  const v = await requestViewer(new URL(req.url).searchParams.get("client"));
  const scenes = RELAY_STOCK.map((s) => ({ key: s.key, title: s.title, logline: s.logline, genre: s.genre, hall: s.hall, roles: s.roles.length, lines: s.lines.length }));
  let mine: { code: string; title: string; done: boolean }[] = [];
  let ready = true;
  if (v.keys.length) {
    const service = createServiceClient();
    const { data, error } = await service.from("relay_room_members").select("room, joined_at").in("owner", v.keys).eq("kicked", false).order("joined_at", { ascending: false }).limit(10);
    if (missing(error)) ready = false;
    const codes = (data ?? []).map((r) => r.room);
    if (codes.length) {
      const { data: rooms } = await service.from("relay_rooms").select("code, scene_id").in("code", codes);
      const ids = (rooms ?? []).map((r) => r.scene_id);
      const { data: sc } = ids.length ? await service.from("relay_scenes").select("id, title, status").in("id", ids) : { data: [] };
      mine = codes.flatMap((c) => {
        const r = rooms?.find((x) => x.code === c);
        const s = r && sc?.find((x) => x.id === r.scene_id);
        return s ? [{ code: c, title: s.title, done: s.status === "room_done" }] : [];
      });
    }
  }
  return json({ scenes, mine, ready });
}

/** 방 만들기 — 비축 장면 하나를 복사해 방 장면(status room)으로. 만든 사람이 방장. */
export async function POST(req: Request) {
  const t = requestT(req);
  if (!allow(`room-new:${clientIp(req)}`, 10, 3_600_000)) return tooMany(t("방을 너무 많이 만들었어요. 잠시 뒤에 해 주세요.", "Too many rooms."));
  const b = (await req.json().catch(() => ({}))) as { client?: string; stockKey?: string; name?: string; avatar?: unknown };
  const v = await requestViewer(b.client);
  const owner = ownerOf(v);
  if (!owner) return json({ error: t("이 브라우저는 저장이 막혀 있어 로그인해야 방을 만들 수 있어요.", "Log in to make a room.") }, 401);
  const pick = RELAY_STOCK.find((s) => s.key === b.stockKey);
  if (!pick) return json({ error: t("없는 장면이에요.", "Unknown scene.") }, 400);

  const service = createServiceClient();
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { count, error: cErr } = await service.from("relay_rooms").select("code", { count: "exact", head: true }).eq("host", owner).gte("created_at", since);
  if (missing(cErr)) return json({ error: t("방 기능을 준비하고 있어요. 조금만 기다려 주세요!", "Rooms are coming soon!"), notReady: true }, 503);
  if ((count ?? 0) >= ROOMS_PER_DAY) return json({ error: t(`방은 하루에 ${ROOMS_PER_DAY}개까지 만들 수 있어요.`, `Up to ${ROOMS_PER_DAY} rooms a day.`) }, 429);

  const now = Date.now();
  const { data: scene, error } = await service
    .from("relay_scenes")
    .insert({
      hall: pick.hall,
      stock_key: pick.key,
      title: pick.title,
      logline: pick.logline,
      genre: pick.genre,
      roles: pick.roles as unknown as Json,
      status: "room",
      opens_at: new Date(now).toISOString(),
      premiere_at: new Date(now + ROOM_HOURS * 3600_000).toISOString(),
    })
    .select("id")
    .single();
  if (error || !scene) {
    console.error("room scene", error?.message);
    return json({ error: t("방 기능을 준비하고 있어요. 조금만 기다려 주세요!", "Rooms are coming soon!"), notReady: true }, 503);
  }
  const fail = async (msg: string) => {
    await service.from("relay_scenes").delete().eq("id", scene.id);
    return json({ error: msg }, 500);
  };
  if (!(await insertStockLines(scene.id, pick, service))) return fail(t("방을 만들지 못했어요.", "Couldn't make the room."));
  const code = newCode();
  const { error: rErr } = await service.from("relay_rooms").insert({ code, scene_id: scene.id, host: owner, host_user: v.userId });
  if (rErr) return fail(t("방을 만들지 못했어요.", "Couldn't make the room."));
  const name = await displayName(v, cleanNickname(b.name), service);
  await service.from("relay_room_members").insert({ room: code, owner, user_id: v.userId, name, avatar: normalizeAvatar(b.avatar, owner) as unknown as Json, seen_at: new Date().toISOString() });
  await postSystem(code, `🎬 ${name}님이 「${pick.title}」 방을 열었어요. 링크로 친구를 불러 배역을 나눠 보세요!`, service);
  return json({ code });
}
