import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { earned, likeTier, nextGoals } from "@/lib/rewards";
import { keysOf, statsFor, statsOfEntryOwner } from "@/lib/rewards-server";

/**
 * 보상 — ?entry=<출전작> 이면 그 목소리 주인의 것(공개), 없으면 지금 보는 사람 자신의 것.
 * 자기 것이면 다음 목표(남은 수)도 같이 준다.
 */
const CLIENT = /^[a-z0-9]{8,40}$/;
const ID = /^[0-9a-f-]{36}$/i;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const clientRaw = url.searchParams.get("client") ?? "";
  const client = CLIENT.test(clientRaw) ? clientRaw : null;
  const entry = url.searchParams.get("entry") ?? "";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const service = createServiceClient();
  const mine = keysOf(user?.id ?? null, client);

  if (ID.test(entry)) {
    const r = await statsOfEntryOwner(entry, service);
    if (!r) return Response.json({ error: "not-found" }, { status: 404 });
    const self = mine.includes(r.owner);
    return Response.json(
      { earned: earned(r.stats), tier: likeTier(r.stats.likesReceived), stats: r.stats, self, next: self ? nextGoals(r.stats) : [] },
      { headers: { "cache-control": "no-store" } },
    );
  }
  const stats = await statsFor(mine, user?.id ?? null, service);
  return Response.json(
    { earned: earned(stats), tier: likeTier(stats.likesReceived), stats, self: true, next: nextGoals(stats) },
    { headers: { "cache-control": "no-store" } },
  );
}
