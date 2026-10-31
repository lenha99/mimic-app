import type { Analysis } from "./voice-analysis";

/**
 * AI 심사위원 — 출전하자마자 돌아오는 첫 반응.
 *
 * 사람이 적을 땐 올려도 아무 반응이 없다. 그 빈자리를 캐릭터가 채운다. 모델을 부르지
 * 않는다(비용 0): 캐릭터마다 첫마디 · 녹음 특징에 맞춘 한 줄 · 마무리를 조합하고, 이
 * 기기에서 최근에 나온 문장은 다시 안 쓴다. 조합이 수천 가지라 매번 다르게 들린다.
 *
 * 원칙: 보상이 먼저다. 독설도 수행만 놀리고 끝은 칭찬으로 닫는다. 외모·정체성은 안 건드린다.
 */

export type JudgeId = "hamster" | "pd" | "fan" | "intern" | "cat";

export type Judge = {
  id: JudgeId;
  emoji: string;
  name: [string, string];
  hidden?: boolean;
};

export type Verdict = { judge: Judge; line: string };

type Trait = "wide" | "calm" | "fast" | "slow" | "ending" | "loud" | "plain";
type Ctx = "dawn" | "morning" | "night" | "first" | "podium" | "replaced" | "none";

export const JUDGES: Record<JudgeId, Judge> = {
  hamster: { id: "hamster", emoji: "🐹", name: ["볼따구", "Cheeks"] },
  pd: { id: "pd", emoji: "🧐", name: ["독설 PD", "Savage PD"] },
  fan: { id: "fan", emoji: "😳", name: ["과몰입 팬", "Obsessed Fan"] },
  intern: { id: "intern", emoji: "🧑‍💼", name: ["MZ 인턴", "Gen-Z Intern"] },
  cat: { id: "cat", emoji: "🐈", name: ["냥심사관", "Judge Meow"], hidden: true },
};

type Pool = { open: string[]; trait: Record<Trait, string[]>; ctx: Partial<Record<Ctx, string[]>>; close: string[] };

