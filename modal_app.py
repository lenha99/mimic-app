"""
밈 따라하기 채점 API (Modal 서버리스, 무료 티어)
배포:  modal deploy modal_app.py
호출:  POST /score  (multipart: 필드 'file' = 유저 녹음, query: meme_id)

요청이 올 때만 실행 → 안 쓰면 과금 0.

주의: librosa/matplotlib/fastapi 등 무거운 의존성은 `with image.imports()`로
감싸 컨테이너에서만 import 한다. (modal deploy 는 이 스크립트를 로컬에서 import
하므로, 로컬에 없는 패키지를 모듈 레벨에서 import 하면 배포가 실패한다.)
annotation 은 from __future__ 로 문자열화해 로컬 평가를 피한다.
"""
from __future__ import annotations
import modal

# librosa 포함된 컨테이너 이미지 정의
image = (
    modal.Image.debian_slim()
    .apt_install("ffmpeg", "libsndfile1", "fonts-nanum")
    .pip_install("librosa", "numpy", "scipy", "soundfile",
                 "matplotlib", "fastapi[standard]")
)

# 기준 음성 스트리밍 전용 경량 이미지 (librosa 없음 → 콜드 스타트 빠름)
slim_image = modal.Image.debian_slim().pip_install("fastapi[standard]")

app = modal.App("meme-scoring")

# 기준 밈 음성을 저장할 영구 볼륨 (호날두 SIU 등)
volume = modal.Volume.from_name("meme-refs", create_if_missing=True)
REF_DIR = "/refs"

# 앱 배포(APK) 저장 볼륨 — 친구 챌린지 링크에서 다운로드용
dist_volume = modal.Volume.from_name("meme-app-dist", create_if_missing=True)
APK_DIR = "/dist"

# 친구 챌린지 링크/다운로드 베이스 URL (배포 후 실제 URL)
DOWNLOAD_URL = "https://lenha99--meme-scoring-download.modal.run"

# 컨테이너 안에서만 실행되는 import (로컬 deploy 시엔 건너뜀)
with image.imports():
    import os
    import tempfile
    import subprocess
    import numpy as np
    import librosa
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib import font_manager as fm
    from fastapi import UploadFile, Response

    # numba JIT 워밍 — 콜드 스타트 후 첫 채점이 느려지는 것 방지.
    # 컨테이너 초기화 때 더미 신호로 pyin/rms/dtw를 한 번 돌려 JIT 컴파일을
    # 끝내둔다. enable_memory_snapshot 과 함께 쓰면 이 상태가 스냅샷에 포함됨.
    try:
        _w = np.random.randn(8000).astype("float32")
        librosa.pyin(_w, fmin=65, fmax=2093, sr=22050)
        librosa.feature.rms(y=_w)
        librosa.sequence.dtw(np.zeros((1, 12)), np.zeros((1, 12)), metric="euclidean")
    except Exception:
        pass

# slim 컨테이너에서도 fastapi 심볼이 모듈 전역에 있어야 UploadFile/Response
# 어노테이션을 해석할 수 있다 (image.imports는 heavy 이미지 컨테이너에서만 실행됨).
with slim_image.imports():
    from fastapi import UploadFile, Response


# 콜드 스타트 최소화:
#  - enable_memory_snapshot: librosa 임포트 + JIT 워밍이 끝난 상태를 스냅샷으로
#    저장 → 콜드 복원이 수십 초 → 수 초로 단축
#  - scaledown_window=300: 첫 호출 이후 5분간 컨테이너 유지 → 연속 채점 ~2s
@app.function(image=image, volumes={REF_DIR: volume},
              scaledown_window=300, enable_memory_snapshot=True)
