"""웹 녹음 포맷 디코드 회귀 테스트 — 이슈 #15

카톡 인앱(안드로이드)은 audio/webm;codecs=opus 를 준다. libsndfile 이 못 읽는
포맷이라 확장자만 .wav 로 붙이던 예전 경로는 여기서 죽었다.
"""
import os, shutil, subprocess, sys, tempfile
import pytest, soundfile as sf

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import modal_app as ma

pytestmark = pytest.mark.skipif(shutil.which("ffmpeg") is None,
                                reason="ffmpeg 없음")


def _encode(codec, container, sr=48000, dur=2.5):
    """브라우저가 보낼 법한 바이트를 만든다."""
    p = tempfile.mktemp(suffix=container)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi",
                    "-i", f"sine=frequency=440:duration={dur}",
                    "-ac", "1", "-ar", str(sr), "-c:a", codec, p],
                   check=True, capture_output=True)
    raw = open(p, "rb").read()
    os.unlink(p)
    return raw


@pytest.mark.parametrize("codec,container", [
    ("libopus", ".webm"),   # 안드로이드 카톡 인앱 — 실측 확인된 포맷
    ("aac", ".m4a"),        # iOS 사파리/카톡
    ("pcm_s16le", ".wav"),  # 기존 Flutter 앱 경로 (회귀 방지)
])
def test_decodes_to_16k_mono(codec, container):
    path = ma._decode_upload(_encode(codec, container))
    assert path is not None, f"{container} 디코딩 실패"
    y, sr = sf.read(path)
    os.unlink(path)
    assert sr == ma.DECODE_SR
    assert y.ndim == 1
    assert abs(len(y) / sr - 2.5) < 0.2


def test_rejects_garbage():
    assert ma._decode_upload(b"not audio at all") is None


def test_rejects_empty():
    assert ma._decode_upload(b"") is None


def test_rejects_oversize():
    assert ma._decode_upload(b"\0" * (ma.MAX_UPLOAD_BYTES + 1)) is None