const KO: Record<Exclude<JudgeId, "cat">, Pool> = {
  hamster: {
    open: ["헉…", "잠깐만요 🥺", "와아아아", "어머어머", "히잉…", "(볼 빵빵)"],
    trait: {
      wide: ["목소리가 롤러코스터처럼 올라갔다 내려갔다 해서 제 볼이 빵빵해졌어요 🐹", "억양이 통통 튀어서 저도 같이 쳇바퀴 돌았어요!"],
      calm: ["차분한 목소리 듣다가 해바라기씨 까던 손이 멈췄어요…", "포근해서 톱밥 속에 파묻힌 기분이에요 🥺"],
      fast: ["말이 제 쳇바퀴보다 빨라요!! 근데 다 들려요, 신기해요", "속도가 슝슝인데 또박또박이에요… 어떻게 한 거예요?"],
      slow: ["한 글자 한 글자 꼭꼭 씹어 말해줘서 너무 다정해요", "천천히 말해줘서 제가 다 받아 적었어요 ✍️"],
      ending: ["문장 끝까지 힘이 살아 있어요! 끝맺음 장인 인정 🏅", "마지막 말이 쏙 들어와서 볼주머니에 넣었어요"],
      loud: ["목소리가 또랑또랑해서 귀가 쫑긋 섰어요", "자신감이 꽉 차 있어서 제가 다 든든해요"],
      plain: ["목소리가 말랑말랑해서 계속 듣고 싶어요", "이 목소리는 해바라기씨 100개 값이에요"],
    },
    ctx: {
      dawn: ["이 새벽에… 저 원래 야행성인데 덕분에 더 깼어요"],
      morning: ["아침부터 이런 목소리라니, 오늘 운수 좋은 날이에요"],
      night: ["자기 전에 이거 듣고 잘래요 🌙"],
      first: ["첫 번째 목소리예요! 제가 제일 먼저 들었어요 히히"],
      podium: ["벌써 시상대예요?! 볼 터질 것 같아요"],
      replaced: ["새 버전이 더 좋아요! 다시 해준 거 너무 멋져요"],
    },
    close: ["볼따구 점수: 해바라기씨 💯개", "책임지세요… 귀가 녹았어요 🫠", "볼주머니에 저장 완료 🐹", "또 올려줘요 약속 🤙"],
  },
  pd: {
    open: ["음.", "솔직히 말할게요.", "PD 생활 20년 차로서 말하는데,", "녹음 버튼 누를 때 각오는 했죠?", "(안경 고쳐 씀)"],
    trait: {
      wide: ["억양이 너무 살아 있어서 대본이 놀랐겠네요. …근데 그게 맞아요.", "감정 기복이 거의 아침 드라마예요. 시청률은 나오겠네."],
      calm: ["처음엔 졸린 줄 알았는데 계속 듣게 되네? 이게 저음의 힘이죠.", "흥분 안 하고 끝까지 가는 거, 프로들도 잘 못 해요."],
      fast: ["속도가 KTX예요. 정차역 좀 만들어 주세요. …근데 발음은 안 무너졌네? 쳇.", "숨은 언제 쉬었어요? 폐활량은 합격."],
      slow: ["여유가 넘치네요. 제 혈압은 올라가는데 귀는 편안합니다.", "느린데 지루하진 않아요. 이게 어려운 거예요."],
      ending: ["아마추어는 문장 끝을 버려요. 근데 이분은 끝까지 챙겼네요. 거슬릴 정도로 잘함.", "끝처리 보고 녹음실 문 닫을 뻔했어요. 칭찬입니다."],
      loud: ["마이크가 살짝 겁먹었어요. 자신감 하나는 방송국 급.", "볼륨 미터가 춤을 추네요. 존재감은 합격."],
      plain: ["까려고 들었는데 깔 데가 없어서 화가 나네요.", "할 말 많았는데 듣고 나니 까먹었어요. 좋은 신호죠."],
    },
    ctx: {
      dawn: ["새벽 녹음은 원래 다 망하는데, 이건 예외로 해두죠."],
      first: ["첫 출전이라고 봐주는 거 없습니다. …없는데 잘했네."],
      podium: ["시상대요? 저는 인정 안 했는데 사람들이 했네요. 뭐, 인정."],
      replaced: ["다시 녹음해 온 집념, 그거 하나는 PD감입니다."],
    },
    close: ["다음 주에도 나오세요. 이건 명령입니다.", "제 기준 통과. 흔한 일 아닙니다.", "섭외 리스트에 적어 둡니다. 연필로요.", "점수는 말 안 해요. 대신 한 번 더 들었어요."],
  },
  fan: {
    open: ["잠깐만 숨 좀 쉬고요…", "아 미쳤다 미쳤다", "(3번째 다시 듣는 중)", "누가 이 목소리 주인 아는 사람?", "꺄아아악"],
    trait: {
      wide: ["감정선이 흔들리는데 제 마음도 같이 흔들렸어요… OST 언제 나와요?", "목소리 하나로 기승전결을 다 했어요. 영화 한 편 봄."],
      calm: ["이 저음 진짜 반칙이에요. 고막에 담요 덮어준 느낌…", "차분한데 설레요. 이거 무슨 원리예요?"],
      fast: ["랩하시는 줄… 따라 하다 혀 깨물었어요. 팬심으로 버팁니다", "말 빠른데 하나도 안 놓쳤어요. 저 이제 귀 좋아짐"],
      slow: ["한 마디 한 마디가 편지 같아요. 손편지로 답장 보내고 싶어요", "천천히 말하는 거 들으면서 같이 숨 쉬었어요…"],
      ending: ["마지막 글자 처리 듣고 소리 질렀어요 (진짜로)", "끝음에서 심장이 쿵 했어요. 책임져요"],
      loud: ["목소리에 자신감이 꽉 차서 제가 다 설레요", "스피커 볼륨 최대로 했다가 이웃한테 공유함"],
      plain: ["벨소리로 하고 싶어요. 알람으로도요. 그냥 다 하고 싶어요", "이 목소리 듣고 오늘 하루 버틸 수 있을 것 같아요"],
    },
    ctx: {
      dawn: ["새벽에 이런 거 올리시면 저 잠 못 자요 진짜로"],
      night: ["오늘 밤 수면 BGM 확정입니다"],
      first: ["제가 1호 청취자예요!! 나중에 유명해지면 기억해 주세요"],
      podium: ["역시 될 줄 알았어요. 제가 처음부터 말했잖아요(말 안 했음)"],
      replaced: ["새 버전 나왔다고요?! 둘 다 소장할게요"],
    },
    close: ["팬클럽 1호 회원 신청합니다 🙋", "팬카페 이름 제가 지어도 돼요?", "응원봉 사러 갑니다 💡", "이 목소리 지켜…"],
  },
  intern: {
    open: ["와 ㄹㅇ", "아니 잠만", "실화냐", "부장님 몰래 듣는 중인데", "헐 대박"],
    trait: {
      wide: ["텐션 폼 미쳤다… 억양이 거의 놀이기구임 🎢", "감정 표현 완전 찢었다 이건 못 참지"],
      calm: ["목소리 완전 갓생 사는 사람 같음. 차분 그 자체", "듣는데 마음에 평화가 옴… 퇴사 생각 사라짐"],
      fast: ["2배속 맞죠? 아니라고요? 와 ㄹㅇ 랩 재능", "말 속도 완전 업무 처리 속도 같음. 일잘러 냄새남"],
      slow: ["말 속도 완전 힐링 브이로그 감성임 🍵", "천천히 말하는데 오히려 집중됨. 신기방기"],
      ending: ["끝처리 깔끔 그 잡채", "마무리가 완전 칼퇴처럼 깔끔함 ✨"],
      loud: ["목소리 크기 ㄹㅇ 회의실 장악 가능", "발표 시키면 바로 승진각"],
      plain: ["귀호강 지렸다… 점심시간에 또 들을 예정", "이거 듣고 일하니까 능률 200% 오름 (아님)"],
    },
    ctx: {
      dawn: ["새벽 감성 미쳤다… 내일 출근인데 큰일남"],
      morning: ["출근길에 들었으면 지각 안 했을 듯"],
      night: ["야근하면서 듣는 중… 이거면 버틴다"],
      first: ["첫 타자 ㄷㄷ 용기 리스펙"],
      podium: ["벌써 시상대?? 성공한 사람 냄새남"],
      replaced: ["재녹음까지?? 완벽주의 폼 미쳤다"],
    },
    close: ["보고서에 '귀호강'이라고 적었다가 혼남", "퇴근길 플리 추가 완료 ✅", "단톡방에 몰래 공유함 (농담임 아마도)", "오늘 일 안 하고 이것만 들을 듯"],
  },
};

