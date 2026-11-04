"""채점 캘리브레이션 회귀 테스트.

배포되는 채점기(`modal_app._score`)를 직접 검증한다. 이전에는 CI가
`scoring_engine.py`(배포에 쓰이지 않는 프로토타입)를 테스트해서, 실제 서버 채점식은
테스트 0줄이었다.

사람이 따라한 녹음이 아직 없어서(이슈 #15), 기준 음성에 **통제된 변형**을 가해
정답이 자명한 쌍을 만든다:

  정답류(GOOD) — 제대로 따라했고 녹음 조건만 나쁨 → 점수가 나와야 한다
  오답류(BAD)  — 따라한 게 아님(거꾸로/무의미/다른 밈) → 낮아야 한다

핵심 불변식은 **마진**이다: 정답류 최저점 > 오답류 최고점.
이게 깨지면 "제대로 했는데 C, 아무 말이나 했더니 A"가 나온다.
"""
import os
import sys
import tempfile

import numpy as np
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

librosa = pytest.importorskip("librosa")
sf = pytest.importorskip("soundfile")

import modal_app

# modal_app 은 무거운 의존성을 `with image.imports()` 안에 가둬서(로컬 deploy 가
# 깨지지 않도록) 로컬 import 시엔 librosa/np 가 모듈 전역에 없다. 주입해서 부른다.
modal_app.librosa = librosa
modal_app.np = np

SR = 22050
REFS = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "refs")
MEMES = ["ronaldo_siu.wav", "oh_my_god.wav", "nani.wav", "wow.wav"]

GOOD = {"동일", "약한잡음", "음높이+2세미톤", "속도+10%", "속도+30%", "속도2배", "강한잡음"}
BAD = {"역재생", "순수잡음", "다른밈"}
PARTIAL = {"절반잘림", "25%만"}  # 부분 정답 — 중간대면 되고 불변식에서는 제외


def _write(y):
    path = tempfile.mktemp(suffix=".wav")
    sf.write(path, y.astype(np.float32), SR)
    return path


def _base(name):
    """무음 패딩을 먼저 없앤다 — 안 그러면 '절반 잘림'이 패딩만 자른다."""
    y = librosa.load(os.path.join(REFS, name), sr=SR, mono=True)[0]
    y, _ = librosa.effects.trim(y, top_db=30)
    return y