@modal.fastapi_endpoint(method="POST", docs=True)
async def score(meme_id: str, file: UploadFile):
    """
    meme_id: 따라할 밈 식별자 (예: 'ronaldo_siu') — query param
    file:    유저 녹음 (multipart 필드 'file', wav/m4a)
    """
    ref_path = os.path.join(REF_DIR, f"{meme_id}.wav")
    if not os.path.exists(ref_path):
        return {"error": f"기준 음성 없음: {meme_id}"}

    # 유저 파일 임시 저장
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        f.write(await file.read())
        user_path = f.name

    result = _score(ref_path, user_path)
    os.unlink(user_path)
    return result


@app.function(image=slim_image, volumes={REF_DIR: volume}, scaledown_window=300)
@modal.fastapi_endpoint(method="GET")
def reference(meme_id: str):
    """기준 음성(wav) 스트리밍 — 앱의 '원본 듣기'용. query: meme_id"""
    import os
    from fastapi import Response
    path = os.path.join(REF_DIR, f"{meme_id}.wav")
    if not os.path.exists(path):
        return Response(status_code=404)
    with open(path, "rb") as f:
        data = f.read()
    return Response(content=data, media_type="audio/wav")


@app.function(image=slim_image, volumes={APK_DIR: dist_volume})
@modal.fastapi_endpoint(method="GET")
def download():
    """앱 APK 다운로드 — 친구가 사이드로드 설치용."""
    import os
    from fastapi import Response
    p = os.path.join(APK_DIR, "mimic.apk")
    if not os.path.exists(p):
        return Response(status_code=404, content="앱 파일이 아직 준비되지 않았어요.")
    with open(p, "rb") as f:
        data = f.read()
    return Response(
        content=data,
        media_type="application/vnd.android.package-archive",
        headers={"Content-Disposition": "attachment; filename=mimic.apk"})


@app.function(image=slim_image)
@modal.fastapi_endpoint(method="GET")
def challenge(meme_id: str = "", title: str = "", score: int = 0):
    """친구 지목 링크가 도착하는 랜딩 페이지. 챌린지 안내 + 앱 받기 버튼."""
    from fastapi.responses import HTMLResponse
    import html as _html
    name = _html.escape(title or meme_id or "이 소리")
    html_doc = f"""<!doctype html><html lang="ko"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>MIMIC 챌린지</title>
<style>
  body{{margin:0;background:#0A0A0B;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
    min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box}}
  .card{{max-width:420px;text-align:center}}
  .logo{{font-size:34px;font-weight:900;background:linear-gradient(90deg,#E8FF3A,#00E5FF);
    -webkit-background-clip:text;background-clip:text;color:transparent;letter-spacing:2px}}
  h1{{font-size:26px;line-height:1.3;margin:18px 0 8px}}
  .accent{{color:#E8FF3A}}
  .score{{font-size:60px;font-weight:900;color:#FF2D78;margin:10px 0 4px}}
  .sub{{color:#8A8A92;font-size:15px;margin-bottom:30px}}
  .btn{{display:block;background:#E8FF3A;color:#0A0A0B;font-weight:800;font-size:18px;
    text-decoration:none;padding:18px;border-radius:18px;margin:10px 0}}
  .note{{color:#8A8A92;font-size:12px;margin-top:18px;line-height:1.6}}
</style></head><body><div class="card">
  <div class="logo">🎙 MIMIC</div>
  <h1><span class="accent">{name}</span> 따라하기<br>챌린지가 도착했어요!</h1>
  <div class="score">{int(score)}점</div>
  <div class="sub">친구 점수를 넘어봐 😎</div>
  <a class="btn" href="{DOWNLOAD_URL}">📲 앱 받기 (Android)</a>
  <div class="note">
    설치 시 "출처를 알 수 없는 앱 허용"이 필요해요.<br>
    iPhone은 곧 지원 예정입니다.
  </div>
</div></body></html>"""
    return HTMLResponse(html_doc)


