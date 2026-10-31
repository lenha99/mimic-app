import { isAdmin } from "@/lib/admin";
import { config } from "@/lib/config";
import { proxyHeaders } from "@/lib/modal-proxy";

/**
 * 이 기기를 통계에서 빼기(POST) · 다시 넣기(DELETE). 운영자만.
 *
 * 운영자가 프로필을 열면 브라우저가 자기 익명 식별자(mimic.cid)를 보내고, Modal 이
 * 내부 기기 목록에 넣는다. /stats 와 "N명 도전"이 그 기기 이벤트를 과거분까지 뺀다.
 */
const CLIENT = /^[a-z0-9]{8,40}$/;

async function forward(req: Request, action: "add" | "remove") {
  if (!(await isAdmin())) return Response.json({ error: "운영자만 쓸 수 있어요." }, { status: 403 });
  const { client } = (await req.json().catch(() => ({}))) as { client?: unknown };
  if (typeof client !== "string" || !CLIENT.test(client)) {
    return Response.json({ error: "이 브라우저는 기기 식별자를 저장하지 못해요." }, { status: 400 });
  }
  try {
    const res = await fetch(config.internalDeviceUrl, {
      method: "POST",
      headers: { "content-type": "application/json", ...proxyHeaders() },
      body: JSON.stringify({ client, action }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return Response.json({ error: `등록하지 못했어요 (${res.status})` }, { status: 502 });
    return Response.json(await res.json());
  } catch {
    return Response.json({ error: "서버가 응답하지 않아요. 잠시 후 다시 열어 주세요." }, { status: 504 });
  }
}

export const POST = (req: Request) => forward(req, "add");
export const DELETE = (req: Request) => forward(req, "remove");
