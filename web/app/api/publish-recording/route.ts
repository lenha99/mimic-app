import { randomUUID } from "node:crypto";
import { config } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * "결과 공개하기" 버튼이 부를 단일 엔드포인트 (이슈 #23).
 *
 * 브라우저가 보낸 점수는 절대 믿지 않는다 — 여기서 같은 오디오를 Modal에
 * 다시 채점시켜 나온 값만 recordings에 쓴다. 위조 가능한 클라이언트 점수가
 * 랭킹에 올라가는 걸 막기 위한 유일한 방법이다.
 *
 * 로그인 유저면 user_id로, 게스트면 user_id null + claim_token 발급(이슈 #19).
 * 게스트는 나중에 로그인하면 클라이언트가 이 claim_token으로 recordings row를
 * 자기 계정에 귀속시킨다(마이그레이션 20260916000008 참고).
 */
const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(req: Request) {
  const memeId = new URL(req.url).searchParams.get("meme_id");
  if (!memeId) {
    return Response.json({ error: "meme_id가 없습니다" }, { status: 400 });
  }

  const form = await req.formData();
  const file = form.get("file");
  const isPublic = form.get("is_public") === "true";

  if (!(file instanceof Blob) || file.size === 0) {
    return Response.json({ error: "녹음이 비어 있습니다" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "녹음이 너무 깁니다" }, { status: 413 });
  }

  // 1) 누가 요청했는지 확인 — 로그인 유저면 user_id, 아니면 게스트.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 2) 같은 오디오로 Modal에 다시 채점 요청 — 클라이언트가 뭐라 주장하든 무시.
  let scoreResult: {
    score: number;
    grade: string;
    breakdown: { pitch: number; tone: number; timing: number };
  };
  try {
    const modalForm = new FormData();
    modalForm.append("file", file, "recording.webm");
    const res = await fetch(`${config.scoreUrl}?meme_id=${encodeURIComponent(memeId)}`, {
      method: "POST",
      body: modalForm,
      signal: AbortSignal.timeout(90_000),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      return Response.json({ error: data.error ?? "채점에 실패했습니다." }, { status: 502 });
    }
    scoreResult = data;
  } catch {
    return Response.json(
      { error: "채점 서버가 응답하지 않습니다. 잠시 후 다시 시도해 주세요." },
      { status: 504 },
    );
  }

  // 3) Storage 업로드 + recordings insert — service_role로 RLS 우회 (여기가 신뢰 경계).
  const service = createServiceClient();
  const folder = user?.id ?? "guest";
  const path = `${folder}/${randomUUID()}.webm`;

  const { error: uploadError } = await service.storage.from("recordings").upload(path, file, {
    contentType: file.type || "audio/webm",
  });
  if (uploadError) {
    return Response.json({ error: "파일 저장에 실패했습니다." }, { status: 500 });
  }
  const { data: publicUrl } = service.storage.from("recordings").getPublicUrl(path);

  const claimToken = user ? undefined : randomUUID();
  const { data: recording, error: insertError } = await service
    .from("recordings")
    .insert({
      user_id: user?.id ?? null,
      meme_id: memeId,
      audio_url: publicUrl.publicUrl,
      score: scoreResult.score,
      grade: scoreResult.grade,
      pitch: scoreResult.breakdown.pitch,
      tone: scoreResult.breakdown.tone,
      timing: scoreResult.breakdown.timing,
      is_public: isPublic,
      ...(claimToken ? { claim_token: claimToken } : {}),
    })
    .select("id, claim_token")
    .single();

  if (insertError || !recording) {
    return Response.json({ error: "결과 저장에 실패했습니다." }, { status: 500 });
  }

  return Response.json({
    recordingId: recording.id,
    claimToken: claimToken ?? null,
    ...scoreResult,
  });
}
