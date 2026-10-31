import { currentUserId, nicknames } from "@/lib/social-server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * 앱 안 알림 — GET ?count=1 이면 안 읽은 수만(하단 탭 점), 아니면 최근 40개.
 * POST 는 전부 읽음.
 */
export async function GET(req: Request) {
  const me = await currentUserId();
  if (!me) return Response.json({ unread: 0, items: [] });
  const service = createServiceClient();
  const { count } = await service
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", me)
    .is("read_at", null);
  if (new URL(req.url).searchParams.get("count")) return Response.json({ unread: count ?? 0 });
  const { data } = await service
    .from("notifications")
    .select("id, kind, actor, entry_id, thread_id, count, created_at, read_at")
    .eq("user_id", me)
    .order("id", { ascending: false })
    .limit(40);
  const who = await nicknames((data ?? []).map((n) => n.actor).filter((x): x is string => !!x), service);
  return Response.json({
    unread: count ?? 0,
    items: (data ?? []).map((n) => ({
      id: n.id,
      kind: n.kind,
      actor: n.actor ? (who.get(n.actor)?.nickname ?? null) : null,
      actorAvatar: n.actor ? (who.get(n.actor)?.avatar ?? null) : null,
      entryId: n.entry_id,
      threadId: n.thread_id,
      count: n.count,
      at: n.created_at,
      read: Boolean(n.read_at),
    })),
  });
}

export async function POST() {
  const me = await currentUserId();
  if (!me) return Response.json({ ok: false }, { status: 401 });
  await createServiceClient().from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", me).is("read_at", null);
  return Response.json({ ok: true });
}
