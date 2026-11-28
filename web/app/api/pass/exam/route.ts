import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { progressOf, xpOf } from "@/lib/pass";
import { keysOf, kstDay, statsFor } from "@/lib/pass-server";
import { EXAM_TRIES_PER_DAY } from "@/lib/rank-exam";
import { allow, clientIp, tooMany } from "@/lib/rate-limit";

/**
 * 승급전(11/28) — GET: 지금 도전할 수 있는 승급전과 오늘 남은 기회. POST: 결과 기록.
 *
 * 채점은 브라우저에서 한다(말 속도·억양 폭·쉼 — 비용 0). 서버는 "XP 가 찼는가 · 그 레벨 시험이
 * 맞는가 · 오늘 기회가 남았는가"만 지킨다. 걸린 게 꾸미기라 결과 자체는 믿는다.
 */
const CLIENT = /^[a-z0-9]{8,40}$/;
const headers = { "cache-control": "no-store" };

async function who(client: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const c = typeof client === "string" && CLIENT.test(client) ? client : null;
  return keysOf(user?.id ?? null, c);
}

async function state(keys: string[], service: ReturnType<typeof createServiceClient>) {
  const stats = await statsFor(keys, service);
  if (stats.cleared === undefined) return { ready: false as const };
  const p = progressOf(xpOf(stats), stats.cleared);
  if (!p.exam) return { ready: true as const, level: p.level, exam: null };
  const { count } = await service
    .from("rank_ups")
    .select("id", { count: "exact", head: true })
    .in("owner", keys)
    .eq("level", p.exam)
    .eq("passed", false)
    .eq("day", kstDay());
  return { ready: true as const, level: p.level, exam: { level: p.exam, triesLeft: Math.max(0, EXAM_TRIES_PER_DAY - (count ?? 0)) } };
}

export async function GET(req: Request) {
  const keys = await who(new URL(req.url).searchParams.get("client"));
  if (!keys.length) return Response.json({ ready: false }, { headers });
  return Response.json(await state(keys, createServiceClient()), { headers });
}

export async function POST(req: Request) {
  if (!allow(`exam:${clientIp(req)}`, 20, 600_000)) return tooMany();
  const b = (await req.json().catch(() => ({}))) as { client?: unknown; level?: unknown; passed?: unknown };
  const keys = await who(b.client);
  if (!keys.length) return Response.json({ error: "no identity" }, { status: 400, headers });
  const service = createServiceClient();
  const st = await state(keys, service);
  if (!st.ready || !st.exam || st.exam.level !== b.level) return Response.json({ error: "no-exam", ...st }, { status: 409, headers });
  if (st.exam.triesLeft <= 0) return Response.json({ error: "no-tries", ...st }, { status: 429, headers });
  const passed = b.passed === true;
  const { error } = await service.from("rank_ups").insert({ owner: keys[0], level: st.exam.level, passed, day: kstDay() });
  if (error) return Response.json({ error: "failed" }, { status: 500, headers });
  return Response.json(await state(keys, service), { headers });
}
