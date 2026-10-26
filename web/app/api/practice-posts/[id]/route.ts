import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requestT } from "@/lib/i18n";

/** 내 게시물 내리기 — 파일 먼저, 행은 그다음 (행이 먼저 지워지면 파일 경로를 잃는다). */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const t = requestT(req);
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: t("로그인이 필요해요.", "Please log in.") }, { status: 401 });

  const service = createServiceClient();
  const { data: row } = await service
    .from("practice_posts")
    .select("id, user_id, audio_path")
    .eq("id", id)
    .maybeSingle();
  if (!row || row.user_id !== user.id) {
    return Response.json({ error: t("내 게시물이 아니에요.", "That's not your post.") }, { status: 404 });
  }
  const { error: fileError } = await service.storage.from("recordings").remove([row.audio_path]);
  if (fileError) return Response.json({ error: t("내리지 못했어요. 다시 해주세요.", "Couldn't remove. Please try again.") }, { status: 500 });
  await service.from("practice_posts").delete().eq("id", id);
  return Response.json({ ok: true });
}
