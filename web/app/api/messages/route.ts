import { allow, clientIp, tooMany } from "@/lib/rate-limit";
import { currentUserId, myThreads, sendMessage } from "@/lib/social-server";
import { requestT } from "@/lib/i18n";
import { messageError } from "@/lib/message-errors";

/** 내 대화방 목록(GET) · 새 메시지(POST {to, body}). */
export async function GET() {
  const me = await currentUserId();
  if (!me) return Response.json({ error: "login" }, { status: 401 });
  return Response.json({ threads: await myThreads(me) });
}

export async function POST(req: Request) {
  const t = requestT(req);
  if (!allow(`dm:${clientIp(req)}`, 30, 600_000)) return tooMany(t("메시지를 너무 빨리 보내고 있어요.", "You're sending messages too fast."));
  const me = await currentUserId();
  if (!me) return Response.json({ error: t("로그인이 필요해요.", "Please log in.") }, { status: 401 });
  const { to, body } = (await req.json().catch(() => ({}))) as { to?: unknown; body?: unknown };
  if (typeof to !== "string" || typeof body !== "string") return Response.json({ error: "bad request" }, { status: 400 });
  const r = await sendMessage(me, to, body);
  if ("error" in r) return Response.json({ error: messageError(r.error, t) }, { status: r.status });
  return Response.json(r);
}
