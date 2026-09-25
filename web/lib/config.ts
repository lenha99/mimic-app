/**
 * 환경값은 전부 여기 한 곳에서 관리한다.
 *
 * 기본값은 현재 배포돼 있는 Modal 엔드포인트 — 아직 Supabase 이전 전이라
 * 기존 서버를 그대로 쓴다. 이전이 끝나면 memes/reference 는 Supabase 로 간다.
 * (이슈 #18 — 기준음성 단일 소스)
 */
const env = process.env;

export const config = {
  /** 채점 API — librosa 기반, Modal 유지 확정 (기획서 v0.2 결정 01) */
  scoreUrl: env.NEXT_PUBLIC_SCORE_URL ?? "https://lenha99--meme-scoring-score.modal.run",

  /** 밈 카탈로그 — Supabase 이전 예정 (#18) */
  memesUrl: env.NEXT_PUBLIC_MEMES_URL ?? "https://lenha99--meme-scoring-memes.modal.run",

  /** 기준 음성 스트리밍 — Supabase Storage 이전 예정 (#18) */
  referenceUrl: env.NEXT_PUBLIC_REFERENCE_URL ?? "https://lenha99--meme-scoring-reference.modal.run",

  /** 사용자 챌린지 기준 음성 만들기·지우기 — 서버 전용 (UGC_TOKEN 필요). */
  ugcCreateUrl: env.UGC_CREATE_URL ?? "https://lenha99--meme-scoring-ugc-create.modal.run",
  ugcRemoveUrl: env.UGC_REMOVE_URL ?? "https://lenha99--meme-scoring-ugc-remove.modal.run",

  /** 이 웹앱의 공개 주소. OG 태그의 metadataBase 로도 쓰인다. */
  siteUrl: resolveSiteUrl(),
} as const;

/**
 * OG 카드는 절대 URL을 요구하므로 배포 주소를 정확히 알아야 한다.
 * 커스텀 도메인이 붙기 전에는 Vercel 이 주입하는 값을 쓴다.
 * (VERCEL_* 는 서버에만 노출된다 — 이 모듈은 서버 컴포넌트에서만 import 한다)
 */
function resolveSiteUrl(): string {
  if (env.NEXT_PUBLIC_SITE_URL) return env.NEXT_PUBLIC_SITE_URL;
  if (env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (env.VERCEL_URL) return `https://${env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export function refAudio(memeId: string): string {
  return `${config.referenceUrl}?meme_id=${encodeURIComponent(memeId)}`;
}
