import { clientId } from "@/lib/client-id";

/**
 * 받아쓰기 호출 — 연습실 대본 확인(코코의 심사표). 녹음이 서버로 가는 유일한 길이고 비용이 들어서
 * 사용자가 버튼을 누를 때만 부른다. 결과는 테이크에 저장해 같은 녹음을 다시 보내지 않는다.
 */
export async function transcribe(blob: Blob): Promise<{ text: string } | { error: string | null }> {
  try {
    const body = new FormData();
    body.append("file", blob, "recording.webm");
    const res = await fetch(`/api/transcribe?client=${encodeURIComponent(clientId())}`, { method: "POST", body });
    const data = (await res.json()) as { text?: string; error?: string };
    if (!res.ok || typeof data.text !== "string") return { error: data.error ?? null };
    return { text: data.text };
  } catch {
    return { error: null };
  }
}
