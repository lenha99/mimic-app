import { pairToken } from "@/lib/battle-server";
import { requestT } from "@/lib/i18n";
import { allow, clientIp, tooMany } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { liveWeek } from "@/lib/weekly-server";

/**
 * 1:1 목소리 대결 — 친구끼리 같은 대본으로 붙고, 링크로 들어온 사람들이 고른다.
 *
 * 블라인드 배틀은 모르는 사람이 많아야 돌아간다. 이건 두 명과 그 친구들만 있으면 된다.
 * 표는 블라인드 배틀과 같은 표(/api/weekly/battle POST)로 받는다 — 같은 서명, 같은 중복 막기.
 * 여기선 지금 상황만 알려준다: 몇 대 몇인지, 내가 이미 골랐는지, 고를 수 있는지.
 */
const ID = /^[0-9a-f-]{36}$/i;
const CLIENT = /^[a-z0-9]{8,40}$/;

export async function GET(req: Request) {
  const t = requestT(req);
  if (!allow(`duel-get:${clientIp(req)}`, 120, 600_000)) {
    return tooMany(t("너무 자주 눌렀어요. 잠깐 쉬었다가 다시 시도해 주세요.", "Too many tries. Take a breather and try again."));
  }
  const q = new URL(req.url).searchParams;
  const a = q.get("a") ?? "";
  const b = q.get("b") ?? "";
  if (!ID.test(a) || (b && (!ID.test(b) || a === b))) {
    return Response.json({ error: t("잘못된 대결이에요.", "Invalid duel.") }, { status: 400 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const client = q.get("client");
  const voters = [user ? `u:${user.id}` : null, client && CLIENT.test(client) ? `g:${client}` : null].filter(
    (v): v is string => !!v,
  );

  const week = await liveWeek();
  const service = createServiceClient();
  const ids = b ? [a, b] : [a];
  const { data: rows } = await service
    .from("weekly_entries")
    .select("id, owner, user_id, hidden, challenge_id")
    .in("id", ids);
  if (!rows || rows.length !== ids.length || rows.some((r) => r.hidden || r.challenge_id !== week.id)) {
    return Response.json({ error: t("이번 주 출전작끼리만 붙을 수 있어요.", "Only this week's entries can duel.") }, { status: 404 });
  }
  const isMine = (id: string) => {
    const r = rows.find((x) => x.id === id);
    return !!r && (voters.includes(r.owner) || (!!user && r.user_id === user.id));
  };
  const headers = { "cache-control": "no-store" };
  if (!b) return Response.json({ mine: isMine(a) ? a : null }, { headers });

  const mine = isMine(a) ? a : isMine(b) ? b : null;
  const pair = a < b ? `${a}|${b}` : `${b}|${a}`;
  // 마이그레이션 전이면 표가 없다 — 0:0 으로 보이고 고르기만 막힌다.
  const { data: votes, error } = await service
    .from("weekly_battle_votes")
    .select("winner_id, voter")
    .eq("pair", pair)
    .limit(5000);
  const tally = { [a]: 0, [b]: 0 };
  for (const v of votes ?? []) if (v.winner_id in tally) tally[v.winner_id] += 1;
  const voted = (votes ?? []).find((v) => voters.includes(v.voter))?.winner_id ?? null;
  const canVote = !error && !mine && !voted && voters.length > 0;
  return Response.json(
    { mine, tally, voted, token: canVote ? pairToken(week.id, a, b) : null, ready: !error },
    { headers },
  );
}
