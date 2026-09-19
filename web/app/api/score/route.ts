import { config } from "@/lib/config";

/**
 * 채점 프록시.
 *
 * 브라우저가 Modal 을 직접 때리면 (1) CORS 를 열어야 하고 (2) 엔드포인트가
 * 클라이언트 번들에 박힌다. 녹음이 ~15KB 라 서버에서 한 번 건너뛰는 비용은
 * 무시할 수준이라, 그냥 여기서 중계한다.
 */
const MAX_BYTES = 10 * 1024 * 1024; // modal_app._decode_upload 와 같은 상한

export async function POST(req: Request) {
  const memeId = new URL(req.url).searchParams.get("meme_id");
  if (!memeId) {
    return Response.json({ error: "meme_id 가 없습니다" }, { status: 400 });
  }

  const file = (await req.formData()).get("file");
  if (!(file instanceof Blob) || file.size === 0) {
    return Response.json({ error: "녹음이 비어 있습니다" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "녹음이 너무 깁니다" }, { status: 413 });
  }

  const body = new FormData();
  body.append("file", file, "recording.webm");

  try {
    // Modal 콜드 스타트가 수십 초까지 간다. 넉넉히 기다린다.
    const res = await fetch(
      `${config.scoreUrl}?meme_id=${encodeURIComponent(memeId)}`,
      { method: "POST", body, signal: AbortSignal.timeout(90_000) },
    );
    // 서버가 JSON 이 아닌 걸 뱉으면 그대로 흘리지 않고 에러로 바꾼다.
    const text = await res.text();
    try {
      JSON.parse(text);
    } catch {
      return Response.json({ error: "채점 서버 응답이 이상합니다" }, { status: 502 });
    }
    return new Response(text, {
      status: res.status,
      headers: { "content-type": "application/json" },
    });
  } catch {
    return Response.json(
      { error: "채점 서버가 응답하지 않습니다. 잠시 후 다시 시도해 주세요." },
      { status: 504 },
    );
  }
}
