"""AI 예시 음성 만들기 — 출전작이 없을 때 주간 챌린지 예시 순위표에서 틀 소리.

  python tools/make_examples.py           # 없는 것만 만든다
  python tools/make_examples.py --force   # 전부 다시

만드는 것:
  web/public/examples/scripts/{대본 id}.mp3   연습실 대본을 AI(edge-tts)가 읽은 것
  web/lib/examples.ts                        위 목록·길이·파형 (생성물 — 직접 고치지 말 것)

예시 순위표는 "예시"라고 붙이고, 실제 순위·❤·피드에는 절대 섞지 않는다.
"""
import asyncio
import json
import os
import subprocess
import sys
import tempfile

import edge_tts
import librosa
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "web", "public", "examples")
TS = os.path.join(ROOT, "web", "lib", "examples.ts")

# 성우 트랙은 여성, 아나운서 트랙은 남성 — 한 목소리만 들으면 "그 목소리를 흉내 내라"로 읽힌다.
VOICE = {"voice": "ko-KR-SunHiNeural", "anchor": "ko-KR-InJoonNeural"}
BARS = 40


def clean(text: str) -> str:
    """대본 표기(/ 쉼, *강조*)를 읽을 문장으로. 쉼표시는 쉼표로 바꿔 실제로 쉬게 한다."""
    t = text.replace("*", "")
    t = t.replace(" / ", ", ").replace("/", ",")
    return "\n".join(p.strip() for p in t.split("\n") if p.strip())


async def synth(text: str, voice: str, path: str) -> None:
    await edge_tts.Communicate(text, voice).save(path)


def encode(src: str, dst: str) -> None:
    """모노 · 48kbps · 앞뒤 무음 정리 — 대본 하나에 100KB 안팎."""
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", src,
         "-af", "silenceremove=start_periods=1:start_threshold=-50dB,areverse,"
                "silenceremove=start_periods=1:start_threshold=-50dB,areverse",
         "-ac", "1", "-ar", "24000", "-b:a", "48k", dst],
        check=True,
    )


def shape(path: str) -> tuple[float, list[float]]:
    y, sr = librosa.load(path, sr=16000, mono=True)
    dur = len(y) / sr
    step = max(1, len(y) // BARS)
    bars = [float(np.abs(y[i:i + step]).max()) for i in range(0, len(y), step)][:BARS]
    m = max(bars) if bars else 1.0
    return round(dur, 1), [round(b / (m + 1e-9), 2) for b in bars]


def main(force: bool) -> None:
    reg = json.load(open(os.path.join(ROOT, "content", "registry.json"), encoding="utf-8"))
    scripts = {}
    tmp = tempfile.mkdtemp()

    for s in reg["scripts"]:
        dst = os.path.join(OUT, "scripts", f"{s['id']}.mp3")
        if force or not os.path.exists(dst):
            raw = os.path.join(tmp, f"{s['id']}.mp3")
            asyncio.run(synth(clean(s["text"]), VOICE[s["track"]], raw))
            encode(raw, dst)
        dur, bars = shape(dst)
        scripts[s["id"]] = {"src": f"/examples/scripts/{s['id']}.mp3", "duration": dur, "bars": bars}
        print("script", s["id"], dur)

    with open(TS, "w", encoding="utf-8", newline="\n") as f:
        f.write("// tools/make_examples.py 가 만든다. 직접 고치지 말 것 — 다시 돌리면 덮어쓴다.\n")
        f.write("// AI 예시 음성: 출전작이 없을 때 예시 순위표(app/weekly/hub.tsx)의 소리. 실제 순위·❤ 에 섞지 않는다.\n\n")
        f.write("export type Example = { src: string; duration: number; bars: number[] };\n\n")
        f.write(f"export const SCRIPT_EXAMPLES: Record<string, Example> = {json.dumps(scripts, ensure_ascii=False, indent=1)};\n")
    print("wrote", TS)


if __name__ == "__main__":
    main("--force" in sys.argv)
