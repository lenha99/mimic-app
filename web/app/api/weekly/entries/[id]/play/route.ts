import { allow, clientIp } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * 끝까지 들었다 — 재생 수 +1. 화면이 ❤ 를 열어 주는 바로 그 순간에 부른다.
 * 같은 네트워크에서 같은 출전작은 한 시간에 세 번까지만 센다. 실패해도 조용히 넘긴다.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response(null, { status: 204 });
  if (!allow(`weekly-play:${clientIp(req)}:${id}`, 3, 3_600_000)) return new Response(null, { status: 204 });
  await createServiceClient().rpc("weekly_bump_play", { p_entry: id });
  return new Response(null, { status: 204 });
}
