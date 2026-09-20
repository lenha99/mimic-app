import { after } from "next/server";
import { config } from "@/lib/config";

/**
 * 채점 서버 예열.
 *
 * Modal 은 요청이 없으면 컨테이너를 내린다. 다시 올리는 데 실측 40초 넘게 걸리고,
 * 그 시간이 하필 "혼자 폰에 대고 소리를 낸 직후"에 떨어진다 — 이탈이 제일 쉬운
 * 순간이다.
 *
 * 그래서 챌린지 화면이 열리는 순간 여기로 한 번 찌른다. 사용자가 원본을 듣고
 * 3·2·1 을 세고 따라하는 동안 컨테이너가 깨어난다.
 *
 * 응답을 기다리지 않는 이유: 브라우저는 "깨우기 시작했다"만 알면 되고, 깨어나는
 * 것 자체는 Modal 쪽 일이다. `after` 로 넘기면 204 를 즉시 돌려주고 fetch 는
 * 백그라운드에서 마저 돈다. (처음엔 그냥 await 했는데, 콜드 스타트가 타임아웃보다
 * 길어서 요청이 20초씩 매달렸다.)
 *
 * 무음 wav 를 보내는 이유: 컨테이너만 띄우는 게 아니라 librosa import 와
 * 메모리 스냅샷 복원까지 실제 채점 경로를 그대로 지나가야 진짜 예열이 된다.
 * 서버는 "기준 음성 없음"을 돌려주는데, 그 응답은 버린다.
 */

/** 콜드 스타트가 40초를 넘긴 적이 있다. 예열은 끝까지 갈 시간을 줘야 의미가 있다. */
export const maxDuration = 60;

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
  after(async () => {
    const body = new FormData();
    body.append("file", new Blob([silentWav()], { type: "audio/wav" }), "warm.wav");
    try {
      await fetch(`${config.scoreUrl}?meme_id=__warm__`, {
        method: "POST",
        body,
        signal: AbortSignal.timeout(55_000),
      });
    } catch {
      // 의도적으로 삼킨다 — 예열은 최선 노력이고, 실패해도 채점은 그대로 된다.
    }
  });

  return new Response(null, { status: 204 });
}
