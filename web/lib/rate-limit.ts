/**
 * 요청 횟수 제한 — 서버 전용, IP 단위, 함수 인스턴스 메모리에 둔다.
 *
 * 인스턴스가 여러 개 뜨면 각자 센다. 그래서 정확한 쿼터가 아니라 "한 사람이 스크립트로
 * 수백 번 두드리는 것"을 끊는 1차 방어다. 비용의 진짜 상한은 Modal 의 max_containers 가
 * 쥐고 있다. 외부 저장소(Redis 등)를 붙이지 않은 건 그 값어치보다 운영이 무거워서다.
 */
type Bucket = { hits: number[] };
const buckets = new Map<string, Bucket>();

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "unknown").trim();
}

/** 창(windowMs) 안에서 limit 번을 넘으면 false. */
export function allow(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key) ?? { hits: [] };
  b.hits = b.hits.filter((t) => now - t < windowMs);
  if (b.hits.length >= limit) {
    buckets.set(key, b);
    return false;
  }
  b.hits.push(now);
  buckets.set(key, b);
  // 오래 안 온 키는 치운다 — 메모리가 끝없이 늘지 않게.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (!v.hits.some((t) => now - t < windowMs)) buckets.delete(k);
  }
  return true;
}

export function tooMany(message = "너무 자주 눌렀어요. 잠깐 쉬었다가 다시 해주세요."): Response {
  return Response.json({ error: message }, { status: 429 });
}
