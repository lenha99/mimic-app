import { currentUserId, followingOf, whoOf } from "@/lib/social-server";

/** 내가 구독한 목소리들. 손님은 ?client= 로 기기 이름표를 보낸다. */
export async function GET(req: Request) {
  const me = whoOf(await currentUserId(), new URL(req.url).searchParams.get("client"));
  if (!me) return Response.json({ items: [] });
  return Response.json({ items: await followingOf(me) });
}
