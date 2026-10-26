import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requestT } from "@/lib/i18n";

/**
 * 게스트로 출전한 작품을 로그인한 계정으로 가져온다. 순위·❤·수상 기록이 그대로 따라온다.
 *
 * 같은 주에 계정으로도 이미 출전했으면 그 주 것은 가져오지 않는다(1인 1작품) — 게스트
 * 출전작은 그대로 남고 열쇠도 기기에 남는다. 응답의 done 은 기기에서 버려도 되는 열쇠다.
 */
export async function POST(req: Request) {
  const t = requestT(req);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: t("로그인이 필요해요.", "Please log in.") }, { status: 401 });

  const { tokens } = (await req.json().catch(() => ({}))) as { tokens?: unknown };
  const list = (Array.isArray(tokens) ? tokens : [])
    .filter((t): t is string => typeof t === "string" && /^[0-9a-f-]{36}$/i.test(t))
    .slice(0, 20);
  if (!list.length) return Response.json({ claimed: 0, done: [] });

  const service = createServiceClient();
  const { data: rows } = await service
    .from("weekly_entries")
    .select("id, challenge_id, claim_token")
    .in("claim_token", list)
    .is("user_id", null);
  const found = new Set((rows ?? []).map((r) => r.claim_token));
  // 서버에 없는 열쇠(이미 귀속됐거나 지워진 것)는 버려도 된다.
  const done = list.filter((t) => !found.has(t));

  let claimed = 0;
  for (const r of rows ?? []) {
    const { data: taken } = await service
      .from("weekly_entries")
      .select("id")
      .eq("challenge_id", r.challenge_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (taken) continue;
    const { error } = await service
      .from("weekly_entries")
      .update({ user_id: user.id, owner: `u:${user.id}`, claim_token: null, guest_name: null })
      .eq("id", r.id)
      .is("user_id", null);
    if (error) continue;
    await service.from("weekly_awards").update({ user_id: user.id }).eq("entry_id", r.id);
    claimed++;
    done.push(r.claim_token!);
  }
  return Response.json({ claimed, done });
}
