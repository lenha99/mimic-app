import { requestT } from "@/lib/i18n";
import { createServiceClient } from "@/lib/supabase/service";
import { badText } from "@/lib/relay-server";
import { json, requestViewer } from "@/lib/relay-req";
import { broadcast, finishRoom, findRoom, hashKey, membersOf, postSystem, wipeMember } from "@/lib/room-server";
import { cleanTitle } from "@/lib/room-script";

type Body = {
  client?: string;
  action?: "kick" | "lock" | "unlock" | "finish" | "free_role" | "rename" | "public" | "private";
  who?: string;
  role?: string;
  title?: string;
};

/** 방장 도구 — 제목 바꾸기 · 목록 공개/비공개 · 잠그기/열기 · 내보내기 · (장면 방) 완성 · 배역 비우기 */
export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const t = requestT(req);
  const { code } = await ctx.params;
  const b = (await req.json().catch(() => ({}))) as Body;
  const v = await requestViewer(b.client);
  const service = createServiceClient();
  const room = await findRoom(code, service);
  if (!room) return json({ error: t("없는 방이에요.", "No such room.") }, 404);
  if (!v.keys.includes(room.host)) return json({ error: t("방장만 할 수 있어요.", "Host only.") }, 403);
  const changed = async (text: string) => {
    await postSystem(room.code, text, service);
    await broadcast(room.code, "room", {});
    return json({ ok: true });
  };

  if (b.action === "rename") {
    const title = cleanTitle(b.title);
    if (!title) return json({ error: t("제목을 써 주세요.", "Write a title.") }, 400);
    if (badText(title)) return json({ error: t("제목에 쓸 수 없는 말이 있어요.", "That title isn't allowed.") }, 400);
    const { error } = await service.from("relay_rooms").update({ title }).eq("code", room.code);
    if (error) return json({ error: t("지금은 제목을 바꿀 수 없어요.", "Can't rename right now.") }, 503);
    return changed(`✏️ 방 제목이 「${title}」(으)로 바뀌었어요`);
  }

  if (b.action === "public" || b.action === "private") {
    const { error } = await service.from("relay_rooms").update({ public: b.action === "public" }).eq("code", room.code);
    if (error) return json({ error: t("지금은 바꿀 수 없어요.", "Can't change right now.") }, 503);
    return changed(b.action === "public" ? "🌐 방이 목록에 공개됐어요. 누구나 찾아 들어올 수 있어요." : "🔗 방이 목록에서 빠졌어요. 이제 링크로만 들어와요.");
  }

  if (b.action === "lock" || b.action === "unlock") {
    await service.from("relay_rooms").update({ locked: b.action === "lock" }).eq("code", room.code);
    return changed(b.action === "lock" ? "🔒 방장이 방을 잠갔어요. 새 사람은 못 들어와요." : "🔓 방장이 방을 다시 열었어요.");
  }

  if (b.action === "finish") {
    const ok = await finishRoom(room, service);
    return ok ? json({ ok: true }) : json({ error: t("이미 완성됐거나 완성할 수 없는 방이에요.", "Can't finish this room.") }, 409);
  }

  if (b.action === "kick") {
    const target = (await membersOf(room.code, service)).find((m) => hashKey(m.owner) === b.who);
    if (!target || target.owner === room.host) return json({ error: t("내보낼 수 없어요.", "Can't remove.") }, 400);
    await service.from("relay_room_members").update({ kicked: true }).eq("room", room.code).eq("owner", target.owner);
    // 내보낸 사람의 이 방 녹음은 지운다(배역도 비워져 다른 사람이 맡을 수 있다)
    await wipeMember(room, target.owner, service);
    await broadcast(room.code, "scene", {});
    return changed(`🚪 ${target.name}님이 방에서 나갔어요`);
  }

  if (b.action === "free_role" && b.role && room.scene_id) {
    const { data: sc } = await service.from("relay_scenes").select("status").eq("id", room.scene_id).maybeSingle();
    if (sc?.status !== "room") return json({ error: t("완성된 방은 바꿀 수 없어요.", "Finished rooms can't change.") }, 409);
    const { data: owner } = await service.from("relay_roles").select("owner").eq("scene_id", room.scene_id).eq("role", b.role).maybeSingle();
    if (!owner) return json({ ok: true });
    const { data: lines } = await service.from("relay_lines").select("id").eq("scene_id", room.scene_id).eq("role", b.role);
    const ids = (lines ?? []).map((l) => l.id);
    if (ids.length) {
      const { data: gone } = await service.from("relay_takes").delete().in("line_id", ids).eq("owner", owner.owner).select("audio_path");
      const paths = (gone ?? []).map((g) => g.audio_path);
      if (paths.length) await service.storage.from("recordings").remove(paths);
    }
    await service.from("relay_roles").delete().eq("scene_id", room.scene_id).eq("role", b.role);
    await broadcast(room.code, "scene", {});
    return changed("🎭 방장이 배역 하나를 비웠어요. 누구나 맡을 수 있어요.");
  }
  return json({ error: "bad action" }, 400);
}
