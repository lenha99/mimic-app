import { randomBytes } from "node:crypto";
import { config } from "@/lib/config";
import { removeUgcAudio } from "@/lib/challenges";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * 내 소리로 챌린지 만들기.
 *
 * 로그인해야 한다. 남이 듣는 콘텐츠라 누가 올렸는지 알아야 하고(반려·신고), 만든
 * 사람에게 "N명이 날 따라했어"를 돌려줘야 다시 온다.
 *
 * 순서: 녹음을 Modal 에 넘겨 기준 음성으로 다듬고(앞뒤 무음 자르기·라우드니스·품질
 * 검사) → 성공하면 challenges 행을 만든다. 행을 먼저 만들면 소리 없는 챌린지가 생긴다.
 * 링크는 바로 되고, 홈 목록엔 운영자가 듣고 올린다(status: pending → approved).
 */
export const maxDuration = 60;

const PER_DAY = 5;
const MAX_BYTES = 5 * 1024 * 1024;

function clean(v: FormDataEntryValue | null, max: number): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "챌린지를 만들려면 로그인이 필요해요." }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");
  const title = clean(form.get("title"), 20);
  const line = clean(form.get("line"), 40);
  const emoji = clean(form.get("emoji"), 8) || "🎤";
  if (!(file instanceof Blob) || file.size === 0) {
    return Response.json({ error: "녹음이 비어 있어요." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "녹음이 너무 커요." }, { status: 413 });
  }
  if (!title) {
    return Response.json({ error: "제목을 적어주세요." }, { status: 400 });
  }

  const service = createServiceClient();
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await service
    .from("challenges")
    .select("id", { count: "exact", head: true })
    .eq("creator_id", user.id)
    .gte("created_at", since);
  if ((count ?? 0) >= PER_DAY) {
    return Response.json({ error: `챌린지는 하루 ${PER_DAY}개까지 만들 수 있어요.` }, { status: 429 });
  }

  const token = process.env.UGC_TOKEN;
  if (!token) {
    return Response.json({ error: "지금은 챌린지를 만들 수 없어요." }, { status: 503 });
  }

  // 8자리 소문자·숫자 — DB 제약(^u_[a-z0-9]{8}$)과 같다.
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const id = "u_" + [...randomBytes(8)].map((b) => alphabet[b % alphabet.length]).join("");

  let made: { ok?: boolean; error?: string; duration_ms?: number };
  try {
    const body = new FormData();
    body.append("file", file, "challenge.webm");
    const res = await fetch(
      `${config.ugcCreateUrl}?token=${encodeURIComponent(token)}&meme_id=${id}`,
      { method: "POST", body, signal: AbortSignal.timeout(55_000) },
    );
    made = await res.json();
  } catch {
    return Response.json({ error: "소리 서버가 응답하지 않아요. 잠시 후 다시 해주세요." }, { status: 504 });
  }
  if (!made.ok) {
    return Response.json({ error: made.error ?? "소리를 다듬지 못했어요. 다시 녹음해줄래요?" }, { status: 422 });
  }

  const { error } = await service.from("challenges").insert({
    id,
    creator_id: user.id,
    title,
    line: line || null,
    emoji,
    duration_ms: made.duration_ms ?? null,
  });
  if (error) {
    await removeUgcAudio(id); // 행이 없으면 그 소리는 아무도 못 찾는다
    return Response.json({ error: "챌린지를 저장하지 못했어요. 다시 해주세요." }, { status: 500 });
  }

  return Response.json({ id });
}
