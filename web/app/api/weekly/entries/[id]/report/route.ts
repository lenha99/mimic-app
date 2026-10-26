import { allow, tooMany } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requestT } from "@/lib/i18n";

/**
 * 출전작 신고. 로그인한 사람만 — 게스트 신고를 받으면 경쟁자가 시크릿 창으로 남의
 * 출전작을 내릴 수 있다. 서로 다른 세 계정이 신고하면 숨기고, 운영자가 되살릴 수 있다
 * (/admin/weekly). 게시판(두 명)보다 높게 잡은 건 순위 경쟁이 걸려 있어서다.
 */
const HIDE_AT = 3;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const t = requestT(req);
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: t("잘못된 요청이에요.", "Invalid request.") }, { status: 400 });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: t("로그인하면 신고할 수 있어요.", "Log in to report.") }, { status: 401 });
  if (!allow(`weekly-report:${user.id}`, 20, 3_600_000)) return tooMany(t("너무 자주 눌렀어요. 잠깐 쉬었다가 다시 시도해 주세요.", "Too many tries. Take a breather and try again."));

  const service = createServiceClient();
  const { data: e } = await service.from("weekly_entries").select("id, user_id, reports").eq("id", id).maybeSingle();
  if (!e) return Response.json({ ok: true });
  if (e.user_id === user.id) return Response.json({ error: t("내 출전작은 신고할 수 없어요.", "You can't report your own entry.") }, { status: 400 });

  const { error } = await service.from("weekly_reports").insert({ entry_id: id, user_id: user.id });
  if (error && error.code !== "23505") {
    return Response.json({ error: t("신고하지 못했어요. 다시 해주세요.", "Couldn't report. Please try again.") }, { status: 500 });
  }
  const { count } = await service
    .from("weekly_reports")
    .select("user_id", { count: "exact", head: true })
    .eq("entry_id", id);
  const n = count ?? 0;
  await service
    .from("weekly_entries")
    .update(n >= HIDE_AT ? { reports: n, hidden: true } : { reports: n })
    .eq("id", id);
  return Response.json({ ok: true });
}
