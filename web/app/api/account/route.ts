import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * 회원 탈퇴.
 *
 * 계정을 지우면 profiles → recordings → votes 가 cascade 로 따라 지워진다
 * (마이그레이션 13). 그런데 Storage 의 음성 파일은 DB cascade 가 모른다 —
 * 먼저 파일을 지우고 나서 계정을 지운다. 순서가 반대면 경로를 잃어 파일이 고아로 남는다.
 */
export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const service = createServiceClient();

  const { data: rows, error: listError } = await service
    .from("recordings")
    .select("audio_path")
    .eq("user_id", user.id);
  if (listError) {
    return Response.json({ error: "탈퇴에 실패했어요. 다시 시도해주세요." }, { status: 500 });
  }

  const paths = (rows ?? []).map((r) => r.audio_path);
  for (let i = 0; i < paths.length; i += 500) {
    const { error } = await service.storage.from("recordings").remove(paths.slice(i, i + 500));
    if (error) {
      return Response.json({ error: "탈퇴에 실패했어요. 다시 시도해주세요." }, { status: 500 });
    }
  }

  const { error: deleteError } = await service.auth.admin.deleteUser(user.id);
  if (deleteError) {
    return Response.json({ error: "탈퇴에 실패했어요. 다시 시도해주세요." }, { status: 500 });
  }

  // 지워진 계정의 세션 쿠키를 남겨두지 않는다.
  await supabase.auth.signOut();
  return Response.json({ ok: true });
}
