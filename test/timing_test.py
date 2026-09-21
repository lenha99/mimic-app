"""배포되는 채점 코드(modal_app)의 타이밍 축 테스트.

scoring_test.py 는 scoring_engine.py 를 보는데, 그건 배포되지 않는 옛 사본이다.
실제로 사용자 점수를 만드는 건 modal_app._score 쪽이라 여기서 직접 본다.
(modal_app 임포트는 Modal 인증을 요구하지 않는다 — 이미지/볼륨 핸들은 지연 생성된다.)
"""
import numpy as np
import pytest

from modal_app import _timing_from_path


def path(pairs):
    """librosa.sequence.dtw 가 주는 모양 — (i, j) 쌍 배열."""
    return np.array(pairs, dtype=int)


def diagonal(n):
    return path([(i, i) for i in range(n)])


def test_perfect_alignment_is_full_marks():
    """같은 속도로 따라갔으면 만점이다."""
    assert _timing_from_path(diagonal(50), 50, 50) == pytest.approx(100.0)


def test_uniformly_slower_still_full_marks():
    """전체를 2배 느리게 말해도 리듬 자체는 맞다.

    길이 비율로 재던 예전 방식은 여기서 50점을 줬다. 그게 이 커밋의 이유다.
    """
    # 실제 DTW 경로는 (0,0) 에서 (n_ref-1, n_usr-1) 까지 간다. 50프레임이 99프레임에
    # 고르게 펼쳐진 경우다.
    wp = path([(i, 2 * i) for i in range(50)])
    assert _timing_from_path(wp, 50, 99) == pytest.approx(100.0)


def test_front_loaded_is_penalized():
    """앞을 몰아치고 뒤에서 늘어지면 총 길이가 같아도 깎여야 한다."""
    n = 100
    # 원본의 앞 20%를 내 녹음의 앞 60% 에 썼다 = 앞에서 늘어지고 뒤에서 급했다
    i = np.arange(n)
    j = np.concatenate([np.linspace(0, 0.6 * n, 20), np.linspace(0.6 * n, n - 1, n - 20)])
    wp = np.stack([i, j.astype(int)], axis=1)
    skewed = _timing_from_path(wp, n, n)
    assert skewed < 70.0
    assert skewed < _timing_from_path(diagonal(n), n, n)


def test_worse_skew_scores_lower():
    """더 많이 어긋날수록 점수가 낮아야 한다 (단조성)."""
    n = 100
    scores = []
    for shift in (0.05, 0.2, 0.4):
        i = np.arange(n)
        j = np.clip(i + shift * n, 0, n - 1).astype(int)
        scores.append(_timing_from_path(np.stack([i, j], axis=1), n, n))
    assert scores == sorted(scores, reverse=True)


def test_degenerate_input_does_not_crash():
    assert _timing_from_path(None, 10, 10) == 0.0
    assert _timing_from_path(path([]), 10, 10) == 0.0
    assert _timing_from_path(diagonal(2), 1, 1) == 0.0


def test_reversed_path_same_result():
    """librosa 는 경로를 역순으로 준다. 방향에 결과가 달라지면 안 된다."""
    n = 40
    i = np.arange(n)
    j = np.clip(i + 8, 0, n - 1)
    fwd = np.stack([i, j], axis=1)
    assert _timing_from_path(fwd, n, n) == pytest.approx(_timing_from_path(fwd[::-1], n, n))
