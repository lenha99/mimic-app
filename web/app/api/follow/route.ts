import { allow, clientIp, tooMany } from "@/lib/rate-limit";
import { currentUserId, followerCount, follows, setFollow } from "@/lib/social-server";
import { requestT } from "@/lib/i18n";

/** 목소리 구독(POST) · 해지(DELETE). 로그인한 사람만 — 구독한 사람이 누군지 올린 사람이 알아야 한다. */
async function handle(req: Request, on: boolean) {
  const t = requestT(req);
  if (!allow(`follow:${clientIp(req)}`, 30, 600_000)) return tooMany(t("너무 자주 눌렀어요.", "Too many tries."));
  const me = await currentUserId();
  if (!me) return Response.json({ error: t("로그인하면 구독할 수 있어요.", "Log in to subscribe.") }, { status: 401 });
  const { creator } = (await req.json().catch(() => ({}))) as { creator?: unknown };
  if (typeof creator !== "string") return Response.json({ error: "bad request" }, { status: 400 });
  const r = await setFollow(me, creator, on);
  if ("error" in r) return Response.json({ error: r.error }, { status: r.status });
  return Response.json(r);
}

export const POST = (req: Request) => handle(req, true);
export const DELETE = (req: Request) => handle(req, false);

/** 이 출전자 구독 상태 — 캐시되는 화면(출전작 무대)이 붙은 뒤에 묻는다. */
export async function GET(req: Request) {
  const creator = new URL(req.url).searchParams.get("creator") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(creator)) return Response.json({ error: "bad request" }, { status: 400 });
  const me = await currentUserId();
  const [followers, following] = await Promise.all([followerCount(creator), me && me !== creator ? follows(me, creator) : Promise.resolve(false)]);
  return Response.json({ loggedIn: Boolean(me), self: me === creator, following, followers });
}
