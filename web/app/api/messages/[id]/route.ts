import { allow, clientIp, tooMany } from "@/lib/rate-limit";
import { actOnThread, currentUserId, sendMessage, threadFor } from "@/lib/social-server";
import { requestT } from "@/lib/i18n";
import { messageError } from "@/lib/message-errors";

type Ctx = { params: Promise<{ id: string }> };

/** 대화방 하나 — 읽기(GET) · 보내기(POST {body}) · 수락/거절/차단(PATCH {action}). */
export async function GET(_req: Request, ctx: Ctx) {
  const me = await currentUserId();
  if (!me) return Response.json({ error: "login" }, { status: 401 });
  const th = await threadFor(me, (await ctx.params).id);
  if (!th) return Response.json({ error: "not-found" }, { status: 404 });
  return Response.json(th);
}

export async function POST(req: Request, ctx: Ctx) {
  const t = requestT(req);
  if (!allow(`dm:${clientIp(req)}`, 30, 600_000)) return tooMany(t("메시지를 너무 빨리 보내고 있어요.", "You're sending messages too fast."));
  const me = await currentUserId();
  if (!me) return Response.json({ error: "login" }, { status: 401 });
  const th = await threadFor(me, (await ctx.params).id);
  if (!th?.other) return Response.json({ error: "not-found" }, { status: 404 });
  const { body } = (await req.json().catch(() => ({}))) as { body?: unknown };
  if (typeof body !== "string") return Response.json({ error: "bad request" }, { status: 400 });
  const r = await sendMessage(me, th.other.id, body);
  if ("error" in r) return Response.json({ error: messageError(r.error, t) }, { status: r.status });
  return Response.json(r);
}

export async function PATCH(req: Request, ctx: Ctx) {
  const me = await currentUserId();
  if (!me) return Response.json({ error: "login" }, { status: 401 });
  const { action } = (await req.json().catch(() => ({}))) as { action?: unknown };
  if (action !== "accept" && action !== "decline" && action !== "block") return Response.json({ error: "bad request" }, { status: 400 });
  const r = await actOnThread(me, (await ctx.params).id, action);
  if ("error" in r) return Response.json({ error: r.error }, { status: r.status });
  return Response.json(r);
}
