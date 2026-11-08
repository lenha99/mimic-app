/**
 * 릴레이 더빙 — 브라우저·서버 공용 규칙.
 *
 * 장면(10줄)을 여러 사람이 한 줄씩 녹음해 완성한다. 동시 접속은 없다.
 *   - 아무도 안 한 줄은 TTS 가 읽는다 → 사람이 0명이어도 장면은 완성된다.
 *   - 장면은 열린 뒤 사흘째 21시(KST)에 무조건 개봉한다 → 반드시 끝나고 다음 장면이 열린다.
 *   - 한 사람은 장면 하나에 배역 하나 → 목소리가 반드시 섞인다. 개봉 24시간 전 빈 배역만 예외(막판 캐스팅).
 *   - 6번·10번은 갈림길 — 작가(LV5)가 대사를 쓰고, 배우가 그 대사를 녹음하면 1표.
 *
 * 계급은 VOICE PASS 레벨에서 나온다(lib/pass.ts RANKS 와 같은 구간).
 *   ROOKIE 1~2 배우 · RISING 3~4 애드리브 · STAR 5~6 작가 · ICON 7~8 감독 · LEGEND 9~10 명감독
 */

export type Hall = "act" | "real";
export type RoleType = "anime" | "actor" | "announcer" | "speech" | "everyday";

export type RelayRole = { id: string; name: string; type: RoleType; voice: string; desc: string };

export type StockLine = { n: number; role: string; text: string; dir: string; tip: string; tts: string; sec: number };
export type StockScene = {
  key: string;
  hall: Hall;
  genre: string;
  title: string;
  logline: string;
  roles: RelayRole[];
  lines: StockLine[];
};

/** 갈림길 자리 — 6번(전개 비틀기) · 10번(결말) */
export const BRANCH_N = [6, 10] as const;
export const isBranch = (n: number) => n === 6 || n === 10;
export const LINES_PER_SCENE = 10;

/** 상영 기간 — 열린 날로부터 사흘째 21시(KST) 개봉 */
export const RUN_DAYS = 3;
export const PREMIERE_HOUR_KST = 21;
/** 배역 우선권 — 첫 줄을 녹음하면 그 배역의 남은 줄은 24시간 동안 나에게 먼저 */
export const PRIORITY_MS = 24 * 3600_000;
/** 막판 캐스팅 — 개봉 24시간 전부터는 빈 배역에 한해 1인 2배역 */
export const LATE_MS = 24 * 3600_000;
export const MAX_LATE_ROLES = 2;
/** 대사 길이 상한(작가·감독이 쓰는 줄) */
export const MAX_LINE_CHARS = 40;
export const MAX_PROMPT_CHARS = 40;
/** 녹음 길이 — 줄의 TTS 길이 × 1.6 + 1.5초까지, 최소 4초 · 최대 15초 */
export function maxTakeMs(sec: number): number {
  return Math.round(Math.min(15, Math.max(4, sec * 1.6 + 1.5)) * 1000);
}
export const ADLIB_MS = 2500;

export function premiereAt(opens: number): number {
  // 열린 날(KST) + 사흘 → 그날 21시(KST). KST 날짜 경계를 UTC 로 계산한다.
  const kst = new Date(opens + 9 * 3600_000);
  const day = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() + RUN_DAYS, PREMIERE_HOUR_KST - 9);
  return day;
}

// ---- 계급 ----

export type Title = "actor" | "adlib" | "writer" | "director" | "legend";
export const TITLES: { id: Title; from: number; ko: string; en: string; icon: string; perkKo: string; perkEn: string }[] = [
  { id: "actor", from: 1, ko: "배우", en: "Actor", icon: "🎙", perkKo: "배역을 맡아 녹음하고 출연해요", perkEn: "Take a role, record, appear" },
  { id: "adlib", from: 3, ko: "애드리브 배우", en: "Ad-lib actor", icon: "😏", perkKo: "내 줄 뒤에 2초 애드리브를 붙여요", perkEn: "Add a 2s ad-lib after your line" },
  { id: "writer", from: 5, ko: "작가", en: "Writer", icon: "✍️", perkKo: "갈림길 대사를 써요 · LV6 반전 카드", perkEn: "Write branch lines · twist card at LV6" },
  { id: "director", from: 7, ko: "감독", en: "Director", icon: "🎬", perkKo: "장면을 열고, 캐스팅하고, NG/OK 를 찍어요", perkEn: "Open scenes, cast, stamp NG/OK" },
  { id: "legend", from: 9, ko: "명감독", en: "Master director", icon: "👑", perkKo: "한 주에 장면 두 편 · 이주의 명작 추천", perkEn: "Two scenes a week" },
];
export function titleOf(level: number): (typeof TITLES)[number] {
  let t = TITLES[0];
  for (const x of TITLES) if (level >= x.from) t = x;
  return t;
}
export function nextTitle(level: number): (typeof TITLES)[number] | null {
  return TITLES.find((x) => x.from > level) ?? null;
}
export const can = {
  adlib: (lv: number) => lv >= 3,
  write: (lv: number) => lv >= 5,
  twist: (lv: number) => lv >= 6,
  direct: (lv: number) => lv >= 7,
};
/** 작가 하루 쓰기 · 감독 한 주 장면 수 */
export const writesPerDay = (lv: number) => (lv >= 8 ? 8 : lv >= 6 ? 6 : 3);
export const scenesPerWeek = (lv: number) => (lv >= 9 ? 2 : 1);

