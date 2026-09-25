import { createServiceClient } from "@/lib/supabase/service";

/**
 * 주인 없는 게스트 녹음 청소 — Vercel Cron 이 하루 한 번 부른다 (web/vercel.json).
 *
 * 게스트 녹음은 로그인하면 내 것으로 가져갈 수 있게 잠깐 맡아두는 것이다.
 * 가져갈 열쇠(claim_token)는 그 브라우저에만 있어서, 가져가지 않은 녹음은 아무도
 * 지울 수 없는 목소리로 영영 남는다. PRIVACY.md 에 약속한 대로 30일 뒤 지운다.
 */
const KEEP_DAYS = 30;
const BATCH = 500;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  const cutoff = new Date(Date.now() - KEEP_DAYS * 86_400_000).toISOString();

  const { data: rows, error } = await service
    .from("recordings")
    .select("id, audio_path")
    .is("user_id", null)
    .lt("created_at", cutoff)
    .limit(BATCH);
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  if (!rows || rows.length === 0) {
    return Response.json({ purged: 0 });
  }

  // 파일을 먼저 지운다. 행을 먼저 지우고 파일 삭제가 실패하면 경로를 잃어 다시 못 찾는다.
  const { error: fileError } = await service.storage
    .from("recordings")
    .remove(rows.map((r) => r.audio_path));
  if (fileError) {
    return Response.json({ error: fileError.message }, { status: 500 });
  }

  const { error: rowError } = await service
    .from("recordings")
    .delete()
    .in(
      "id",
      rows.map((r) => r.id),
    );
  if (rowError) {
    return Response.json({ error: rowError.message }, { status: 500 });
  }

  return Response.json({ purged: rows.length, more: rows.length === BATCH });
}
