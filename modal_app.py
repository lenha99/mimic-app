"""
밈 따라하기 채점 API (Modal 서버리스, 무료 티어)
배포:  modal deploy modal_app.py
호출:  POST /score  (multipart: 필드 'file' = 유저 녹음, query: meme_id)

요청이 올 때만 실행 → 안 쓰면 과금 0.

주의: librosa/fastapi 등 무거운 의존성은 `with image.imports()`로
감싸 컨테이너에서만 import 한다. (modal deploy 는 이 스크립트를 로컬에서 import
하므로, 로컬에 없는 패키지를 모듈 레벨에서 import 하면 배포가 실패한다.)
annotation 은 from __future__ 로 문자열화해 로컬 평가를 피한다.
"""
from __future__ import annotations
import os
import subprocess
import tempfile
import modal

# 채점 전용 이미지.
#
# 채점은 웹앱의 임계 경로다(사용자가 소리를 낸 직후 기다리는 그 시간). 여기서
# 뺄 수 있는 건 다 뺀다. 한때 공유 카드를 그리느라 matplotlib 과 fonts-nanum 이
# 같이 올라왔는데, 영상 생성 자체를 접으면서 그 이미지는 사라졌다.
score_image = (
    modal.Image.debian_slim()
    .apt_install("ffmpeg", "libsndfile1")
    .pip_install("librosa", "numpy", "scipy", "soundfile", "fastapi[standard]")
)

# 기준 음성 스트리밍 전용 경량 이미지 (librosa 없음 → 콜드 스타트 빠름)
slim_image = modal.Image.debian_slim().pip_install("fastapi[standard]")

app = modal.App("meme-scoring")

# 기준 밈 음성을 저장할 영구 볼륨 (호날두 SIU 등)
volume = modal.Volume.from_name("meme-refs", create_if_missing=True)
REF_DIR = "/refs"

# 컨테이너 안에서만 실행되는 import (로컬 deploy 시엔 건너뜀).
# numba JIT 워밍을 여기서 끝내둔다 — 콜드 스타트 후 첫 채점이 느려지는 걸 막는다.
with score_image.imports():
    import numpy as np
    import librosa
    from fastapi import UploadFile, Response, Request

    try:
        _w = np.random.randn(8000).astype("float32")
        librosa.pyin(_w, fmin=65, fmax=2093, sr=22050)
        librosa.feature.rms(y=_w)
        librosa.sequence.dtw(np.zeros((1, 12)), np.zeros((1, 12)), metric="euclidean")
        np.corrcoef(_w[:64], _w[64:128])
    except Exception:
        pass


# slim 컨테이너에서도 fastapi 심볼이 모듈 전역에 있어야 UploadFile/Response
# 어노테이션을 해석할 수 있다 (image.imports는 heavy 이미지 컨테이너에서만 실행됨).
with slim_image.imports():
    from fastapi import UploadFile, Response, Request


# ---- 배포 버전 ----
# 배포본이 코드보다 낡으면 기능이 조용히 사라진다. 실제로 서버가 7시간 낡은
# 상태로 돌면서, 클라이언트가 보낸 대사(line)를 받는 파라미터가 없어 통째로
# 버리고 있었다. 아무도 에러를 못 봤다 — 그냥 대사가 화면에 안 나올 뿐이었다.
#
# deploy 시점의 커밋을 이미지 환경변수로 구워 넣는다.
#
# 처음엔 모듈 상수에 담았는데 늘 "unknown" 이 나왔다 — 모듈은 컨테이너에서도
# 다시 import 되고, 거기엔 git 도 .git 도 없다. 배포 때 로컬에서 한 번 읽은 값이
# 컨테이너까지 따라가려면 이미지에 실어야 한다.
def _git_sha():
    try:
        return subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True,
                              text=True, cwd=os.path.dirname(os.path.abspath(__file__))
                              ).stdout.strip()[:12] or "unknown"
    except Exception:
        return "unknown"


version_image = slim_image.env({"MIMIC_SHA": _git_sha()})


@app.function(image=version_image)
@modal.fastapi_endpoint(method="GET")
def version():
    """배포된 커밋. doctor 가 로컬과 대조한다."""
    return {"sha": os.environ.get("MIMIC_SHA", "unknown")}