/** TTS 목소리 프리셋 이름 — 서버(lib/relay-tts)와 감독 스튜디오가 같이 쓴다 */
export const VOICE_LABEL: Record<string, string> = {
  f_bright: "밝은 여성",
  f_calm: "차분한 여성",
  f_child: "어린아이",
  f_elder: "할머니",
  m_calm: "차분한 남성",
  m_deep: "낮은 악역",
  m_elder: "할아버지",
  m_young: "젊은 남성",
  m_bright: "활기찬 남성",
  robot: "로봇",
};

// ---- 연출 ----

export const DIRECTIONS: { id: string; ko: string; en: string }[] = [
  { id: "meaner", ko: "더 비열하게", en: "Meaner" },
  { id: "louder", ko: "더 크게", en: "Louder" },
  { id: "softer", ko: "더 작게, 속삭이듯", en: "Softer, whisper" },
  { id: "tearful", ko: "울먹이며", en: "Tearful" },
  { id: "faster", ko: "더 빠르게", en: "Faster" },
  { id: "slower", ko: "더 천천히", en: "Slower" },
  { id: "serious", ko: "진지하게 (웃지 마)", en: "Serious (don't laugh)" },
  { id: "cuter", ko: "더 귀엽게", en: "Cuter" },
  { id: "angrier", ko: "더 화나게", en: "Angrier" },
  { id: "calmer", ko: "더 차분하게", en: "Calmer" },
  { id: "dramatic", ko: "더 극적으로", en: "More dramatic" },
  { id: "natural", ko: "더 자연스럽게", en: "More natural" },
];
export const directionLabel = (id: string | null | undefined, ko = true) => {
  const d = DIRECTIONS.find((x) => x.id === id);
  return d ? (ko ? d.ko : d.en) : "";
};

/** 효과음 — 파일 없이 브라우저가 합성한다(components/relay/audio.ts). 저작권·용량 걱정 없음.
 *  아이콘은 components/relay/sfx-icon.tsx(SVG). say 는 대본 사이에 적히는 의성어 */
export const SFX: { id: string; ko: string; en: string; say: string; sayEn: string }[] = [
  { id: "boom", ko: "폭발", en: "Boom", say: "콰광!", sayEn: "KABOOM!" },
  { id: "heart", ko: "심장박동", en: "Heartbeat", say: "두근… 두근…", sayEn: "Ba-dum… ba-dum…" },
  { id: "whoosh", ko: "휙", en: "Whoosh", say: "휘익—", sayEn: "Whoosh—" },
  { id: "ding", ko: "띵", en: "Ding", say: "띵!", sayEn: "Ding!" },
  { id: "thunder", ko: "천둥", en: "Thunder", say: "우르릉 쾅!", sayEn: "Rumble… CRACK!" },
  { id: "drum", ko: "두구두구", en: "Drumroll", say: "두구두구두구…", sayEn: "Drrrrrumroll…" },
  { id: "door", ko: "문 쾅", en: "Door slam", say: "쾅! (문)", sayEn: "SLAM!" },
  { id: "sparkle", ko: "반짝", en: "Sparkle", say: "반짜악✧", sayEn: "Sparkle✧" },
];

