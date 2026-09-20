"""
밈 클립 인제스트 — 원본 URL + 구간 → 검증된 기준 음성 + 레지스트리 항목.

    python tools/ingest.py add --id bap_meokgo --url "https://..." \
        --start 00:01:12.30 --end 00:01:14.60 \
        --title "밥은 먹고 다니냐" --line "밥은 먹고 다니냐" --source "살인의 추억" --emoji 🍚

    python tools/ingest.py add --id muyaho --file ~/Downloads/take3.wav --title "무야호"  # 로컬 파일
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
MAX_DURATION_S = 6.0     # 창 = dur+800ms → MANUAL_STOP_ABOVE_MS(8000) 까지 여유
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

def _loudnorm_measure(src, cut):
    af = "highpass=f=80,loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json"
    r = run(["ffmpeg", "-v", "info", *cut, "-i", str(src), "-af", af, "-f", "null", "-"])
    m = re.search(r"\{[^{}]*input_i[^{}]*\}", r.stderr, re.DOTALL)
    return json.loads(m.group(0)) if m else None


def normalize(src, dst, start_s=None, end_s=None, denoise=False):
    """기존 코퍼스와 같은 포맷으로 맞춘다: mono / 22050 / pcm_s16le, 앞뒤 무음 제거.

    라우드니스는 재생 UX 용이다 — _score 는 피크 정규화를 하므로 점수엔 영향이 없다.
    2패스로 재는 이유: 2초짜리 짧은 클립은 1패스 추정이 크게 빗나간다.
    """
    cut = []
    if start_s is not None:
        cut += ["-ss", f"{start_s:.3f}"]
    if end_s is not None:
        cut += ["-to", f"{end_s:.3f}"]

    ln = "loudnorm=I=-16:TP=-1.5:LRA=11"
    stats = _loudnorm_measure(src, cut)
    if stats:
        ln += (f":measured_I={stats['input_i']}:measured_TP={stats['input_tp']}"
               f":measured_LRA={stats['input_lra']}:measured_thresh={stats['input_thresh']}"
               ":linear=true")

    chain = ["highpass=f=80"]
    if denoise:
        # 약하게만. 기준 음성에만 건 필터는 유저의 깨끗한 마이크엔 없어서,
        # 세게 걸면 모두에게 음색 감점이 깔린다.
        chain.append("afftdn=nf=-25:tn=1")
    chain.append(ln)
    trim = ("silenceremove=start_periods=1:start_silence=0.05:"
            "start_threshold=-45dB:detection=rms")
    chain += [trim, "areverse", trim, "areverse"]

    r = run(["ffmpeg", "-y", "-v", "error", *cut, "-i", str(src),
             "-af", ",".join(chain), "-ac", "1", "-ar", str(SR),
             "-c:a", "pcm_s16le", "-map_metadata", "-1", str(dst)])
    if r.returncode != 0:
        die(f"ffmpeg 정규화 실패:\n{r.stderr[-1500:]}")
    return dst


# ---------------------------------------------------------------- 품질 검사

def qa(path, voice=True):
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

    m = {"duration_s": round(dur, 2), "trimmed_s": round(trimmed, 2),
         "peak": round(peak, 4), "clip_ratio": round(clip_ratio, 5),
         "sr": sr, "samples": len(y)}

    if trimmed < MIN_TRIMMED_S:
        fails.append(f"트림 후 {trimmed:.2f}초 — {MIN_TRIMMED_S}초 미만이면 채점이 거부한다")
    if dur < MIN_DURATION_S:
        fails.append(f"길이 {dur:.2f}초 — 최소 {MIN_DURATION_S}초")
    if dur > MAX_DURATION_S:
        fails.append(f"길이 {dur:.2f}초 — {MAX_DURATION_S}초 넘으면 수동 정지 UI 로 넘어간다")
    elif not (SWEET_S[0] <= dur <= SWEET_S[1]):
        warns.append(f"길이 {dur:.2f}초 — 권장대는 {SWEET_S[0]}~{SWEET_S[1]}초")
    if peak < 1e-3:
        fails.append("사실상 무음이다")
    if clip_ratio > MAX_CLIP_RATIO:
        fails.append(f"클리핑 {clip_ratio*100:.2f}% — 원본을 다시 따와라")

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
    m, fails, warns = qa(out, voice=not a.nonvoice)
    print_qa(m, fails, warns)
    if fails and not a.force:
        # 파일은 남긴다 — 구간을 다시 고르려면 잘린 걸 들어보고 뜯어봐야 한다.
        # 레지스트리에만 안 넣으므로 배포로는 절대 안 샌다.
        print(f"\n게이트를 통과 못 했다. 잘린 파일은 검사용으로 남겨둔다: {out}\n"
              "구간을 다시 고르거나(scan), --denoise 를 쓰거나, 직접 녹음/TTS 로\n"
              "대체해라. 그래도 넣으려면 --force.")
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
    m, fails, warns = qa(Path(a.path), voice=not a.nonvoice)
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

    cfg = {"offset": offset, "window": window,
           "video_title": info.get("video_title"), "channel": info.get("channel"),
           "start": (ts_to_s(a.start) - offset) if a.start else None,
           "end": (ts_to_s(a.end) - offset) if a.end else None}
    page = (Path(__file__).parent / "picker.html").read_text(encoding="utf-8")
    token = "/*__PICK_CONFIG__*/ { offset: 0, window: 60 }"
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


def _admin_token():
    tok = os.environ.get("MIMIC_ADMIN_TOKEN")
    if not tok:
        die("MIMIC_ADMIN_TOKEN 환경변수가 없다 (셸 히스토리에 남기지 않으려고 플래그로 안 받는다)")
    return tok


BASE = "https://lenha99--meme-scoring"


def cmd_publish(a):
    import urllib.parse, urllib.request
    entry = next((m for m in load_registry()["memes"] if m["id"] == a.id), None)
    if not entry:
        die(f"레지스트리에 없다: {a.id}")
    wav = CLIP_DIR / f"{a.id}.wav"
    if not wav.exists():
        wav = ROOT / "refs_animals" / f"{a.id}.wav"
    if not wav.exists():
        die(f"기준 음성 파일이 없다: refs_kr/{a.id}.wav")

    q = {"token": _admin_token(), "meme_id": a.id, "title": entry["title"],
         "source": entry.get("source", ""), "emoji": entry.get("emoji", "🎙"),
         "plays": entry.get("plays", 0), "line": entry.get("line", ""),
         "origin_url": (entry.get("origin") or {}).get("url", "") or "",
         "draft": "true" if (entry.get("draft") and not a.live) else "false"}
    url = f"{BASE}-admin-add.modal.run?" + urllib.parse.urlencode(q)

    boundary = "----mimic"
    body = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; "
            f"filename=\"{a.id}.wav\"\r\nContent-Type: audio/wav\r\n\r\n").encode()
    body += wav.read_bytes() + f"\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request(url, data=body, method="POST",
                                 headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
    with urllib.request.urlopen(req, timeout=120) as res:
        out = json.loads(res.read().decode())
    if out.get("error"):
        die(f"서버가 거부했다: {out['error']}")
    print(f"✓ 업로드: {out}")
    cmd_verify(a)


def cmd_verify(a):
    import hashlib, time, urllib.request, urllib.parse
    wav = CLIP_DIR / f"{a.id}.wav"
    local = hashlib.sha256(wav.read_bytes()).hexdigest() if wav.exists() else None

    # 1) 바이트 왕복 — 볼륨 반영과 원시 쓰기 경로를 한 번에 본다
    ref = f"{BASE}-reference.modal.run?meme_id={urllib.parse.quote(a.id)}"
    got = None
    for i in range(6):
        try:
            with urllib.request.urlopen(ref, timeout=30) as r:
                got = r.read()
            break
        except Exception as e:
            print(f"  · 기준 음성 아직 안 보임 ({e}) — 재시도 {i+1}/6")
            time.sleep(10)
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
        p.add_argument("--force", action="store_true", help="게이트 실패해도 진행")

    pk = sub.add_parser("pick", help="파형 보며 구간을 골라 그대로 넣는다 (권장)")
    pk.add_argument("--around", help="대략의 위치 (00:09:55). 없으면 한가운데")
    pk.add_argument("--window", type=float, default=60.0, help="화면에 띄울 폭(초)")
    content_args(pk, required=False)
    pk.set_defaults(func=cmd_pick)

    a = sub.add_parser("add", help="구간을 직접 지정해 넣는다")
    content_args(a)
    a.set_defaults(func=cmd_add)

    q = sub.add_parser("qa", help="기존 wav 에 게이트만 다시 돌린다")
    q.add_argument("path"); q.add_argument("--nonvoice", action="store_true")
    q.set_defaults(func=cmd_qa)

    s = sub.add_parser("scan", help="영상에서 대사만 깨끗한 구간을 찾는다")
    s.add_argument("--url", required=True)
    s.add_argument("--around", required=True, help="대략의 위치 (00:01:13)")
    s.add_argument("--window", type=float, default=30.0, help="훑을 폭(초)")
    s.add_argument("--length", type=float, default=2.5, help="후보 구간 길이(초)")
    s.set_defaults(func=cmd_scan)

    p = sub.add_parser("publish", help="볼륨 업로드 + 카탈로그 등록 + 검증")
    p.add_argument("id"); p.add_argument("--live", action="store_true", help="draft 해제하고 바로 공개")
    p.set_defaults(func=cmd_publish)

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