# ---- 업로드 오디오 디코딩 ----
# 브라우저 MediaRecorder 는 컨테이너를 제 마음대로 고른다. 안드로이드 카톡 인앱
# 웹뷰는 audio/webm;codecs=opus, iOS 는 audio/mp4 를 준다. libsndfile 은 둘 다
# 못 읽고("Format not recognised"), librosa 1.0 부터 audioread 폴백마저 빠져서
# 확장자만 .wav 로 붙여 넘기면 그대로 죽는다. 디코딩은 ffmpeg 에 맡긴다. (이슈 #15)
MAX_UPLOAD_BYTES = 10 * 1024 * 1024   # 2.5초 opus 녹음이 ~15KB. 상한은 넉넉하게.
DECODE_SR = 16000                     # _score 가 어차피 16k 로 리샘플한다.


def _decode_upload(raw: bytes):
    """업로드 바이트를 16k mono wav 로 변환하고 임시 파일 경로를 돌려준다.

    포맷을 추측하지 않는다 — ffmpeg 이 컨테이너를 스스로 판별한다.
    읽을 수 없으면 None (호출부가 500 대신 에러 메시지를 돌려주도록).
    """
    if not raw or len(raw) > MAX_UPLOAD_BYTES:
        return None

    src = tempfile.NamedTemporaryFile(delete=False).name
    dst = tempfile.NamedTemporaryFile(suffix=".wav", delete=False).name
    try:
        with open(src, "wb") as f:
            f.write(raw)
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-i", src,
             "-ac", "1", "-ar", str(DECODE_SR), "-c:a", "pcm_s16le", dst],
            check=True, capture_output=True, timeout=30,
        )
        return dst
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError):
        os.unlink(dst)
        return None
    finally:
        os.unlink(src)


# 콜드 스타트 최소화:
#  - enable_memory_snapshot: librosa 임포트 + JIT 워밍이 끝난 상태를 스냅샷으로
#    저장 → 콜드 복원이 수십 초 → 수 초로 단축
#  - scaledown_window=300: 첫 호출 이후 5분간 컨테이너 유지 → 연속 채점 ~2s
@app.function(image=score_image, volumes={REF_DIR: volume},
              scaledown_window=300, enable_memory_snapshot=True)
@modal.fastapi_endpoint(method="POST", docs=True)
async def score(meme_id: str, file: UploadFile, client: str = "", rescore: int = 0):
    """
    meme_id: 따라할 밈 식별자 (예: 'ronaldo_siu') — query param
    file:    유저 녹음 (multipart 필드 'file', wav/m4a)
    client:  익명 기기 식별자(선택). 랭킹에서 같은 사람의 연속 시도를 묶는 용도.
    rescore: 1 이면 이미 한 번 채점한 녹음을 저장 전에 다시 채점하는 것(웹
             /api/publish-recording). 도전 수에 또 세면 "N명 도전"이 부푼다.
    """
    ref_path = _ref_path(meme_id)
    if ref_path is None:
        return {"error": f"기준 음성 없음: {meme_id}"}

    user_path = _decode_upload(await file.read())
    if user_path is None:
        return {"error": "녹음 파일을 디코딩할 수 없음"}

    result = _score(ref_path, user_path)
    os.unlink(user_path)

    if isinstance(result.get("score"), int):
        bd = result.get("breakdown") or {}
        _log_event("rescore" if rescore else "score", {
            "meme_id": meme_id, "score": result["score"],
            "grade": result.get("grade"),
            "pitch": bd.get("pitch"), "tone": bd.get("tone"),
            "timing": bd.get("timing"),
            **({"client": client[:64]} if client else {}),
        })
    return result


@app.function(image=slim_image, volumes={REF_DIR: volume}, scaledown_window=300)
@modal.fastapi_endpoint(method="GET")
def reference(meme_id: str):
    """기준 음성(wav) 스트리밍 — 앱의 '원본 듣기'용. query: meme_id"""
    from fastapi import Response
    path = _ref_path(meme_id)
    if path is None:
        return Response(status_code=404)
    with open(path, "rb") as f:
        data = f.read()
    return Response(content=data, media_type="audio/wav")


