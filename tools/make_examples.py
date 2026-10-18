"""예시 순위표 소리 만들기 — 출전작이 없을 때 주간 챌린지 화면에 까는 "예시 출전작" 네 개.

  python tools/make_examples.py           # 없는 것만 만든다
  python tools/make_examples.py --force   # 전부 다시

만드는 것:
  web/public/examples/demo/{대본 id}_{0~3}.mp3   주간 대본(lib/weekly.ts 의 ROTATION)마다 네 목소리
  web/lib/examples.ts                           위 목록·길이·파형 (생성물 — 직접 고치지 말 것)

네 줄이 같은 소리면 "사람마다 다르게 읽어 올리는 판"이라는 게 안 보인다. 목소리·속도·높이를
달리해 네 사람처럼 들리게 한다. 화면에는 "예시"라고 붙이고, 실제 순위·❤ 에는 섞지 않는다.
ROTATION 에 대본을 덧붙였으면 다시 돌린다.
"""
import asyncio
import json
import os
import re
import subprocess
import sys
import tempfile

import edge_tts
import librosa
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "web", "public", "examples", "demo")
TS = os.path.join(ROOT, "web", "lib", "examples.ts")
WEEKLY = os.path.join(ROOT, "web", "lib", "weekly.ts")

# 예시 출전자 넷 — hub.tsx 의 DEMO 와 순서가 같다. (목소리, 속도, 높이)
TAKES = [
    ("ko-KR-SunHiNeural", "-6%", "-4Hz"),
    ("ko-KR-InJoonNeural", "+4%", "-8Hz"),
    ("ko-KR-HyunsuMultilingualNeural", "+0%", "+0Hz"),
    ("ko-KR-SunHiNeural", "+12%", "+18Hz"),
]
BARS = 40


def rotation() -> list[str]:
    src = open(WEEKLY, encoding="utf-8").read()
    block = src[src.index("export const ROTATION"):]
    block = block[: block.index("];")]
    return re.findall(r'scriptId:\s*"([^"]+)"', block)


def clean(text: str) -> str:
    """대본 표기(/ 쉼, *강조*)를 읽을 문장으로. 쉼표시는 쉼표로 바꿔 실제로 쉬게 한다."""
    t = text.replace("*", "")
    t = t.replace(" / ", ", ").replace("/", ",")
    return "\n".join(p.strip() for p in t.split("\n") if p.strip())


async def synth(text: str, voice: str, rate: str, pitch: str, path: str) -> None:
    await edge_tts.Communicate(text, voice, rate=rate, pitch=pitch).save(path)


def encode(src: str, dst: str) -> None:
    """모노 · 48kbps · 앞뒤 무음 정리 — 하나에 100KB 안팎."""
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
    by_id = {s["id"]: s for s in reg["scripts"]}
    demo: dict[str, list[dict]] = {}
    tmp = tempfile.mkdtemp()

    for sid in rotation():
        s = by_id[sid]
        takes = []
        for n, (voice, rate, pitch) in enumerate(TAKES):
            dst = os.path.join(OUT, f"{sid}_{n}.mp3")
            if force or not os.path.exists(dst):
                raw = os.path.join(tmp, f"{sid}_{n}.mp3")
                asyncio.run(synth(clean(s["text"]), voice, rate, pitch, raw))
                encode(raw, dst)
            dur, bars = shape(dst)
            takes.append({"src": f"/examples/demo/{sid}_{n}.mp3", "duration": dur, "bars": bars})
        demo[sid] = takes
        print(sid, [t["duration"] for t in takes])

    with open(TS, "w", encoding="utf-8", newline="\n") as f:
        f.write("// tools/make_examples.py 가 만든다. 직접 고치지 말 것 — 다시 돌리면 덮어쓴다.\n")
        f.write("// 예시 순위표(app/weekly/hub.tsx)의 예시 출전작 소리 — AI 가 네 목소리로 읽었다. 실제 순위·❤ 에 섞지 않는다.\n\n")
        f.write("export type Example = { src: string; duration: number; bars: number[] };\n\n")
        f.write(f"export const DEMO_TAKES: Record<string, Example[]> = {json.dumps(demo, ensure_ascii=False)};\n")
    print("wrote", TS)


if __name__ == "__main__":
    main("--force" in sys.argv)
