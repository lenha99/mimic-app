"use client";

/**
 * 내 기기에 저장 — 방 녹음은 방을 나가면 서버에서 지워진다. 간직하고 싶으면 여기서 내려받는다.
 * 서버엔 아무것도 더 남기지 않는다.
 */

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

const safe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, "_").slice(0, 40) || "mimic";

/** 녹음 하나 그대로 */
export async function saveOne(url: string, name: string): Promise<boolean> {
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    const blob = await res.blob();
    const ext = blob.type.includes("mp4") || blob.type.includes("aac") ? "m4a" : blob.type.includes("ogg") ? "ogg" : blob.type.includes("wav") ? "wav" : blob.type.includes("mpeg") ? "mp3" : "webm";
    download(blob, `${safe(name)}.${ext}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * 여러 녹음을 순서대로 이어 붙여 wav 하나로 — 완성본·이어 듣기 저장.
 * 주소가 없는 줄(브라우저가 소리 내 읽는 AI 목소리)은 담을 수 없어 건너뛴다.
 */
export async function saveJoined(urls: (string | null)[], name: string, gapMs = 250): Promise<{ ok: boolean; skipped: number }> {
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AC) return { ok: false, skipped: 0 };
  const ctx = new AC();
  try {
    let skipped = 0;
    const buffers: AudioBuffer[] = [];
    for (const u of urls) {
      if (!u) {
        skipped++;
        continue;
      }
      try {
        const res = await fetch(u);
        if (!res.ok) throw new Error("fetch");
        buffers.push(await ctx.decodeAudioData(await res.arrayBuffer()));
      } catch {
        skipped++;
      }
    }
    if (!buffers.length) return { ok: false, skipped };
    const rate = 24000;
    const gap = Math.round((gapMs / 1000) * rate);
    const resampled = await Promise.all(
      buffers.map(async (b) => {
        const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(b.duration * rate)), rate);
        const src = off.createBufferSource();
        src.buffer = b;
        src.connect(off.destination);
        src.start();
        return (await off.startRendering()).getChannelData(0);
      }),
    );
    const total = resampled.reduce((n, d) => n + d.length + gap, 0);
    const pcm = new Float32Array(total);
    let at = 0;
    for (const d of resampled) {
      pcm.set(d, at);
      at += d.length + gap;
    }
    download(toWav(pcm, rate), `${safe(name)}.wav`);
    return { ok: true, skipped };
  } finally {
    void ctx.close();
  }
}

function toWav(pcm: Float32Array, rate: number): Blob {
  const buf = new ArrayBuffer(44 + pcm.length * 2);
  const v = new DataView(buf);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF");
  v.setUint32(4, 36 + pcm.length * 2, true);
  w(8, "WAVE");
  w(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, "data");
  v.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[i])) * 0x7fff, true);
  return new Blob([buf], { type: "audio/wav" });
}
