"""
기준 음성을 무료로 만드는 3가지 방법
=====================================
영상 합성과 채점 둘 다 이 기준 음성(ref wav)이 필요함.

[방법 A] 직접 녹음 (★추천 - 저작권 100% 안전)
  - 너나 지인이 직접 "시우우~" 외쳐서 폰으로 녹음
  - 오리지널이라 저작권 분쟁 0. MVP엔 이게 최선.

[방법 B] 무료 TTS (edge-tts, MS 음성)
  - 비용 0, 다국어. 단 '연기'는 약함 → 밈보단 대사형에 적합
  - 아래 generate_tts() 사용 (네 PC에서 실행, 인터넷 필요)

[방법 C] 유저 UGC
  - 인기 유저의 고득점 녹음을 (동의 하에) 기준으로 승격
  - 콘텐츠 자가증식. 운영자는 검수만.

권장 전략: A로 시작 → C로 확장. B는 다국어 대사 확장 시.
"""
import asyncio


# 방법 B: 무료 MS Edge TTS
async def generate_tts(text, out_path, voice="en-US-GuyNeural",
                       rate="-10%", pitch="+20Hz"):
    """네 PC에서 실행. pip install edge-tts 필요."""
    import edge_tts
    c = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
    await c.save(out_path)
    print(f"저장: {out_path}")


# 밈별 추천 보이스 프리셋
PRESETS = {
    "ronaldo_siu": dict(text="SIUUUU", voice="en-US-GuyNeural",
                        rate="-15%", pitch="+25Hz"),
    "oh_my_god":   dict(text="Oh my God", voice="en-US-AriaNeural",
                        rate="+0%", pitch="+10Hz"),
    "nani":        dict(text="Nani?!", voice="ja-JP-KeitaNeural",
                        rate="+0%", pitch="+15Hz"),
}


async def build_all(out_dir="."):
    import os
    for mid, cfg in PRESETS.items():
        await generate_tts(
            cfg["text"], os.path.join(out_dir, f"{mid}.mp3"),
            voice=cfg["voice"], rate=cfg["rate"], pitch=cfg["pitch"])


if __name__ == "__main__":
    # 네 PC에서:  python make_reference.py
    asyncio.run(build_all("./refs"))
