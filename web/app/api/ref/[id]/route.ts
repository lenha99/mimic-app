import { config } from "@/lib/config";

/**
 * 기준 음성(원본 소리) — Modal 앞에 CDN 을 세운다.
 *
 * Modal 은 미국에 있고 캐시 헤더도 없어서, 한국에서 원본 한 번 듣는 데 1~1.5초가
 * 걸렸다. 피드는 넘길 때마다 원본부터 트니 그게 곧 "렉"이었다. 여기서 받은 걸
 * Vercel CDN 에 얹으면 두 번째부터는 가까운 엣지에서 바로 나간다.
 *
 * 캐시 수명: 운영 콘텐츠는 renorm·재업로드 때만 바뀌므로 1시간(+하루 동안 옛 것을
 * 주면서 뒤에서 갱신). 사용자 챌린지(u_*)는 반려되면 지워야 하므로 5분만.
 * 원본을 고쳐 올렸는데 옛 소리가 나오면 최대 이 시간만큼 기다리면 된다.
 */
const ID = /^[a-z0-9_]{1,40}$/;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID.test(id)) return new Response(null, { status: 400 });

  let res: Response;
  try {
    res = await fetch(`${config.referenceUrl}?meme_id=${encodeURIComponent(id)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return new Response(null, { status: 504 });
  }
  // 404 는 짧게만 캐시한다 — 방금 올린 밈이 5분 동안 "소리 없음"으로 굳으면 안 된다.
  if (!res.ok) {
    return new Response(null, {
      status: res.status === 404 ? 404 : 502,
      headers: { "cache-control": "public, max-age=0, s-maxage=30" },
    });
  }

  const ugc = id.startsWith("u_");
  return new Response(res.body, {
    headers: {
      "content-type": res.headers.get("content-type") ?? "audio/wav",
      ...(res.headers.get("content-length")
        ? { "content-length": res.headers.get("content-length")! }
        : {}),
      "cache-control": ugc
        ? "public, max-age=300, s-maxage=300"
        : "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
