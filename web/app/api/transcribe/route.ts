import { config } from "@/lib/config";
import { proxyHeaders } from "@/lib/modal-proxy";
import { allow, clientIp, tooMany } from "@/lib/rate-limit";
import { requestT } from "@/lib/i18n";

/**
 * 받아쓰기 프록시 — 연습실 "대본대로 읽었나" (lib/script-match).
 *
 * 채점 프록시(/api/score)와 같은 이유로 중계한다. 사용자가 "대본 확인"을 누른
 * 테이크만 온다. 서버는 받아쓴 뒤 녹음을 지우고 글자도 남기지 않는다.
 */
const MAX_BYTES = 10 * 1024 * 1024; // modal_app._decode_upload 와 같은 상한

/** 콜드 스타트(모델 적재)가 10초 남짓이라 플랫폼 기본 제한으로는 모자란다. */
export const maxDuration = 60;

export async function POST(req: Request) {
  const t = requestT(req);
  // 대본을 한 번 읽는 데 최소 몇 초는 걸린다. 받아쓰기는 채점보다 비싸서 더 좁게 둔다.
  if (!allow(`transcribe:${clientIp(req)}`, 8, 60_000)) return tooMany(t("너무 자주 눌렀어요. 잠깐 쉬었다가 다시 시도해 주세요.", "Too many tries. Take a breather and try again."));
  const client = (new URL(req.url).searchParams.get("client") ?? "").slice(0, 64);
  const file = (await req.formData()).get("file");
  if (!(file instanceof Blob) || file.size === 0) {
    return Response.json({ error: t("녹음이 비어 있어요", "The recording is empty.") }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: t("녹음이 너무 길어요", "The recording is too long.") }, { status: 413 });
  }

  const body = new FormData();
  body.append("file", file, "recording.webm");
  try {
    const res = await fetch(
      `${config.transcribeUrl}${client ? `?client=${encodeURIComponent(client)}` : ""}`,
      { method: "POST", body, headers: proxyHeaders(), signal: AbortSignal.timeout(55_000) },
    );
    const text = await res.text();
    try {
      const data = JSON.parse(text) as { text?: unknown; error?: unknown };
      if (typeof data.error === "string") return Response.json({ error: data.error }, { status: 422 });
      if (typeof data.text !== "string") throw new Error();
      return Response.json({ text: data.text });
    } catch {
      return Response.json({ error: t("받아쓰기 서버 응답이 이상해요", "The transcription server sent a bad response.") }, { status: 502 });
    }
  } catch {
    return Response.json(
      { error: t("받아쓰기 서버가 응답하지 않아요. 잠시 뒤 다시 눌러줄래?", "The transcription server isn't responding. Tap again in a moment.") },
      { status: 504 },
    );
  }
}