export const GENRES: { id: string; ko: string; en: string; hall: Hall }[] = [
  { id: "fantasy", ko: "판타지·모험", en: "Fantasy", hall: "act" },
  { id: "battle", ko: "배틀·열혈", en: "Battle", hall: "act" },
  { id: "anime", ko: "애니", en: "Anime", hall: "act" },
  { id: "movie", ko: "영화", en: "Movie", hall: "act" },
  { id: "horror", ko: "호러", en: "Horror", hall: "act" },
  { id: "romance", ko: "로맨스", en: "Romance", hall: "act" },
  { id: "interview", ko: "면접", en: "Interview", hall: "real" },
  { id: "announcer", ko: "아나운서", en: "Announcer", hall: "real" },
  { id: "news", ko: "뉴스", en: "News", hall: "real" },
  { id: "speech", ko: "스피치", en: "Speech", hall: "real" },
  { id: "cross", ko: "크로스오버", en: "Crossover", hall: "real" },
  { id: "chaos", ko: "막장", en: "Chaos", hall: "act" },
];
export const genreLabel = (id: string, ko = true) => {
  const g = GENRES.find((x) => x.id === id);
  return g ? (ko ? g.ko : g.en) : id;
};
export const HALL_LABEL: Record<Hall, { ko: string; en: string; sub: string; subEn: string }> = {
  act: { ko: "연기관", en: "Acting hall", sub: "모험 · 애니 · 영화", subEn: "Adventure · Anime · Movie" },
  real: { ko: "현실관", en: "Real-life hall", sub: "면접 · 아나운서 · 뉴스 · 스피치", subEn: "Interview · Announcer · News · Speech" },
};
export const TYPE_LABEL: Record<RoleType, { ko: string; en: string }> = {
  anime: { ko: "애니", en: "Anime" },
  actor: { ko: "연기", en: "Acting" },
  announcer: { ko: "아나운서", en: "Announcer" },
  speech: { ko: "스피치", en: "Speech" },
  everyday: { ko: "일상", en: "Everyday" },
};

/** 연습실 대본 기록 → 어울리는 배역 계열 (sc_a_ 아나운서 · sc_v_ani 애니 · sc_v_ 연기 · sc_s_ 스피치) */
export function prefFromPractice(itemIds: string[]): RoleType | null {
  const n: Record<RoleType, number> = { anime: 0, actor: 0, announcer: 0, speech: 0, everyday: 0 };
  for (const id of itemIds) {
    if (id.startsWith("sc_a_")) n.announcer++;
    else if (id.startsWith("sc_v_ani")) n.anime++;
    else if (id.startsWith("sc_v_")) n.actor++;
    else if (id.startsWith("sc_s_")) n.speech++;
  }
  const best = (Object.entries(n) as [RoleType, number][]).sort((a, b) => b[1] - a[1])[0];
  return best && best[1] > 0 ? best[0] : null;
}

export type Assignment = { sceneId: string; lineId: string; role: string; reason: "cast" | "mine" | "open" | "vote" | "late" | "free" };

// ---- 화면에 내려 주는 장면 ----

export type TakeView = {
  id: string;
  lineId: string;
  owner: string;
  name: string;
  avatar: Record<string, string>;
  kind: "line" | "adlib";
  stamp: "ok" | "ng" | null;
  direction: string | null;
  sec: number;
  at: string;
  mine?: boolean;
};

export type LineView = {
  id: string;
  n: number;
  role: string;
  text: string;
  dir: string;
  tip: string;
  tts: string | null;
  sec: number;
  candidate: boolean;
  twist: boolean;
  authorName: string | null;
  mineAuthor?: boolean;
  won: boolean;
  at: string;
};

export type RoleOwner = { role: string; owner: string; name: string; late: boolean; priorityUntil: string; mine?: boolean };

export type SceneView = {
  id: string;
  hall: Hall;
  stockKey: string | null;
  title: string;
  logline: string;
  genre: string;
  roles: RelayRole[];
  directorName: string | null;
  promptText: string | null;
  promptName: string | null;
  mode: "normal" | "chaos";
  status: "pending" | "queued" | "live" | "premiered" | "void";
  opensAt: string | null;
  premiereAt: string | null;
  listens: number;
  bestWeek: string | null;
  lines: LineView[];
  takes: TakeView[];
  owners: RoleOwner[];
  casts: { role: string; owner: string; mine?: boolean }[];
  sfx: { afterN: number; sfx: string }[];
  final: FinalCut | null;
  /** 보는 사람이 이 장면의 감독인가 */
  amDirector?: boolean;
};

export type CutLine = {
  n: number;
  role: string;
  roleName: string;
  text: string;
  dir: string;
  lineId: string;
  tts: string | null;
  sec: number;
  takeId: string | null;
  owner: string | null;
  name: string | null;
  avatar: Record<string, string> | null;
  adlibId: string | null;
  authorName: string | null;
  candidate: boolean;
};