/** 냥심사관 — 좋으면 귀엽게, 그저 그러면 새침하게. 둘 다 결국은 칭찬이다. */
const CAT_GOOD = [
  "냥! 냐앙~ 💕 (번역: 고막 남친/여친 인정)",
  "골골골골… (기분 좋은 소리) …꾹꾹이 해드릴게냥 🐾",
  "츄르 하나 드립니다냥 🍬 이건 아무한테나 안 줘냥",
  "(배 보여줌) …특별히 만져도 된다냥 😽",
  "냥냥냥! 꼬리가 저절로 흔들린다냥 💫",
  "이 목소리 옆에서 낮잠 자고 싶다냥… 💤",
];
const CAT_COOL = [
  "흥. …한 번 더 들어줄 수도 있다냥 😼",
  "나쁘지 않다냥. 박스 다음으로 좋다냥 📦",
  "(귀 쫑긋) …방금 거 다시 틀어봐라냥",
  "츄르 반 개 드립니다냥. 다음엔 한 개 노려라냥 🍬",
];

const EN: Record<Exclude<JudgeId, "cat">, string[]> = {
  hamster: ["Ahh 🥺 your voice is so squishy I stuffed it in my cheek pouch!", "My wheel stopped spinning just to listen. Do it again 🐹", "Sunflower seeds: 💯 out of 💯. My ears melted 🫠"],
  pd: ["I came here to roast you and found nothing. I'm furious.", "Twenty years in radio. This one passes. That's rare.", "Not bad. Fine — good. Come back next week, that's an order."],
  fan: ["I'm on my 3rd replay. Where do I join the fan club? 🙋", "Making this my ringtone. And my alarm. And my everything.", "Buying a lightstick right now 💡 protect this voice"],
  intern: ["ngl this slaps. listening on my lunch break again", "added to my commute playlist ✅ no notes", "my manager caught me replaying this. worth it"],
};
const CAT_EN_GOOD = ["Meow! Mrrp~ 💕 (translation: certified ear candy)", "Purrrr… here, have a churu 🍬", "(shows belly) …you may pet me. this once 😽"];
const CAT_EN_COOL = ["Hmph. …I might listen again 😼", "Not bad. Second only to boxes 📦"];

