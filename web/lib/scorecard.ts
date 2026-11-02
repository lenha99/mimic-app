import type { Analysis, Phrase } from "./voice-analysis";
import { tr, type T } from "./i18n";

/**
 * 심사표 — 출전·연습 직후 "내 목소리를 보여 주는" 화면의 계산부.
 *
 * 예전 심사위원 한 줄 평은 미리 써 둔 문장 조합이라 내 녹음과 상관없게 들렸다. 여기서는
 * 전부 이 녹음에서 잰 값으로만 말한다(LLM·서버 없음, 비용 0):
 *   - 마디마다 그 마디에 해당하는 대본 글자 + 말끝 처짐·평평함 표시
 *   - 가장 아쉬운 한 곳(말끝 처짐 · 평평함) → 그 부분만 다시 녹음
 *   - 목소리 타입(속도 × 억양 폭 × 음높이 · 쉼 · 말끝, 14가지) — 공유용
 */

export type Issue = "drop" | "flat";

export type Row = {
  phrase: Phrase;
  /** 이 마디에 해당한다고 보는 대본 글자(음절 비율로 나눈 근사) */
  text: string;
  syllables: number;
  issue: Issue | null;
};

export type Fix = { index: number; issue: Issue; title: string; tip: string };

/** 말끝이 이만큼 이상 작아지면 "처짐" */
const DROP_DB = -6;