def _wav_problem(data: bytes):
    """업로드 바이트가 진짜 PCM wav 인지 헤더만 보고 검사. 문제 없으면 None.

    기준 음성은 서버가 트랜스코딩하지 않고 그대로 {id}.wav 로 쓴다. mp3 를 .wav 로
    이름만 바꿔 올리면 업로드는 성공하고 채점에서야 librosa 가 터진다. slim 이미지엔
    librosa 가 없으니 표준 라이브러리로 헤더만 뜯는다.
    """
    import struct
    if len(data) < 44 or data[:4] != b"RIFF" or data[8:12] != b"WAVE":
        return "RIFF/WAVE 헤더가 아니다 (mp3·m4a 를 .wav 로 바꿔 올린 것 아닌가)"
    pos, fmt, has_data = 12, None, False
    while pos + 8 <= len(data):
        cid = data[pos:pos + 4]
        size = struct.unpack("<I", data[pos + 4:pos + 8])[0]
        body = data[pos + 8:pos + 8 + size]
        if cid == b"fmt " and len(body) >= 16:
            fmt = struct.unpack("<HHIIHH", body[:16])  # format, ch, sr, byterate, align, bits
        elif cid == b"data":
            has_data = size > 0
        pos += 8 + size + (size & 1)
    if fmt is None:
        return "fmt 청크가 없다"
    if not has_data:
        return "data 청크가 비었다"
    audio_format, channels, sample_rate, _, _, bits = fmt
    if audio_format != 1:
        return f"PCM 이 아니다 (format={audio_format})"
    if channels != 1:
        return f"모노가 아니다 (channels={channels})"
    if bits != 16:
        return f"16비트가 아니다 (bits={bits})"
    if sample_rate not in (16000, 22050, 44100, 48000):
        return f"예상 밖 샘플레이트 {sample_rate} (권장 22050)"
    return None


def _ref_path(meme_id):
    """기준 음성 경로. 없으면 볼륨을 한 번 리로드해 보고 그래도 없으면 None.

    카탈로그(_load_catalog)는 매번 reload 하지만 wav 조회는 안 했다. 그래서 방금
    올린 밈이 '목록엔 보이는데 소리만 404' 나는 구간이 컨테이너 수명(300초)만큼
    있었다. 히트 경로엔 reload 를 안 태우고 미스일 때만 한 번 본다.
    """
    import os
    path = os.path.join(REF_DIR, f"{meme_id}.wav")
    if os.path.exists(path):
        return path
    volume.reload()
    return path if os.path.exists(path) else None


# ---- 이벤트 로그 ----
# 지금까지 이 서비스는 자기 자신에 대해 아무것도 몰랐다. 누가 뭘 눌렀는지,
# 녹음까지 갔는지, 점수가 어떻게 분포하는지 답할 방법이 없었고 catalog 의
# `plays` 는 registry.json 에 손으로 적어둔 숫자였다. 그래서 UI 를 고칠 때마다
# 측정이 아니라 추론을 했다.
#
# 한 파일에 append 하지 않는다. 볼륨은 요청마다 다른 컨테이너에 붙고 각자 자기
# 시점의 뷰를 들고 있어서, 같은 경로를 여럿이 고치면 마지막에 커밋한 쪽이 이긴다.
# 채점은 동시에 여러 건이 들어오는 경로라 그 방식으로는 반드시 샌다.
# 이벤트마다 고유 파일명으로 쓰면 충돌할 일 자체가 없고 커밋은 순수하게
# 더하기만 한다. 나중에 날짜별로 합치면 된다.
EVENT_DIR = "/refs/events"


def _log_event(kind: str, data: dict):
    """이벤트 한 건. 실패해도 절대 호출자를 깨뜨리지 않는다."""
    import json, os, time, uuid
    try:
        day = time.strftime("%Y-%m-%d", time.gmtime())
        d = os.path.join(EVENT_DIR, day)
        os.makedirs(d, exist_ok=True)
        rec = {"kind": kind, "ts": time.time(), **data}
        with open(os.path.join(d, f"{uuid.uuid4().hex}.json"), "w", encoding="utf-8") as f:
            json.dump(rec, f, ensure_ascii=False)
        volume.commit()
    except Exception:
        pass    # 로깅 때문에 채점이 실패하는 일은 없어야 한다


