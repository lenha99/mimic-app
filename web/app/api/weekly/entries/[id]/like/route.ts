import { allow, clientIp, tooMany } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isLive, weekById } from "@/lib/weekly";
import { ipHash } from "@/lib/weekly-server";

/**
 * ❤ 누르기 · 취소.
 *
 * 로그인 없이도 누른다 — 출전자가 링크를 돌리면 받은 친구가 가입 없이 바로 ❤ 를
 * 누르는 것, 그게 지금 단계에서 가장 큰 유입이다. 대신:
 *   - 한 사람(계정 또는 기기)당 출전작 하나에 한 번
 *   - 내 출전작에는 못 누른다
 *   - 같은 네트워크(IP)에서 한 출전작에 3번까지 — 시크릿 창 몰아주기를 끊는다
 *   - 마감된 주는 얼어붙는다
 * "끝까지 들어야 ❤" 는 화면이 건다. 서버는 들었는지 알 수 없다.
 */
const CLIENT = /^[a-z0-9]{8,40}$/;
const PER_NETWORK = 3;

async function resolve(req: Request, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: Response.json({ error: "잘못된 요청이에요." }, { status: 400 }) };
  const { client } = (await req.json().catch(() => ({}))) as { client?: unknown };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user && !(typeof client === "string" && CLIENT.test(client))) {
    return { error: Response.json({ error: "이 브라우저에선 ❤ 를 저장할 수 없어요. 로그인해 주세요." }, { status: 401 }) };
  }
  const voter = user ? `u:${user.id}` : `g:${client}`;
  const service = createServiceClient();
  const { data: e } = await service
    .from("weekly_entries")
    .select("id, challenge_id, user_id, owner, hidden, like_count")
    .eq("id", id)
    .maybeSingle();
  if (!e || e.hidden) return { error: Response.json({ error: "없는 출전작이에요." }, { status: 404 }) };
  const week = weekById(e.challenge_id);
  if (!week || !isLive(week)) {
    return { error: Response.json({ error: "마감된 챌린지예요. ❤ 는 이제 바뀌지 않아요." }, { status: 409 }) };
  }
  return { service, user, voter, entry: e, week };
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const ip = clientIp(req);
  if (!allow(`weekly-like:${ip}`, 60, 600_000)) return tooMany();
  const r = await resolve(req, id);
  if ("error" in r) return r.error;
  const { service, user, voter, entry, week } = r;

  if (entry.owner === voter || (user && entry.user_id === user.id)) {
    return Response.json({ error: "내 출전작에는 ❤ 를 못 눌러요. 친구한테 부탁해 봐요!" }, { status: 403 });
  }

  const hash = ipHash(ip, week.id);
  const { count } = await service
    .from("weekly_likes")
    .select("voter", { count: "exact", head: true })
    .eq("entry_id", id)
    .eq("ip_hash", hash);
  if ((count ?? 0) >= PER_NETWORK) {
    return Response.json({ error: "같은 와이파이에서 이미 여러 번 눌렀어요." }, { status: 429 });
  }

  const { error } = await service
    .from("weekly_likes")
    .insert({ entry_id: id, voter, user_id: user?.id ?? null, ip_hash: hash });
  // 이미 누른 상태면 unique 위반 — 원하는 상태와 같으니 성공으로 돌려준다.
  if (error && error.code !== "23505") {
    return Response.json({ error: "❤ 를 남기지 못했어요. 다시 해주세요." }, { status: 500 });
  }
  const { data: after } = await service.from("weekly_entries").select("like_count").eq("id", id).maybeSingle();
  return Response.json({ liked: true, likes: after?.like_count ?? entry.like_count });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!allow(`weekly-like:${clientIp(req)}`, 60, 600_000)) return tooMany();
  const r = await resolve(req, id);
  if ("error" in r) return r.error;
  const { service, voter, entry } = r;
  await service.from("weekly_likes").delete().eq("entry_id", id).eq("voter", voter);
  const { data: after } = await service.from("weekly_entries").select("like_count").eq("id", id).maybeSingle();
  return Response.json({ liked: false, likes: after?.like_count ?? entry.like_count });
}
