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
const TTL_SECONDS = 60 * 30;

export async function signAudio(paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return out;

  const { data, error } = await createServiceClient()
    .storage.from("recordings")
    .createSignedUrls(unique, TTL_SECONDS);
  if (error || !data) return out;

  for (const row of data) {
    if (row.path && row.signedUrl) out.set(row.path, row.signedUrl);
  }
  return out;
}
