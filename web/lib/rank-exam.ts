import type { Analysis } from "./voice-analysis";

/**
 * 승급전(11/28) — XP 를 채운 뒤 코코 심사위원의 미션을 깨야 레벨이 오른다.
 *
 * 규민: "레벨이 너무 쉽게 오른다 · 게임처럼". 그래서 보스전처럼 만든다 — 라운드마다 미션 카드 한 장,
 * 하트 2개(실수는 한 번까지)가 다 떨어지면 탈락, 하루 기회는 3번(떨어지면 내일 다시 — 돌아올 이유).
 * 채점은 브라우저 측정(lib/voice-analysis)만 쓴다. 서버·받아쓰기 비용 0.
 * 기준값은 목소리 타입 경계(lib/scorecard: 속도 3.9~5.3음절/초 · 억양 폭 5.5~10반음)에서 잡았다.
 */
export const EXAM_TRIES_PER_DAY = 3;

export type Grade = "perfect" | "good" | "miss";

export type MissionId = "steady" | "emotion" | "breath" | "strong" | "rapid" | "calm" | "shout";

export type Mission = {
  id: MissionId;
  icon: string;
  ko: string;
  en: string;
  /** 이 레벨부터 나온다 */
  from: number;
  lines: string[];
  unit: { ko: string; en: string };
  /** 게이지 양 끝 */
  axis: [number, number];
  /** 통과 구간과 만점 구간 — 난이도 d(0~1)에 따라 좁아진다 */
  band: (d: number) => { pass: [number, number]; perfect: [number, number] };
  measure: (a: Analysis) => number | null;
  goal: (d: number) => { ko: string; en: string };
};

const f1 = (x: number) => x.toFixed(1);

export const MISSIONS: Mission[] = [
  {
    id: "steady",
    icon: "🎯",
    ko: "또박또박",
    en: "Steady pace",
    from: 2,
    lines: ["지금부터 코코 심사위원의 승급 심사를 시작하겠습니다.", "오늘의 날씨는 맑고 오후에는 바람이 조금 불겠습니다.", "천천히 그리고 또박또박 한 글자씩 읽어 보겠습니다."],
    unit: { ko: "음절/초", en: "syl/s" },
    axis: [2, 8],
    band: (d) => {
      const hw = 1.1 - 0.5 * d;
      return { pass: [4.6 - hw, 4.6 + hw], perfect: [4.6 - hw / 2, 4.6 + hw / 2] };
    },
    measure: (a) => a.pace,
    goal: (d) => {
      const hw = 1.1 - 0.5 * d;
      return { ko: `초당 ${f1(4.6 - hw)}~${f1(4.6 + hw)}음절로`, en: `${f1(4.6 - hw)}–${f1(4.6 + hw)} syllables per second` };
    },
  },
  {
    id: "emotion",
    icon: "🔥",
    ko: "감정 폭발",
    en: "Big emotion",
    from: 2,
    lines: ["말도 안 돼! 진짜 내가 합격이라고?", "제발, 한 번만 더 기회를 주세요!", "우와, 이건 정말 최고의 순간이야!"],
    unit: { ko: "반음", en: "st" },
    axis: [0, 16],
    band: (d) => {
      const t = 6 + 4 * d;
      return { pass: [t, 99], perfect: [t + 2.5, 99] };
    },
    measure: (a) => a.pitchRange,
    goal: (d) => ({ ko: `억양 폭 ${f1(6 + 4 * d)}반음 이상 — 높낮이를 크게`, en: `Pitch range ≥ ${f1(6 + 4 * d)} semitones` }),
  },
  {
    id: "breath",
    icon: "🫁",
    ko: "한 호흡",
    en: "One breath",
    from: 2,
    lines: ["숨 한 번에 끝까지 읽어야 이번 라운드를 통과할 수 있습니다.", "목소리를 끊지 않고 마지막 글자까지 부드럽게 이어서 읽어 보세요."],
    unit: { ko: "초 (가장 긴 쉼)", en: "s longest pause" },
    axis: [0, 1.5],
    band: (d) => {
      const t = 0.8 - 0.35 * d;
      return { pass: [0, t], perfect: [0, t / 2] };
    },
    measure: (a) => a.longestPause,
    goal: (d) => ({ ko: `${f1(0.8 - 0.35 * d)}초 넘게 쉬지 않고 끝까지`, en: `No pause longer than ${f1(0.8 - 0.35 * d)}s` }),
  },
  {
    id: "strong",
    icon: "💪",
    ko: "끝까지 힘있게",
    en: "Strong finish",
    from: 3,
    lines: ["나는 반드시 끝까지 해낸다.", "이 무대의 주인공은 바로 나야.", "포기하지 않으면 결국 이긴다."],
    unit: { ko: "dB (끝 처짐)", en: "dB end drop" },
    axis: [-14, 4],
    band: (d) => {
      const t = -5 + 3 * d;
      return { pass: [t, 99], perfect: [t + 2, 99] };
    },
    measure: (a) => a.endDrop,
    goal: (d) => ({ ko: `문장 끝이 ${f1(5 - 3 * d)}dB 넘게 처지지 않게`, en: `Don't let the ending drop more than ${f1(5 - 3 * d)} dB` }),
  },
  {
    id: "calm",
    icon: "🌙",
    ko: "차분하게",
    en: "Stay calm",
    from: 4,
    lines: ["괜찮아요. 천천히, 숨 한번 쉬고 시작해요.", "지금 이 순간, 마음을 차분하게 가라앉혀 봅니다."],
    unit: { ko: "반음", en: "st" },
    axis: [0, 16],
    band: (d) => {
      const t = 6.5 - 1.5 * d;
      return { pass: [1, t], perfect: [1, t - 1.5] };
    },
    measure: (a) => a.pitchRange,
    goal: (d) => ({ ko: `억양 폭 ${f1(6.5 - 1.5 * d)}반음 이하 — 아나운서처럼 고르게`, en: `Pitch range ≤ ${f1(6.5 - 1.5 * d)} st — even like an announcer` }),
  },
  {
    id: "rapid",
    icon: "⚡",
    ko: "속사포",
    en: "Rapid fire",
    from: 5,
    lines: ["간장 공장 공장장은 강 공장장이고 된장 공장 공장장은 장 공장장이다.", "내가 그린 기린 그림은 잘 그린 기린 그림이다."],
    unit: { ko: "음절/초", en: "syl/s" },
    axis: [2, 9],
    band: (d) => {
      const t = 5.6 + 0.8 * d;
      return { pass: [t, 99], perfect: [t + 0.6, 99] };
    },
    measure: (a) => a.pace,
    goal: (d) => ({ ko: `초당 ${f1(5.6 + 0.8 * d)}음절 이상 — 빠르게!`, en: `≥ ${f1(5.6 + 0.8 * d)} syllables per second` }),
  },
  {
    id: "shout",
    icon: "📣",
    ko: "기합",
    en: "Battle cry",
    from: 3,
    lines: ["파이팅!", "가자아아!", "할 수 있다!"],
    unit: { ko: "dB (가장 큰 소리)", en: "dB peak" },
    axis: [-30, 0],
    band: (d) => {
      const t = -12 + 3 * d;
      return { pass: [t, 99], perfect: [t + 4, 99] };
    },
    measure: (a) => a.peakDb,
    goal: () => ({ ko: "있는 힘껏 크게 외치기", en: "Shout it as loud as you can" }),
  },
];

