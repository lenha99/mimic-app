import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { currentWeek } from "@/lib/weekly";
import { weekRows } from "@/lib/weekly-server";

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
  // 다른 대본으로 이번 주에 올린 것도 같은 순위다(lib/weekly-server weekRows).
  const { data: entries } = await weekRows<{ id: string; user_id: string | null; owner: string; like_count: number }>(
    service,
    week,
    "id, user_id, owner, like_count",
  );
  const ids = (entries ?? []).map((e) => e.id);
  const { data: likes } =
    voters.length && ids.length
      ? await service.from("weekly_likes").select("entry_id").in("voter", voters).in("entry_id", ids)
      : { data: [] };
  // 여러 대본으로 올렸으면 순위에 드는 것(❤ 가장 많은 것)이 "내 것"이다.
  const mine = (entries ?? [])
    .filter((e) => (user && e.user_id === user.id) || voters.includes(e.owner))
    .sort((a, b) => b.like_count - a.like_count)[0];

  // 갤러리는 주를 넘어 쌓인 목소리를 보여 준다 — 그 화면이 넘긴 id 들 중 내가 ❤ 한 것.
  const asked = (new URL(req.url).searchParams.get("ids") ?? "")
    .split(",")
    .filter((s) => /^[0-9a-f-]{36}$/i.test(s))
    .slice(0, 60);
  const { data: likesAny } =
    voters.length && asked.length
      ? await service.from("weekly_likes").select("entry_id").in("voter", voters).in("entry_id", asked)
      : { data: [] };

  return Response.json(
    {
      week: week.id,
      loggedIn: Boolean(user),
      liked: [...new Set((likes ?? []).map((l) => l.entry_id))],
      likedAny: [...new Set((likesAny ?? []).map((l) => l.entry_id))],
      mine: mine?.id ?? null,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