export type FinalCut = {
  lines: CutLine[];
  /** 반전판 결말(10번) — 반전 카드가 있으면 */
  twist: CutLine | null;
  /** B 루트 — 갈림길 2위 */
  alt: CutLine[];
  credits: {
    director: string | null;
    prompt: string | null;
    writers: { name: string; n: number; twist?: boolean }[];
    cast: { role: string; roleName: string; names: string[] }[];
    adlibs: string[];
    tts: number;
  };
  realActors: number;
  sfx: { afterN: number; sfx: string }[];
};

type CutInput = Pick<SceneView, "roles" | "lines" | "takes" | "owners" | "sfx" | "directorName" | "promptName">;

function votes(lineId: string, takes: TakeView[]): number {
  return new Set(takes.filter((t) => t.lineId === lineId && t.kind === "line").map((t) => t.owner)).size;
}

function rankCandidates(cands: LineView[], takes: TakeView[]): LineView[] {
  return [...cands].sort((a, b) => votes(b.id, takes) - votes(a.id, takes) || a.at.localeCompare(b.at));
}

/** 갈림길 자리의 정식 대사 — 득표 1위(동점이면 먼저 쓴 것), 후보가 없으면 기본 대사 */
export function chosenLine(n: number, lines: LineView[], takes: TakeView[]): { line: LineView | null; second: LineView | null } {
  const base = lines.find((l) => l.n === n && !l.candidate) ?? null;
  if (!isBranch(n)) return { line: base, second: null };
  const ranked = rankCandidates(lines.filter((l) => l.n === n && l.candidate && !l.twist), takes);
  if (!ranked.length) return { line: base, second: null };
  return { line: ranked[0], second: ranked[1] ?? base };
}

/** 줄의 목소리 — 감독 OK > 배역 주인 > 먼저 녹음한 사람 (NG 는 맨 뒤). 없으면 null(TTS) */
export function chosenTake(line: LineView, takes: TakeView[], owners: RoleOwner[]): TakeView | null {
  const mine = takes.filter((t) => t.lineId === line.id && t.kind === "line");
  if (!mine.length) return null;
  const owner = owners.find((o) => o.role === line.role)?.owner;
  const score = (t: TakeView) => (t.stamp === "ok" ? 3 : 0) + (t.owner === owner ? 2 : 0) + (t.stamp === "ng" ? -4 : 0);
  return [...mine].sort((a, b) => score(b) - score(a) || (a.stamp === "ok" && b.stamp === "ok" ? b.at.localeCompare(a.at) : a.at.localeCompare(b.at)))[0];
}

function cutOf(line: LineView, roles: RelayRole[], takes: TakeView[], owners: RoleOwner[]): CutLine {
  const take = chosenTake(line, takes, owners);
  const adlib = take ? takes.find((t) => t.lineId === line.id && t.kind === "adlib" && t.owner === take.owner) : undefined;
  return {
    n: line.n,
    role: line.role,
    roleName: roles.find((r) => r.id === line.role)?.name ?? line.role,
    text: line.text,
    dir: line.dir,
    lineId: line.id,
    tts: line.tts,
    sec: take?.sec || line.sec,
    takeId: take?.id ?? null,
    owner: take?.owner ?? null,
    name: take?.name ?? null,
    avatar: take?.avatar ?? null,
    adlibId: adlib?.id ?? null,
    authorName: line.candidate ? line.authorName : null,
    candidate: line.candidate,
  };
}

/** 지금 상태로 개봉하면 나올 정식판 — 개봉 때 서버가 이걸 박제한다 */
export function computeFinal(s: CutInput): FinalCut {
  const lines: CutLine[] = [];
  const alt: CutLine[] = [];
  for (let n = 1; n <= LINES_PER_SCENE; n++) {
    const { line, second } = chosenLine(n, s.lines, s.takes);
    if (!line) continue;
    lines.push(cutOf(line, s.roles, s.takes, s.owners));
    if (second) alt.push(cutOf(second, s.roles, s.takes, s.owners));
  }
  const twists = rankCandidates(s.lines.filter((l) => l.n === 10 && l.candidate && l.twist), s.takes);
  const twist = twists[0] ? cutOf(twists[0], s.roles, s.takes, s.owners) : null;

  const cast = s.roles.map((r) => {
    const names = [...new Set(lines.filter((l) => l.role === r.id && l.name).map((l) => l.name!))];
    return { role: r.id, roleName: r.name, names };
  });
  const writers: { name: string; n: number; twist?: boolean }[] = lines.filter((l) => l.candidate && l.authorName).map((l) => ({ name: l.authorName!, n: l.n }));
  if (twist?.authorName) writers.push({ name: twist.authorName, n: 10, twist: true });
  const adlibNames = [...new Set(lines.filter((l) => l.adlibId).map((l) => l.name!).filter(Boolean))];
  return {
    lines,
    twist,
    alt,
    credits: {
      director: s.directorName,
      prompt: s.promptName,
      writers,
      cast,
      adlibs: adlibNames,
      tts: lines.filter((l) => !l.takeId).length,
    },
    realActors: new Set(lines.filter((l) => l.owner).map((l) => l.owner)).size,
    sfx: s.sfx,
  };
}