# ---- 동적 밈 카탈로그 (운영자 추가/삭제 + 친구 UGC 업로드, 앱 재빌드 불필요) ----
# 카탈로그는 meme-refs 볼륨의 catalog.json 에 저장. 기준 음성은 {id}.wav.
def _load_catalog():
    import os, json
    volume.reload()
    p = os.path.join(REF_DIR, "catalog.json")
    if not os.path.exists(p):
        return []
    with open(p, encoding="utf-8") as f:
        return json.load(f).get("memes", [])


def _save_catalog(memes_list):
    import os, json
    with open(os.path.join(REF_DIR, "catalog.json"), "w", encoding="utf-8") as f:
        json.dump({"memes": memes_list}, f, ensure_ascii=False)
    volume.commit()


@app.function(image=slim_image, volumes={REF_DIR: volume})
@modal.fastapi_endpoint(method="GET")
def memes():
    """앱이 불러오는 밈 목록(JSON 배열). Config.memesUrl 로 연결 → 콘텐츠 동적."""
    return _load_catalog()


@app.function(image=slim_image, volumes={REF_DIR: volume})
@modal.fastapi_endpoint(method="POST")
async def submit(title: str, file: UploadFile, source: str = "친구", emoji: str = "🎤"):
    """친구/유저가 자기 목소리를 새 챌린지로 업로드(UGC). 누구나 가능."""
    import os, uuid
    mid = "ugc_" + uuid.uuid4().hex[:8]
    with open(os.path.join(REF_DIR, f"{mid}.wav"), "wb") as f:
        f.write(await file.read())
    volume.commit()
    cat = _load_catalog()
    entry = {"id": mid, "title": (title or "내 소리")[:20], "source": source,
             "emoji": emoji, "plays": 0, "ugc": True}
    cat.insert(0, entry)  # 새 UGC를 목록 맨 앞에
    _save_catalog(cat)
    return entry


@app.function(image=slim_image, volumes={REF_DIR: volume},
              secrets=[modal.Secret.from_name("mimic-admin")])
@modal.fastapi_endpoint(method="POST")
async def admin_add(token: str, meme_id: str, title: str, file: UploadFile,
                    source: str = "", emoji: str = "🎙", plays: int = 0):
    """운영자 전용: 밈 추가/수정 (기준 wav 업로드 + 카탈로그 등록). token 필요."""
    import os
    if token != os.environ.get("ADMIN_TOKEN"):
        return Response(status_code=403, content="forbidden")
    with open(os.path.join(REF_DIR, f"{meme_id}.wav"), "wb") as f:
        f.write(await file.read())
    volume.commit()
    cat = [m for m in _load_catalog() if m.get("id") != meme_id]
    cat.append({"id": meme_id, "title": title, "source": source,
                "emoji": emoji, "plays": plays})
    _save_catalog(cat)
    return {"ok": True, "count": len(cat)}


@app.function(image=slim_image, volumes={REF_DIR: volume},
              secrets=[modal.Secret.from_name("mimic-admin")])
@modal.fastapi_endpoint(method="POST")
def admin_remove(token: str, meme_id: str):
    """운영자 전용: 밈 삭제 (카탈로그 + 기준 wav). token 필요."""
    import os
    if token != os.environ.get("ADMIN_TOKEN"):
        return Response(status_code=403, content="forbidden")
    cat = [m for m in _load_catalog() if m.get("id") != meme_id]
    _save_catalog(cat)
    p = os.path.join(REF_DIR, f"{meme_id}.wav")
    if os.path.exists(p):
        os.remove(p)
        volume.commit()
    return {"ok": True, "count": len(cat)}


@app.function(image=image, volumes={REF_DIR: volume}, timeout=120)
@modal.fastapi_endpoint(method="POST", docs=True)
async def make_video(meme_id: str, title: str, score: int,
                     grade: str, file: UploadFile, source: str = "원본"):
    """
    채점 후 호출. 원본 vs 나 공유영상(9:16 mp4)을 생성해 바이트로 반환.
    file: 유저 녹음 (multipart 필드 'file', 채점 때 보낸 것과 동일)
    """
    ref_path = os.path.join(REF_DIR, f"{meme_id}.wav")
    if not os.path.exists(ref_path):
        return {"error": f"기준 음성 없음: {meme_id}"}

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        f.write(await file.read()); user_path = f.name
    out_mp4 = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False).name

    _build_video(ref_path, user_path, title, score, grade, out_mp4, source)
    with open(out_mp4, "rb") as v:
        data = v.read()
    os.unlink(user_path); os.unlink(out_mp4)
    return Response(content=data, media_type="video/mp4")


