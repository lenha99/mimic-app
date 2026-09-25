import { isAdmin } from "@/lib/admin";
import { removeUgcAudio, UGC_ID } from "@/lib/challenges";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * 챌린지 검토: approve(홈 목록에 올리기) · reject(링크까지 막고 소리도 지우기) ·
 * unpublish(목록에서만 내리기 — 링크는 계속 된다).
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return Response.json({ error: "운영자만 할 수 있어요." }, { status: 403 });
  }
  const { id } = await ctx.params;
  if (!UGC_ID.test(id)) {
    return Response.json({ error: "잘못된 챌린지" }, { status: 400 });
  }
  const { action } = (await req.json().catch(() => ({}))) as { action?: unknown };
  const status =
    action === "approve" ? "approved" : action === "reject" ? "rejected" : action === "unpublish" ? "pending" : null;
  if (!status) {
    return Response.json({ error: "모르는 동작" }, { status: 400 });
  }

  const { error } = await createServiceClient()
    .from("challenges")
    .update({ status, reviewed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    return Response.json({ error: "바꾸지 못했어요." }, { status: 500 });
  }
  if (status === "rejected") await removeUgcAudio(id);
  return Response.json({ ok: true, status });
}
