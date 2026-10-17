import { allow, clientIp, tooMany } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * 결과 화면 한 줄 피드백 (components/quick-feedback). 로그인 없이도 받는다 —
 * 단톡방엔 아무도 안 쓰지만 버튼 하나는 누른다. 읽는 곳은 /admin/feedback.
 */
const PAGES = ["record", "practice", "board"] as const;

export async function POST(req: Request) {
  if (!allow(`feedback:${clientIp(req)}`, 12, 3_600_000)) return tooMany();
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const rating = b.rating === 1 ? 1 : b.rating === -1 ? -1 : null;
  const page = PAGES.find((p) => p === b.page);
  if (!rating || !page) return Response.json({ error: "잘못된 요청이에요." }, { status: 400 });
  const message = typeof b.message === "string" ? b.message.trim().slice(0, 500) : "";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await createServiceClient()
    .from("app_feedback")
    .insert({
      user_id: user?.id ?? null,
      client_id: typeof b.client === "string" ? b.client.slice(0, 64) : null,
      page,
      item_id: typeof b.item === "string" ? b.item.slice(0, 64) : null,
      rating,
      message: message || null,
    });
  if (error) return Response.json({ error: "보내지 못했어요." }, { status: 500 });
  return Response.json({ ok: true });
}