/** 오디오 주소 — 녹음은 /api/relay/audio/<id>, TTS 는 정적 파일이거나 /api/relay/audio/l_<줄 id> */
export function takeUrl(takeId: string): string {
  return `/api/relay/audio/${takeId}`;
}
export function ttsUrl(line: { id?: string; lineId?: string; tts: string | null }): string | null {
  if (!line.tts) return null;
  if (line.tts.startsWith("/")) return line.tts;
  return `/api/relay/audio/l_${line.lineId ?? line.id}`;
}

export function timeLeft(iso: string | null, ko: boolean, now = Date.now()): string {
  if (!iso) return "";
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return ko ? "곧 개봉" : "Premiering";
  const h = Math.floor(ms / 3600_000);
  const d = Math.floor(h / 24);
  if (d >= 1) return ko ? `${d}일 ${h % 24}시간 뒤 개봉` : `Premieres in ${d}d ${h % 24}h`;
  if (h >= 1) return ko ? `${h}시간 뒤 개봉` : `Premieres in ${h}h`;
  return ko ? `${Math.max(1, Math.floor(ms / 60_000))}분 뒤 개봉` : `Premieres in ${Math.max(1, Math.floor(ms / 60_000))}m`;
}

/** 개봉일 표시 — "목 21시" */
export function premiereLabel(iso: string | null, ko: boolean): string {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() + 9 * 3600_000);
  const wk = (ko ? ["일", "월", "화", "수", "목", "금", "토"] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"])[d.getUTCDay()];
  return ko ? `${wk} ${d.getUTCHours()}시 개봉` : `${wk} ${d.getUTCHours()}:00`;
}


// ---- 배역 고르기 ----

export type RolePick =
  | { state: "mine"; lineId: string | null; left: number }
  | { state: "open"; lineId: string }
  | { state: "taken"; name: string }
  | { state: "blocked" };

/**
 * 장면 화면·허브에서 "이 배역 하기" 버튼이 어디로 갈지 — 서버 checkRole 과 같은 규칙.
 * 열린 배역이면 그 배역의 첫 빈 줄로 바로 녹음하러 간다(/relay/rec?scene=&line=).
 */
export function rolePick(s: Pick<SceneView, "lines" | "takes" | "owners" | "premiereAt" | "status">, roleId: string, now = Date.now()): RolePick {
  const base = s.lines.filter((l) => !l.candidate && l.role === roleId).sort((a, b) => a.n - b.n);
  const owner = s.owners.find((o) => o.role === roleId);
  const mineCount = s.owners.filter((o) => o.mine).length;
  const late = !!s.premiereAt && new Date(s.premiereAt).getTime() - now <= LATE_MS;
  if (owner?.mine) {
    const todo = base.filter((l) => !s.takes.some((t) => t.lineId === l.id && t.kind === "line" && t.mine));
    return { state: "mine", lineId: todo[0]?.id ?? null, left: todo.length };
  }
  if (s.status !== "live") return owner ? { state: "taken", name: owner.name } : { state: "blocked" };
  if (owner) {
    if (new Date(owner.priorityUntil).getTime() > now) return { state: "taken", name: owner.name };
    const empty = base.find((l) => !s.takes.some((t) => t.lineId === l.id && t.kind === "line"));
    if (!empty || (mineCount >= 1 && !late)) return { state: "taken", name: owner.name };
    return { state: "open", lineId: empty.id };
  }
  if (!base.length) return { state: "blocked" };
  if (mineCount === 0 || (late && mineCount < MAX_LATE_ROLES)) return { state: "open", lineId: base[0].id };
  return { state: "blocked" };
}

/** 배역별 색 — 대본에서 누가 말하는지 색으로 구분 */
export const ROLE_COLORS = ["#ffc93c", "#7cc8f2", "#ff7a45", "#8fd96b", "#b79cff", "#ff5d8f"];
export const roleColor = (roles: { id: string }[], id: string) => ROLE_COLORS[Math.max(0, roles.findIndex((r) => r.id === id)) % ROLE_COLORS.length];
