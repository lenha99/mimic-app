import { signAudio } from "@/lib/audio-url";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * 릴레이 오디오 — 고정 주소로 받으면 새 서명 URL 로 보낸다.
 *   /api/relay/audio/<녹음 id>      출연 녹음 (숨긴 건 끊긴다)
 *   /api/relay/audio/l_<줄 id>      작가·감독이 쓴 줄의 TTS
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const service = createServiceClient();
  let path: string | null = null;
  if (id.startsWith("l_")) {
    const lineId = id.slice(2);
    if (/^[0-9a-f-]{36}$/.test(lineId)) {
      const { data } = await service.from("relay_lines").select("tts, hidden").eq("id", lineId).maybeSingle();
      if (data && !data.hidden && data.tts && !data.tts.startsWith("/")) path = data.tts;
    }
  } else if (/^[0-9a-f-]{36}$/.test(id)) {
    const { data } = await service.from("relay_takes").select("audio_path, hidden").eq("id", id).maybeSingle();
    if (data && !data.hidden) path = data.audio_path;
  }
  if (!path) return new Response(null, { status: 404, headers: { "cache-control": "no-store" } });
  const url = (await signAudio([path])).get(path);
  if (!url) return new Response(null, { status: 502, headers: { "cache-control": "no-store" } });
  return new Response(null, { status: 302, headers: { location: url, "cache-control": "private, max-age=600" } });
}
