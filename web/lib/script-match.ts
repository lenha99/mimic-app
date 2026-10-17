/**
 * 대본 ↔ 받아쓴 글자 비교 — "대본대로 읽었나".
 *
 * 받아쓰기(Whisper)는 소리를 그럴듯한 문장으로 옮긴다. 그래서 발음이 살짝 뭉개진 건
 * 못 잡고, 빠뜨린 말 · 바꾼 말 · 덧붙인 말을 잡는다. 화면도 딱 그 셋만 말한다.
 *
 * 비교는 음절 단위다. 띄어쓰기는 받아쓰기마다 제멋대로라 어절로 맞추면 멀쩡한
 * 문장도 틀린 것처럼 나온다. 음절로 줄을 세운 뒤(편집 거리) 대본 어절에 되돌려 붙인다.
 *
 * 읽는 소리가 같으면 같은 글자로 본다:
 *  - 숫자 — 대본은 "삼 분기", 받아쓰기는 "3분기". 숫자는 읽는 대로 한글로 바꾼다.
 *    "두 시"처럼 고유어로 읽는 단위는 따로 안다. 그래도 못 맞춘 숫자(투 아웃 → 2아웃)는
 *    틀렸다고 하지 않는다 — 사람이 틀린 게 아니라 우리가 못 읽은 것이다.
 *  - ㅐ/ㅔ — 요즘 말소리에선 구분이 없다("네가" = "내가"). 받아쓰기는 아무거나 고른다.
 */

export type WordStatus = "ok" | "missed" | "changed";

export type WordResult = {
  /** 대본 어절 순번 (쉼·강조 표시를 뺀 어절 기준, 0부터) */
  index: number;
  word: string;
  status: WordStatus;
  /** changed 일 때 들린 말 */
  heard?: string;
};

export type Added = { /** 이 어절 뒤에 덧붙였다 (-1 이면 맨 앞) */ after: number; text: string };

export type MatchResult = {
  words: WordResult[];
  added: Added[];
  /** 대본 음절 중 맞게 읽은 비율 0~1 */
  accuracy: number;
  missed: number;
  changed: number;
};

