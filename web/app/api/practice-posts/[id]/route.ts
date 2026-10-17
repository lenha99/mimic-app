import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/** 내 게시물 내리기 — 파일 먼저, 행은 그다음 (행이 먼저 지워지면 파일 경로를 잃는다). */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });

  const service = createServiceClient();
  const { data: row } = await service
    .from("practice_posts")
    .select("id, user_id, audio_path")
    .eq("id", id)
    .maybeSingle();
  if (!row || row.user_id !== user.id) {
    return Response.json({ error: "내 게시물이 아니에요." }, { status: 404 });
  }
  const { error: fileError } = await service.storage.from("recordings").remove([row.audio_path]);
  if (fileError) return Response.json({ error: "내리지 못했어요. 다시 해주세요." }, { status: 500 });
  await service.from("practice_posts").delete().eq("id", id);
  return Response.json({ ok: true });
}
