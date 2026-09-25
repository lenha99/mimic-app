import { normalizeAvatar } from "@/lib/avatar";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * 이미 저장한 녹음을 링크로 공유 가능하게 켠다 (/p/{id}).
 *
 * 주인만 켤 수 있다: 로그인한 주인이거나, 게스트면 저장할 때 받은 claim_token 을
 * 가진 사람. 브라우저는 shared 를 직접 못 바꾸므로(12번 마이그레이션) 여기서 한다.
 * 그 김에 지금 캐릭터로 갈아입힌다 — 저장 뒤에 캐릭터를 바꿨을 수 있다.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { claimToken?: unknown; avatar?: unknown };

  const service = createServiceClient();
  const { data: row } = await service
    .from("recordings")
    .select("id, user_id, claim_token, hidden")
    .eq("id", id)
    .maybeSingle();
  if (!row || row.hidden) {
    return Response.json({ error: "공유할 수 없는 녹음이에요." }, { status: 404 });
  }

  let owner = false;
  if (row.user_id) {
    const {
      data: { user },
    } = await (await createClient()).auth.getUser();
    owner = user?.id === row.user_id;
  } else {
    owner = typeof body.claimToken === "string" && body.claimToken === row.claim_token;
  }
  if (!owner) {
    return Response.json({ error: "내 녹음이 아니에요." }, { status: 403 });
  }

  const { error } = await service
    .from("recordings")
    .update({ shared: true, ...(body.avatar ? { avatar: normalizeAvatar(body.avatar) } : {}) })
    .eq("id", id);
  if (error) {
    return Response.json({ error: "링크를 못 만들었어요. 다시 시도해주세요." }, { status: 500 });
  }
  return Response.json({ ok: true });
}
