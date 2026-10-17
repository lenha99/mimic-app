"""
콘텐츠 레지스트리 스키마 + 파생 사본 드리프트 검사.

밈 목록은 네 군데(catalog.json · memes.json · web FALLBACK · Flutter demoMemes)에
복제돼 있고, 예전엔 손으로 맞췄다. 하나만 빠뜨려도 Modal 이 죽었을 때 새 밈이
404 나는데, 그건 서버가 멀쩡한 동안엔 아무도 모른다. 그래서 CI 가 대신 본다.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
REGISTRY = ROOT / "content" / "registry.json"
ID_RE = re.compile(r"^[a-z0-9_]{3,32}$")

# recorder.tsx 의 UX 분기점 — 이 위로 올라가면 화면 흐름 자체가 바뀐다.
MANUAL_STOP_ABOVE_MS = 8000
TAIL_MS = 800

SPEECH_KINDS = {"movie", "drama", "variety", "shortform"}


@pytest.fixture(scope="module")
def memes():
    with REGISTRY.open(encoding="utf-8") as f:
        return json.load(f)["memes"]


def test_ids_are_unique_and_url_safe(memes):
    ids = [m["id"] for m in memes]
    assert len(ids) == len(set(ids)), "id 중복"
    for i in ids:
        # id 는 URL 경로 조각이자 볼륨의 {id}.wav 파일명이 된다 (modal_app._ref_path)
        assert ID_RE.match(i), f"id 형식 위반: {i}"
    assert "__warm__" not in ids, "예열 센티널과 겹치면 안 된다"


def test_required_fields(memes):
    for m in memes:
        for key in ("id", "title", "emoji", "license"):
            assert m.get(key), f"{m.get('id')}: {key} 누락"
        assert isinstance(m.get("plays", 0), int)


def test_speech_memes_carry_the_line(memes):
    """말소리 밈은 뭘 말해야 하는지 화면에 띄워야 한다 (recorder 가 meme.line 으로 분기)."""
    for m in memes:
        if m.get("kind") in SPEECH_KINDS:
            assert m.get("line"), f"{m['id']}: 말소리 밈인데 line 이 없다"


def test_original_clips_record_provenance(memes):
    """원본 유래 클립은 출처가 있어야 한다 — 내려달라는 연락이 오면 이게 유일한 근거다."""
    for m in memes:
        if (m.get("license") or {}).get("kind") == "original-clip":
            origin = m.get("origin") or {}
            assert origin.get("url"), f"{m['id']}: origin.url 누락"


def test_duration_stays_in_the_one_tap_flow(memes):
    """길이가 UX 를 정한다. 8초를 넘으면 수동 정지 버튼이 붙는다 (recorder.tsx)."""
    for m in memes:
        ms = m.get("duration_ms")
        if ms:
            assert ms + TAIL_MS <= MANUAL_STOP_ABOVE_MS, (
                f"{m['id']}: {ms}ms — 녹음 창이 8초를 넘어 흐름이 바뀐다")


def test_generated_copies_match_registry():
    """catalog.json · memes.json · web FALLBACK · Flutter demoMemes 드리프트."""
    r = subprocess.run(
        [sys.executable, str(ROOT / "tools" / "sync_catalog.py"), "--check"],
        capture_output=True, text=True, encoding="utf-8", errors="replace")
    assert r.returncode == 0, r.stdout + r.stderr


# ---- 권리 상태 · 연습실 대본 -------------------------------------------------

RIGHTS = {"original", "public_domain", "quote_rerecorded", "partner", "clip"}
SCRIPT_ID_RE = re.compile(r"^sc_[a-z0-9_]{3,29}$")


@pytest.fixture(scope="module")
def scripts():
    with REGISTRY.open(encoding="utf-8") as f:
        return json.load(f).get("scripts", [])


def test_every_meme_states_its_rights(memes):
    """돈을 받기 시작하면 clip 은 유료 기능에서 빠져야 한다. 그러려면 전부 적혀 있어야 한다."""
    for m in memes:
        assert (m.get("license") or {}).get("rights") in RIGHTS, f"{m['id']}: license.rights 누락/오타"


def test_script_shape(scripts, memes):
    ids = [s["id"] for s in scripts]
    assert len(ids) == len(set(ids)), "대본 id 중복"
    assert not set(ids) & {m["id"] for m in memes}, "대본 id 가 밈 id 와 겹친다 (연습실 주소가 같다)"
    for s in scripts:
        assert SCRIPT_ID_RE.match(s["id"]), f"대본 id 형식: {s['id']}"
        assert s["track"] in {"voice", "anchor"}, s["id"]
        assert s["level"] in {1, 2, 3}, s["id"]
        assert s["pitch"] in {"low", "mid", "high"}, s["id"]
        lo, hi = s["pace"]
        assert 2.0 <= lo < hi <= 8.0, f"{s['id']}: 속도 범위가 이상하다 {s['pace']}"
        assert s["rights"]["kind"] in RIGHTS, s["id"]
        for key in ("title", "category", "direction", "text"):
            assert s.get(key, "").strip(), f"{s['id']}: {key} 누락"


def test_script_text_reads_as_written(scripts):
    """속도는 음절 수로 잰다. 숫자·영문이 섞이면 읽는 음절 수와 글자 수가 어긋난다."""
    for s in scripts:
        assert not re.search(r"[0-9A-Za-z]", s["text"]), f"{s['id']}: 숫자·영문은 한글로 풀어 쓴다"
        assert s["text"].count("*") % 2 == 0, f"{s['id']}: 강조 표시(*)가 짝이 안 맞다"
