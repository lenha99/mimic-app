"""
밈 클립 인제스트 — 원본 URL + 구간 → 검증된 기준 음성 + 레지스트리 항목.

    python tools/ingest.py add --id bap_meokgo --url "https://..." \
        --start 00:01:12.30 --end 00:01:14.60 \
        --title "밥은 먹고 다니냐" --line "밥은 먹고 다니냐" --source "살인의 추억" --emoji 🍚

    python tools/ingest.py add --id muyaho --file ~/Downloads/take3.wav --title "무야호"  # 로컬 파일
    python tools/ingest.py locate --url "https://..." --text "4딸라"             # 대사 위치 찾기
    python tools/ingest.py scan --url "https://..." --around 00:01:13            # 깨끗한 구간 찾기
    python tools/ingest.py qa refs_kr/bap_meokgo.wav                             # 게이트만 재실행

왜 도구인가: 채점은 기준 음성 wav 하나가 전부다. 캘리브레이션도, 피처도, 난이도
상수도 없다. 그래서 "어떤 wav 를 넣느냐"가 곧 품질이고, 그 판단을 매번 손으로 하면
반드시 틀린다. 게이트는 전부 production 코드(modal_app._score)에서 역산한 값이다.
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from datetime import date
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parent.parent
REGISTRY = ROOT / "content" / "registry.json"
CLIP_DIR = ROOT / "refs_kr"          # 원본 유래 클립. .gitignore 대상.
CACHE_DIR = CLIP_DIR / ".cache"      # 내려받아 디코드한 원본 (재컷용)

SR = 22050                            # modal_app._score 와 동일
ID_RE = re.compile(r"^[a-z0-9_]{3,32}$")

# 게이트 임계값 — 근거는 docs/ 아닌 코드다. 주석에 출처를 남긴다.
MIN_TRIMMED_S = 0.35     # _score.load() 는 SR*0.15 미만을 거부. 2배 여유.
MIN_DURATION_S = 1.2     # recorder.tsx MIN_WINDOW_MS=1200
# 길이가 녹음 화면의 흐름을 정한다. 녹음 창 = 원본 길이 + TAIL_MS(800ms) 이므로:
#   ~7.2초  수동 정지 버튼 없음 (완전 원테이크)
#   ~10초   "다 했어 →" 버튼이 붙는다 (MANUAL_STOP_ABOVE_MS=8000)
#   10초 초과  듣기와 따라하기가 두 탭으로 갈린다 (LONG_REF_SECONDS=10)
STOP_BUTTON_S = 7.2
MAX_DURATION_S = 10.0    # 흐름이 갈리는 진짜 경계. --max-seconds 로 넘길 수 있다.
SWEET_S = (1.5, 4.5)     # 기존 코퍼스 0.82~4.02초
MIN_VOICED_FRAMES = 25   # _score 는 5 미만이면 피치를 통째로 버린다. 5는 '안 터짐', 25는 '실제로 측정됨'
MIN_VOICED_RATIO = 0.35
SEMITONE_STD = (1.5, 8.0)  # 아래면 단조로워 변별 불가, 위면 pyin 이 음악을 쫓는 중
MAX_CLIP_RATIO = 0.005
MIN_SELF_SCORE = 90
# 엉터리 테이크와 얼마나 벌어지는가. 절대 점수로 자르면 안 된다 —
# 이 엔진은 백색잡음에도 60점(억양 81점)을 준다. 바닥이 높아서 절대 기준은 무의미하고,
# 변별력은 '자기 자신'과 '틀린 억양' 사이의 격차로 봐야 한다.
MIN_SCORE_SPREAD = 15
# 재생 라우드니스. 점수엔 안 들어가지만 "원본이 안 들린다"가 곧 이탈이다.
# 기존 코퍼스는 -10.6(고양이) ~ -22.3(밥은 먹고 다니냐) 로 12dB 이 벌어져 있었다 —
# 목록에서 다음 걸 누를 때마다 볼륨을 다시 잡아야 했다는 뜻이다.
TARGET_LUFS = -14.0      # 스트리밍 관례(-14)에 맞춘다. -16 은 폰 스피커엔 작다.
TARGET_TP_DB = -1.0      # 리미터 천장
LOUDNESS_WARN = 1.0      # 목표에서 이만큼 벗어나면 경고
LOUDNESS_FAIL = 3.0      # 이만큼이면 불합격 — 게인이 어딘가에서 막혔다는 뜻


def die(msg):
    print(f"✗ {msg}")
    sys.exit(1)


def run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8",
                          errors="replace", **kw)


def ts_to_s(v):
    """'00:01:12.30' 또는 '72.3' → 초(float)."""
    if v is None:
        return None
    if ":" not in str(v):
        return float(v)
    parts = [float(p) for p in str(v).split(":")]
    out = 0.0
    for p in parts:
        out = out * 60 + p
    return out


def yt_dlp_cmd():
    """설치돼 있으면 실행 커맨드를, 아니면 안내하고 종료."""
    if shutil.which("yt-dlp"):
        return ["yt-dlp"]
    if run([sys.executable, "-m", "yt_dlp", "--version"]).returncode == 0:
        return [sys.executable, "-m", "yt_dlp"]
    die("yt-dlp 가 없다.  pip install -r tools/requirements-ingest.txt")


# ---------------------------------------------------------------- 내려받기

def download_section(url, start_s, end_s, out_dir, pad=2.0):
    """구간만 오디오로 받아온다.

    구간만 받으려는 시도는 다 느렸다. --download-sections + --force-keyframes-at-cuts 는
    긴 영상을 통째로 재인코딩하고, 오디오 직링크에 ffmpeg -ss 를 거는 방식은 유튜브
    스로틀링에 걸려 수 분씩 걸린다. 반면 yt-dlp 로 오디오 전체를 받는 건 27분짜리가
    24MB · 3초다(병렬 range 요청). 그냥 통째로 받고 로컬에서 자른다.
    """
    print("· 메타데이터 …")
    r = run(yt_dlp_cmd() + ["-f", "bestaudio", "--no-playlist", "-J", url])
    if r.returncode != 0:
        die(f"yt-dlp 실패:\n{r.stderr[-1500:]}")
    j = json.loads(r.stdout)
    info = {"platform": (j.get("extractor_key") or "").lower(),
            "video_id": j.get("id"), "url": j.get("webpage_url", url),
            "channel": j.get("channel") or j.get("uploader"),
            "video_title": j.get("title"), "upload_date": j.get("upload_date")}

    # 같은 영상에서 구간을 여러 번 고쳐 자르는 게 정상이다(한 번에 맞는 일은 없다).
    # 그래서 받은 건 wav 로 디코드해 캐시해 둔다 — 두 번째부터는 내려받기가 없다.
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cached = CACHE_DIR / f"{info['video_id']}.wav"
    if cached.exists():
        print(f"· 캐시 사용: {cached.name}")
        return cached, info, start_s, end_s

    size = j.get("filesize") or j.get("filesize_approx") or 0
    print(f"· 오디오 내려받는 중 ({size / 1e6:.0f}MB) …" if size else "· 오디오 내려받는 중 …")
    r = run(yt_dlp_cmd() + ["-f", "bestaudio", "--no-playlist", "-q",
                            "-o", str(out_dir / "full.%(ext)s"), url])
    got = next((p for p in out_dir.glob("full.*")), None)
    if r.returncode != 0 or got is None:
        die(f"내려받기 실패:\n{r.stderr[-1500:]}")

    r = run(["ffmpeg", "-y", "-v", "error", "-i", str(got), "-vn",
             "-ac", "1", "-ar", str(SR), "-c:a", "pcm_s16le", str(cached)])
    if r.returncode != 0:
        die(f"디코드 실패:\n{r.stderr[-800:]}")

    # 타임스탬프는 원본 기준 그대로 쓴다 — 통째로 받았으니 오프셋 보정이 필요 없다.
    return cached, info, start_s, end_s


# ---------------------------------------------------------------- 정규화

def _pre_chain(denoise):
    """라우드니스를 재기 전에 거치는 필터들. 잰 값과 실제로 나갈 소리가 같아야 한다.

    채점의 pyin 은 fmin=65Hz 부터 본다. 하이패스를 그 위(80Hz)에 걸었더니 저음
    남성 목소리(송강호 ~76Hz)의 기본주파수가 깎여 유성 프레임이 반토막 났다
    (64개 → 32개). fmin 아래인 55Hz 로 내린다 — 럼블은 걷고 목소리는 남긴다.
    """
    chain = ["highpass=f=55"]
    if denoise:
        # 약하게만. 기준 음성에만 건 필터는 유저의 깨끗한 마이크엔 없어서,
        # 세게 걸면 모두에게 음색 감점이 깔린다.
        chain.append("afftdn=nf=-25:tn=1")
    return chain


# 무음 제거 문턱(-45dB)은 절대값이라 게인 뒤에 와야 한다. 앞에 뒀더니 원본이
# 조용한 클립일수록 더 많이 잘렸다 — 염소 울음이 4.02초에서 2.59초로 뭉텅 날아갔다.
_TRIM = ("silenceremove=start_periods=1:start_silence=0.05:"
         "start_threshold=-45dB:detection=rms")


def measure_lufs(src, cut=(), pre=()):
    """통합 라우드니스(LUFS)와 트루피크(dBTP). 못 재면 (None, None)."""
    af = ",".join([*pre, f"loudnorm=I={TARGET_LUFS}:TP={TARGET_TP_DB}:LRA=11"
                         ":print_format=json"])
    r = run(["ffmpeg", "-v", "info", *cut, "-i", str(src), "-af", af, "-f", "null", "-"])
    m = re.search(r"\{[^{}]*input_i[^{}]*\}", r.stderr, re.DOTALL)
    if not m:
        return None, None
    d = json.loads(m.group(0))
    try:
        return float(d["input_i"]), float(d["input_tp"])
    except (KeyError, ValueError):       # 무음이면 -inf 가 온다
        return None, None


def normalize(src, dst, start_s=None, end_s=None, denoise=False):
    """기존 코퍼스와 같은 포맷으로 맞춘다: mono / 22050 / pcm_s16le, 앞뒤 무음 제거.

    라우드니스는 재생 UX 용이다 — _score 는 피크 정규화를 하므로 점수엔 영향이 없다.
    그래서 오래 방치됐는데, 실제로는 목표를 아무도 안 지키고 있었다. loudnorm 의
    linear 모드는 트루피크 천장에 걸리면 게인을 조용히 줄인다. 영화 대사처럼
    순간 피크가 큰 클립("밥은 먹고 다니냐")은 그 바람에 목표보다 6dB 낮게 나왔고,
    아무도 검사하지 않으니 그대로 올라갔다. 이제는 게인을 직접 걸고, 피크는
    리미터가 받고, 결과를 다시 재서 어긋나면 게이트가 잡는다.
    """
    cut = []
    if start_s is not None:
        cut += ["-ss", f"{start_s:.3f}"]
    if end_s is not None:
        cut += ["-to", f"{end_s:.3f}"]

    pre = _pre_chain(denoise)
    measured, _ = measure_lufs(src, cut, pre)
    gain = 0.0 if measured is None else TARGET_LUFS - measured

    def render(g):
        limit = 10 ** (TARGET_TP_DB / 20.0)
        chain = [*pre, f"volume={g:.2f}dB", _TRIM, "areverse", _TRIM, "areverse",
                 f"alimiter=limit={limit:.4f}:attack=5:release=50:level=disabled"]
        r = run(["ffmpeg", "-y", "-v", "error", *cut, "-i", str(src),
                 "-af", ",".join(chain), "-ac", "1", "-ar", str(SR),
                 "-c:a", "pcm_s16le", "-map_metadata", "-1", str(dst)])
        if r.returncode != 0:
            die(f"ffmpeg 정규화 실패:\n{r.stderr[-1500:]}")

    render(gain)
    # 리미터가 깎은 만큼 라우드니스도 내려간다. 한 번 재서 보정하면 대개 0.2LU 안에 든다.
    got, _ = measure_lufs(dst)
    if got is not None and abs(got - TARGET_LUFS) > 0.3:
        render(gain + (TARGET_LUFS - got))
    return dst


# ---------------------------------------------------------------- 품질 검사

def qa(path, voice=True, max_s=MAX_DURATION_S):
    """게이트 실행. (metrics, failures, warnings) 반환."""
    import numpy as np
    import librosa

    fails, warns = [], []
    try:
        y, sr = librosa.load(str(path), sr=SR, mono=True)
    except Exception as e:
        return {}, [f"librosa 가 파일을 못 연다 ({e}) — 서버는 기준 음성을 트랜스코딩하지 않는다"], []

    dur = len(y) / sr
    yt, _ = librosa.effects.trim(y, top_db=30)     # _score 와 같은 기준
    trimmed = len(yt) / sr
    peak = float(np.max(np.abs(y))) if len(y) else 0.0
    clip_ratio = float(np.mean(np.abs(y) > 0.999)) if len(y) else 1.0

    lufs, tp = measure_lufs(path)
    m = {"duration_s": round(dur, 2), "trimmed_s": round(trimmed, 2),
         "peak": round(peak, 4), "clip_ratio": round(clip_ratio, 5),
         "lufs": round(lufs, 2) if lufs is not None else None,
         "true_peak_db": round(tp, 2) if tp is not None else None,
         "sr": sr, "samples": len(y)}

    if trimmed < MIN_TRIMMED_S:
        fails.append(f"트림 후 {trimmed:.2f}초 — {MIN_TRIMMED_S}초 미만이면 채점이 거부한다")
    if dur < MIN_DURATION_S:
        fails.append(f"길이 {dur:.2f}초 — 최소 {MIN_DURATION_S}초")
    if dur > max_s:
        fails.append(
            f"길이 {dur:.2f}초 — {max_s}초를 넘으면 듣기와 따라하기가 두 탭으로 갈린다. "
            "그래도 넣으려면 --max-seconds 를 올려라")
    elif dur > STOP_BUTTON_S:
        warns.append(f"길이 {dur:.2f}초 — '다 했어 →' 수동 정지 버튼이 붙는다 (긴 대사엔 오히려 자연스럽다)")
    elif not (SWEET_S[0] <= dur <= SWEET_S[1]):
        warns.append(f"길이 {dur:.2f}초 — 권장대는 {SWEET_S[0]}~{SWEET_S[1]}초")
    if dur > SWEET_S[1]:
        # timing 은 순수 길이 비율(100*min/max)이라 길수록 중간에 멈추면 크게 깎인다.
        warns.append(f"길수록 타이밍 점수가 박해진다 — 1초 일찍 끊으면 {100*dur/(dur+1):.0f}점")
    if peak < 1e-3:
        fails.append("사실상 무음이다")
    if clip_ratio > MAX_CLIP_RATIO:
        fails.append(f"클리핑 {clip_ratio*100:.2f}% — 원본을 다시 따와라")
    # 라우드니스는 귀로만 알 수 있던 항목이라 오래 새고 있었다. 이제 숫자로 막는다 —
    # 목록에서 클립을 넘길 때마다 볼륨을 다시 잡게 되면 그게 이탈이다.
    if lufs is None:
        warns.append("라우드니스를 못 쟀다 (ffmpeg loudnorm 출력 없음)")
    else:
        miss = abs(lufs - TARGET_LUFS)
        if miss > LOUDNESS_FAIL:
            fails.append(f"라우드니스 {lufs:.1f} LUFS — 목표 {TARGET_LUFS} 에서 {miss:.1f}dB "
                         "벗어났다. 게인이 리미터나 피크 천장에 막혔다는 뜻이다")
        elif miss > LOUDNESS_WARN:
            warns.append(f"라우드니스 {lufs:.1f} LUFS — 목표 {TARGET_LUFS} 에서 {miss:.1f}dB")

    # 피치: _score 의 40%가 여기 달려 있다
    f0, voiced, _ = librosa.pyin(y, fmin=65, fmax=2093, sr=sr)
    v = f0[~np.isnan(f0)]
    ratio = float(np.mean(voiced)) if voiced is not None and len(voiced) else 0.0
    semis = 12 * np.log2(v / (np.median(v) + 1e-9)) if len(v) else np.array([])
    m.update({"voiced_frames": int(len(v)), "voiced_ratio": round(ratio, 2),
              "semitone_std": round(float(np.std(semis)), 2) if len(semis) else 0.0,
              "semitone_range": round(float(np.ptp(semis)), 2) if len(semis) else 0.0})

    if voice:
        if len(v) < MIN_VOICED_FRAMES:
            fails.append(
                f"유성 프레임 {len(v)}개 — {MIN_VOICED_FRAMES}개 미만. 배경음이 피치 추적을 "
                "망쳤거나 말소리가 아니다. 5개 미만이면 채점에서 억양(40%)이 통째로 빠진다")
        if ratio < MIN_VOICED_RATIO:
            fails.append(f"유성 비율 {ratio:.2f} — 대사보다 음악·잡음이 많다")
        std = m["semitone_std"]
        if std < SEMITONE_STD[0]:
            # 하한은 경고까지만. '밋밋하면 변별이 안 된다'는 직관은 맞지만, 실제로
            # 변별이 되는지는 아래 격차 게이트가 직접 잰다. 현재 서비스 중인 클립도
            # 고양이 0.63 · 염소 0.24 로 이 선 아래인데 격차는 충분하다.
            warns.append(f"억양 폭 {std:.2f} 세미톤 — 밋밋한 편이다. 아래 격차를 봐라")
        elif std > SEMITONE_STD[1]:
            # 폭이 크면 원인이 둘이다: 배경음악을 쫓고 있거나, 화자가 두 명이거나.
            # 구분해줘야 사람이 다음에 뭘 할지 안다 (한쪽만 자르기 vs 구간 다시 고르기).
            # 앞뒤 절반 비교로는 못 잡는다 — 한 사람 분량이 짧으면 중앙값이 안 흔들린다.
            # 음높이 분포를 정렬해 '큰 틈'을 찾고, 양쪽이 다 유의미한 양이면 두 화자다.
            sv = np.sort(12 * np.log2(v / (np.median(v) + 1e-9)))
            gaps = np.diff(sv)
            k = int(np.argmax(gaps)) if len(gaps) else 0
            gap = float(gaps[k]) if len(gaps) else 0.0
            minor = min(k + 1, len(sv) - k - 1) / max(len(sv), 1)
            m["pitch_gap_semitones"] = round(gap, 1)
            if gap > 5 and minor > 0.15:
                fails.append(
                    f"음높이가 {gap:.0f}세미톤 틈으로 두 덩어리다 (작은 쪽 {minor*100:.0f}%) — "
                    "화자가 두 명이다. 한 사람이 따라할 수 없으니 한쪽만 잘라라")
            else:
                fails.append(f"억양 폭 {std:.2f} 세미톤 — pyin 이 음악을 쫓는 중일 가능성이 높다")

    # 실제 채점 함수로 왕복
    try:
        sys.path.insert(0, str(ROOT))   # tools/ 에서 돌아도 레포 루트의 modal_app 을 본다
        import modal_app
        self_res = modal_app._score(str(path), str(path))
        m["self_score"] = self_res.get("score")
        m["self_pitch"] = (self_res.get("breakdown") or {}).get("pitch")
        if (m["self_score"] or 0) < MIN_SELF_SCORE:
            fails.append(f"자기 자신 채점 {m['self_score']}점 — {MIN_SELF_SCORE}점 이상이어야 한다")
        if voice and not m["self_pitch"]:
            fails.append("채점이 억양을 못 썼다 (pitch=0/None) — 가중치 40%가 죽은 클립이다")

        # 일부러 틀린 테이크와 얼마나 벌어지는지. 이 레포에 없는 '클립별 캘리브레이션'을 대신한다.
        # 250ms 셔플을 쓰는 이유: 음색과 길이는 그대로 두고 '억양 순서'만 망가뜨린다.
        # 못 따라한 사람이 실제로 내는 소리에 가장 가깝고, 이 채점기가 보는 축과 정확히 겹친다.
        # (음높이 이동은 소용없다 — _score 는 자기 중앙값 기준 세미톤이라 이동에 둔감하다.)
        chunk = int(0.25 * sr)
        pieces = [y[i:i + chunk] for i in range(0, len(y), chunk)]
        order = np.random.default_rng(0).permutation(len(pieces))
        deg = np.concatenate([pieces[i] for i in order]) if len(pieces) > 1 else y
        import soundfile as sf
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as t:
            sf.write(t.name, deg, sr, subtype="PCM_16")
        m["degraded_score"] = modal_app._score(str(path), t.name).get("score")
        os.unlink(t.name)
        spread = (m["self_score"] or 0) - (m["degraded_score"] or 0)
        m["score_spread"] = spread
        if spread < MIN_SCORE_SPREAD:
            fails.append(
                f"틀린 억양과 {spread}점밖에 안 벌어진다 (자기 {m['self_score']} / "
                f"셔플 {m['degraded_score']}) — 아무나 해도 같은 점수가 나오는 클립이다")
    except Exception as e:
        warns.append(f"채점 왕복 검사를 건너뜀: {e}")

    return m, fails, warns


def print_qa(m, fails, warns):
    print("\n  측정값")
    for k, v in m.items():
        print(f"    {k:16} {v}")
    for w in warns:
        print(f"  ! {w}")
    for f in fails:
        print(f"  ✗ {f}")
    if not fails:
        print("  ✓ 게이트 통과")


# ---------------------------------------------------------------- 레지스트리

def load_registry():
    with REGISTRY.open(encoding="utf-8") as f:
        return json.load(f)


def save_registry(doc):
    with REGISTRY.open("w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)
        f.write("\n")
    r = run([sys.executable, str(ROOT / "tools" / "sync_catalog.py")])
    print(r.stdout.strip() or r.stderr.strip())


# ---------------------------------------------------------------- 서브커맨드

def cmd_add(a):
    if not ID_RE.match(a.id):
        die(f"id 는 소문자·숫자·밑줄 3~32자여야 한다 (URL 과 파일명이 된다): {a.id}")
    if any(m["id"] == a.id for m in load_registry()["memes"]) and not a.force:
        die(f"'{a.id}' 는 이미 레지스트리에 있다. --force 로 덮어써라")

    CLIP_DIR.mkdir(exist_ok=True)
    out = CLIP_DIR / f"{a.id}.wav"
    origin = {}

    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        if a.file:
            src, s, e = Path(a.file), ts_to_s(a.start), ts_to_s(a.end)
            if not src.exists():
                die(f"파일이 없다: {src}")
        else:
            if not a.url:
                die("--url 또는 --file 중 하나는 있어야 한다")
            src, info, s, e = download_section(
                a.url, ts_to_s(a.start), ts_to_s(a.end), tmp)
            origin = {**info, "start": a.start, "end": a.end}

        print("· 정규화 중 …")
        normalize(src, out, s, e, denoise=a.denoise)

    print(f"· 검사 중: {out}")
    m, fails, warns = qa(out, voice=not a.nonvoice, max_s=a.max_seconds)
    print_qa(m, fails, warns)
    if fails and not a.ignore_gates:
        # 파일은 남긴다 — 구간을 다시 고르려면 잘린 걸 들어보고 뜯어봐야 한다.
        # 레지스트리에만 안 넣으므로 배포로는 절대 안 샌다.
        print(f"\n게이트를 통과 못 했다. 잘린 파일은 검사용으로 남겨둔다: {out}\n"
              "구간을 다시 고르거나(scan), --denoise 를 쓰거나, 직접 녹음/TTS 로\n"
              "대체해라. 그래도 넣으려면 --ignore-gates.")
        sys.exit(1)

    entry = {"id": a.id, "title": a.title, "source": a.source or "",
             "emoji": a.emoji, "plays": a.plays}
    if a.line:
        entry["line"] = a.line
    entry.update({
        "kind": a.kind,
        "origin": origin or {"url": a.url or f"local:{a.file}", "start": a.start, "end": a.end},
        "license": {"kind": a.license, "holder": a.holder or "", "note": a.rights_note},
        "added": date.today().isoformat(),
        "duration_ms": int(round(m.get("duration_s", 0) * 1000)),
        "qa": m,
        "draft": True,
    })
    if a.denoise:
        # 기준 음성에만 건 필터는 유저의 마이크엔 없다. 음색 점수가 전체적으로
        # 조금 깎이는 대신 균일하므로 감수하되, 나중에 원인을 찾을 수 있게 남긴다.
        entry["filters"] = ["afftdn"]
    # 레지스트리는 쓰기 직전에 다시 읽는다. 픽커를 여러 개 띄워놓고 각각 확정하면
    # 인제스트가 겹치는데(검사에 수십 초 걸린다), 명령 시작 시점에 읽어둔 사본에
    # 쓰면 먼저 끝난 클립이 통째로 사라진다.
    doc = load_registry()
    doc["memes"] = [x for x in doc["memes"] if x["id"] != a.id] + [entry]
    save_registry(doc)

    print(f"\n✓ {out} + 레지스트리 항목 (draft)")
    print(f"  다음: python tools/ingest.py publish {a.id}")


def cmd_qa(a):
    m, fails, warns = qa(Path(a.path), voice=not a.nonvoice, max_s=a.max_seconds)
    print_qa(m, fails, warns)
    sys.exit(1 if fails else 0)


def cmd_scan(a):
    """대사 구간 후보를 훑는다 — 유성 비율 높고 타악 성분 낮은 창을 고른다."""
    import numpy as np
    import librosa

    center = ts_to_s(a.around)
    half = a.window / 2
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        src, _, _, _ = download_section(a.url, center - half, center + half, tmp)
        # 받은 건 원본 컨테이너(webm/opus 등)라 libsndfile 이 못 연다. 볼 구간만
        # ffmpeg 로 떼어 wav 로 디코드한다.
        win = tmp / "win.wav"
        r = run(["ffmpeg", "-y", "-v", "error", "-ss", f"{max(0.0, center - half):.3f}",
                 "-t", f"{a.window:.3f}", "-i", str(src), "-vn",
                 "-ac", "1", "-ar", str(SR), "-c:a", "pcm_s16le", str(win)])
        if r.returncode != 0 or not win.exists():
            die(f"구간 디코드 실패:\n{r.stderr[-800:]}")
        y, sr = librosa.load(str(win), sr=SR, mono=True)

    # pyin 은 비싸다. 창마다 돌리지 말고 전체에 한 번 돌린 뒤 프레임을 잘라 집계한다.
    _, perc = librosa.effects.hpss(y)
    f0, voiced, _ = librosa.pyin(y, fmin=65, fmax=2093, sr=sr)
    fhop = 512                                    # librosa 기본 hop_length
    hop, win = int(0.25 * sr), int(a.length * sr)

    print(f"\n  창 {a.length}초 · 0.25초 간격 — 유성비 높고 타악비 낮은 구간이 대사다\n")
    print(f"  {'시작(초)':>8}  {'유성비':>6}  {'타악비':>6}  {'억양폭':>6}  {'RMS':>6}")
    rows = []
    for i in range(0, max(1, len(y) - win), hop):
        seg, ps = y[i:i + win], perc[i:i + win]
        if len(seg) < win:
            break
        fa, fb = i // fhop, (i + win) // fhop
        vseg = voiced[fa:fb]
        vr = float(np.mean(vseg)) if len(vseg) else 0.0
        v = f0[fa:fb][~np.isnan(f0[fa:fb])]
        std = float(np.std(12 * np.log2(v / (np.median(v) + 1e-9)))) if len(v) > 4 else 0.0
        pr = float(np.sqrt(np.mean(ps ** 2)) / (np.sqrt(np.mean(seg ** 2)) + 1e-9))
        rows.append((i / sr, vr, pr, std, float(np.sqrt(np.mean(seg ** 2)))))
    for t, vr, pr, std, rms in sorted(rows, key=lambda r: -(r[1] - r[2]))[:12]:
        abs_t = center - half + t
        print(f"  {abs_t:8.2f}  {vr:6.2f}  {pr:6.2f}  {std:6.2f}  {rms:6.3f}")
    print("\n  위 '시작(초)'을 --start 로, +길이를 --end 로 넣어 add 해라.")


def _voiced_spans(wav, min_len=0.25, bridge=0.2):
    """목소리 구간 [[시작, 끝, 중앙음높이Hz, 주음역인가], …].

    파형만 봐선 어디가 목소리인지 안 보인다. 게다가 음역대까지 알려줘야 한다 —
    한 클립에 두 사람이 섞이면 한 사람이 따라할 수 없어 게이트에서 막히는데,
    그걸 자르고 나서야 알면 늦다.
    """
    import numpy as np
    import librosa
    y, sr = librosa.load(str(wav), sr=SR, mono=True)
    f0, voiced, _ = librosa.pyin(y, fmin=65, fmax=2093, sr=sr)
    if voiced is None or not len(voiced):
        return []
    hop = 512
    spans, run = [], None
    for i, v in enumerate(voiced):
        t = i * hop / sr
        if v and run is None:
            run = t
        elif not v and run is not None:
            spans.append([run, t]); run = None
    if run is not None:
        spans.append([run, len(y) / sr])

    merged = []
    for s in spans:
        if merged and s[0] - merged[-1][1] <= bridge:   # 숨 쉬는 틈은 이어 붙인다
            merged[-1][1] = s[1]
        else:
            merged.append(s)
    merged = [s for s in merged if s[1] - s[0] >= min_len]
    if not merged:
        return []

    out = []
    for a_, b_ in merged:
        seg = f0[int(a_ * sr / hop):int(b_ * sr / hop)]
        seg = seg[~np.isnan(seg)]
        out.append([round(a_, 2), round(b_, 2),
                    round(float(np.median(seg)), 1) if len(seg) else 0.0])

    # 가장 긴 구간의 음역을 '주 화자'로 본다. 7세미톤 넘게 벌어지면 다른 소리다.
    main = max(out, key=lambda s: s[1] - s[0])[2]
    for s in out:
        gap = abs(12 * np.log2((s[2] + 1e-9) / (main + 1e-9))) if s[2] else 99
        s.append(bool(gap <= 7))
    return out


def _caption_chars(url):
    """자막을 (글자, 시각) 으로 편다. 자동 자막이면 단어마다 시각이 박혀 있다."""
    import glob

    with tempfile.TemporaryDirectory() as tmp:
        r = run(yt_dlp_cmd() + ["--skip-download", "--write-subs", "--write-auto-subs",
                                "--sub-langs", "ko.*", "--sub-format", "vtt",
                                "--no-playlist", "-o", str(Path(tmp) / "s"), url])
        files = sorted(glob.glob(str(Path(tmp) / "s*.vtt")))
        if not files:
            return []
        vtt = Path(files[0]).read_text(encoding="utf-8", errors="replace")

    # 자동 자막은 한 큐를 두 번 보낸다(누적 표시용). 단어 시각이 박힌 줄만 쓰면
    # 중복이 저절로 걸러진다: `머리좋은<00:00:01.350><c> 버터</c>…`
    cue = re.compile(r"^(\d\d:\d\d:\d\d\.\d\d\d) -->", re.M)
    word = re.compile(r"<(\d\d:\d\d:\d\d\.\d\d\d)><c>(.*?)</c>")
    out, seen = [], set()
    for block in re.split(r"\n\n+", vtt):
        m = cue.search(block)
        if not m:
            continue
        t0 = ts_to_s(m.group(1))
        pairs = word.findall(block)
        if not pairs:
            continue
        head = re.sub(r"<[^>]*>", "", block.split("\n", 1)[1].split("<", 1)[0]).strip()
        for ch in head:
            if not ch.isspace():
                out.append((ch, t0))
        for t, w in pairs:
            ts = ts_to_s(t)
            if (ts, w) in seen:
                continue
            seen.add((ts, w))
            for ch in w:
                if not ch.isspace():
                    out.append((ch, ts))
    return out


def cmd_locate(a):
    """대사가 영상 어디쯤인지 자막으로 찾는다.

    긴 영상에서 --around 를 모르면 픽커는 한가운데 60초를 띄우고, 거기 대사가
    없으면 눈으로 훑는 수밖에 없다. 한국어 자동 자막은 받아쓰기가 엉망이지만
    ('4딸라' → '쟈 달러') 글자 단위로는 절반쯤 맞아서 위치를 잡기엔 충분하다.
    정확한 경계는 어차피 픽커에서 귀로 잡는다 — 여기선 어느 1분인지만 좁힌다.
    """
    from difflib import SequenceMatcher

    chars = _caption_chars(a.url)
    if not chars:
        die("자막이 없다. --around 없이 pick 을 띄우고 확대/축소로 찾아라.")

    q = re.sub(r"\s", "", a.text)
    text = "".join(c for c, _ in chars)
    width = len(q) + 4
    scored = []
    for i in range(0, max(1, len(text) - 1)):
        win = text[i:i + width]
        if len(win) < len(q) // 2:
            break
        scored.append((SequenceMatcher(None, q, win).ratio(), chars[i][1]))

    scored.sort(key=lambda s: -s[0])
    hits, used = [], []
    for score, t in scored:                    # 같은 대목이 여러 번 걸리니 5초 안은 하나로
        if any(abs(t - u) < 5.0 for u in used):
            continue
        used.append(t)
        hits.append((score, t))
        if len(hits) >= 5:
            break

    print(f"\n  자막 {len(text)}자에서 '{a.text}' 와 닮은 곳 — 받아쓰기가 틀려도 위치는 맞는다\n")
    for score, t in hits:
        i = next(k for k, (_, ts) in enumerate(chars) if ts >= t)
        around = f"{int(t) // 60:02d}:{t % 60:05.2f}"
        print(f"  {score:5.2f}  {around}  …{text[max(0, i - 6):i + width + 6]}…")
    if hits:
        t = hits[0][1]
        print(f"\n  제일 그럴듯한 데서 픽커 열기:\n"
              f"  python tools/ingest.py pick --url \"{a.url}\" --around {t:.1f} "
              f"--window 40 --id ID --title '제목' --line '{a.text}'")


def cmd_pick(a):
    """파형을 보고 귀로 들으며 구간을 고른다.

    타임스탬프를 손으로 찍는 건 거의 항상 빗나간다 — 말이 어디서 시작하는지는
    들어봐야 알고, 유튜브 UI 로는 0.1초 단위를 못 잡는다. 브라우저에 파형을 띄우고
    드래그로 고르게 한 뒤, 고른 구간을 그대로 add 에 넘긴다.
    """
    import http.server, json as _json, socketserver, threading, webbrowser

    with tempfile.TemporaryDirectory() as tmp:
        src, info, _, _ = download_section(a.url, None, None, Path(tmp))

    import soundfile as sf
    total = sf.info(str(src)).duration
    center = ts_to_s(a.around) if a.around else total / 2
    offset = max(0.0, center - a.window / 2)
    window = min(a.window, total - offset)

    serve = Path(tempfile.mkdtemp())
    clip = serve / "audio.wav"
    r = run(["ffmpeg", "-y", "-v", "error", "-ss", f"{offset:.3f}", "-t", f"{window:.3f}",
             "-i", str(src), "-ac", "1", "-ar", str(SR), "-c:a", "pcm_s16le", str(clip)])
    if r.returncode != 0:
        die(f"구간 디코드 실패:\n{r.stderr[-800:]}")

    # 어디가 말소리인지 파형만 봐선 모른다 — 음악·발소리도 똑같이 크다. pyin 으로
    # 유성 구간을 미리 찾아 파형 위에 칠해주고, 기본 선택도 제일 긴 구간에 맞춘다.
    voiced_spans = _voiced_spans(clip)
    if voiced_spans and not a.start:
        # 주 화자 음역의 구간 중 제일 긴 것에 기본 선택을 맞춘다
        main_spans = [s for s in voiced_spans if s[3]] or voiced_spans
        lo, hi = max(main_spans, key=lambda s: s[1] - s[0])[:2]
        cfg_start, cfg_end = max(0.0, lo - 0.15), min(window, hi + 0.15)
    else:
        cfg_start = (ts_to_s(a.start) - offset) if a.start else None
        cfg_end = (ts_to_s(a.end) - offset) if a.end else None

    cfg = {"offset": offset, "window": window, "max_s": a.max_seconds,
           "voiced": voiced_spans,
           "video_title": info.get("video_title"), "channel": info.get("channel"),
           "start": cfg_start, "end": cfg_end}
    page = (Path(__file__).parent / "picker.html").read_text(encoding="utf-8")
    token = "/*__PICK_CONFIG__*/ { offset: 0, window: 60, max_s: 10.0 }"
    if token not in page:
        die("picker.html 의 설정 자리를 찾지 못했다")
    page = page.replace(token, _json.dumps(cfg, ensure_ascii=False))
    (serve / "index.html").write_text(page, encoding="utf-8")

    picked = {}

    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kw):
            super().__init__(*args, directory=str(serve), **kw)

        def do_POST(self):
            body = self.rfile.read(int(self.headers["Content-Length"]))
            picked.update(_json.loads(body))
            self.send_response(204)
            self.end_headers()

        def log_message(self, *args):
            pass

    with socketserver.TCPServer(("127.0.0.1", 0), Handler) as srv:
        port = srv.server_address[1]
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        url = f"http://127.0.0.1:{port}/"
        print(f"\n  브라우저에서 구간을 고르면 여기서 이어서 진행한다:\n  {url}\n")
        webbrowser.open(url)
        try:
            while not picked:
                __import__("time").sleep(0.3)
        except KeyboardInterrupt:
            die("취소했다")
        srv.shutdown()

    start, end = picked["start"], picked["end"]
    s_str, e_str = f"{start:.2f}", f"{end:.2f}"
    print(f"✓ 고른 구간: {s_str}초 → {e_str}초 ({end - start:.2f}초)")

    if not a.id:
        print("\n  이 구간으로 넣으려면:\n"
              f"  python tools/ingest.py add --id ID --url \"{a.url}\" \\\n"
              f"      --start {s_str} --end {e_str} --title '제목' --line '대사'")
        return

    a.start, a.end, a.file = s_str, e_str, None
    cmd_add(a)


def _renorm_source(entry):
    """이 항목을 다시 정규화할 원본. 없으면 None.

    결과는 언제나 refs_kr/ 로 나간다(publish 가 거길 먼저 본다). 제자리에 덮어쓰면
    두 번 돌릴 때마다 무음 제거가 누적돼 원본이 조금씩 갉힌다 — 실제로 한 번
    날려먹고 git 에서 되살렸다. 원본은 건드리지 않는 게 규칙이다.
    """
    vid = (entry.get("origin") or {}).get("video_id")
    if vid and (CACHE_DIR / f"{vid}.wav").exists():
        return CACHE_DIR / f"{vid}.wav"
    # 원본을 다시 받아올 수 없는 것들(CC0 코퍼스)은 받아둔 wav 자체가 원본이다.
    for d in ("refs_animals", "refs_cc0"):
        p = ROOT / d / f"{entry['id']}.wav"
        if p.exists():
            return p
    return None


def cmd_renorm(a):
    """정규화 규칙이 바뀌면 기존 클립을 전부 다시 만든다.

    라우드니스 목표를 고쳐도 이미 들어간 클립은 옛 값 그대로 남는다. 그래서 목록을
    넘길 때마다 볼륨이 튀었다 — 고양이 -10.6 LUFS, 밥은 먹고 다니냐 -22.3 LUFS.
    메타데이터(plays·added·출처)는 건드리지 않고 소리와 QA 수치만 다시 쓴다.
    """
    doc = load_registry()
    targets = [m for m in doc["memes"] if not a.ids or m["id"] in a.ids]
    if a.ids:
        missing = set(a.ids) - {m["id"] for m in targets}
        if missing:
            die(f"레지스트리에 없다: {', '.join(sorted(missing))}")

    changed, skipped = [], []
    for entry in targets:
        src = _renorm_source(entry)
        if src is None:
            skipped.append(entry["id"])
            continue
        origin = entry.get("origin") or {}
        denoise = "afftdn" in (entry.get("filters") or [])
        out = CLIP_DIR / f"{entry['id']}.wav"
        print(f"\n· {entry['id']} ← {src.name}")
        CLIP_DIR.mkdir(parents=True, exist_ok=True)
        normalize(src, out, ts_to_s(origin.get("start")),
                  ts_to_s(origin.get("end")), denoise=denoise)

        before = (entry.get("qa") or {}).get("lufs")
        m, fails, warns = qa(out, voice=bool(entry.get("line")))   # 동물은 억양 게이트 면제
        print_qa(m, fails, warns)
        entry["qa"], entry["duration_ms"] = m, int(round(m.get("duration_s", 0) * 1000))
        changed.append((entry["id"], before, m.get("lufs")))

    save_registry(doc)      # 카탈로그 사본까지 같이 갱신한다
    print("\n  라우드니스 (LUFS)")
    for cid, before, after in changed:
        print(f"    {cid:<20} {before if before is not None else '  ?':>7} → {after:>7}")
    if skipped:
        print(f"\n  원본이 없어 건너뜀: {', '.join(skipped)}")


def _admin_token():
    tok = os.environ.get("MIMIC_ADMIN_TOKEN")
    if not tok:
        die("MIMIC_ADMIN_TOKEN 환경변수가 없다 (셸 히스토리에 남기지 않으려고 플래그로 안 받는다)")
    return tok


BASE = "https://lenha99--meme-scoring"


UPLOAD_TRIES = 3         # 볼륨에 쓰기가 유실되는 일이 실제로 있다. 아래 주석 참고.


def _fetch_reference(mid, tries=6, wait=10):
    """프로덕션이 실제로 돌려주는 기준 음성 바이트. 끝내 못 받으면 None."""
    import time, urllib.parse, urllib.request
    ref = f"{BASE}-reference.modal.run?meme_id={urllib.parse.quote(mid)}"
    for i in range(tries):
        try:
            with urllib.request.urlopen(ref, timeout=30) as r:
                return r.read()
        except Exception as e:
            if i + 1 < tries:
                print(f"  · 기준 음성 아직 안 보임 ({e}) — 재시도 {i+1}/{tries}")
                time.sleep(wait)
    return None


def _admin_add(entry, wav, live):
    import urllib.parse, urllib.request
    q = {"token": _admin_token(), "meme_id": entry["id"], "title": entry["title"],
         "source": entry.get("source", ""), "emoji": entry.get("emoji", "🎙"),
         "plays": entry.get("plays", 0), "line": entry.get("line", ""),
         "origin_url": (entry.get("origin") or {}).get("url", "") or "",
         "draft": "true" if (entry.get("draft") and not live) else "false"}
    url = f"{BASE}-admin-add.modal.run?" + urllib.parse.urlencode(q)

    boundary = "----mimic"
    body = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; "
            f"filename=\"{entry['id']}.wav\"\r\nContent-Type: audio/wav\r\n\r\n").encode()
    body += wav.read_bytes() + f"\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request(url, data=body, method="POST",
                                 headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
    with urllib.request.urlopen(req, timeout=120) as res:
        out = json.loads(res.read().decode())
    if out.get("error"):
        die(f"서버가 거부했다: {out['error']}")
    return out


def cmd_publish(a):
    import hashlib
    entry = next((m for m in load_registry()["memes"] if m["id"] == a.id), None)
    if not entry:
        die(f"레지스트리에 없다: {a.id}")
    wav = CLIP_DIR / f"{a.id}.wav"
    if not wav.exists():
        wav = ROOT / "refs_animals" / f"{a.id}.wav"
    if not wav.exists():
        die(f"기준 음성 파일이 없다: refs_kr/{a.id}.wav")
    want = hashlib.sha256(wav.read_bytes()).hexdigest()

    # 서버가 ok 를 줘도 파일이 볼륨에 남지 않는 일이 있다. 11개를 연달아 올렸더니
    # 3개는 60초 내내 404 였고 1개는 옛 파일이 그대로 나왔다 — 요청마다 다른
    # 컨테이너에 붙는데 각자 자기 시점의 볼륨 뷰로 커밋하면서 남의 쓰기를 덮는다.
    # 그러니 200 을 믿지 않는다. 프로덕션에서 같은 바이트가 나와야 성공이다.
    for attempt in range(1, UPLOAD_TRIES + 1):
        print(f"✓ 업로드: {_admin_add(entry, wav, a.live)}")
        got = _fetch_reference(a.id, tries=3, wait=8)
        if got is not None and hashlib.sha256(got).hexdigest() == want:
            break
        why = "안 보인다" if got is None else "옛 파일이 나온다"
        if attempt < UPLOAD_TRIES:
            print(f"  ! 올렸는데 프로덕션에서 {why} — 다시 올린다 ({attempt}/{UPLOAD_TRIES})")
    else:
        die(f"{UPLOAD_TRIES}번 올렸는데 프로덕션에 반영되지 않는다: {a.id}")

    cmd_verify(a)

    # --live 는 서버에만 공개로 올리고 레지스트리 플래그는 그대로 뒀었다. 그러면
    # sync_catalog 가 웹 FALLBACK·Flutter 사본에서 계속 걸러내서, 프로덕션엔
    # 떠 있는데 오프라인 목록엔 없는 상태가 된다. 올린 대로 레지스트리도 맞춘다.
    if a.live and entry.get("draft"):
        doc = load_registry()
        for m in doc["memes"]:
            if m["id"] == a.id:
                m.pop("draft", None)
        save_registry(doc)
        print("  draft 해제 — 레지스트리와 생성 사본도 공개로 맞췄다")


def cmd_publish_all(a):
    """레지스트리 전체를 다시 올린다.

    renorm 으로 소리를 다시 만들면 서버엔 옛 파일이 그대로 남는다. 한 개씩
    올리는 셸 반복문을 받아적게 하면 id 목록을 손으로 치다가 틀린다(실제로
    'dolphin','bap_meokgo' 가 붙어 'dolphinmeokgo' 가 됐다). 목록은 레지스트리가
    갖고 있으니 여기서 읽는다.
    """
    ids = [m["id"] for m in load_registry()["memes"]]
    failed = []
    for i, mid in enumerate(ids, 1):
        print(f"\n[{i}/{len(ids)}] {mid}")
        try:
            cmd_publish(argparse.Namespace(id=mid, live=a.live))
        except SystemExit:      # die() 한 개 때문에 나머지를 멈추지 않는다
            failed.append(mid)
    print(f"\n✓ {len(ids) - len(failed)}/{len(ids)} 올렸다")
    if failed:
        print(f"✗ 실패: {', '.join(failed)}\n  같은 명령을 다시 돌리면 된다 (업로드는 덮어쓰기다)")
        sys.exit(1)


def cmd_verify(a):
    import hashlib, urllib.request, urllib.parse
    wav = CLIP_DIR / f"{a.id}.wav"
    if not wav.exists():
        wav = ROOT / "refs_animals" / f"{a.id}.wav"
    local = hashlib.sha256(wav.read_bytes()).hexdigest() if wav.exists() else None

    # 1) 바이트 왕복 — 볼륨 반영과 원시 쓰기 경로를 한 번에 본다
    got = _fetch_reference(a.id)
    if got is None:
        die("기준 음성을 못 받았다")
    same = local == hashlib.sha256(got).hexdigest() if local else None
    print(f"✓ 기준 음성 {len(got)}바이트" + (f" · 해시 {'일치' if same else '불일치'}" if local else ""))

    # 2) 프로덕션 채점에 자기 자신을 먹여 억양 축이 살아 있는지 확인
    boundary = "----mimic"
    body = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; "
            f"filename=\"{a.id}.wav\"\r\nContent-Type: audio/wav\r\n\r\n").encode()
    body += got + f"\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request(
        f"{BASE}-score.modal.run?meme_id={urllib.parse.quote(a.id)}", data=body,
        method="POST", headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
    with urllib.request.urlopen(req, timeout=120) as r:
        res = json.loads(r.read().decode())
    print(f"✓ 프로덕션 자기채점: {res.get('score')}점 · breakdown={res.get('breakdown')}")
    if not (res.get("breakdown") or {}).get("pitch"):
        print("  ! 억양이 0/None 이다 — 말소리 밈이면 클립이 오염된 것이다")
    print(f"\n  실기기 확인: /record/{a.id}")


def cmd_push_catalog(a):
    """카탈로그 전체를 레지스트리 순서대로 덮어쓴다.

    admin_add 는 끝에 붙이기만 해서 순서를 못 잡는데, 홈 히어로가 memes[0] 이라
    순서 자체가 편집 결정이다. UGC 항목은 서버가 앞에 그대로 남긴다.
    """
    import urllib.parse, urllib.request
    run([sys.executable, str(ROOT / "tools" / "sync_catalog.py")])
    data = (ROOT / "catalog.json").read_bytes()
    url = f"{BASE}-admin-set-catalog.modal.run?" + urllib.parse.urlencode(
        {"token": _admin_token()})
    boundary = "----mimic"
    body = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; "
            f"filename=\"catalog.json\"\r\nContent-Type: application/json\r\n\r\n").encode()
    body += data + f"\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request(url, data=body, method="POST",
                                 headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
    with urllib.request.urlopen(req, timeout=60) as r:
        out = json.loads(r.read().decode())
    if out.get("error"):
        die(f"서버가 거부했다: {out['error']}")
    print(f"✓ 카탈로그 교체: {out}")


def cmd_remove(a):
    import urllib.parse, urllib.request
    url = (f"{BASE}-admin-remove.modal.run?"
           + urllib.parse.urlencode({"token": _admin_token(), "meme_id": a.id}))
    with urllib.request.urlopen(urllib.request.Request(url, data=b"", method="POST"), timeout=60) as r:
        print("✓ 서버:", r.read().decode())

    doc = load_registry()
    entry = next((m for m in doc["memes"] if m["id"] == a.id), None)
    doc["memes"] = [m for m in doc["memes"] if m["id"] != a.id]
    save_registry(doc)
    (CLIP_DIR / f"{a.id}.wav").unlink(missing_ok=True)

    log = ROOT / "content" / "TAKEDOWNS.md"
    origin = (entry or {}).get("origin", {}).get("url", "")
    with log.open("a", encoding="utf-8") as f:
        if log.stat().st_size == 0:
            f.write("# 내린 콘텐츠\n\n기록을 남겨야 같은 걸 다시 올리지 않는다.\n\n")
        f.write(f"- {date.today().isoformat()} · `{a.id}` · {origin} · 사유: {a.reason}\n")
    print(f"✓ 레지스트리·파일 삭제 + {log.name} 기록")


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    def content_args(p, required=True):
        """add 와 pick 이 같은 메타데이터 인자를 받는다 (pick 은 골라서 add 로 넘긴다)."""
        p.add_argument("--id", required=required)
        p.add_argument("--title", required=required)
        p.add_argument("--url"); p.add_argument("--file")
        p.add_argument("--start"); p.add_argument("--end")
        p.add_argument("--line", help="따라 말할 대사 (말소리 밈)")
        p.add_argument("--source", help="출처 한 줄 — 영화 제목, 채널명")
        p.add_argument("--emoji", default="🎙")
        p.add_argument("--plays", type=int, default=0)
        p.add_argument("--kind", default="shortform",
                       choices=["movie", "drama", "variety", "shortform", "animal"])
        p.add_argument("--license", default="original-clip",
                       choices=["original-clip", "cc0", "own-recording", "tts"])
        p.add_argument("--holder", help="권리자 표기")
        p.add_argument("--rights-note", dest="rights_note",
                       default="짧은 인용. 권리자 요청 시 즉시 삭제.")
        p.add_argument("--denoise", action="store_true", help="약한 노이즈 리덕션 추가")
        p.add_argument("--nonvoice", action="store_true", help="동물·효과음 (억양 게이트 면제)")
        p.add_argument("--max-seconds", dest="max_seconds", type=float,
                       default=MAX_DURATION_S,
                       help=f"길이 상한(초). 기본 {MAX_DURATION_S} — 넘으면 듣기/따라하기가 갈린다")
        p.add_argument("--force", action="store_true",
                       help="이미 레지스트리에 있는 id 를 덮어쓴다 (구간 다시 자를 때)")
        p.add_argument("--ignore-gates", dest="ignore_gates", action="store_true",
                       help="품질 게이트 실패를 무시하고 등록한다. 웬만하면 쓰지 마라")

    pk = sub.add_parser("pick", help="파형 보며 구간을 골라 그대로 넣는다 (권장)")
    pk.add_argument("--around", help="대략의 위치 (00:09:55). 없으면 한가운데")
    pk.add_argument("--window", type=float, default=60.0, help="화면에 띄울 폭(초)")
    content_args(pk, required=False)
    pk.set_defaults(func=cmd_pick)

    a = sub.add_parser("add", help="구간을 직접 지정해 넣는다")
    content_args(a)
    a.set_defaults(func=cmd_add)

    rn = sub.add_parser("renorm", help="정규화 규칙이 바뀌면 기존 클립을 다시 만든다")
    rn.add_argument("ids", nargs="*", help="비우면 레지스트리 전체")
    rn.set_defaults(func=cmd_renorm)

    q = sub.add_parser("qa", help="기존 wav 에 게이트만 다시 돌린다")
    q.add_argument("path"); q.add_argument("--nonvoice", action="store_true")
    q.add_argument("--max-seconds", dest="max_seconds", type=float, default=MAX_DURATION_S)
    q.set_defaults(func=cmd_qa)

    lo = sub.add_parser("locate", help="대사가 영상 어디쯤인지 자막으로 찾는다")
    lo.add_argument("--url", required=True)
    lo.add_argument("--text", required=True, help="찾을 대사 (자막 받아쓰기가 틀려도 된다)")
    lo.set_defaults(func=cmd_locate)

    s = sub.add_parser("scan", help="영상에서 대사만 깨끗한 구간을 찾는다")
    s.add_argument("--url", required=True)
    s.add_argument("--around", required=True, help="대략의 위치 (00:01:13)")
    s.add_argument("--window", type=float, default=30.0, help="훑을 폭(초)")
    s.add_argument("--length", type=float, default=2.5, help="후보 구간 길이(초)")
    s.set_defaults(func=cmd_scan)

    p = sub.add_parser("publish", help="볼륨 업로드 + 카탈로그 등록 + 검증")
    p.add_argument("id"); p.add_argument("--live", action="store_true", help="draft 해제하고 바로 공개")
    p.set_defaults(func=cmd_publish)

    pa = sub.add_parser("publish-all", help="레지스트리 전체를 다시 올린다 (renorm 뒤)")
    pa.add_argument("--live", action="store_true", help="draft 해제하고 바로 공개")
    pa.set_defaults(func=cmd_publish_all)

    v = sub.add_parser("verify", help="프로덕션에서 실제로 되는지 확인")
    v.add_argument("id")
    v.set_defaults(func=cmd_verify)

    pc = sub.add_parser("push-catalog",
                        help="카탈로그 전체를 레지스트리 순서대로 교체 (히어로 자리 정하기)")
    pc.set_defaults(func=cmd_push_catalog)

    r = sub.add_parser("remove", help="내리기 (서버 + 레지스트리 + 기록)")
    r.add_argument("id"); r.add_argument("--reason", default="운영 판단")
    r.set_defaults(func=cmd_remove)

    args = ap.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
