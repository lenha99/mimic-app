import { MAX_ASK, MAX_LIVE_POSTS, MAX_POST_BYTES, MAX_POSTS_PER_USER } from "@/lib/board";
import { allow, tooMany } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * 연습 테이크를 게시판에 올린다 — "피드백 받기".
 *
 * 로그인한 사람만. 누가 올렸는지 보여야 피드백이 오가고, 지울 사람도 분명해진다.
 * 상한(사람당 3개 · 전체 400개 · 4MB)은 저장 공간을 지키는 선이다 (lib/board).
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "로그인하면 올릴 수 있어요." }, { status: 401 });
  if (!allow(`post:${user.id}`, 6, 3_600_000)) {
    return tooMany("한 시간에 너무 많이 올렸어요. 잠시 뒤에 해주세요.");
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const scriptId = String(form?.get("script_id") ?? "").slice(0, 64);
  const title = String(form?.get("title") ?? "").trim();
  const text = String(form?.get("text") ?? "").trim();
  const track = String(form?.get("track") ?? "");
  const ask = String(form?.get("ask") ?? "").trim();

  if (!(file instanceof Blob) || file.size < 1000) {
    return Response.json({ error: "녹음이 비어 있어요." }, { status: 400 });
  }
  if (file.size > MAX_POST_BYTES) {
    return Response.json({ error: "녹음이 너무 커요. 2분 안쪽 테이크만 올릴 수 있어요." }, { status: 413 });
  }
  if (!/^audio\//.test(file.type)) {
    return Response.json({ error: "녹음 파일이 아니에요." }, { status: 400 });
  }
  if (!scriptId || !title || title.length > 40 || !text || text.length > 900) {
    return Response.json({ error: "대본 정보가 이상해요." }, { status: 400 });
  }
  if (track !== "voice" && track !== "anchor" && track !== "line") {
    return Response.json({ error: "대본 종류가 이상해요." }, { status: 400 });
  }
  if (ask.length > MAX_ASK) {
    return Response.json({ error: `봐줬으면 하는 곳은 ${MAX_ASK}자까지예요.` }, { status: 400 });
  }

  const service = createServiceClient();
  const now = new Date().toISOString();
  const [{ count: mine }, { count: all }] = await Promise.all([
    service
      .from("practice_posts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("hidden", false)
      .gt("expires_at", now),
    service
      .from("practice_posts")
      .select("id", { count: "exact", head: true })
      .eq("hidden", false)
      .gt("expires_at", now),
  ]);
  if ((mine ?? 0) >= MAX_POSTS_PER_USER) {
    return Response.json(
      { error: `한 번에 ${MAX_POSTS_PER_USER}개까지 올릴 수 있어요. 프로필에서 하나 내리고 다시 해주세요.` },
      { status: 409 },
    );
  }
  if ((all ?? 0) >= MAX_LIVE_POSTS) {
    return Response.json({ error: "게시판이 꽉 찼어요. 며칠 뒤에 다시 해주세요." }, { status: 503 });
  }

  const id = crypto.randomUUID();
  const ext = file.type.includes("mp4") ? "m4a" : file.type.includes("ogg") ? "ogg" : "webm";
  const path = `practice/${user.id}/${id}.${ext}`;
  const { error: upError } = await service.storage
    .from("recordings")
    .upload(path, file, { contentType: file.type.split(";")[0], upsert: false });
  if (upError) {
    return Response.json({ error: "녹음을 올리지 못했어요. 다시 해주세요." }, { status: 500 });
  }

  const { error: rowError } = await service.from("practice_posts").insert({
    id,
    user_id: user.id,
    script_id: scriptId,
    title,
    script_text: text,
    track,
    ask: ask || null,
    audio_path: path,
  });
  if (rowError) {
    await service.storage.from("recordings").remove([path]);
    return Response.json({ error: "올리지 못했어요. 다시 해주세요." }, { status: 500 });
  }
  return Response.json({ id });
}