def _variants(y):
    rng = np.random.default_rng(0)
    amp = np.sqrt(np.mean(y**2))
    return [
        ("동일", y),
        ("약한잡음", y + rng.normal(0, amp / 10, len(y))),
        ("음높이+2세미톤", librosa.effects.pitch_shift(y=y, sr=SR, n_steps=2)),
        ("속도+10%", librosa.effects.time_stretch(y=y, rate=1.10)),
        ("속도+30%", librosa.effects.time_stretch(y=y, rate=1.30)),
        ("속도2배", librosa.effects.time_stretch(y=y, rate=2.0)),
        ("강한잡음", y + rng.normal(0, amp, len(y))),
        ("절반잘림", y[: len(y) // 2]),
        ("25%만", y[: len(y) // 4]),
        ("역재생", y[::-1]),
        ("순수잡음", rng.normal(0, 0.1, len(y))),
    ]


@pytest.fixture(scope="module")
def ladder():
    """[(밈, 변형이름, 점수, breakdown)] 전체."""
    rows = []
    for name in MEMES:
        y = _base(name)
        ref_path = _write(y)
        for label, variant in _variants(y):
            # _score 는 trim 후 0.15초 미만을 '무음'으로 거절한다. 짧은 밈(nani 0.37s)의
            # 25% 는 그 아래라 채점 대상이 아니다 — 거절 자체는 올바른 동작이므로 건너뛴다.
            if len(variant) < SR * 0.2:
                continue
            result = modal_app._score(ref_path, _write(variant))
            assert "error" not in result, f"{name}/{label}: {result['error']}"
            rows.append((name, label, result["score"], result["breakdown"]))
        for other in MEMES:
            if other == name:
                continue
            result = modal_app._score(ref_path, os.path.join(REFS, other))
            rows.append((name, "다른밈", result["score"], result["breakdown"]))
    return rows


def test_identical_audio_is_perfect(ladder):
    """같은 오디오끼리는 100점. 이게 아니면 정규화가 깨진 것."""
    for meme, label, score, _ in ladder:
        if label == "동일":
            assert score == 100, f"{meme}: 자기 자신과 비교했는데 {score}점"


def test_correct_attempt_beats_wrong_attempt(ladder):
    """핵심 불변식 — 제대로 따라한 것의 최저점 > 따라하지 않은 것의 최고점."""
    good = [(m, l, s) for m, l, s, _ in ladder if l in GOOD]
    bad = [(m, l, s) for m, l, s, _ in ladder if l in BAD]
    worst_good = min(good, key=lambda r: r[2])
    best_bad = max(bad, key=lambda r: r[2])
    assert worst_good[2] > best_bad[2], (
        f"오답이 정답을 이김: {best_bad[0]}/{best_bad[1]}={best_bad[2]}점 >= "
        f"{worst_good[0]}/{worst_good[1]}={worst_good[2]}점"
    )


def test_timing_rejects_junk(ladder):
    """timing 은 길이 비율만 보면 안 된다.

    예전엔 길이만 같으면 100점이라 잡음만 넣어도, 완전히 다른 밈이어도 timing 만점이었다.

    역재생은 일부러 제외한다: '시우우'처럼 좌우대칭으로 길게 끄는 소리는 거꾸로
    돌려도 에너지 포락선이 거의 같아서(siu 93, nani 74) 포락선 특징이 원리적으로
    구분할 수 없다. 대신 억양·음색이 잡아내며, 총점은
    test_correct_attempt_beats_wrong_attempt 가 지킨다.
    """
    for meme, label, _, bd in ladder:
        if label in ("순수잡음", "다른밈"):
            # breakdown 은 표시 곡선을 거친 값이다 — 원점수 70 을 같은 곡선에 태워 비교
            assert bd["timing"] < round(modal_app._curve(70)), (
                f"{meme}/{label}: 따라한 게 아닌데 timing={bd['timing']}"
            )


def test_truncation_is_penalised(ladder):
    """절반만 따라하면 온전히 따라한 것보다 낮아야 한다."""
    by_meme = {}
    for meme, label, score, _ in ladder:
        by_meme.setdefault(meme, {})[label] = score
    checked = 0
    for meme, scores in by_meme.items():
        if "절반잘림" not in scores:
            continue
        assert scores["절반잘림"] < scores["동일"], (
            f"{meme}: 절반만 따라했는데 감점이 없음 — "
            f"절반={scores['절반잘림']}, 동일={scores['동일']}"
        )
        if "25%만" in scores:
            assert scores["25%만"] < scores["절반잘림"], (
                f"{meme}: 잘림 감점이 단조롭지 않음 — "
                f"25%={scores['25%만']}, 절반={scores['절반잘림']}"
            )
        checked += 1
    assert checked, "잘림 검증이 한 건도 안 돌았다 — 픽스처가 비었는지 확인"


def test_curve_is_monotone_and_pinned():
    """표시 곡선이 순증가여야 순위가 안 바뀐다. 양 끝은 0·100 고정."""
    assert modal_app._curve(0) == 0 and modal_app._curve(100) == 100
    ys = [modal_app._curve(x / 2) for x in range(201)]
    assert all(b > a for a, b in zip(ys, ys[1:]))
    assert all(modal_app._curve(x) >= x for x in range(101)), "곡선은 올리기만 한다"


def test_grade_matches_score(ladder):
    """등급 경계가 점수와 어긋나지 않는지."""
    for meme, label, score, _ in ladder:
        assert 0 <= score <= 100, f"{meme}/{label}: 점수 범위 밖 {score}"


# ---- 애니 명대사 기준 (profile="anime") ----
# 밈 기준과 같은 사다리에 "그냥 지르기"를 오답으로 더한다: 원본 길이만큼 한 덩어리로
# 내지르는 소리. 예전 브라우저 기합 점수는 이걸 100점 줬다.

def _just_shout(n, rng):
    """한 덩어리 비명 — 톱니파 + 거친 잡음, 앞뒤만 살짝 페이드."""
    t = np.arange(n) / SR
    f = 260 + 8 * np.sin(2 * np.pi * 5 * t)
    y = 0.6 * ((np.cumsum(f) / SR) % 1.0 - 0.5) + 0.05 * rng.normal(0, 1, n)
    fade = min(n // 10, int(0.05 * SR))
    env = np.ones(n)
    env[:fade] = np.linspace(0, 1, fade)
    env[-fade:] = np.linspace(1, 0, fade)
    return y * env


@pytest.fixture(scope="module")
def anime_ladder():
    rng = np.random.default_rng(1)
    rows = []
    for name in MEMES:
        y = _base(name)
        ref_path = _write(y)
        variants = _variants(y) + [("그냥지르기", _just_shout(len(y), rng))]
        for label, variant in variants:
            if len(variant) < SR * 0.2:
                continue
            r = modal_app._score(ref_path, _write(variant), "anime")
            assert "error" not in r, f"{name}/{label}: {r['error']}"
            rows.append((name, label, r["score"], r))
        for other in MEMES:
            if other != name:
                r = modal_app._score(ref_path, os.path.join(REFS, other), "anime")
                rows.append((name, "다른밈", r["score"], r))
    return rows


ANIME_GOOD = {"동일", "약한잡음", "음높이+2세미톤", "속도+10%", "속도+30%"}
# 역재생은 뺀다: 0.37초짜리 "나니"처럼 짧고 좌우대칭인 소리는 거꾸로 돌려도 거의 같은
# 소리라 원리적으로 못 가른다(밈 기준도 같은 이유로 timing 검사에서 뺀다). 사람이
# 따라 하다 거꾸로 외치지는 않는다 — 현실의 오답은 "그냥 지르기"와 "다른 대사"다.
ANIME_BAD = (BAD - {"역재생"}) | {"그냥지르기"}


def test_anime_identical_is_perfect(anime_ladder):
    for meme, label, score, _ in anime_ladder:
        if label == "동일":
            assert score == 100, f"{meme}: 자기 자신인데 {score}점"


def test_anime_good_beats_bad(anime_ladder):
    good = [(m, l, s) for m, l, s, _ in anime_ladder if l in ANIME_GOOD]
    bad = [(m, l, s) for m, l, s, _ in anime_ladder if l in ANIME_BAD]
    wg = min(good, key=lambda r: r[2])
    bb = max(bad, key=lambda r: r[2])
    assert wg[2] > bb[2], f"오답이 정답을 이김: {bb} >= {wg}"


def test_anime_just_shouting_is_not_high(anime_ladder):
    """소리만 크게 지르면 원본 따라하기 점수가 나오면 안 된다."""
    for meme, label, score, _ in anime_ladder:
        if label == "그냥지르기":
            assert score < 60, f"{meme}: 그냥 질렀는데 {score}점"


def test_anime_100_is_rare(anime_ladder):
    """원본 그대로가 아니면 100점은 안 나온다 (예전엔 외치기만 하면 나왔다)."""
    for meme, label, score, _ in anime_ladder:
        if label not in ("동일", "약한잡음"):
            assert score < 100, f"{meme}/{label}: {score}점"


def test_anime_curve_monotone():
    ys = [modal_app._curve(x / 2, modal_app.ANIME_CURVE) for x in range(201)]
    assert all(b > a for a, b in zip(ys, ys[1:]))
    assert ys[0] == 0 and ys[-1] == 100
