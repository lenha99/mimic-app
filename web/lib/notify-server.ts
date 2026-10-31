import { createHash } from "node:crypto";
import webpush from "web-push";
import { createServiceClient } from "@/lib/supabase/service";
import type { NotificationKind } from "@/types/database";

/**
 * 알림 — 앱 안(🔔)에 남기고, 웹 푸시를 구독한 기기엔 푸시도 보낸다. 서버 전용.
 *
 * 원칙: 자주 보내지 않는다. 푸시는 키마다 한 번(notif_sent)만 나가고, 밤 11시~아침 8시(KST)엔
 * 안 보낸다(앱 안 알림은 남는다). 실패해도 호출자를 깨뜨리지 않는다 — 알림 때문에 출전·구독이
 * 실패하면 본말전도다.
 *
 * 비용: 웹 푸시는 브라우저 회사들이 무료로 전달한다(VAPID). 키는 Vercel 환경변수에만 있다.
 */
type Service = ReturnType<typeof createServiceClient>;

export type PushPayload = { title: string; body: string; url: string; tag?: string };

let configured: boolean | null = null;
function ready(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return (configured = false);
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "https://mimic-web-omega.vercel.app", pub, priv);
  return (configured = true);
}

/** 지금이 조용한 시간(KST 23~08시)인가. */
export function quietHours(at = Date.now()): boolean {
  const h = new Date(at + 9 * 3_600_000).getUTCHours();
  return h >= 23 || h < 8;
}

/** KST 날짜 'YYYYMMDD' (· 시간까지 원하면 hour=true) */
export function kstStamp(at = Date.now(), hour = false): string {
  const d = new Date(at + 9 * 3_600_000).toISOString();
  return d.slice(0, 10).replace(/-/g, "") + (hour ? d.slice(11, 13) : "");
}

/** 이 키로 처음 부르면 true. 두 번째부터는 false — 빈도 제한의 전부다. */
export async function once(key: string, service: Service = createServiceClient()): Promise<boolean> {
  const { error } = await service.from("notif_sent").insert({ key: key.slice(0, 200) });
  return !error;
}

export function endpointKey(endpoint: string): string {
  return createHash("sha256").update(endpoint).digest("hex").slice(0, 24);
}

type Sub = { endpoint: string; p256dh: string; auth: string };

/** 구독들에 푸시. 없어진 구독(404·410)은 지운다. */
export async function pushTo(subs: Sub[], payload: PushPayload, service: Service = createServiceClient()): Promise<void> {
  if (!subs.length || !ready()) return;
  const body = JSON.stringify(payload);
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, {
          TTL: 6 * 3600,
          urgency: "normal",
        });
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await service.from("push_subs").delete().eq("endpoint", s.endpoint);
      }
    }),
  );
}

/** 한 사람(계정 또는 게스트 기기)의 푸시 구독들. */
export async function subsOf(who: { userId?: string | null; client?: string | null }, service: Service = createServiceClient()): Promise<Sub[]> {
  const out: Sub[] = [];
  if (who.userId) {
    const { data } = await service.from("push_subs").select("endpoint, p256dh, auth").eq("user_id", who.userId);
    out.push(...(data ?? []));
  }
  if (who.client) {
    const { data } = await service.from("push_subs").select("endpoint, p256dh, auth").eq("client", who.client);
    out.push(...(data ?? []));
  }
  const seen = new Set<string>();
  return out.filter((s) => !seen.has(s.endpoint) && seen.add(s.endpoint));
}

/**
 * 한 사람에게 알림. userId 가 있으면 앱 안 알림을 남기고, pushKey 가 처음이면(그리고 조용한
 * 시간이 아니면) 푸시도 보낸다. owner 문자열('u:…' / 'g:…')로도 부를 수 있다.
 */
