import type { AnimeLine } from "./anime";
import { memeText } from "./meme-i18n";
import type { Meme } from "./memes";

/**
 * 영화·드라마·예능 명대사(밈 카탈로그) → 대결 카드 모양.
 *
 * 대결 화면은 애니 대사 카드(AnimeLine)로 그려진다. 영화 대사는 전부 원본 클립이 올라가 있으니
 * 원본을 듣고 /record 와 같은 밈 기준으로 채점한다(`movie.ref`). 아래 길이·덩어리 수는 서버가
 * 실패했을 때 쓰는 추정치용이라 음절 수로 대충 잡는다.
 */
const HUES = [48, 190, 330, 95, 20, 260];

export function movieLines(memes: Meme[]): AnimeLine[] {
  return memes
    .filter((m) => m.line && !m.draft && !m.id.startsWith("anime_"))
    .map((m, i) => {
      const line = m.line as string;
      const syl = (line.match(/[가-힣]/g) ?? []).length || 4;
      const words = line.split(/\s+/).filter(Boolean).length;
      const en = memeText(m, "en");
      return {
        id: `m_${m.id}`,
        series: m.source,
        seriesEn: en.source,
        who: "",
        whoEn: "",
        say: line,
        ko: "",
        en: en.meaning ?? en.title,
        emoji: m.emoji,
        style: "tense",
        span: [Math.max(0.6, syl * 0.14), Math.max(2, syl * 0.36)],
        beats: Math.max(1, words),
        tip: "먼저 원본을 듣고, 말투·쉬는 곳·끝 처리까지 그대로",
        tipEn: "Hear the original first, then copy the delivery, pauses and ending",
        hue: HUES[i % HUES.length],
        movie: { ref: m.id },
      } satisfies AnimeLine;
    });
}
