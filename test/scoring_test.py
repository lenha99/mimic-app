"""채점 엔진 회귀 테스트 - pytest"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import scoring_engine as se
import numpy as np, soundfile as sf, tempfile

SR=22050
def _wav(pitch=1.0,dur=1.0,noise=0.0,gain=1.0):
    t=np.linspace(0,dur,int(SR*dur)); f=300*pitch*(1+0.5*t/dur)
    y=0.5*gain*np.sin(2*np.pi*np.cumsum(f)/SR)*np.hanning(int(SR*dur))
    if noise: y=y+noise*np.random.randn(len(y))
    p=tempfile.mktemp(suffix='.wav'); sf.write(p,y.astype(np.float32),SR); return p

REF=_wav()

def test_perfect_high():
    assert se.score(REF,REF)['score']>=90

def test_silence_zero():
    assert se.score(REF,_wav(gain=0.0005))['score']==0

def test_bad_low():
    assert se.score(REF,_wav(pitch=2.0,dur=0.4,noise=0.3))['score']<55

def test_reproducible():
    s=[se.score(REF,_wav(pitch=1.02,dur=1.03,noise=0.03))['score'] for _ in range(5)]
    assert np.std(s)<8, f"재현성 실패: {s}"

def test_grade_consistency():
    r=se.score(REF,REF)
    assert r['grade'] in ('SS','S','A','B','C')
