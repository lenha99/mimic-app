import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { lookOf, nextUnlock, progressOf, xpOf, type PassStats } from "@/lib/pass";
import { keysOf, statsFor, statsOfEntryOwner } from "@/lib/pass-server";

/**
 * VOICE PASS — ?entry=<출전작> 이면 그 목소리 주인의 것(공개), 없으면 지금 보는 사람 자신의 것.
 */
const CLIENT = /^[a-z0-9]{8,40}$/;
const ID = /^[0-9a-f-]{36}$/i;

function view(stats: PassStats, self: boolean) {
  const xp = xpOf(stats);
  const p = progressOf(xp);
  return { stats, xp, look: lookOf(stats), progress: p, next: nextUnlock(p.level), self };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = url.searchParams.get("client") ?? "";
  const client = CLIENT.test(raw) ? raw : null;
  const entry = url.searchParams.get("entry") ?? "";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const service = createServiceClient();
  const mine = keysOf(user?.id ?? null, client);
  const headers = { "cache-control": "no-store" };

  if (ID.test(entry)) {
    const r = await statsOfEntryOwner(entry, service);
    if (!r) return Response.json({ error: "not-found" }, { status: 404, headers });
    return Response.json(view(r.stats, mine.includes(r.owner)), { headers });
  }
  return Response.json(view(await statsFor(mine, service), true), { headers });
}
