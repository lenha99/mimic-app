import { after } from "next/server";
import { notify, ownerTarget } from "@/lib/notify-server";
import { allow, clientIp } from "@/lib/rate-limit";
import { currentUserId } from "@/lib/social-server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * 끝까지 들었다 — 재생 수 +1. 화면이 ❤ 를 열어 주는 바로 그 순간에 부른다.
 * 같은 네트워크에서 같은 출전작은 한 시간에 세 번까지만 센다. 실패해도 조용히 넘긴다.
 *
 * 누가 들었는지(계정 또는 기기)도 남긴다 — 올린 사람에게 "처음으로 누가 들었어요"(한 번)와
 * 하루 요약(크론)을 보내려고. 본인 재생은 안 센다.
 */
const CLIENT = /^[a-z0-9]{8,40}$/;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response(null, { status: 204 });
  if (!allow(`weekly-play:${clientIp(req)}:${id}`, 3, 3_600_000)) return new Response(null, { status: 204 });
  const { client } = (await req.json().catch(() => ({}))) as { client?: unknown };
  const user = await currentUserId();
  const service = createServiceClient();
  await service.rpc("weekly_bump_play", { p_entry: id });

  const listener = user ? `u:${user}` : typeof client === "string" && CLIENT.test(client) ? `g:${client}` : null;
  if (listener) {
    after(async () => {
      try {
        const { data: e } = await service.from("weekly_entries").select("owner, user_id").eq("id", id).maybeSingle();
        if (!e || e.owner === listener || (user && e.user_id === user)) return;
        const { error } = await service.from("entry_listens").insert({ entry_id: id, listener });
        if (error) return; // 이미 들은 사람
        const { count } = await service.from("entry_listens").select("listener", { count: "exact", head: true }).eq("entry_id", id);
        if (count !== 1) return;
        await notify({
          ...ownerTarget(e.owner, e.user_id),
          kind: "listen_first",
          entryId: id,
          push: { title: "🎧 첫 청취자!", body: "누군가 당신 목소리를 처음으로 끝까지 들었어요", url: `/weekly/e/${id}`, tag: `listen-${id}` },
          pushKey: `first:${id}`,
        });
      } catch {}
    });
  }
  return new Response(null, { status: 204 });
}