# ---- 채점 로직 ----
# 신뢰성 설계:
#  - 억양(pitch): 보이스드 구간만 추려 '세미톤 컨투어'로 비교(절대 음높이 무관).
#    무음/비보이스 프레임을 섞지 않아 안정적. DTW로 타이밍 정렬 후 평균 세미톤 오차로 점수.
#  - 음색(tone):  MFCC(음색 특징) DTW 코사인 유사도. UI의 '음색'과 의미 일치.
#  - 타이밍(timing): 길이 비율.
#  - 동물 등 비음성 사운드는 보이스드 프레임이 적으면 억양을 제외하고 가중치 재분배.
#  - 같은 소리=100, 비슷=높게 나오도록 매핑 보정.
def _score(reference_path, user_path):
    SR = 22050

    def load(p):
        y = librosa.load(p, sr=SR, mono=True)[0]
        y, _ = librosa.effects.trim(y, top_db=30)
        if len(y) < int(SR * 0.15):
            return None
        return y / (np.max(np.abs(y)) + 1e-9)

    ref, usr = load(reference_path), load(user_path)
    if ref is None or usr is None:
        return {"error": "빈 오디오 또는 무음"}

    # 억양: 보이스드 구간 세미톤 컨투어
    def semis(y):
        f0, _, _ = librosa.pyin(y, fmin=65, fmax=2093, sr=SR)
        v = f0[~np.isnan(f0)]
        v = v[v > 0]
        if len(v) < 5:
            return None
        return 12.0 * np.log2(v / (np.median(v) + 1e-9))

    sa, sb = semis(ref), semis(usr)
    if sa is None or sb is None:
        pitch = None  # 비음성 → 억양 채점 제외
    else:
        _, wp = librosa.sequence.dtw(sa.reshape(1, -1), sb.reshape(1, -1),
                                     metric="euclidean")
        mad = float(np.mean(np.abs(sa[wp[:, 0]] - sb[wp[:, 1]])))
        pitch = 100.0 * float(np.exp(-mad / 4.0))  # 0세미톤=100, 4세미톤≈37

    # 음색: MFCC DTW 코사인 유사도
    def mfcc_norm(y):
        m = librosa.feature.mfcc(y=y, sr=SR, n_mfcc=13)
        return (m - m.mean(axis=1, keepdims=True)) / (m.std(axis=1, keepdims=True) + 1e-9)

    ma, mb = mfcc_norm(ref), mfcc_norm(usr)
    Dm, wpm = librosa.sequence.dtw(ma, mb, metric="cosine")
    tone_cost = float(Dm[-1, -1] / max(len(wpm), 1))   # 평균 코사인 거리(0..2)
    if not np.isfinite(tone_cost):
        tone_cost = 1.0
    tone = 100.0 * float(np.clip(1.0 - tone_cost, 0.0, 1.0))

    # 타이밍: 길이 비율
    timing = 100.0 * (min(len(ref), len(usr)) / max(len(ref), len(usr)))

    # 가중 합 (억양 없으면 그 가중치를 음색/타이밍에 재분배)
    comps = []
    if pitch is not None:
        comps.append((pitch, 0.40))
    comps.append((tone, 0.40))
    comps.append((timing, 0.20))
    wsum = sum(w for _, w in comps)
    total = round(sum(v * w for v, w in comps) / wsum)

    grade = ("SS" if total >= 90 else "S" if total >= 80
             else "A" if total >= 70 else "B" if total >= 55 else "C")

    # 파형 막대(0..1) — 앱 결과 화면에서 원본 vs 나 비교 표시용
    def bars(y, n=48):
        if len(y) == 0:
            return []
        step = max(1, len(y) // n)
        out = [float(np.abs(y[i:i + step]).max()) for i in range(0, len(y), step)][:n]
        m = max(out) if out else 1.0
        return [round(v / (m + 1e-9), 3) for v in out]

    return {
        "score": total, "grade": grade,
        "breakdown": {
            "pitch": round(pitch) if pitch is not None else 0,
            "tone": round(tone),
            "timing": round(timing),
        },
        "waveform": {"ref": bars(ref), "user": bars(usr)},
    }


# ---- 공유 영상 생성 ----
FONT_PATH = "/usr/share/fonts/truetype/nanum/NanumSquareRoundB.ttf"
VOLT, PINK, ASH = "#E8FF3A", "#FF2D78", "#8A8A92"


def _bars(path, n=56):
    y, _ = librosa.load(path, sr=22050, mono=True)
    y, _ = librosa.effects.trim(y, top_db=25)
    step = max(1, len(y) // n)
    return [float(np.abs(y[i:i+step]).max()) for i in range(0, len(y), step)][:n]


def _grade_color(g):
    return {"SS": VOLT, "S": "#00E5FF", "A": "#7CFF6B"}.get(g, PINK)


def _build_card(ref_audio, usr_audio, title, score, grade, out_png, source="원본"):
    font = fm.FontProperties(fname=FONT_PATH) if os.path.exists(FONT_PATH) else None
    fig = plt.figure(figsize=(9, 16), dpi=120)
    fig.patch.set_facecolor("#0A0A0B")

    fig.text(0.5, 0.88, title, ha="center", color="#fff", fontsize=42,
             fontweight="bold", fontproperties=font)
    fig.text(0.5, 0.83, "따라하기 챌린지", ha="center", color=ASH,
             fontsize=20, fontproperties=font)

    for audio, color, y0, lbl, ly in [
        (ref_audio, VOLT, 0.60, source, 0.755),
        (usr_audio, PINK, 0.42, "나", 0.575),
    ]:
        ax = fig.add_axes([0.1, y0, 0.8, 0.15]); ax.set_facecolor("#0A0A0B")
        b = _bars(audio)
        ax.bar(range(len(b)), b, color=color, width=0.7)
        ax.bar(range(len(b)), [-x for x in b], color=color, width=0.7)
        ax.set_ylim(-1, 1); ax.axis("off")
        fig.text(0.12, ly, lbl, color=color, fontsize=24,
                 fontweight="bold", fontproperties=font)

    fig.text(0.5, 0.27, grade, ha="center", color=_grade_color(grade),
             fontsize=130, fontweight="bold")
    fig.text(0.5, 0.17, f"{score}점", ha="center", color="#fff",
             fontsize=64, fontweight="bold", fontproperties=font)
    fig.text(0.5, 0.07, "MIMIC · 너도 도전해봐", ha="center", color=ASH,
             fontsize=26, fontproperties=font)

    plt.savefig(out_png, facecolor="#0A0A0B")
    plt.close()


def _build_video(ref_audio, usr_audio, title, score, grade, out_mp4, source="원본"):
    """공유용 9:16 mp4 생성. 오디오는 원본→나 순으로 이어붙임."""
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as t:
        card = t.name
    _build_card(ref_audio, usr_audio, title, score, grade, card, source)
    cmd = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-loop", "1", "-t", "3", "-i", card,
        "-i", ref_audio, "-i", usr_audio,
        "-filter_complex",
        "[0:v]scale=1080:1920[v];[1:a][2:a]concat=n=2:v=0:a=1[a]",
        "-map", "[v]", "-map", "[a]",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac",
        "-shortest", out_mp4,
    ]
    subprocess.run(cmd, check=True)
    os.unlink(card)
    return out_mp4
