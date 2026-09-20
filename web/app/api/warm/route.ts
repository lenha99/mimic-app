import { config } from "@/lib/config";

/**
 * 채점 서버 예열.
 *
 * Modal 은 요청이 없으면 컨테이너를 내린다. 다시 올리는 데 수십 초가 걸리고,
 * 그 수십 초가 하필 "혼자 폰에 대고 소리를 낸 직후"에 떨어진다 — 이탈이 제일
 * 쉬운 순간이다.
 *
 * 그래서 챌린지 화면이 열리는 순간 여기로 한 번 찌른다. 사용자가 원본을 듣고
 * 3·2·1 을 세고 따라하는 동안(대략 4~6초) 컨테이너가 깨어난다. 녹음이 끝날
 * 때쯤엔 대개 준비가 끝나 있다.
 *
 * 무음 wav 를 보내는 이유: 컨테이너만 띄우는 게 아니라 librosa import 와
 * 메모리 스냅샷 복원까지 실제 채점 경로를 그대로 지나가야 진짜 예열이 된다.
 * 서버는 "빈 오디오 또는 무음"을 돌려주는데, 그 응답은 버린다.
 */

/** 0.05초짜리 16k 모노 무음 wav. 채점은 실패하지만 디코드 경로는 다 지난다. */
function silentWav(): ArrayBuffer {
  const sampleRate = 16000;
  const samples = Math.round(sampleRate * 0.05);
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };

  ascii(0, "RIFF");
  view.setUint32(4, 36 + samples * 2, true);
  ascii(8, "WAVEfmt ");
  view.setUint32(16, 16, true); // fmt 청크 길이
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // 모노
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // 바이트/초
  view.setUint16(32, 2, true); // 블록 정렬
  view.setUint16(34, 16, true); // 비트 심도
  ascii(36, "data");
  view.setUint32(40, samples * 2, true);
  // 본문은 0 으로 두면 그대로 무음이다.

  return buffer;
}

export async function POST() {
  const body = new FormData();
  body.append("file", new Blob([silentWav()], { type: "audio/wav" }), "warm.wav");

  try {
    // 예열은 실패해도 사용자에게 아무 영향이 없다. 오래 매달리지 않는다.
    await fetch(`${config.scoreUrl}?meme_id=__warm__`, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    // 의도적으로 삼킨다 — 예열은 최선 노력이고, 실패해도 채점은 그대로 된다.
  }

  return new Response(null, { status: 204 });
}
