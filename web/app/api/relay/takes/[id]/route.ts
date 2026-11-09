import { createServiceClient } from "@/lib/supabase/service";
import { ownerOf } from "@/lib/relay-server";
import { json, requestViewer } from "@/lib/relay-req";
import { broadcast, findRoom } from "@/lib/room-server";

/**
 * 출연 되돌리기 — 내 녹음만. 그 배역에 내 녹음이 하나도 안 남으면 배역도 내려놓는다
 * (되돌린 뒤 다른 배역을 맡을 수 있게). 개봉한 장면은 지울 수 없다 — 정식판이 박제됐다.
 */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const v = await requestViewer(new URL(req.url).searchParams.get("client"));
  const owner = ownerOf(v);
  if (!owner || !/^[0-9a-f-]{36}$/.test(id)) return json({ error: "forbidden" }, 403);
  const service = createServiceClient();
  const { data: take } = await service.from("relay_takes").select("id, scene_id, line_id, owner, audio_path, kind").eq("id", id).maybeSingle();
  if (!take || !v.keys.includes(take.owner)) return json({ error: "forbidden" }, 403);
  const { data: scene } = await service.from("relay_scenes").select("status").eq("id", take.scene_id).maybeSingle();
  if (scene?.status !== "live" && scene?.status !== "room") return json({ error: "premiered" }, 409);
  // 줄을 지우면 그 줄의 애드리브도 같이
  const { data: gone } = await service
    .from("relay_takes")
    .delete()
    .eq("line_id", take.line_id)
    .eq("owner", take.owner)
    .in("kind", take.kind === "line" ? ["line", "adlib"] : ["adlib"])
    .select("audio_path");
  const paths = (gone ?? []).map((g) => g.audio_path);
  if (paths.length) await service.storage.from("recordings").remove(paths);

  if (take.kind === "line") {
    const { data: line } = await service.from("relay_lines").select("role, candidate").eq("id", take.line_id).maybeSingle();
    if (line && !line.candidate) {
      const { data: sameRole } = await service.from("relay_lines").select("id").eq("scene_id", take.scene_id).eq("role", line.role).eq("candidate", false);
      const ids = (sameRole ?? []).map((l) => l.id);
      const { count } = await service.from("relay_takes").select("id", { count: "exact", head: true }).in("line_id", ids).eq("owner", take.owner).eq("kind", "line");
      if (!count) await service.from("relay_roles").delete().eq("scene_id", take.scene_id).eq("role", line.role).eq("owner", take.owner);
    }
  }
  if (scene?.status === "room") {
    const room = await findRoom(take.scene_id, service);
    if (room) await broadcast(room.code, "scene", {});
  }
  return json({ ok: true });
}
