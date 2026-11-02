import { allow, clientIp, tooMany } from "@/lib/rate-limit";
import { currentUserId } from "@/lib/social-server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * 웹 푸시 구독 저장(POST) · 지우기(DELETE). 게스트도 된다 — 기기 id(client)로 묶어서
 * "내 출전작을 누가 들었어요"가 가입 없이도 온다.
 */
const CLIENT = /^[a-z0-9]{8,40}$/;

export async function POST(req: Request) {
  if (!allow(`push:${clientIp(req)}`, 20, 600_000)) return tooMany("Too many tries.");
  const b = (await req.json().catch(() => ({}))) as {
    subscription?: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
    client?: unknown;
    newEntries?: unknown;
    mine?: unknown;
    dm?: unknown;
  };
  const endpoint = b.subscription?.endpoint;
  const p256dh = b.subscription?.keys?.p256dh;
  const auth = b.subscription?.keys?.auth;
  if (typeof endpoint !== "string" || !/^https:\/\//.test(endpoint) || endpoint.length > 1000) return Response.json({ error: "bad" }, { status: 400 });
  if (typeof p256dh !== "string" || typeof auth !== "string" || p256dh.length > 200 || auth.length > 100) return Response.json({ error: "bad" }, { status: 400 });
  const client = typeof b.client === "string" && CLIENT.test(b.client) ? b.client : null;
  const userId = await currentUserId();
  if (!userId && !client) return Response.json({ error: "no identity" }, { status: 400 });
  const service = createServiceClient();
  const base = { endpoint, p256dh, auth, user_id: userId, client, new_entries: b.newEntries !== false };
  let { error } = await service.from("push_subs").upsert({ ...base, mine: b.mine !== false, dm: b.dm !== false });
  // 종류별 열(마이그레이션 26)이 아직 없으면 예전 모양으로 저장한다.
  if (error && /mine|dm|column/i.test(error.message)) ({ error } = await service.from("push_subs").upsert(base));
  if (error) return Response.json({ error: "failed" }, { status: 500 });
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { endpoint } = (await req.json().catch(() => ({}))) as { endpoint?: unknown };
  if (typeof endpoint !== "string") return Response.json({ error: "bad" }, { status: 400 });
  await createServiceClient().from("push_subs").delete().eq("endpoint", endpoint);
  return Response.json({ ok: true });
}
