import { randomUUID } from "node:crypto";
import { normalizeAvatar } from "@/lib/avatar";
import { config } from "@/lib/config";
import { getMemes } from "@/lib/memes";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * "저장하기" 버튼이 부를 단일 엔드포인트 (이슈 #23).
 *
 * 브라우저가 보낸 점수는 절대 믿지 않는다 — 여기서 같은 오디오를 Modal에
 * 다시 채점시켜 나온 값만 recordings에 쓴다. 위조 가능한 클라이언트 점수가
 * 랭킹에 올라가는 걸 막기 위한 유일한 방법이다.
 *
 * 로그인 유저면 user_id로, 게스트면 user_id null + claim_token 발급(이슈 #19).
 *
 * 공개 범위(visibility):
 *   private — 나만 (기본)
 *   link    — 링크를 가진 사람만 (/p/{id}). 투표·랭킹엔 안 오른다. 게스트도 된다 —
 *             친구한테 "내 목소리로" 도발하는 게 이 앱이 퍼지는 길이라서.
 *   public  — 투표·랭킹까지. 로그인해야 한다. 신고는 로그인해야 할 수 있는데 공개는
 *             아무나 할 수 있으면 익명 게시판이 된다.
 */
const MAX_BYTES = 10 * 1024 * 1024;

/** /api/score 와 같은 이유 — 콜드 스타트 채점이 플랫폼 기본 제한(10초)보다 길다. */
export const maxDuration = 60;

export async function POST(req: Request) {
  const q = new URL(req.url).searchParams;
  const memeId = q.get("meme_id");
  if (!memeId) {
    return Response.json({ error: "meme_id가 없습니다" }, { status: 400 });
  }
  const client = (q.get("client") ?? "").slice(0, 64);

  const form = await req.formData();
  const file = form.get("file");
  const raw = form.get("visibility") ?? (form.get("is_public") === "true" ? "public" : "private");
  const visibility = raw === "public" || raw === "link" ? raw : "private";
  const isPublic = visibility === "public";
  const avatarRaw = form.get("avatar");
  let avatar = null;
  if (typeof avatarRaw === "string") {
    try {
      avatar = normalizeAvatar(JSON.parse(avatarRaw));
    } catch {
      avatar = null;
    }
  }

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

  if (isPublic && !user) {
    return Response.json({ error: "공개하려면 로그인이 필요해요." }, { status: 401 });
  }

  // 2) 카탈로그에 있는 밈인지. recordings.meme_id 는 memes 를 참조하는데, memes 테이블은
  //    레지스트리를 따라오지 않는다 — 새 밈이 생길 때마다 여기서 채운다.
  const { memes, stale } = await getMemes({ includeDraft: true });
  const meme = memes.find((m) => m.id === memeId);
  if (!meme || stale) {
    return Response.json(
      { error: stale ? "카탈로그 서버가 응답하지 않아요. 잠시 후 다시 저장해 주세요." : "없는 밈입니다" },
      { status: stale ? 503 : 404 },
    );
  }

  // 3) 같은 오디오로 Modal에 다시 채점 요청 — 클라이언트가 뭐라 주장하든 무시.
  //    rescore=1: 방금 /api/score 로 한 번 센 도전을 "N명 도전"에 또 세지 않게.
  let scoreResult: {
    score: number;
    grade: string;
    breakdown: { pitch: number; tone: number; timing: number };
  };
  try {
    const modalForm = new FormData();
    modalForm.append("file", file, "recording.webm");
    const res = await fetch(
      `${config.scoreUrl}?meme_id=${encodeURIComponent(memeId)}&rescore=1` +
        (client ? `&client=${encodeURIComponent(client)}` : ""),
      { method: "POST", body: modalForm, signal: AbortSignal.timeout(55_000) },
    );
    const data = await res.json();
    if (!res.ok || data.error || typeof data.score !== "number") {
      return Response.json({ error: data.error ?? "채점에 실패했습니다." }, { status: 502 });
    }
    scoreResult = data;
  } catch {
    return Response.json(
      { error: "채점 서버가 응답하지 않습니다. 잠시 후 다시 시도해 주세요." },
      { status: 504 },
    );
  }

  // 4) Storage 업로드 + recordings insert — service_role로 RLS 우회 (여기가 신뢰 경계).
  const service = createServiceClient();

  const { error: memeError } = await service.from("memes").upsert(
    { id: meme.id, title: meme.title, source: meme.source ?? null, emoji: meme.emoji ?? "🎙" },
    { onConflict: "id" },
  );
  if (memeError) {
    return Response.json({ error: "결과 저장에 실패했습니다." }, { status: 500 });
  }

  const folder = user?.id ?? "guest";
  const path = `${folder}/${randomUUID()}.webm`;

  const { error: uploadError } = await service.storage.from("recordings").upload(path, file, {
    contentType: file.type || "audio/webm",
  });
  if (uploadError) {
    return Response.json({ error: "파일 저장에 실패했습니다." }, { status: 500 });
  }

  const claimToken = user ? undefined : randomUUID();
  const { data: recording, error: insertError } = await service
    .from("recordings")
    .insert({
      user_id: user?.id ?? null,
      meme_id: memeId,
      audio_path: path,
      score: scoreResult.score,
      grade: scoreResult.grade,
      pitch: scoreResult.breakdown.pitch,
      tone: scoreResult.breakdown.tone,
      timing: scoreResult.breakdown.timing,
      is_public: isPublic,
      shared: visibility !== "private",
      avatar,
      ...(claimToken ? { claim_token: claimToken } : {}),
    })
    .select("id")
    .single();

  if (insertError || !recording) {
    // 행이 없으면 파일은 아무도 못 찾는 고아가 된다. 지운다.
    await service.storage.from("recordings").remove([path]);
    return Response.json({ error: "결과 저장에 실패했습니다." }, { status: 500 });
  }

  return Response.json({
    recordingId: recording.id,
    claimToken: claimToken ?? null,
    ...scoreResult,
  });
}
