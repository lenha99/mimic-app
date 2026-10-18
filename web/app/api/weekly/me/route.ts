import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { currentWeek } from "@/lib/weekly";

/**
 * 이번 주에 "나"와 관련된 것 — 내가 ❤ 누른 출전작, 로그인 출전이면 내 출전작.
 *
 * 챌린지 화면은 정적이라 누가 보는지 모른다. 그 위에 이것만 브라우저가 따로 묻는다
 * (components/viewer 와 같은 방식). 게스트 출전작은 기기에 남긴 기록(lib/weekly readMine)이 맡는다.
 */
const CLIENT = /^[a-z0-9]{8,40}$/;

export async function GET(req: Request) {
  const client = new URL(req.url).searchParams.get("client") ?? "";
  const week = currentWeek();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const voters = [user ? `u:${user.id}` : null, CLIENT.test(client) ? `g:${client}` : null].filter(
    (v): v is string => !!v,
  );

  const service = createServiceClient();
  const { data: entries } = await service
    .from("weekly_entries")
    .select("id, user_id, owner")
    .eq("challenge_id", week.id)
    .eq("hidden", false)
    .limit(500);
  const ids = (entries ?? []).map((e) => e.id);
  const { data: likes } =
    voters.length && ids.length
      ? await service.from("weekly_likes").select("entry_id").in("voter", voters).in("entry_id", ids)
      : { data: [] };
  const mine = (entries ?? []).find((e) => (user && e.user_id === user.id) || voters.includes(e.owner));

  return Response.json(
    { week: week.id, loggedIn: Boolean(user), liked: [...new Set((likes ?? []).map((l) => l.entry_id))], mine: mine?.id ?? null },
    { headers: { "cache-control": "no-store" } },
  );
}