export async function notify(opts: {
  userId?: string | null;
  client?: string | null;
  kind: NotificationKind;
  actor?: string | null;
  entryId?: string | null;
  threadId?: string | null;
  count?: number | null;
  push?: PushPayload;
  pushKey?: string;
}): Promise<void> {
  try {
    const service = createServiceClient();
    if (opts.userId) {
      await service.from("notifications").insert({
        user_id: opts.userId,
        kind: opts.kind,
        actor: opts.actor ?? null,
        entry_id: opts.entryId ?? null,
        thread_id: opts.threadId ?? null,
        count: opts.count ?? null,
      });
    }
    if (!opts.push || quietHours()) return;
    if (opts.pushKey && !(await once(opts.pushKey, service))) return;
    await pushTo(await subsOf({ userId: opts.userId, client: opts.client }, service), opts.push, service);
  } catch {
    // 알림 실패는 조용히.
  }
}

/** 'u:<id>' / 'g:<기기 id>' → 알림 대상. */
export function ownerTarget(owner: string, userId: string | null): { userId: string | null; client: string | null } {
  if (userId) return { userId, client: null };
  return owner.startsWith("g:") ? { userId: null, client: owner.slice(2) } : { userId: null, client: null };
}

/**
 * 새 출전작 알림 — 그 목소리 구독자(앱 안 + 푸시)와 "새 출전작 알림"을 켠 기기(푸시)에게.
 * 기기마다 하루 한 번만 — 여러 개가 올라와도 첫 번째만 알린다. 올린 본인은 빼고.
 */
export async function announceNewEntry(e: { id: string; userId: string | null; client: string | null; name: string }): Promise<void> {
  try {
    const service = createServiceClient();
    // 구독자 — 계정(앱 안 알림 + 푸시)과 손님 기기(푸시). follows 표가 아직 없으면 예전 표로.
    const creator = e.userId ? `u:${e.userId}` : e.client ? `g:${e.client}` : null;
    let keys: string[] = [];
    if (creator) {
      const { data, error } = await service.from("follows").select("follower").eq("creator", creator).limit(1000);
      if (error && e.userId) {
        keys = ((await service.from("voice_follows").select("follower").eq("creator", e.userId).limit(1000)).data ?? []).map((r) => `u:${r.follower}`);
      } else keys = (data ?? []).map((r) => r.follower);
    }
    const followers = keys.filter((k) => k.startsWith("u:")).map((k) => k.slice(2));
    const guestFans = keys.filter((k) => k.startsWith("g:")).map((k) => k.slice(2));
    if (followers.length) {
      await service.from("notifications").insert(
        followers.map((f) => ({ user_id: f, kind: "new_entry" as const, actor: e.userId, entry_id: e.id })),
      );
    }
    if (quietHours()) return;
    const { data: open } = await service.from("push_subs").select("endpoint, p256dh, auth, user_id, client").eq("new_entries", true).limit(500);
    const { data: fan } = followers.length
      ? await service.from("push_subs").select("endpoint, p256dh, auth, user_id, client").in("user_id", followers)
      : { data: [] };
    const { data: guestFan } = guestFans.length
      ? await service.from("push_subs").select("endpoint, p256dh, auth, user_id, client").in("client", guestFans)
      : { data: [] };
    const seen = new Set<string>();
    const targets = [...(fan ?? []), ...(guestFan ?? []), ...(open ?? [])].filter((s) => {
      if (seen.has(s.endpoint)) return false;
      seen.add(s.endpoint);
      return !(e.userId && s.user_id === e.userId) && !(e.client && s.client === e.client);
    });
    const day = kstStamp();
    const fresh: Sub[] = [];
    for (const s of targets) if (await once(`push:new:${endpointKey(s.endpoint)}:${day}`, service)) fresh.push(s);
    await pushTo(
      fresh,
      { title: "🎙 새 목소리가 올라왔어요", body: `${e.name}님이 이번 주 챌린지에 출전했어요`, url: `/weekly/e/${e.id}`, tag: "new-entry" },
      service,
    );
  } catch {}
}