/** 레벨별 판 — 라운드 수 · 하트 · 난이도 */
export function examPlan(level: number): { rounds: number; hearts: number; d: number } {
  const d = Math.min(1, Math.max(0, (level - 2) / 8));
  // 하트는 늘 2개 — 실수는 한 번까지. 레벨이 오를수록 라운드가 늘고 기준이 좁아진다.
  if (level <= 3) return { rounds: 3, hearts: 2, d };
  if (level <= 6) return { rounds: 4, hearts: 2, d };
  return { rounds: 5, hearts: 2, d };
}

export type Round = { mission: Mission; line: string };

/** 이번 판 라운드 — 레벨에 열린 미션을 섞어서. 같은 미션은 한 판에 한 번(모자라면 다시). */
export function rollRounds(level: number, rand: () => number = Math.random): Round[] {
  const { rounds } = examPlan(level);
  const pool = MISSIONS.filter((m) => m.from <= level);
  const order: Mission[] = [];
  while (order.length < rounds) {
    const bag = [...pool].sort(() => rand() - 0.5);
    order.push(...bag);
  }
  return order.slice(0, rounds).map((m) => ({ mission: m, line: m.lines[Math.floor(rand() * m.lines.length)] }));
}

export function syllables(line: string): number {
  return (line.match(/[가-힣]/g) ?? []).length;
}

/** 측정이 안 됐으면 null — 하트를 잃지 않고 다시 읽게 한다 */
export function judge(m: Mission, a: Analysis, d: number): { grade: Grade; value: number } | null {
  if (a.span < 0.3) return null;
  const v = m.measure(a);
  if (v === null || !Number.isFinite(v)) return null;
  const { pass, perfect } = m.band(d);
  const inside = (r: [number, number]) => v >= r[0] && v <= r[1];
  return { grade: inside(perfect) ? "perfect" : inside(pass) ? "good" : "miss", value: v };
}
