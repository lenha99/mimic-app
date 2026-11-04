import { revalidatePath } from "next/cache";

/**
 * 목소리가 올라가거나 내려가거나 ❤ 를 받으면, 그걸 보여 주는 화면의 캐시를 바로 버린다.
 * 홈은 5분(revalidate 300), 갤러리는 30초 캐시라 "올렸는데 스토리에 안 떠요"가 됐다(11/4).
 * 다음 방문 때 새로 그린다 — 요청이 적어 재생성 비용은 거의 없다.
 */
export function refreshVoicePages(): void {
  try {
    revalidatePath("/[lang]", "page");
    revalidatePath("/[lang]/weekly", "page");
    revalidatePath("/[lang]/weekly/e/[id]", "page");
    revalidatePath("/[lang]/v/[name]", "page");
  } catch {
    // 캐시를 못 버려도 길어야 몇 분 뒤엔 새로 그려진다.
  }
}