/** 대본을 마디 수만큼 나눈다 — 소리 낸 시간에 비례해서. 정확한 정렬이 아니라 근사다. */
export function splitScript(text: string, phrases: Phrase[]): { text: string; syllables: number }[] {
  const words = text
    .replace(/[/*_]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (!phrases.length) return [];
  const syl = (w: string) => (w.match(/[가-힣]/g) ?? []).length || (/[A-Za-z0-9]/.test(w) ? 1 : 0);
  const total = words.reduce((s, w) => s + syl(w), 0);
  const voicedTotal = phrases.reduce((s, p) => s + Math.max(0.05, p.voiced), 0);
  // 어절 경계마다 누적 음절. cum[k] = 앞 k 어절의 음절 수.
  const cum = [0];
  words.forEach((w) => cum.push(cum[cum.length - 1] + syl(w)));
  // 사람은 문장부호에서 쉰다 — 목표 지점 근처에 . , ? ! 로 끝나는 어절이 있으면 거기서 끊는다.
  const punct = (k: number) => k > 0 && /[.,?!…]$/.test(words[k - 1]);
  const out: { text: string; syllables: number }[] = [];
  let from = 0;
  let acc = 0;
  phrases.forEach((p, i) => {
    acc += Math.max(0.05, p.voiced);
    let cut = words.length;
    if (i < phrases.length - 1) {
      const target = (total * acc) / voicedTotal;
      const left = phrases.length - 1 - i; // 뒤 마디마다 어절 하나는 남긴다
      let best = Math.min(words.length - left, from + 1);
      let bestCost = Infinity;
      for (let k = from + 1; k <= words.length - left; k += 1) {
        const cost = Math.abs(cum[k] - target) - (punct(k) ? 4 : 0);
        if (cost < bestCost) {
          bestCost = cost;
          best = k;
        }
      }
      cut = Math.max(from, best);
    }
    const chunk = words.slice(from, cut);
    out.push({ text: chunk.join(" "), syllables: cum[cut] - cum[from] });
    from = cut;
  });
  return out;
}

/** 평평하다고 볼 억양 폭(반음). 대본 기준이 있으면 그 아래쪽 끝을 쓴다. */
export function flatBelow(pitchLo?: number): number {
  return pitchLo ? Math.max(2, pitchLo * 0.6) : 2.5;
}

export function rowsOf(a: Analysis | null, text: string, pitchLo?: number): Row[] {
  const ph = a?.phrases ?? [];
  if (!ph.length) return [];
  const parts = splitScript(text, ph);
  const flat = flatBelow(pitchLo);
  return ph.map((p, i) => {
    let issue: Issue | null = null;
    if (p.drop !== null && p.drop <= DROP_DB) issue = "drop";
    else if (p.range !== null && p.range < flat && p.voiced >= 1) issue = "flat";
    return { phrase: p, text: parts[i]?.text ?? "", syllables: parts[i]?.syllables ?? 0, issue };
  });
}

/** 가장 아쉬운 한 곳. 없으면 null — 그땐 칭찬만 한다. */
export function worstOf(rows: Row[], pitchLo: number | undefined, L: T = tr("ko")): Fix | null {
  const flat = flatBelow(pitchLo);
  let best: { i: number; sev: number; issue: Issue } | null = null;
  rows.forEach((r, i) => {
    const p = r.phrase;
    let sev = 0;
    let issue: Issue | null = null;
    if (p.drop !== null && p.drop <= DROP_DB) {
      sev = -p.drop;
      issue = "drop";
    }
    if (p.range !== null && p.range < flat && p.voiced >= 1) {
      const s = (flat - p.range) * 2.5;
      if (s > sev) {
        sev = s;
        issue = "flat";
      }
    }
    if (issue && (!best || sev > best.sev)) best = { i, sev, issue };
  });
  if (!best) return null;
  const { i, issue } = best as { i: number; sev: number; issue: Issue };
  const n = i + 1;
  return issue === "drop"
    ? {
        index: i,
        issue,
        title: L(`${n}번째 마디, 말끝이 작아졌어요`, `Phrase ${n}: the ending faded`),
        tip: L(
          "마지막 두 글자까지 숨을 남겨 두세요. 끝 글자를 앞 글자만큼 또렷하게 내면 문장이 단단해져요.",
          "Save some breath for the last two syllables. Say the final word as clearly as the first.",
        ),
      }
    : {
        index: i,
        issue,
        title: L(`${n}번째 마디, 억양이 평평해요`, `Phrase ${n}: the melody is flat`),
        tip: L(
          "이 마디에서 제일 중요한 단어 하나만 골라 조금 높게 올려 보세요. 하나만 올라가도 말이 살아요.",
          "Pick the one key word in this phrase and lift it a little. One lift is enough to bring it alive.",
        ),
      };
}

/** 다시 녹음한 마디와 원래 마디를 견준다. 좋아졌으면 true. */
export function retryVerdict(
  before: Phrase,
  after: Analysis,
  issue: Issue,
  L: T = tr("ko"),
): { better: boolean; line: string } {
  if (issue === "drop") {
    const b = before.drop ?? 0;
    const a = after.endDrop;
    if (a === null) return { better: false, line: L("너무 짧아서 말끝을 못 쟀어요. 마디 전체를 읽어 주세요", "Too short to measure the ending — read the whole phrase") };
    const gain = a - b;
    return gain >= 2
      ? { better: true, line: L(`말끝이 살아났어요! 끝 처짐 ${Math.abs(b).toFixed(0)} → ${Math.abs(Math.min(0, a)).toFixed(0)} (작을수록 좋아요)`, `Ending came back! Fade ${Math.abs(b).toFixed(0)} → ${Math.abs(Math.min(0, a)).toFixed(0)} (lower is better)`) }
      : { better: false, line: L("아직 끝이 작아요. 마지막 글자에 숨을 조금 더 남겨 보세요", "Still fading. Keep a little more breath for the last word") };
  }
  const b = before.range ?? 0;
  const a = after.pitchRange;
  if (a === null) return { better: false, line: L("목소리가 잘 안 잡혔어요. 조금 더 크게 다시", "Couldn't catch your voice — try a bit louder") };
  return a - b >= 1
    ? { better: true, line: L(`억양이 살아났어요! 폭 ${b.toFixed(1)} → ${a.toFixed(1)}반음`, `More melody! Range ${b.toFixed(1)} → ${a.toFixed(1)} st`) }
    : { better: false, line: L("아직 평평해요. 중요한 단어 하나를 더 높게", "Still flat — lift one key word higher") };
}

/* ── 목소리 타입 ───────────────────────────────────────────────────────── */

export type VoiceType = { id: string; name: string; desc: string; why: string };

type Lv = 0 | 1 | 2;
/** 낮음·중간·높음 세 칸. 경계는 연습실 대본들의 기준 범위(registry pace·PITCH_RANGE) 분포에서 잡았다. */
const lv = (v: number, lo: number, hi: number): Lv => (v < lo ? 0 : v >= hi ? 2 : 1);

/** [이름, 한 줄 설명] — 속도(행) × 억양 폭(열). 칭찬처럼 들리게 쓴다(못한 점은 고칠 곳에서 말한다). */
const GRID: [string, string, string, string][][] = [
  // 느림
  [
    ["docu", "다큐 내레이터형", "Documentary narrator", "담담하게 끌고 가는 신뢰의 목소리"],
    ["radio", "심야 라디오 DJ형", "Late-night radio DJ", "귀에 가까이 앉아 말하는 듯한 편안함"],
    ["story", "오디오북 낭독형", "Audiobook narrator", "장면이 그려지는 이야기꾼"],
  ],
  // 보통
  [
    ["anchor", "뉴스 앵커형", "News anchor", "또박또박, 흔들림 없는 전달력"],
    ["announcer", "정석 아나운서형", "Classic announcer", "높낮이도 속도도 교과서처럼 고른"],
    ["drama", "드라마 더빙형", "Drama dubbing", "감정이 실린 대사가 자연스러운"],
  ],
  // 빠름
  [
    ["breaking", "속보 리포터형", "Breaking-news reporter", "빠르고 정확하게 핵심만"],
    ["host", "쇼호스트형", "Shopping-show host", "막힘없이 술술, 듣는 사람을 붙잡는"],
    ["ad", "광고 성우형", "Commercial voice", "짧은 시간에 귀에 꽂히는 에너지"],
  ],
];
const GRID_EN: Record<string, string> = {
  docu: "Calm and steady — a voice you trust",
  radio: "Close and comfortable, like sitting next to you",
  story: "A storyteller who paints the scene",
  anchor: "Clear and steady delivery",
  announcer: "Textbook-even pitch and pace",
  drama: "Lines that carry real feeling",
  breaking: "Fast and precise, straight to the point",
  host: "Smooth and gripping, never stalls",
  ad: "Energy that sticks in a few seconds",
};

/** 속도를 모를 때(명대사 등) — 억양 폭만으로. */
const NO_PACE: [string, string, string, string][] = [
  ["calm", "담백한 독백형", "Understated monologue", "꾸밈없이 무게를 싣는"],
  ["drama", "드라마 더빙형", "Drama dubbing", "감정이 실린 대사가 자연스러운"],
  ["actor", "연기파 배우형", "Character actor", "높낮이로 인물을 만드는"],
];
const NO_PACE_EN: Record<string, string> = {
  calm: "Plain, with weight",
  drama: "Lines that carry real feeling",
  actor: "Builds a character with pitch",
};

/**
 * 속도 3칸 × 억양 폭 3칸 = 9가지 기본 타입에, 목소리 높이·쉼·말끝으로 특별 타입이 덮인다.
 * 잰 값에서만 나온다 — 근거를 같이 보여 줘서 "랜덤 운세"가 아니게 한다.
 * 성별을 가정하지 않는다 — 음높이(Hz)만 본다.
 */
export function voiceTypeOf(a: Analysis | null, L: T = tr("ko")): VoiceType | null {
  if (!a || a.pitchRange === null) return null;
  const hz = a.pitchHz ?? 0;
  const low = hz > 0 && hz < 125;
  const high = hz > 240;
  const range = lv(a.pitchRange, 5.5, 10);
  const pace = a.pace !== null ? lv(a.pace, 3.9, 5.3) : null;
  const perMin = a.span > 5 ? (a.pauses / a.span) * 60 : 0;
  const strongEnd = a.endDrop !== null && a.endDrop > -2;

  let pick: [string, string, string, string];
  let en: string;
  // 특별 타입 — 조건이 뚜렷할 때만
  if (low && pace !== null && pace <= 1 && range <= 1) {
    pick = ["trailer", "영화 예고편 성우형", "Movie-trailer voice", "한마디로 분위기를 까는 묵직함"];
    en = "Sets the mood in one line";
  } else if (high && range === 2 && pace !== null && pace >= 1) {
    pick = ["anime", "애니 캐릭터 성우형", "Anime character voice", "통통 튀는 표정이 들리는"];
    en = "You can hear the expression bounce";
  } else if (high && range >= 1 && pace === 1) {
    pick = ["kids", "키즈 채널 진행자형", "Kids-show host", "밝고 다정하게 끌어 주는"];
    en = "Bright and friendly, leads the way";
  } else if (pace === 0 && range === 2 && perMin >= 14) {
    pick = ["poem", "시 낭송형", "Poetry reader", "쉼 하나까지 음악처럼 쓰는"];
    en = "Uses every pause like music";
  } else if (pace === 2 && range === 2 && strongEnd) {
    pick = ["sports", "스포츠 캐스터형", "Sports caster", "끝까지 힘이 안 빠지는 현장감"];
    en = "Live energy right to the last word";
  } else if (pace === null) {
    pick = NO_PACE[range];
    en = NO_PACE_EN[pick[0]];
  } else {
    pick = GRID[pace][range];
    en = GRID_EN[pick[0]];
  }
  const [id, ko, enName, desc] = pick;
  // 특별 타입은 이미 높이를 담고 있다 — 기본 타입에만 높이 수식어를 붙인다.
  const special = ["trailer", "anime", "kids"].includes(id);
  const tone = special ? "" : low ? L("낮고 묵직한 ", "Deep ") : high ? L("맑고 높은 ", "Bright ") : "";

  const bits: string[] = [];
  if (a.pace !== null) bits.push(L(`속도 ${a.pace.toFixed(1)}음절/초`, `${a.pace.toFixed(1)} syl/s`));
  bits.push(L(`억양 폭 ${a.pitchRange.toFixed(1)}반음`, `${a.pitchRange.toFixed(1)} st range`));
  if (hz) bits.push(`${Math.round(hz)}Hz`);
  return { id, name: tone + L(ko, enName), desc: L(desc, en), why: bits.join(" · ") };
}
