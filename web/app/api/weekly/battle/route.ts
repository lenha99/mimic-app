import { MIN_LISTEN_MS, nextPair, pairToken, PER_NETWORK_DAY, readPairToken } from "@/lib/battle-server";
import { requestT } from "@/lib/i18n";
import { allow, clientIp, tooMany } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isLive, weekById } from "@/lib/weekly";
import { ipHash, liveWeek } from "@/lib/weekly-server";

/**
 * 블라인드 배틀 — GET 은 다음 짝, POST 는 한 표.
 *
 * ❤ 와 같은 이름표를 쓴다: 로그인했으면 'u:<id>', 아니면 기기 id 'g:<client>'.
 * 로그인 없이도 심사할 수 있어야 한다 — 듣는 사람이 많아야 순위에 의미가 생긴다.
 */
const CLIENT = /^[a-z0-9]{8,40}$/;

async function who(client: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const guest = typeof client === "string" && CLIENT.test(client) ? `g:${client}` : null;
  const voters = [user ? `u:${user.id}` : null, guest].filter((v): v is string => !!v);
  return { user, voters };
}

export async function GET(req: Request) {
  const t = requestT(req);
  if (!allow(`battle-get:${clientIp(req)}`, 120, 600_000)) {
    return tooMany(t("너무 자주 눌렀어요. 잠깐 쉬었다가 다시 시도해 주세요.", "Too many tries. Take a breather and try again."));
  }
  const { user, voters } = await who(new URL(req.url).searchParams.get("client"));
  const week = await liveWeek();
  const found = await nextPair(week, voters, user?.id ?? null);
  const headers = { "cache-control": "no-store" };
  if (!found.a) return Response.json({ pair: null, total: found.total, judged: found.judged }, { headers });
  return Response.json(
    {
      pair: { a: found.a, b: found.b, token: pairToken(week.id, found.a.id, found.b.id) },
      total: found.total,
      judged: found.judged,
    },
    { headers },
  );
}

export async function POST(req: Request) {
  const t = requestT(req);
  const ip = clientIp(req);
  if (!allow(`battle-vote:${ip}`, 60, 600_000)) {
    return tooMany(t("너무 빨리 고르고 있어요. 둘 다 끝까지 들어 보세요!", "You're picking too fast. Listen to both all the way!"));
  }
  const body = (await req.json().catch(() => ({}))) as { token?: unknown; winner?: unknown; client?: unknown };
  const pair = readPairToken(body.token);
  if (!pair) return Response.json({ error: t("대결이 만료됐어요. 다음 대결로 넘어갈게요.", "This battle expired. Moving on to the next one.") }, { status: 400 });
  if (body.winner !== pair.a && body.winner !== pair.b) {
    return Response.json({ error: t("잘못된 요청이에요.", "Invalid request.") }, { status: 400 });
  }
  if (Date.now() - pair.at < MIN_LISTEN_MS) {
    return Response.json({ error: t("둘 다 들어 보고 골라 주세요!", "Listen to both before picking!") }, { status: 425 });
  }
  const week = weekById(pair.weekId);
  if (!week || !isLive(week)) {
    return Response.json({ error: t("마감된 챌린지예요.", "This challenge has closed.") }, { status: 409 });
  }
  const { user, voters } = await who(body.client);
  if (voters.length === 0) {
    return Response.json({ error: t("이 브라우저에선 심사를 저장할 수 없어요. 로그인해 주세요.", "This browser can't save votes. Please log in.") }, { status: 401 });
  }

  const winner = body.winner;
  const loser = winner === pair.a ? pair.b : pair.a;
  const service = createServiceClient();
  const { data: rows } = await service
    .from("weekly_entries")
    .select("id, owner, user_id, hidden, challenge_id")
    .in("id", [winner, loser]);
  if (!rows || rows.length !== 2 || rows.some((r) => r.hidden || r.challenge_id !== week.id)) {
    return Response.json({ error: t("없어진 출전작이 있어요. 다음 대결로 넘어갈게요.", "One of these entries is gone. Moving on.") }, { status: 404 });
  }
  if (rows.some((r) => voters.includes(r.owner) || (user && r.user_id === user.id))) {
    return Response.json({ error: t("내 출전작이 걸린 대결은 심사할 수 없어요.", "You can't judge a battle with your own entry.") }, { status: 403 });
  }

  const { data: result, error } = await service.rpc("weekly_battle_vote", {
    p_week: week.id,
    p_winner: winner,
    p_loser: loser,
    p_voters: voters,
    p_user: user?.id ?? null,
    p_ip_hash: ipHash(ip, week.id),
    p_cap: PER_NETWORK_DAY,
  });
  if (error) return Response.json({ error: t("표가 저장되지 않았어요. 다시 시도해 주세요.", "Your vote didn't save. Please try again.") }, { status: 500 });
  if (result === "cap") {
    return Response.json({ error: t("오늘 이 와이파이에서 심사를 너무 많이 했어요. 내일 또 와 주세요!", "Too many votes from this Wi-Fi today. Come back tomorrow!") }, { status: 429 });
  }
  // 고른 뒤에 공개한다 — 누구였는지, 지금 몇 승 몇 패인지. 이게 다음 판을 누르게 만든다.
  const { data: after } = await service
    .from("weekly_entries")
    .select("id, user_id, guest_name, avatar, battle_rating, battle_wins, battle_losses")
    .in("id", [winner, loser]);
  const users = (after ?? []).map((r) => r.user_id).filter((x): x is string => !!x);
  const { data: profiles } = users.length
    ? await service.from("profiles").select("id, nickname, avatar").in("id", users)
    : { data: [] as { id: string; nickname: string; avatar: unknown }[] };
  const reveal = Object.fromEntries(
    (after ?? []).map((r) => {
      const p = profiles?.find((x) => x.id === r.user_id);
      return [
        r.id,
        {
          name: p?.nickname ?? r.guest_name ?? "익명의 목소리",
          avatar: p?.avatar ?? r.avatar,
          wins: r.battle_wins,
          losses: r.battle_losses,
        },
      ];
    }),
  );
  return Response.json({ ok: true, dup: result === "dup", reveal });
}
