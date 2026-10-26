import { isNoteTag, MAX_NOTE, MAX_NOTES_PER_USER_PER_POST } from "@/lib/board";
import { allow, tooMany } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requestT } from "@/lib/i18n";

/** 남의 연습에 피드백 남기기. 짚을 곳(태그) + 한 줄. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const t = requestT(req);
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: t("로그인하면 피드백을 남길 수 있어요.", "Log in to leave feedback.") }, { status: 401 });
  if (!allow(`note:${user.id}`, 30, 3_600_000)) return tooMany(t("너무 자주 눌렀어요. 잠깐 쉬었다가 다시 시도해 주세요.", "Too many tries. Take a breather and try again."));

  const body = (await req.json().catch(() => ({}))) as { tags?: unknown; body?: unknown };
  const text = typeof body.body === "string" ? body.body.trim() : "";
  const tags = Array.isArray(body.tags) ? [...new Set(body.tags.filter(isNoteTag))] : [];
  if (!text) return Response.json({ error: t("한 줄이라도 적어 주세요.", "Please write at least one line.") }, { status: 400 });
  if (text.length > MAX_NOTE) return Response.json({ error: t(`${MAX_NOTE}자까지예요.`, `Up to ${MAX_NOTE} characters.`) }, { status: 400 });

  const service = createServiceClient();
  const { data: post } = await service
    .from("practice_posts")
    .select("id, user_id, hidden, expires_at")
    .eq("id", id)
    .maybeSingle();
  if (!post || post.hidden || post.expires_at <= new Date().toISOString()) {
    return Response.json({ error: t("내려갔거나 기간이 끝난 연습이에요.", "This post was removed or has expired.") }, { status: 404 });
  }
  if (post.user_id === user.id) {
    return Response.json({ error: t("내 연습에는 피드백을 남길 수 없어요.", "You can't leave feedback on your own post.") }, { status: 400 });
  }
  const { count } = await service
    .from("practice_notes")
    .select("id", { count: "exact", head: true })
    .eq("post_id", id)
    .eq("user_id", user.id);
  if ((count ?? 0) >= MAX_NOTES_PER_USER_PER_POST) {
    return Response.json({ error: t("한 연습에 세 번까지 남길 수 있어요.", "You can leave up to 3 notes per post.") }, { status: 409 });
  }

  const { data: note, error } = await service
    .from("practice_notes")
    .insert({ post_id: id, user_id: user.id, tags, body: text })
    .select("id")
    .single();
  if (error || !note) return Response.json({ error: t("남기지 못했어요. 다시 해주세요.", "Couldn't post. Please try again.") }, { status: 500 });
  return Response.json({ id: note.id });
}
