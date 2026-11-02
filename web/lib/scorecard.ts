import type { Analysis, Phrase } from "./voice-analysis";
import { tr, type T } from "./i18n";

/**
 * 심사표 — 출전·연습 직후 "내 목소리를 보여 주는" 화면의 계산부.
 *
 * 예전 심사위원 한 줄 평은 미리 써 둔 문장 조합이라 내 녹음과 상관없게 들렸다. 여기서는
 * 전부 이 녹음에서 잰 값으로만 말한다(LLM·서버 없음, 비용 0):
 *   - 마디마다 높낮이 선 + 그 마디에 해당하는 대본 글자
 *   - 가장 아쉬운 한 곳(말끝 처짐 · 평평함) → 그 부분만 다시 녹음
 *   - 목소리 타입(속도 × 억양 폭 × 음높이) — 공유용
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

export type VoiceType = { id: string; name: string; why: string };

/**
 * 속도(빠름/느림) × 억양 폭(넓음/좁음) 네 칸 + 음높이 수식어.
 * 잰 값에서만 나온다 — 근거를 같이 보여 줘서 "랜덤"이 아니게 한다.
 */
export function voiceTypeOf(a: Analysis | null, L: T = tr("ko")): VoiceType | null {
  if (!a || a.pitchRange === null) return null;
  const wide = a.pitchRange >= 7;
  const fast = a.pace !== null ? a.pace >= 5.6 : null;
  const hz = a.pitchHz ?? 0;
  // 성별을 가정하지 않는다 — 음높이만으로 "낮은/높은"을 붙인다(가운데는 생략).
  const tone = hz && hz < 125 ? L("낮고 묵직한 ", "Deep ") : hz > 240 ? L("맑고 높은 ", "Bright ") : "";
  let id: string;
  let name: string;
  if (fast === null) {
    id = wide ? "actor" : "calm";
    name = wide ? L("연기파 배우형", "Character actor") : L("담백한 독백형", "Understated monologue");
  } else if (fast && wide) {
    id = "ad";
    name = L("광고 성우형", "Commercial voice");
  } else if (fast) {
    id = "anchor";
    name = L("뉴스 앵커형", "News anchor");
  } else if (wide) {
    id = "story";
    name = L("오디오북 낭독형", "Audiobook narrator");
  } else {
    id = "docu";
    name = L("다큐 내레이터형", "Documentary narrator");
  }
  const bits: string[] = [];
  if (a.pace !== null) bits.push(L(`속도 ${a.pace.toFixed(1)}음절/초`, `${a.pace.toFixed(1)} syl/s`));
  bits.push(L(`억양 폭 ${a.pitchRange.toFixed(1)}반음`, `${a.pitchRange.toFixed(1)} st range`));
  if (hz) bits.push(`${Math.round(hz)}Hz`);
  return { id, name: tone + name, why: bits.join(" · ") };
}
