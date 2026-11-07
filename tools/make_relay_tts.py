"""릴레이 더빙 비축 장면 → TTS 파일 + 웹 데이터.

content/relay_scenes.json 을 읽어
  - web/public/relay/tts/<key>/<n>.mp3  줄마다 배역 목소리로 읽은 TTS (edge-tts, 무료)
  - web/lib/relay-stock.ts              웹이 쓰는 장면 데이터 (생성물 — 직접 고치지 말 것)
를 만든다. 대사가 안 바뀐 줄은 다시 만들지 않는다(파일 옆 .hash 로 비교).

    python tools/make_relay_tts.py           # 바뀐 줄만
    python tools/make_relay_tts.py --check   # 파일 생성 없이 검사만 (CI 용)

TTS 는 정적 파일이라 서버 비용이 0 이다. 대사 하나를 고치면 그 줄만 다시 읽는다.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "content" / "relay_scenes.json"
OUT_AUDIO = ROOT / "web" / "public" / "relay" / "tts"
OUT_TS = ROOT / "web" / "lib" / "relay-stock.ts"
LINES = 10
TYPES = {"anime", "actor", "announcer", "speech", "everyday"}
HALLS = {"act", "real"}
# edge-tts 기본 출력(24kHz · 48kbps · 모노 mp3) — 고정 비트레이트라 길이를 크기로 잰다.
KBPS = 48


def load() -> dict:
    data = json.loads(SRC.read_text(encoding="utf-8"))
    voices = data["voices"]
    keys = set()
    for s in data["scenes"]:
        k = s["key"]
        assert k not in keys, f"중복 key: {k}"
        keys.add(k)
        assert s["hall"] in HALLS, f"{k}: hall"
        roles = {r[0]: r for r in s["roles"]}
        assert 2 <= len(roles) <= 4, f"{k}: 배역은 2~4"
        for r in s["roles"]:
            assert r[2] in TYPES, f"{k}/{r[0]}: 계열 {r[2]}"
            assert r[3] in voices, f"{k}/{r[0]}: 목소리 {r[3]}"
        assert len(s["lines"]) == LINES, f"{k}: 줄 수 {len(s['lines'])} (10이어야 함)"
        used = set()
        for i, ln in enumerate(s["lines"], 1):
            assert ln[0] in roles, f"{k} {i}번: 배역 {ln[0]}"
            assert 2 <= len(ln[1]) <= 60, f"{k} {i}번: 대사 길이 {len(ln[1])}"
            assert not any(c.isdigit() for c in ln[1]), f"{k} {i}번: 숫자는 한글로"
            used.add(ln[0])
        assert used == set(roles), f"{k}: 대사 없는 배역 {set(roles) - used}"
    return data


def digest(text: str, preset: dict) -> str:
    raw = json.dumps([text, preset], ensure_ascii=False, sort_keys=True)
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:10]


async def speak(text: str, preset: dict, path: Path) -> None:
    import edge_tts

    for attempt in range(4):
        try:
            await edge_tts.Communicate(text, preset["voice"], rate=preset["rate"], pitch=preset["pitch"]).save(str(path))
            if path.stat().st_size > 2000:
                return
        except Exception as e:  # 네트워크가 가끔 끊긴다 — 몇 번 다시
            print(f"  다시 시도 {attempt + 1}: {e}")
        await asyncio.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"TTS 실패: {path}")


async def build(check: bool) -> None:
    data = load()
    voices = data["voices"]
    scenes_out = []
    made = 0
    for s in data["scenes"]:
        roles = {r[0]: r for r in s["roles"]}
        d = OUT_AUDIO / s["key"]
        lines_out = []
        for i, ln in enumerate(s["lines"], 1):
            preset = voices[roles[ln[0]][3]]
            h = digest(ln[1], preset)
            mp3 = d / f"{i}.mp3"
            stamp = d / f"{i}.hash"
            fresh = mp3.exists() and stamp.exists() and stamp.read_text().strip() == h
            if not fresh:
                if check:
                    raise SystemExit(f"TTS 가 낡았다: {s['key']} {i}번 — python tools/make_relay_tts.py")
                d.mkdir(parents=True, exist_ok=True)
                await speak(ln[1], preset, mp3)
                stamp.write_text(h)
                made += 1
                print(f"  {s['key']} {i}: {ln[1]}")
            sec = round(mp3.stat().st_size * 8 / (KBPS * 1000), 2)
            lines_out.append({
                "n": i, "role": ln[0], "text": ln[1], "dir": ln[2], "tip": ln[3],
                "tts": f"/relay/tts/{s['key']}/{i}.mp3?v={h}", "sec": sec,
            })
        scenes_out.append({
            "key": s["key"], "hall": s["hall"], "genre": s["genre"], "title": s["title"], "logline": s["logline"],
            "roles": [{"id": r[0], "name": r[1], "type": r[2], "voice": r[3], "desc": r[4]} for r in s["roles"]],
            "lines": lines_out,
        })

    ts = (
        "// 생성물 — tools/make_relay_tts.py 가 content/relay_scenes.json 에서 만든다. 직접 고치지 말 것.\n"
        'import type { StockScene } from "@/lib/relay";\n\n'
        f"export const RELAY_STOCK: StockScene[] = {json.dumps(scenes_out, ensure_ascii=False, indent=1)};\n"
    )
    if check:
        if not OUT_TS.exists() or OUT_TS.read_text(encoding="utf-8") != ts:
            raise SystemExit("relay-stock.ts 가 낡았다 — python tools/make_relay_tts.py")
        print(f"ok: 장면 {len(scenes_out)}개")
        return
    OUT_TS.write_text(ts, encoding="utf-8")
    print(f"장면 {len(scenes_out)}개 · 새로 읽은 줄 {made}개 → {OUT_TS.relative_to(ROOT)}")


if __name__ == "__main__":
    asyncio.run(build("--check" in sys.argv))
