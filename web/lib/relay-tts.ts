import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * 작가·감독이 쓴 줄을 TTS 로 한 번 읽어 스토리지에 둔다 — 서버 전용.
 *
 * 비축 장면은 tools/make_relay_tts.py 가 미리 만든 정적 파일이고, 여기는 사람이 쓴 줄만 온다
 * (하루 수십 줄). 무료 edge TTS 라 비용은 없지만 비공식 경로라 막힐 수 있다 — 실패하면 null 을
 * 돌려주고, 화면은 브라우저 TTS(speechSynthesis)로 대신 읽는다.
 * 프리셋은 content/relay_scenes.json 의 voices 와 같다.
 */
export const VOICE_PRESETS: Record<string, { voice: string; pitch: string; rate: string }> = {
  f_bright: { voice: "ko-KR-SunHiNeural", pitch: "+12Hz", rate: "+6%" },
  f_calm: { voice: "ko-KR-SunHiNeural", pitch: "-2Hz", rate: "-4%" },
  f_child: { voice: "ko-KR-SunHiNeural", pitch: "+38Hz", rate: "+10%" },
  f_elder: { voice: "ko-KR-SunHiNeural", pitch: "-18Hz", rate: "-16%" },
  m_calm: { voice: "ko-KR-InJoonNeural", pitch: "+0Hz", rate: "-4%" },
  m_deep: { voice: "ko-KR-InJoonNeural", pitch: "-22Hz", rate: "-12%" },
  m_elder: { voice: "ko-KR-InJoonNeural", pitch: "-12Hz", rate: "-18%" },
  m_young: { voice: "ko-KR-HyunsuMultilingualNeural", pitch: "+8Hz", rate: "+4%" },
  m_bright: { voice: "ko-KR-HyunsuMultilingualNeural", pitch: "+0Hz", rate: "+10%" },
  robot: { voice: "ko-KR-HyunsuMultilingualNeural", pitch: "-6Hz", rate: "+18%" },
};
export { VOICE_LABEL } from "@/lib/relay";

async function synth(text: string, presetId: string): Promise<Buffer | null> {
  const p = VOICE_PRESETS[presetId] ?? VOICE_PRESETS.m_calm;
  const tts = new MsEdgeTTS();
  try {
    await tts.setMetadata(p.voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(text, { pitch: p.pitch, rate: p.rate });
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("tts timeout")), 15_000);
      audioStream.on("data", (c: Buffer) => chunks.push(c));
      audioStream.on("close", () => {
        clearTimeout(timer);
        resolve();
      });
      audioStream.on("error", (e: unknown) => {
        clearTimeout(timer);
        reject(e);
      });
    });
    const buf = Buffer.concat(chunks);
    return buf.length > 1500 ? buf : null;
  } catch (e) {
    console.error("relay tts", e);
    return null;
  } finally {
    try {
      tts.close();
    } catch {}
  }
}

/** 줄 하나를 읽어 저장 → 스토리지 경로와 길이(초). 실패하면 null. */
export async function ttsForLine(lineId: string, text: string, presetId: string): Promise<{ path: string; sec: number } | null> {
  const buf = await synth(text, presetId);
  if (!buf) return null;
  const path = `relay/tts/${lineId}.mp3`;
  const { error } = await createServiceClient()
    .storage.from("recordings")
    .upload(path, new Blob([new Uint8Array(buf)], { type: "audio/mpeg" }), { contentType: "audio/mpeg", upsert: true, cacheControl: "31536000" });
  if (error) {
    console.error("relay tts upload", error.message);
    return null;
  }
  // 48kbps 고정 비트레이트 — 크기로 길이를 잰다
  return { path, sec: Math.round(((buf.length * 8) / 48_000) * 100) / 100 };
}