/** 대본 표기("/", "*")를 빼고 어절로 자른다. 화면(ScriptText)도 같은 규칙으로 센다. */
export function scriptWords(text: string): string[] {
  return text
    .replace(/[/*]/g, " ")
    .split(/\s+/)
    .filter((w) => /[가-힣0-9]/.test(w));
}

const SINO = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];

function sinoInt(n: number): string {
  if (n === 0) return "영";
  const units: [number, string][] = [
    [1_0000_0000, "억"],
    [1_0000, "만"],
    [1000, "천"],
    [100, "백"],
    [10, "십"],
  ];
  let out = "";
  let rest = n;
  for (const [u, name] of units) {
    const q = Math.floor(rest / u);
    if (q > 0) {
      // 만·억 앞은 여러 자리일 수 있다(삼십만). 천·백·십 앞의 1 은 읽지 않는다(천, 백, 십).
      out += (u >= 1_0000 ? sinoInt(q) : q === 1 ? "" : SINO[q]) + name;
      rest %= u;
    }
  }
  return out + SINO[rest];
}

const NATIVE_ONES = ["", "한", "두", "세", "네", "다섯", "여섯", "일곱", "여덟", "아홉"];
const NATIVE_TENS = ["", "열", "스물", "서른", "마흔", "쉰", "예순", "일흔", "여든", "아흔"];

function nativeInt(n: number): string | null {
  if (n <= 0 || n >= 100) return null;
  const t = Math.floor(n / 10);
  const o = n % 10;
  if (t === 2 && o === 0) return "스무";
  return NATIVE_TENS[t] + NATIVE_ONES[o];
}

/** 고유어로 세는 단위 — 숫자 바로 뒤에 오면 "두 시", "세 명"으로 읽는다. */
const NATIVE_COUNTERS = /^(시|명|개|살|마리|번|잔|달|사람|가지|권|병|장|채|켤레|닢)/;

const UNIT_WORDS: [RegExp, string][] = [
  [/%/g, "퍼센트"],
  [/km/gi, "킬로미터"],
  [/cm/gi, "센티미터"],
  [/mm/gi, "밀리미터"],
  [/m(?![a-z])/gi, "미터"],
  [/kg/gi, "킬로그램"],
  [/℃|°C/g, "도"],
];

/** c: 비교용 음절, num: 숫자에서 바꾼 음절, show: 화면에 "들린 말"로 보일 글자 */
const NUMBER_SYLLABLES = new Set(
  [..."영일이삼사오육륙칠팔구십백천만억점한두세네다섯여일곱덟아홉열스물무서른마흔쉰예순흔여든아흔"].map(fold),
);

type Ch = { c: string; num: boolean; show: string; /** 같은 숫자에서 나온 음절끼리 같은 값 */ id: number };

/**
 * 받아쓴 글자를 읽는 소리 기준 음절 열로.
 * 숫자는 한자어("삼")와 고유어("세") 중 대본에 실제로 있는 쪽으로 읽는다.
 */
function heardSyllables(raw: string, script: string): Ch[] {
  let s = raw.replace(/(\d),(?=\d{3})/g, "$1");
  for (const [re, w] of UNIT_WORDS) s = s.replace(re, w);
  const out: Ch[] = [];
  const re = /(\d+(?:\.\d+)?)|([가-힣])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m[2]) {
      out.push({ c: m[2], num: false, show: m[2], id: -1 });
      continue;
    }
    const [intPart, frac] = m[1].split(".");
    const n = Number(intPart);
    const next = s.slice(m.index + m[1].length).trimStart();
    const native = frac ? null : nativeInt(n);
    let reading =
      native && (NATIVE_COUNTERS.test(next) || script.includes(native)) && !script.includes(sinoInt(n))
        ? native
        : null;
    if (!reading) {
      reading = sinoInt(n);
      if (frac) reading += "점" + [...frac].map((d) => (d === "0" ? "영" : SINO[Number(d)])).join("");
    }
    // 숫자 하나가 음절 여럿이 된다. 화면에는 원래 숫자("2.4")를 한 번만 보인다(id 로 묶는다).
    for (const c of reading) out.push({ c, num: true, show: m[1], id: m.index });
  }
  return out;
}

/** ㅐ→ㅔ, ㅒ→ㅖ, ㅙ·ㅞ→ㅚ 로 접는다. 소리가 같은 것끼리 같은 글자가 되게. */
function fold(c: string): string {
  const code = c.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return c;
  const lead = Math.floor(code / 588);
  let vowel = Math.floor((code % 588) / 28);
  const tail = code % 28;
  const map: Record<number, number> = { 1: 5, 3: 7, 10: 11, 15: 11 };
  vowel = map[vowel] ?? vowel;
  return String.fromCharCode(0xac00 + lead * 588 + vowel * 28 + tail);
}

export function matchScript(script: string, heardText: string): MatchResult {
  const words = scriptWords(script);
  const flat = words.join("");
  // 대본 음절 → 어절 번호
  const ref: { c: string; w: number }[] = [];
  words.forEach((w, i) => {
    for (const c of w) if (/[가-힣]/.test(c)) ref.push({ c: fold(c), w: i });
  });
  const hyp = heardSyllables(heardText, flat).map((h) => ({ ...h, c: fold(h.c) }));

  // 편집 거리 정렬. 같으면 0, 바꿈 1, 빠뜨림·덧붙임 1.
  // 뒤집은 열로 정렬한다 — 되짚기가 끝에서부터 짝을 지으니, 뒤집어 두면 같은 말이
  // 반복될 때("알아. 다 알아.") 앞쪽 것과 짝지어지고 빠뜨린 건 뒤쪽 것이 된다.
  const R = [...ref].reverse();
  const H = [...hyp].reverse();
  const n = ref.length;
  const m = hyp.length;
  const W = m + 1;
  const d = new Uint16Array((n + 1) * W);
  for (let i = 0; i <= n; i += 1) d[i * W] = i;
  for (let j = 0; j <= m; j += 1) d[j] = j;
  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      const same = R[i - 1].c === H[j - 1].c;
      d[i * W + j] = Math.min(
        d[(i - 1) * W + (j - 1)] + (same ? 0 : 1),
        d[(i - 1) * W + j] + 1,
        d[i * W + (j - 1)] + 1,
      );
    }
  }

  // 되짚기 — 대본 음절마다 무엇과 짝지어졌는지.
  type Op = { kind: "eq" | "sub" | "del" | "ins"; i: number; j: number };
  const ops: Op[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const same = R[i - 1].c === H[j - 1].c;
      if (d[i * W + j] === d[(i - 1) * W + (j - 1)] + (same ? 0 : 1)) {
        ops.push({ kind: same ? "eq" : "sub", i: n - i, j: m - j });
        i -= 1;
        j -= 1;
        continue;
      }
    }
    if (i > 0 && d[i * W + j] === d[(i - 1) * W + j] + 1) {
      ops.push({ kind: "del", i: n - i, j: m - j });
      i -= 1;
      continue;
    }
    ops.push({ kind: "ins", i: n - i, j: m - j });
    j -= 1;
  }

  // 어절별로 모은다.
  const per = words.map(() => ({ eq: 0, sub: 0, del: 0, num: false, heard: "", off: "", lastId: -2 }));
  const hear = (p: (typeof per)[number], h: Ch) => {
    if (h.id >= 0 && h.id === p.lastId) return;
    p.lastId = h.id;
    p.heard += h.show;
  };
  const added: Added[] = [];
  let lastWord = -1;
  let pendingIns = "";
  let pendingNum = false;
  let pendingId = -2;
  const flushIns = () => {
    if (pendingIns.length >= 2 && !pendingNum) added.push({ after: lastWord, text: pendingIns });
    pendingIns = "";
    pendingNum = false;
  };
  for (const op of ops) {
    if (op.kind === "ins") {
      const h = hyp[op.j];
      // 어절 안쪽에 끼어든 글자는 그 어절의 "들린 말"에 붙인다.
      const inside = lastWord >= 0 && op.i < n && ref[op.i]?.w === lastWord;
      if (inside) {
        hear(per[lastWord], h);
        per[lastWord].sub += 1;
        per[lastWord].num ||= h.num;
      } else {
        pendingIns += h.id >= 0 && h.id === pendingId ? "" : h.show;
        pendingId = h.id;
        pendingNum ||= h.num;
      }
      continue;
    }
    const w = ref[op.i].w;
    if (w !== lastWord) {
      flushIns();
      lastWord = w;
    }
    const p = per[w];
    if (op.kind === "eq") {
      p.eq += 1;
      hear(p, hyp[op.j]);
      p.num ||= hyp[op.j].num;
    } else if (op.kind === "sub") {
      p.sub += 1;
      p.off += ref[op.i].c;
      hear(p, hyp[op.j]);
      p.num ||= hyp[op.j].num;
    } else {
      p.del += 1;
      p.off += ref[op.i].c;
    }
  }
  flushIns();

  let good = 0;
  let missed = 0;
  let changed = 0;
  const results: WordResult[] = words.map((word, index) => {
    const p = per[index];
    const syl = [...word].filter((c) => /[가-힣]/.test(c)).length;
    let status: WordStatus;
    if (p.sub === 0 && p.del === 0) status = "ok";
    // 숫자를 우리가 못 읽은 경우만 봐준다("투 아웃" ↔ "2아웃"). 대본 쪽 어긋난 음절이
    // 전부 숫자 말이면("이 점 일" ↔ "2.4") 사람이 숫자를 틀린 것이다 — 아나운서에겐 그게 제일 크다.
    else if (p.num && [...p.off].some((c) => !NUMBER_SYLLABLES.has(c))) status = "ok";
    else if (p.eq === 0 && p.sub === 0) status = "missed";
    else if (p.del >= syl * 0.6 && p.sub === 0) status = "missed";
    else status = "changed";
    if (status === "ok") good += syl;
    else if (status === "missed") missed += 1;
    else {
      changed += 1;
      good += Math.max(0, p.eq - p.sub);
    }
    return status === "changed"
      ? { index, word, status, heard: p.heard.replace(/\s+/g, "") }
      : { index, word, status };
  });

  const totalSyl = ref.length || 1;
  return { words: results, added, accuracy: Math.min(1, good / totalSyl), missed, changed };
}
