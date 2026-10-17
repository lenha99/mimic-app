import { HIDE_AT_REPORTS } from "@/lib/board";
import { allow, tooMany } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * 신고 — 게시물(연습) 또는 그 안의 피드백 하나. 서로 다른 두 사람이 신고하면 바로
 * 숨긴다. 운영자 확인을 기다리면 그동안 계속 들린다. 잘못 숨긴 건 운영자가 되살린다.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "로그인하면 신고할 수 있어요." }, { status: 401 });
  if (!allow(`report:${user.id}`, 20, 3_600_000)) return tooMany();

  const { noteId } = (await req.json().catch(() => ({}))) as { noteId?: unknown };
  const isNote = typeof noteId === "string";
  const key = isNote ? (noteId as string) : id;
  const service = createServiceClient();

  const { error } = await service
    .from("practice_reports")
    .insert(isNote ? { user_id: user.id, note_id: key } : { user_id: user.id, post_id: key });
  // 같은 사람이 또 누르면 unique 위반 — 이미 센 것이니 조용히 성공으로 돌려준다.
  if (error && error.code !== "23505") {
    return Response.json({ error: "신고하지 못했어요. 다시 해주세요." }, { status: 500 });
  }

  const { count } = await service
    .from("practice_reports")
    .select("user_id", { count: "exact", head: true })
    .eq(isNote ? "note_id" : "post_id", key);
  const n = count ?? 0;
  const patch = n >= HIDE_AT_REPORTS ? { reports: n, hidden: true } : { reports: n };
  if (isNote) await service.from("practice_notes").update(patch).eq("id", key);
  else await service.from("practice_posts").update(patch).eq("id", key);
  return Response.json({ ok: true });
}