def _iter_events(since: float = 0):
    """볼륨에 쌓인 이벤트를 하나씩. 깨진 파일은 건너뛴다."""
    import json, os
    if not os.path.isdir(EVENT_DIR):
        return
    for day in sorted(os.listdir(EVENT_DIR)):
        d = os.path.join(EVENT_DIR, day)
        if not os.path.isdir(d):
            continue
        for name in os.listdir(d):
            try:
                with open(os.path.join(d, name), encoding="utf-8") as f:
                    e = json.load(f)
            except Exception:
                continue
            if e.get("ts", 0) >= since:
                yield e


def _people(events) -> int:
    """사람 수 — 같은 기기(client)는 한 명. 식별자가 없는 이벤트는 각각 한 명으로 센다."""
    ids, anon = set(), 0
    for e in events:
        if e.get("client"):
            ids.add(e["client"])
        else:
            anon += 1
    return len(ids) + anon


# 퍼널 순서. 이 앱이 퍼지는 길은 이것 하나다 — 들어와서, 듣고, 외치고, 점수 받고,
# 던지고, 받은 사람이 다시 들어온다. 어디서 새는지 모르면 고칠 곳도 모른다.
FUNNEL = ("view_home", "view_record", "play_ref", "record_start", "score", "share",
          "view_share", "arrive_challenge")


