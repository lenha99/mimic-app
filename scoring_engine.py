"""채점 엔진 v4 - energy를 음색(spectral)으로 교체, 속도 최적화"""
import librosa
import numpy as np

def _load(path, sr=16000):  # 16k로 낮춰 속도↑ (음성엔 충분)
    y, _ = librosa.load(path, sr=sr, mono=True)
    rms_raw = np.sqrt(np.mean(y**2))
    y, _ = librosa.effects.trim(y, top_db=25)
    if len(y) < sr*0.15: return None, 0.0
    peak = np.max(np.abs(y))
    if peak < 1e-3: return None, 0.0
    return y/(peak+1e-9), float(rms_raw), sr

def _pitch(y, sr):
    # pyin 대신 빠른 피치추정: autocorrelation 기반 yin
    f0 = librosa.yin(y, fmin=65, fmax=2093, sr=sr, frame_length=1024)
    return np.nan_to_num(f0, nan=0.0)

def _mfcc(y, sr):
    # 음색/발음 특성 - energy보다 변별력 큼
    return librosa.feature.mfcc(y=y, sr=sr, n_mfcc=8)

def _dtw_seq(A, B, sharpen=1.0):
    A=(A-A.mean(axis=-1,keepdims=True))/(A.std(axis=-1,keepdims=True)+1e-9)
    B=(B-B.mean(axis=-1,keepdims=True))/(B.std(axis=-1,keepdims=True)+1e-9)
    if A.ndim==1: A=A.reshape(1,-1); B=B.reshape(1,-1)
    D,_=librosa.sequence.dtw(A,B,metric='euclidean')
    return float(np.exp(-(D[-1,-1]/(A.shape[1]+B.shape[1]))*sharpen))

def _remap(x,lo,hi): return float(np.clip((x-lo)/(hi-lo),0,1))

def score(ref_path, usr_path):
    r=_load(ref_path); u=_load(usr_path)
    if r[0] is None: return {"error":"기준 음성 무음"}
    if u[0] is None: return {"score":0,"grade":"C",
        "breakdown":{"pitch":0,"tone":0,"timing":0},"reason":"무음/너무 짧음"}
    ref,ref_rms,sr=r; usr,usr_rms,_=u

    p=_dtw_seq(_pitch(ref,sr), _pitch(usr,sr))           # 억양
    m=_dtw_seq(_mfcc(ref,sr), _mfcc(usr,sr), sharpen=1.5) # 음색/발음
    t=min(len(ref),len(usr))/max(len(ref),len(usr))       # 타이밍

    p=_remap(p,0.38,0.85); m=_remap(m,0.15,0.75); t=_remap(t,0.45,1.0)
    vol=_remap(usr_rms/(ref_rms+1e-9),0.15,0.6)

    raw=(0.62*p+0.10*m+0.28*t)*(0.7+0.3*vol)
    total=round(raw*100)
    grade=("SS" if total>=88 else "S" if total>=74 else "A" if total>=60
           else "B" if total>=44 else "C")
    return {"score":total,"grade":grade,
            "breakdown":{"pitch":round(p*100),"tone":round(m*100),
                         "timing":round(t*100)}}
