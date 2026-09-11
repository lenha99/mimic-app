"""
바이럴 공유영상 생성기 (검증 완료)
원본 vs 나 파형 + 대형 등급 + 워터마크 → 9:16 세로 영상.
의존성: librosa, matplotlib, ffmpeg(시스템). 전부 무료.
"""
import os, subprocess, tempfile
import numpy as np
import librosa
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import font_manager as fm

FONT_PATH = "/usr/share/fonts/truetype/nanum/NanumSquareRoundB.ttf"
VOLT, PINK, ASH = "#E8FF3A", "#FF2D78", "#8A8A92"

def score_to_similarity(score: int) -> int:
    """채점 점수 → 닮음 %. 심리적으로 후하게 (0→30%, 100→100%)."""
    return round(30 + score * 0.70)



def _bars(path, n=56):
    y, _ = librosa.load(path, sr=22050, mono=True)
    y, _ = librosa.effects.trim(y, top_db=25)
    step = max(1, len(y) // n)
    return [float(np.abs(y[i:i+step]).max()) for i in range(0, len(y), step)][:n]


def _grade_color(g):
    return {"SS": VOLT, "S": "#00E5FF", "A": "#7CFF6B"}.get(g, PINK)


def _build_card(ref_audio, usr_audio, title, score, grade, out_png,
                source_name="원본"):
    font = fm.FontProperties(fname=FONT_PATH) if os.path.exists(FONT_PATH) else None
    fig = plt.figure(figsize=(9, 16), dpi=120)
    fig.patch.set_facecolor("#0A0A0B")

    fig.text(0.5, 0.88, title, ha="center", color="#fff", fontsize=42,
             fontweight="bold", fontproperties=font)
    fig.text(0.5, 0.83, f"나 {source_name}", ha="center", color=ASH,
             fontsize=20, fontproperties=font)

    for audio, color, y0, lbl, ly in [
        (ref_audio, VOLT, 0.60, "원본", 0.755),
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
    sim = score_to_similarity(score)
    fig.text(0.5, 0.75, f"{sim}%", ha="center", color=VOLT, fontsize=110, fontweight="bold")
    fig.text(0.5, 0.67, "닮음", ha="center", color="#fff", fontsize=36,
             fontweight="bold", fontproperties=font)
    fig.text(0.5, 0.17, f"{grade} 등급  ·  {score}점", ha="center", color="#fff",
             fontsize=64, fontweight="bold", fontproperties=font)
    fig.text(0.5, 0.07, "MIMIC · 너도 도전해봐", ha="center", color=ASH,
             fontsize=26, fontproperties=font)

    plt.savefig(out_png, facecolor="#0A0A0B")
    plt.close()


def build_video(ref_audio, usr_audio, title, score, grade, out_mp4,
                source_name="원본"):
    """
    공유용 9:16 mp4.
    A: 오디오 = 원본(0.4초 갭) → 내 목소리 이어붙임 (들으면 비교됨)
    B: 카드 = 닮음 % 크게 표시 (캡처해도 콘텐츠)
    """
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as t:
        card = t.name
    _build_card(ref_audio, usr_audio, title, score, grade, card, source_name)

    # A: 원본 → 무음 0.4초 → 내 목소리 합성 오디오
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as t:
        combined_audio = t.name
    dur_cmd = ["ffprobe", "-v", "error", "-show_entries",
               "format=duration", "-of", "csv=p=0"]
    ref_dur = float(subprocess.check_output(dur_cmd + [ref_audio]).strip())
    usr_dur = float(subprocess.check_output(dur_cmd + [usr_audio]).strip())
    total = ref_dur + 0.4 + usr_dur
    subprocess.run([
        "ffmpeg", "-y", "-loglevel", "error",
        "-i", ref_audio, "-i", usr_audio,
        "-filter_complex",
        f"[0:a]apad=pad_dur=0.4[r];[r][1:a]concat=n=2:v=0:a=1[a]",
        "-map", "[a]", combined_audio
    ], check=True)

    cmd = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-loop", "1", "-t", str(total), "-i", card,
        "-i", combined_audio,
        "-filter_complex", "[0:v]scale=1080:1920[v]",
        "-map", "[v]", "-map", "1:a",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac",
        "-shortest", out_mp4,
    ]
    subprocess.run(cmd, check=True)
    os.unlink(card)
    os.unlink(combined_audio)
    return out_mp4
