import { allow, clientIp, tooMany } from "@/lib/rate-limit";
import { creatorOfEntry, currentUserId, followerCount, follows, setFollow, userKey, validKey, whoOf } from "@/lib/social-server";
import { requestT } from "@/lib/i18n";

/**
 * 목소리 구독(POST) · 해지(DELETE) · 상태(GET).
 *
 * 로그인 없이도 된다 — 손님은 기기 id 로 구독하고 구독받는다(사람이 적은 지금은 문턱이 곧 이탈).
 * 대상은 출전작(entry)으로도, 이름표/계정 id(creator)로도 가리킨다.
 */
type Target = { key: string; userId: string | null; name: string };

async function resolve(entry: unknown, creator: unknown): Promise<Target | null> {
  if (typeof entry === "string" && entry) return creatorOfEntry(entry);
  if (typeof creator === "string") {
    if (/^[0-9a-f-]{36}$/i.test(creator)) return { key: userKey(creator), userId: creator, name: "" };
    if (validKey(creator)) return { key: creator, userId: creator.startsWith("u:") ? creator.slice(2) : null, name: "" };
  }
  return null;
}

async function handle(req: Request, on: boolean) {
  const t = requestT(req);
  if (!allow(`follow:${clientIp(req)}`, 30, 600_000)) return tooMany(t("너무 자주 눌렀어요.", "Too many tries."));
  const body = (await req.json().catch(() => ({}))) as { creator?: unknown; entry?: unknown; client?: unknown };
  const me = whoOf(await currentUserId(), body.client);
  if (!me) return Response.json({ error: t("이 브라우저는 저장이 막혀 있어서 로그인해야 구독할 수 있어요.", "This browser blocks storage — log in to subscribe.") }, { status: 401 });
  const target = await resolve(body.entry, body.creator);
  if (!target) return Response.json({ error: "bad request" }, { status: 400 });
  const r = await setFollow(me, target.key, on);
  if ("error" in r) {
    const msg = r.error === "login" ? t("로그인하면 구독할 수 있어요.", "Log in to subscribe.") : r.error;
    return Response.json({ error: msg }, { status: r.status });
  }
  return Response.json(r);
}

export const POST = (req: Request) => handle(req, true);
export const DELETE = (req: Request) => handle(req, false);

/** 구독 상태 — 캐시되는 화면(출전작 무대)이 붙은 뒤에 묻는다. ?entry= 또는 ?creator=, 손님은 &client= */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const target = await resolve(q.get("entry"), q.get("creator"));
  if (!target) return Response.json({ error: "bad request" }, { status: 400 });
  const userId = await currentUserId();
  const me = whoOf(userId, q.get("client"));
  const client = q.get("client") ?? "";
  // 손님으로 올린 뒤 로그인했어도(아직 귀속 전) 같은 기기면 "내 것"이다.
  const self = me === target.key || (!!client && target.key === `g:${client}`);
  const [followers, following] = await Promise.all([
    followerCount(target.key),
    me && !self ? follows(me, target.key) : Promise.resolve(false),
  ]);
  return Response.json({ loggedIn: Boolean(userId), self, following, followers, creatorUser: target.userId });
}
