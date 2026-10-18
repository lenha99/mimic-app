import { isAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/service";

/** 운영자 — 출전작 숨기기·되살리기. 되살리면 신고 수도 0 으로 돌린다. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return Response.json({ error: "운영자만 할 수 있어요." }, { status: 403 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  const { hidden } = (await req.json().catch(() => ({}))) as { hidden?: unknown };
  if (typeof hidden !== "boolean") return Response.json({ error: "hidden 이 없어요." }, { status: 400 });

  const service = createServiceClient();
  if (!hidden) await service.from("weekly_reports").delete().eq("entry_id", id);
  const { error } = await service
    .from("weekly_entries")
    .update(hidden ? { hidden } : { hidden, reports: 0 })
    .eq("id", id);
  if (error) return Response.json({ error: "바꾸지 못했어요." }, { status: 500 });
  return Response.json({ ok: true });
}
