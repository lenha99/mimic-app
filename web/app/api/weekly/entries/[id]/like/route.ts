import { allow, clientIp, tooMany } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isLive, weekById } from "@/lib/weekly";
import { ipHash } from "@/lib/weekly-server";
import { requestT } from "@/lib/i18n";

/**
 * ❤ 누르기 · 취소.
 *
 * 로그인 없이도 누른다 — 출전자가 링크를 돌리면 받은 친구가 가입 없이 바로 ❤ 를
 * 누르는 것, 그게 지금 단계에서 가장 큰 유입이다. 대신:
 *   - 한 사람(계정 또는 기기)당 출전작 하나에 한 번
 *   - 내 출전작에는 못 누른다
 *   - 같은 네트워크(IP)에서 한 출전작에 3번까지 — 시크릿 창 몰아주기를 끊는다
 *   - 마감된 주는 얼어붙는다
 * 듣지 않고도 누를 수 있다(사람이 적을 땐 문턱이 ❤ 를 막는다). 재생 수는 /play 가 따로 센다.
 */
const CLIENT = /^[a-z0-9]{8,40}$/;
const PER_NETWORK = 3;

async function resolve(req: Request, id: string) {
  const t = requestT(req);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: Response.json({ error: t("잘못된 요청이에요.", "Invalid request.") }, { status: 400 }) };
  const { client } = (await req.json().catch(() => ({}))) as { client?: unknown };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user && !(typeof client === "string" && CLIENT.test(client))) {
    return { error: Response.json({ error: t("이 브라우저에선 ❤ 를 저장할 수 없어요. 로그인해 주세요.", "This browser can't save ❤. Please log in.") }, { status: 401 }) };
  }
  const guest = typeof client === "string" && CLIENT.test(client) ? `g:${client}` : null;
  // 이 사람의 이름표들 — 첫째가 대표. 게스트로 누른 뒤 로그인해도 한 사람으로 본다.
  const voters = [user ? `u:${user.id}` : null, guest].filter((v): v is string => !!v);
  const service = createServiceClient();
  const { data: e } = await service
    .from("weekly_entries")
    .select("id, challenge_id, user_id, owner, hidden, like_count")
    .eq("id", id)
    .maybeSingle();
  if (!e || e.hidden) return { error: Response.json({ error: t("없는 출전작이에요.", "Entry not found.") }, { status: 404 }) };
  const week = weekById(e.challenge_id);
  if (!week || !isLive(week)) {
    return { error: Response.json({ error: t("마감된 챌린지예요. ❤ 는 이제 바뀌지 않아요.", "This challenge has closed. ❤ can't change anymore.") }, { status: 409 }) };
  }
  return { service, user, voters, entry: e, week };
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const t = requestT(req);
  const { id } = await ctx.params;
  const ip = clientIp(req);
  if (!allow(`weekly-like:${ip}`, 60, 600_000)) return tooMany(t("너무 자주 눌렀어요. 잠깐 쉬었다가 다시 시도해 주세요.", "Too many tries. Take a breather and try again."));
  const r = await resolve(req, id);
  if ("error" in r) return r.error;
  const { service, user, voters, entry, week } = r;

  if (voters.includes(entry.owner) || (user && entry.user_id === user.id)) {
    return Response.json({ error: t("내 출전작에는 ❤ 를 못 눌러요. 다른 출전작에 눌러 보세요!", "You can't ❤ your own entry. Try someone else's!") }, { status: 403 });
  }

  // 중복 확인 · 네트워크 상한 · 넣기를 DB 한 트랜잭션에서 (마이그레이션 21).
  const { data: result, error } = await service.rpc("weekly_like", {
    p_entry: id,
    p_voters: voters,
    p_user: user?.id ?? null,
    p_ip_hash: ipHash(ip, week.id),
    p_cap: PER_NETWORK,
  });
  if (error) return Response.json({ error: t("❤ 를 남기지 못했어요. 다시 해주세요.", "Couldn't save ❤. Please try again.") }, { status: 500 });
  if (result === "cap") {
    return Response.json({ error: t("같은 와이파이에서 이미 여러 번 눌렀어요.", "Too many ❤ from this Wi-Fi already.") }, { status: 429 });
  }
  const { data: after } = await service.from("weekly_entries").select("like_count").eq("id", id).maybeSingle();
  return Response.json({ liked: true, likes: after?.like_count ?? entry.like_count });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const t = requestT(req);
  const { id } = await ctx.params;
  if (!allow(`weekly-like:${clientIp(req)}`, 60, 600_000)) return tooMany(t("너무 자주 눌렀어요. 잠깐 쉬었다가 다시 시도해 주세요.", "Too many tries. Take a breather and try again."));
  const r = await resolve(req, id);
  if ("error" in r) return r.error;
  const { service, voters, entry } = r;
  await service.from("weekly_likes").delete().eq("entry_id", id).in("voter", voters);
  const { data: after } = await service.from("weekly_entries").select("like_count").eq("id", id).maybeSingle();
  return Response.json({ liked: false, likes: after?.like_count ?? entry.like_count });
}
