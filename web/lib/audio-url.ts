import { createServiceClient } from "@/lib/supabase/service";

/**
 * 녹음 재생 URL — 서버 전용.
 *
 * 버킷은 비공개다. "나만 볼 수 있게 저장"이 정말로 나만이어야 하고, 신고로 숨긴
 * 녹음이 이미 퍼진 링크로 계속 들리면 안 되기 때문이다. 그래서 URL 은 볼 자격이
 * 확인된 행(RLS 를 통과해 온 행)에 대해서만, 짧은 수명으로 여기서 만든다.
 *
 * 부르는 쪽 책임: paths 는 반드시 사용자 권한(RLS)으로 조회한 행에서 온 것이어야
 * 한다. service_role 로 서명하므로 여기서는 자격을 다시 따지지 않는다.
 */
const TTL_SECONDS = 60 * 60 * 6;

/**
 * 재생 캐시 — 같은 녹음엔 같은 주소를 돌려준다.
 *
 * 서명 URL 은 만들 때마다 토큰이 달라서, 매번 새로 만들면 브라우저가 같은 파일을 캐시에서
 * 못 꺼내고 Supabase 에서 다시 내려받는다(전송량). 서버 인스턴스 안에서 한 주소를 수명의
 * 대부분(남은 시간 1시간 전까지) 다시 쓴다. 볼 자격 확인은 부르는 쪽이 매번 먼저 하므로
 * 숨긴 녹음에 새 주소가 나가지는 않는다 — 이미 나간 주소만 최대 6시간 산다.
 */
const REUSE_MS = (TTL_SECONDS - 60 * 60) * 1000;
const cache = new Map<string, { url: string; until: number }>();

export async function signAudio(paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return out;

  const now = Date.now();
  const missing: string[] = [];
  for (const p of unique) {
    const hit = cache.get(p);
    if (hit && hit.until > now) out.set(p, hit.url);
    else missing.push(p);
  }
  if (missing.length === 0) return out;

  const { data, error } = await createServiceClient()
    .storage.from("recordings")
    .createSignedUrls(missing, TTL_SECONDS);
  if (error || !data) return out;

  if (cache.size > 5000) cache.clear();
  for (const row of data) {
    if (row.path && row.signedUrl) {
      out.set(row.path, row.signedUrl);
      cache.set(row.path, { url: row.signedUrl, until: now + REUSE_MS });
    }
  }
  return out;
}