@app.function(image=slim_image, volumes={REF_DIR: volume})
@modal.fastapi_endpoint(method="GET")
def stats(days: int = 7):
    """밈별 채점 집계 + 퍼널.

    녹음 자체는 여기 없다(PRIVACY.md). 남는 건 숫자와 익명 기기 식별자뿐이다.
    """
    import time
    volume.reload()
    events = list(_iter_events(time.time() - days * 86400))

    per = {}
    for e in events:
        if e.get("kind") != "score":
            continue
        b = per.setdefault(e.get("meme_id", "?"), {"plays": 0, "scores": [], "best": 0})
        b["plays"] += 1
        sc = e.get("score")
        if isinstance(sc, int):
            b["scores"].append(sc)
            b["best"] = max(b["best"], sc)

    out = []
    for mid, b in per.items():
        xs = sorted(b["scores"])
        out.append({
            "meme_id": mid, "plays": b["plays"], "best": b["best"],
            "median": xs[len(xs) // 2] if xs else None,
            "mean": round(sum(xs) / len(xs)) if xs else None,
        })
    out.sort(key=lambda r: -r["plays"])

    funnel = []
    for kind in FUNNEL:
        es = [e for e in events if e.get("kind") == kind]
        funnel.append({"step": kind, "events": len(es), "people": _people(es)})

    return {"days": days, "memes": out, "funnel": funnel}


@app.function(image=slim_image, volumes={REF_DIR: volume})
@modal.fastapi_endpoint(method="POST")
async def track(request: Request):
    """화면 이벤트 한 건 (브라우저 sendBeacon).

    sendBeacon 은 text/plain 으로 보내서 CORS 사전 요청이 없다. 그래서 본문을
    직접 JSON 으로 읽는다. 모르는 kind 는 버린다 — 아무나 부를 수 있는 곳이라
    임의 문자열로 볼륨을 채우게 두면 안 된다.
    """
    import json
    try:
        body = json.loads((await request.body())[:2048] or b"{}")
    except Exception:
        return Response(status_code=204)
    kind = body.get("kind")
    if kind not in FUNNEL or kind == "score":   # score 는 채점 서버가 직접 남긴다
        return Response(status_code=204)
    rec = {}
    for k in ("meme_id", "client"):
        v = body.get(k)
        if isinstance(v, str) and v:
            rec[k] = v[:64]
    if isinstance(body.get("via"), str):
        rec["via"] = body["via"][:16]
    _log_event(kind, rec)
    return Response(status_code=204)


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
def memes(include_draft: int = 0):
    """앱이 불러오는 밈 목록(JSON 배열). Config.memesUrl 로 연결 → 콘텐츠 동적.

    draft 항목은 기본으로 숨긴다. include_draft=1 로 미리보기(로컬 개발 서버에
    NEXT_PUBLIC_MEMES_URL 을 이 쿼리째 넣으면 미공개 밈까지 보인다).
    """
    import time
    cat = _load_catalog()

    # plays 는 실제로 채점까지 간 사람 수다. 예전엔 registry 에 손으로 적은 숫자
    # (꼬끼오 128,400 등)가 그대로 나가서, 실제 1명인 소리가 "13만명 도전"으로 보였다.
    # 한 번 들키면 신뢰가 통째로 무너지는 종류의 거짓말이라, 여기서 실측으로 덮어쓴다.
    counted = {}
    for e in _iter_events(time.time() - 365 * 86400):
        if e.get("kind") == "score":
            counted.setdefault(e.get("meme_id"), []).append(e)
    cat = [{**m, "plays": _people(counted.get(m.get("id"), []))} for m in cat]

    if include_draft:
        return cat
    return [m for m in cat if not m.get("draft")]


@app.function(image=slim_image, volumes={REF_DIR: volume})
@modal.fastapi_endpoint(method="POST")
async def submit(title: str, file: UploadFile, source: str = "친구", emoji: str = "🎤"):
    """친구/유저가 자기 목소리를 새 챌린지로 업로드(UGC). 누구나 가능."""
    import os, uuid
    data = await file.read()
    # 운영자 경로(admin_add)만큼 빡세게 보진 않는다 — 기기마다 샘플레이트가 달라서.
    # 다만 wav 가 아닌 걸 {id}.wav 로 저장해 채점에서 터지는 것만 막는다.
    if len(data) < 44 or data[:4] != b"RIFF" or data[8:12] != b"WAVE":
        return {"error": "wav 형식이 아니다"}
    mid = "ugc_" + uuid.uuid4().hex[:8]
    with open(os.path.join(REF_DIR, f"{mid}.wav"), "wb") as f:
        f.write(data)
    volume.commit()
    cat = _load_catalog()
    # 인증 없이 누구나 부를 수 있는 곳이라 목록에 바로 올리지 않는다(draft).
    # 예전엔 홈 두 번째 칸에 꽂혀서, 아무 소리나 올리면 모든 사람 홈에 떴다.
    # 직링크(/record/{id})로만 열리고, 목록에 올릴지는 운영자가 정한다.
    entry = {"id": mid, "title": (title or "내 소리")[:20], "source": source,
             "emoji": emoji, "plays": 0, "ugc": True, "draft": True}
    cat.append(entry)
    _save_catalog(cat)
    return entry


@app.function(image=slim_image, volumes={REF_DIR: volume},
              secrets=[modal.Secret.from_name("mimic-admin")])
@modal.fastapi_endpoint(method="POST")
async def admin_add(token: str, meme_id: str, title: str, file: UploadFile,
                    source: str = "", emoji: str = "🎙", plays: int = 0,
                    line: str = "", origin_url: str = "", draft: bool = False):
    """운영자 전용: 밈 추가/수정 (기준 wav 업로드 + 카탈로그 등록). token 필요.

    line 은 따라 말할 대사 — 말소리 밈에만 있고 동물 소리엔 없다. 빈 값이면
    카탈로그에 키 자체를 넣지 않는다(앱이 유무로 분기하므로 빈 문자열은 곤란).
    draft=True 면 목록에는 안 뜨고 /record/{id} 직링크로만 열린다 — 실기기에서
    먼저 돌려보고 공개하기 위한 상태다.
    """
    import os
    if token != os.environ.get("ADMIN_TOKEN"):
        return Response(status_code=403, content="forbidden")

    data = await file.read()
    problem = _wav_problem(data)
    if problem:
        return {"error": f"기준 음성 형식 오류: {problem}"}

    with open(os.path.join(REF_DIR, f"{meme_id}.wav"), "wb") as f:
        f.write(data)
    volume.commit()

    old = next((m for m in _load_catalog() if m.get("id") == meme_id), {})
    cat = [m for m in _load_catalog() if m.get("id") != meme_id]
    # 기존 항목을 베이스로 덮어쓴다 — 예전엔 고정 키로 새 dict 를 만들어서
    # 재업로드할 때마다 line 같은 필드가 소리 없이 날아갔다.
    entry = dict(old)
    entry.update({"id": meme_id, "title": title, "source": source,
                  "emoji": emoji, "plays": plays})
    if line:
        entry["line"] = line
    if origin_url:
        entry["origin_url"] = origin_url
    if draft:
        entry["draft"] = True
    else:
        entry.pop("draft", None)
    cat.append(entry)
    _save_catalog(cat)
    return {"ok": True, "count": len(cat), "entry": entry}


@app.function(image=slim_image, volumes={REF_DIR: volume},
              secrets=[modal.Secret.from_name("mimic-admin")])
@modal.fastapi_endpoint(method="POST")
async def admin_set_catalog(token: str, file: UploadFile):
    """운영자 전용: 카탈로그 전체 교체 (content/registry.json 에서 생성한 catalog.json 업로드).

    admin_add 는 끝에 append 라 순서를 못 잡는다. 홈 히어로가 memes[0] 이므로
    순서 자체가 콘텐츠 결정이고, 그건 레지스트리에서 정한다.
    UGC 항목은 손대지 않고 앞에 그대로 남긴다 — 유저가 올린 걸 운영 작업이 지우면 안 된다.
    """
    import os, json
    if token != os.environ.get("ADMIN_TOKEN"):
        return Response(status_code=403, content="forbidden")
    try:
        pushed = json.loads((await file.read()).decode("utf-8")).get("memes", [])
    except Exception as e:
        return {"error": f"카탈로그 JSON 파싱 실패: {e}"}
    if not isinstance(pushed, list) or not pushed:
        return {"error": "빈 카탈로그는 받지 않는다"}
    missing = [m["id"] for m in pushed
               if not os.path.exists(os.path.join(REF_DIR, f"{m['id']}.wav"))]
    if missing:
        return {"error": f"기준 음성이 없는 id: {missing}"}
    ugc = [m for m in _load_catalog() if m.get("ugc")]
    _save_catalog(ugc + pushed)
    return {"ok": True, "count": len(ugc) + len(pushed), "ugc_kept": len(ugc)}


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


# ---- 채점 로직 ----
# 신뢰성 설계:
#  - 억양(pitch): 보이스드 구간만 추려 '세미톤 컨투어'로 비교(절대 음높이 무관).
#    무음/비보이스 프레임을 섞지 않아 안정적. DTW로 타이밍 정렬 후 평균 세미톤 오차로 점수.
#  - 음색(tone):  MFCC(음색 특징) DTW 코사인 유사도. UI의 '음색'과 의미 일치.
#  - 타이밍(timing): 길이 비율.
#  - 동물 등 비음성 사운드는 보이스드 프레임이 적으면 억양을 제외하고 가중치 재분배.
#  - 같은 소리=100, 비슷=높게 나오도록 매핑 보정.
def _timing_from_path(wp, n_ref, n_usr):
    """DTW 정렬 경로가 대각선에서 얼마나 벗어났는가 = 리듬 오차 (0~100).

    예전엔 타이밍을 길이 비율로 쟀다:

        timing = 100 * min(len(ref), len(usr)) / max(len(ref), len(usr))

    이건 타이밍이 아니라 길이다. 앞부분을 뭉개고 뒷부분을 늘여서 리듬을 완전히
    망쳐도 총 길이만 맞으면 100점이 나왔다. 가중치 20%가 통째로 공짜였다.

    음색을 재느라 이미 MFCC DTW 를 돌리고 있고, 그 정렬 경로가 곧 "원본의 이
    시점이 내 녹음의 어느 시점에 해당하는가"다. 경로가 대각선이면 둘이 같은
    속도로 간 것이고, 휘어 있으면 그만큼 빠르거나 느렸던 것이다. 벗어난 정도를
    양쪽 길이로 정규화해 평균 낸다 — 길이가 달라도 비교가 된다.

    경로는 (i, j) 쌍의 배열이고 역순으로 들어온다. 방향은 상관없다.
    """
    import numpy as np
    if wp is None or len(wp) == 0 or n_ref < 2 or n_usr < 2:
        return 0.0
    wp = np.asarray(wp, dtype=float)
    # 각 축을 0~1 로 펴서 대각선을 y=x 로 만든다
    i = wp[:, 0] / (n_ref - 1)
    j = wp[:, 1] / (n_usr - 1)
    dev = float(np.mean(np.abs(i - j)))
    # 0.25 는 "네 박자짜리에서 한 박 밀렸다" 정도다. 거기서 대략 37점이 된다.
    return 100.0 * float(np.exp(-dev / 0.25))


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

    # 타이밍: 리듬이 얼마나 어긋났는가 (MFCC 정렬 경로에서 읽는다)
    timing = _timing_from_path(wpm, ma.shape[1], mb.shape[1])

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
