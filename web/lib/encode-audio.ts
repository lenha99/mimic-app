import { config } from "@/lib/config";
import { proxyHeaders } from "@/lib/modal-proxy";

/**
 * 업로드 전에 녹음을 AAC 48kbps(.m4a)로 줄인다 — 서버 전용 (modal_app.encode).
 *
 * 재생할 때마다 Supabase 전송량을 먹으니, 보정한 wav(1초 47KB)를 그대로 두면 사람이 늘 때
 * 무료 한도(5GB/월)를 제일 먼저 넘는다. 48k 는 원본의 약 13%.
 *
 * 실패하면 null — 부르는 쪽은 원본을 그대로 올린다. 압축 때문에 출전이 막히면 안 된다.
 */
export async function toAac(file: Blob): Promise<Blob | null> {
  try {
    const body = new FormData();
    body.append("file", file, "take");
    const res = await fetch(config.encodeUrl, {
      method: "POST",
      body,
      headers: proxyHeaders(),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const out = await res.blob();
    // 이상하게 작거나 오히려 커졌으면 원본이 낫다.
    if (out.size < 1000 || out.size >= file.size) return null;
    return new Blob([out], { type: "audio/mp4" });
  } catch {
    return null;
  }
}

/** 올린 뒤 바뀌지 않는 녹음 — 주소가 매번 달라서 같은 파일을 덮어쓸 일이 없다. 브라우저·CDN 이 1년 들고 있어도 된다. */
export const AUDIO_CACHE_CONTROL = "31536000";