function traitsOf(a: Analysis | null): Trait[] {
  if (!a) return ["plain"];
  const out: Trait[] = [];
  if (a.pitchRange !== null && a.pitchRange >= 7) out.push("wide");
  if (a.pitchRange !== null && a.pitchRange < 4) out.push("calm");
  if (a.pace !== null && a.pace > 6) out.push("fast");
  if (a.pace !== null && a.pace < 3.6) out.push("slow");
  if (a.endDrop !== null && a.endDrop > -4) out.push("ending");
  if (a.peakDb > -6 && !a.clipped) out.push("loud");
  return out.length ? out : ["plain"];
}

function ctxOf(at: number, opts: { first: boolean; podium: boolean; replaced: boolean }): Ctx[] {
  const h = new Date(at).getHours();
  const out: Ctx[] = [];
  if (opts.first) out.push("first");
  if (opts.podium) out.push("podium");
  if (opts.replaced) out.push("replaced");
  if (h < 5) out.push("dawn");
  else if (h < 10) out.push("morning");
  else if (h >= 22) out.push("night");
  return out.length ? out : ["none"];
}

// 이 기기에서 최근 나온 문장은 다시 안 쓴다.
const SEEN_KEY = "mimic.judges.seen";
function readSeen(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}
function writeSeen(list: string[]) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(list.slice(-60)));
  } catch {}
}

function pickFresh(pool: string[], seen: Set<string>, rnd: () => number): string {
  const fresh = pool.filter((s) => !seen.has(s));
  const from = fresh.length ? fresh : pool;
  const s = from[Math.floor(rnd() * from.length)];
  seen.add(s);
  return s;
}

function shuffle<T>(xs: T[], rnd: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 심사위원 두 명의 한 줄 평. 5% 확률로 한 자리에 히든 냥심사관이 앉는다.
 */
export function judgeTake(
  analysis: Analysis | null,
  opts: { lang?: "ko" | "en"; at?: number; first?: boolean; podium?: boolean; replaced?: boolean; rnd?: () => number } = {},
): Verdict[] {
  const rnd = opts.rnd ?? Math.random;
  const lang = opts.lang ?? "ko";
  const seenList = readSeen();
  const seen = new Set(seenList);
  const traits = traitsOf(analysis);
  const good = !traits.includes("plain");
  const ctxs = ctxOf(opts.at ?? Date.now(), { first: !!opts.first, podium: !!opts.podium, replaced: !!opts.replaced });

  const ids = shuffle<Exclude<JudgeId, "cat">>(["hamster", "pd", "fan", "intern"], rnd).slice(0, 2) as JudgeId[];
  if (rnd() < 0.05) ids[1] = "cat";

  const usedTraits = new Set<Trait>();
  const out: Verdict[] = ids.map((id, i) => {
    const judge = JUDGES[id];
    if (id === "cat") {
      const pool = lang === "en" ? (good ? CAT_EN_GOOD : CAT_EN_COOL) : good ? CAT_GOOD : CAT_COOL;
      return { judge, line: pickFresh(pool, seen, rnd) };
    }
    if (lang === "en") return { judge, line: pickFresh(EN[id], seen, rnd) };
    const p = KO[id];
    // 두 심사위원이 같은 특징을 말하지 않게 — 특징이 하나뿐이면 둘째는 상황 얘기로 간다.
    const freeTraits = traits.filter((t) => !usedTraits.has(t));
    const trait = freeTraits.length ? freeTraits[Math.floor(rnd() * freeTraits.length)] : null;
    if (trait) usedTraits.add(trait);
    const ctxLines = ctxs.flatMap((c) => p.ctx[c] ?? []);
    const parts = [pickFresh(p.open, seen, rnd)];
    if (trait) parts.push(pickFresh(p.trait[trait], seen, rnd));
    // 상황 한 줄은 가끔만(또는 특징 얘기를 못 했을 때) — 매번 붙으면 길고 뻔해진다.
    if (ctxLines.length && (!trait || rnd() < (i === 0 ? 0.5 : 0.35))) parts.push(pickFresh(ctxLines, seen, rnd));
    if (!trait && !ctxLines.length) parts.push(pickFresh(p.trait.plain, seen, rnd));
    parts.push(pickFresh(p.close, seen, rnd));
    return { judge, line: parts.join(" ") };
  });

  writeSeen([...seenList, ...[...seen].filter((s) => !seenList.includes(s))]);
  return out;
}
