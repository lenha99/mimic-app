import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * 내 녹음 지우기.
 *
 * 브라우저가 행을 직접 지우지 못하게 막아뒀다(마이그레이션 12). 행만 지우면
 * Storage 의 음성 파일이 남아서 "지웠다"는 말이 거짓이 된다. 여기서 둘 다 지운다.
 */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  // 소유 확인은 사용자 권한으로 — RLS 가 남의 비공개 녹음은 아예 안 보여준다.
  const { data: row } = await supabase
    .from("recordings")
    .select("id, user_id, audio_path")
    .eq("id", id)
    .maybeSingle();
  if (!row || row.user_id !== user.id) {
    return Response.json({ error: "내 녹음이 아니에요." }, { status: 404 });
  }

  const service = createServiceClient();
  const { error: fileError } = await service.storage.from("recordings").remove([row.audio_path]);
  if (fileError) {
    return Response.json({ error: "삭제에 실패했어요. 다시 시도해 주세요." }, { status: 500 });
  }
  const { error: rowError } = await service.from("recordings").delete().eq("id", id);
  if (rowError) {
    return Response.json({ error: "삭제에 실패했어요. 다시 시도해 주세요." }, { status: 500 });
  }

  return Response.json({ ok: true });
}
