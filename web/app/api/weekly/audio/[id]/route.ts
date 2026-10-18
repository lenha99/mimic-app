import { signAudio } from "@/lib/audio-url";
import { isAdmin } from "@/lib/admin";
import { entryAudio } from "@/lib/weekly-server";

/**
 * 출전작 오디오 — 고정 주소로 받으면 그때그때 새 서명 URL 로 보낸다.
 *
 * 챌린지 화면은 30초마다 다시 만들어지는 정적 페이지라, 서명 URL(30분 수명)을 페이지에
 * 박으면 한동안 아무도 안 들어온 뒤 첫 방문자는 만료된 주소를 받는다. 숨긴 출전작은
 * 여기서 바로 끊긴다 — 이미 퍼진 링크로도 안 들린다. 운영자만 예외(신고 검토).
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const found = await entryAudio(id);
  const path = found && (!found.hidden || (await isAdmin())) ? found.path : null;
  if (!path) return new Response(null, { status: 404, headers: { "cache-control": "no-store" } });
  const url = (await signAudio([path])).get(path);
  if (!url) return new Response(null, { status: 502, headers: { "cache-control": "no-store" } });
  return new Response(null, { status: 302, headers: { location: url, "cache-control": "no-store" } });
}
