import { requestT } from "@/lib/i18n";
import { createServiceClient } from "@/lib/supabase/service";
import { json, requestViewer } from "@/lib/relay-req";
import { broadcast, finishRoom, findRoom, hashKey, membersOf, postSystem } from "@/lib/room-server";

type Body = { client?: string; action?: "kick" | "lock" | "unlock" | "finish" | "free_role"; who?: string; role?: string };

/** 방장 도구 — 내보내기 · 잠그기/열기 · 완성 · 배역 비우기 */
export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const t = requestT(req);
  const { code } = await ctx.params;
  const b = (await req.json().catch(() => ({}))) as Body;
  const v = await requestViewer(b.client);
  const service = createServiceClient();
  const room = await findRoom(code, service);
  if (!room) return json({ error: t("없는 방이에요.", "No such room.") }, 404);
  if (!v.keys.includes(room.host)) return json({ error: t("방장만 할 수 있어요.", "Host only.") }, 403);

  if (b.action === "lock" || b.action === "unlock") {
    await service.from("relay_rooms").update({ locked: b.action === "lock" }).eq("code", room.code);
    await postSystem(room.code, b.action === "lock" ? "🔒 방장이 방을 잠갔어요. 새 사람은 못 들어와요." : "🔓 방장이 방을 다시 열었어요.", service);
    await broadcast(room.code, "room", {});
    return json({ ok: true });
  }

  if (b.action === "finish") {
    const ok = await finishRoom(room, service);
    return ok ? json({ ok: true }) : json({ error: t("이미 완성된 방이에요.", "Already finished.") }, 409);
  }

  if (b.action === "kick") {
    const target = (await membersOf(room.code, service)).find((m) => hashKey(m.owner) === b.who);
    if (!target || target.owner === room.host) return json({ error: t("내보낼 수 없어요.", "Can't remove.") }, 400);
    await service.from("relay_room_members").update({ kicked: true }).eq("room", room.code).eq("owner", target.owner);
    // 찍는 중이면 그 사람 배역을 비운다(녹음은 지우지 않고 정식판에서 빠지게 배역만) — 다른 사람이 맡을 수 있게
    const { data: sc } = await service.from("relay_scenes").select("status").eq("id", room.scene_id).maybeSingle();
    if (sc?.status === "room") await freeRolesOf(room.scene_id, target.owner, null, service);
    await postSystem(room.code, `🚪 ${target.name}님이 방에서 나갔어요`, service);
    await broadcast(room.code, "room", {});
    await broadcast(room.code, "scene", {});
    return json({ ok: true });
  }

  if (b.action === "free_role" && b.role) {
    const { data: sc } = await service.from("relay_scenes").select("status").eq("id", room.scene_id).maybeSingle();
    if (sc?.status !== "room") return json({ error: t("완성된 방은 바꿀 수 없어요.", "Finished rooms can't change.") }, 409);
    const { data: owner } = await service.from("relay_roles").select("owner").eq("scene_id", room.scene_id).eq("role", b.role).maybeSingle();
    if (!owner) return json({ ok: true });
    await freeRolesOf(room.scene_id, owner.owner, b.role, service);
    await postSystem(room.code, "🎭 방장이 배역 하나를 비웠어요. 누구나 맡을 수 있어요.", service);
    await broadcast(room.code, "scene", {});
    return json({ ok: true });
  }
  return json({ error: "bad action" }, 400);
}

/** 배역 비우기 — 배역 주인 표시와 그 배역 줄의 녹음을 지운다(role 이 null 이면 그 사람의 모든 배역) */
async function freeRolesOf(sceneId: string, owner: string, role: string | null, service: ReturnType<typeof createServiceClient>) {
  let q = service.from("relay_roles").select("role").eq("scene_id", sceneId).eq("owner", owner);
  if (role) q = q.eq("role", role);
  const roles = ((await q).data ?? []).map((r) => r.role);
  if (!roles.length) return;
  const { data: lines } = await service.from("relay_lines").select("id").eq("scene_id", sceneId).in("role", roles);
  const ids = (lines ?? []).map((l) => l.id);
  if (ids.length) {
    const { data: gone } = await service.from("relay_takes").delete().in("line_id", ids).eq("owner", owner).select("audio_path");
    const paths = (gone ?? []).map((g) => g.audio_path);
    if (paths.length) await service.storage.from("recordings").remove(paths);
  }
  await service.from("relay_roles").delete().eq("scene_id", sceneId).eq("owner", owner).in("role", roles);
}
