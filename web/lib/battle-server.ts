import { createHmac, timingSafeEqual } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";
import type { Week } from "@/lib/weekly";

export { MIN_BATTLES } from "@/lib/weekly";

/**
 * 블라인드 보이스 배틀 — 서버 전용.
 *
 * 짝은 서버가 고르고 서명해서 준다. 아무 짝이나 골라 투표할 수 있으면 내 출전작을
 * 약한 상대들과만 붙여 점수를 올릴 수 있다. 투표는 받은 짝으로만, 그리고 둘 다
 * 들어볼 시간이 지난 뒤에만 받는다.
 */

/** 짝을 받고 이 시간이 지나야 표를 받는다 — 둘 다 듣지도 않고 누르는 걸 막는 최소한. */
export const MIN_LISTEN_MS = 4_000;
/** 짝 서명 수명. 그 뒤엔 새 짝을 받는다. */
const TOKEN_TTL_MS = 30 * 60_000;
/** 한 네트워크(IP)에서 하루에 넣을 수 있는 표. 시크릿 창 몰아주기를 끊는다. */
export const PER_NETWORK_DAY = 300;

export type BattleSide = { id: string; duration: number; bars: number[]; v: string };

function secret(): string {
  // 배틀 전용 비밀이 없으면 서비스 키에서 유도한다 — 둘 다 서버에만 있다.
  const base = process.env.BATTLE_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return createHmac("sha256", base).update("mimic-battle-v1").digest("hex");
}

function sign(body: string): string {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

/** 짝 서명 — "주.a.b.발급시각.서명" */
export function pairToken(weekId: string, a: string, b: string, at = Date.now()): string {
  const body = `${weekId}.${a}.${b}.${at}`;
  return `${body}.${sign(body)}`;
}

export function readPairToken(token: unknown): { weekId: string; a: string; b: string; at: number } | null {
  if (typeof token !== "string" || token.length > 300) return null;
  const parts = token.split(".");
  if (parts.length !== 5) return null;
  const [weekId, a, b, atRaw, sig] = parts;
  const want = Buffer.from(sign(`${weekId}.${a}.${b}.${atRaw}`));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  const at = Number(atRaw);
  if (!Number.isFinite(at) || Date.now() - at > TOKEN_TTL_MS) return null;
  return { weekId, a, b, at };
}

type Row = {
  id: string;
  owner: string;
  user_id: string | null;
  duration_s: number;
  bars: number[] | null;
  updated_at: string;
  battle_rating: number;
  battle_wins: number;
  battle_losses: number;
};

/**
 * 다음 짝. 덜 붙어 본 출전작을 먼저 — 새로 올라온 목소리가 묻히지 않게.
 * 상대는 점수가 비슷한 쪽에서 — 실력 차가 큰 대결은 결과가 뻔해서 정보가 없다.
 * 이 사람이 이미 심사한 짝과 내 출전작은 뺀다. 더 고를 게 없으면 null.
 */
export async function nextPair(
  week: Week,
  voters: string[],
  userId: string | null,
): Promise<{ a: BattleSide; b: BattleSide; total: number; judged: number } | { a: null; total: number; judged: number }> {
  const service = createServiceClient();
  const [{ data: rows }, { data: done }] = await Promise.all([
    service
      .from("weekly_entries")
      .select("id, owner, user_id, duration_s, bars, updated_at, battle_rating, battle_wins, battle_losses")
      .eq("challenge_id", week.id)
      .eq("hidden", false)
      .limit(500),
    voters.length
      ? service.from("weekly_battle_votes").select("pair").eq("challenge_id", week.id).in("voter", voters).limit(5000)
      : Promise.resolve({ data: [] as { pair: string }[] }),
  ]);
  const all = (rows ?? []) as Row[];
  const judgedPairs = new Set((done ?? []).map((d) => d.pair));
  const pool = all.filter((r) => !voters.includes(r.owner) && !(userId && r.user_id === userId));
  const total = all.length;
  const judged = judgedPairs.size;
  if (pool.length < 2) return { a: null, total, judged };

  const key = (x: string, y: string) => (x < y ? `${x}|${y}` : `${y}|${x}`);
  const games = (r: Row) => r.battle_wins + r.battle_losses;
  // 같은 판 수끼리는 섞는다 — 늘 같은 순서로 나오면 앞쪽만 계속 붙는다.
  const order = [...pool].sort((x, y) => games(x) - games(y) || Math.random() - 0.5);

  for (const first of order) {
    const rivals = pool
      .filter((r) => r.id !== first.id && !judgedPairs.has(key(first.id, r.id)))
      .sort((x, y) => Math.abs(x.battle_rating - first.battle_rating) - Math.abs(y.battle_rating - first.battle_rating));
    if (rivals.length === 0) continue;
    // 가장 가까운 셋 중 하나 — 매번 같은 상대만 나오지 않게.
    const rival = rivals[Math.floor(Math.random() * Math.min(3, rivals.length))];
    const side = (r: Row): BattleSide => ({ id: r.id, duration: r.duration_s, bars: r.bars ?? [], v: r.updated_at });
    // 왼쪽·오른쪽도 섞는다 — 먼저 나온 쪽이 유리하면 안 된다.
    const [a, b] = Math.random() < 0.5 ? [first, rival] : [rival, first];
    return { a: side(a), b: side(b), total, judged };
  }
  return { a: null, total, judged };
}
