import { normalizeAvatar } from "@/lib/avatar";
import { kstStamp, notify } from "@/lib/notify-server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * 목소리 구독 · 메시지 요청 — 서버 전용.
 *
 * 메시지는 인스타의 "메시지 요청"처럼: 구독한 사람만 말을 걸 수 있고, 상대가 받아주기(또는
 * 답장하기) 전엔 메시지 1개만 보낼 수 있다. 출전자가 아직 몇 명뿐이라 한 명이 질려서 떠나면
 * 전체의 큰 몫이 사라진다 — 칭찬은 전하고 도배는 막는 선이다.
 */
type Service = ReturnType<typeof createServiceClient>;

export async function currentUserId(): Promise<string | null> {
  try {
    const {
      data: { user },
    } = await (await createClient()).auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

export type PublicProfile = { id: string; nickname: string; avatar: ReturnType<typeof normalizeAvatar>; dmPolicy: "followers" | "off" };

export async function profileById(id: string, service: Service = createServiceClient()): Promise<PublicProfile | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await service.from("profiles").select("id, nickname, avatar, dm_policy").eq("id", id).maybeSingle();
  return data ? { id: data.id, nickname: data.nickname, avatar: normalizeAvatar(data.avatar), dmPolicy: data.dm_policy ?? "followers" } : null;
}

export async function profileByNickname(nickname: string, service: Service = createServiceClient()): Promise<PublicProfile | null> {
  const { data } = await service.from("profiles").select("id, nickname, avatar, dm_policy").eq("nickname", nickname).maybeSingle();
  return data ? { id: data.id, nickname: data.nickname, avatar: normalizeAvatar(data.avatar), dmPolicy: data.dm_policy ?? "followers" } : null;
}

export async function nicknames(ids: string[], service: Service = createServiceClient()): Promise<Map<string, PublicProfile>> {
  const uniq = [...new Set(ids)].filter(Boolean);
  if (!uniq.length) return new Map();
  const { data } = await service.from("profiles").select("id, nickname, avatar, dm_policy").in("id", uniq);
  return new Map(
    (data ?? []).map((p) => [p.id, { id: p.id, nickname: p.nickname, avatar: normalizeAvatar(p.avatar), dmPolicy: p.dm_policy ?? "followers" }]),
  );
}

export async function follows(follower: string, creator: string, service: Service = createServiceClient()): Promise<boolean> {
  const { data } = await service.from("voice_follows").select("creator").eq("follower", follower).eq("creator", creator).maybeSingle();
  return Boolean(data);
}

export async function followerCount(creator: string, service: Service = createServiceClient()): Promise<number> {
  const { count } = await service.from("voice_follows").select("follower", { count: "exact", head: true }).eq("creator", creator);
  return count ?? 0;
}

export async function blocked(x: string, y: string, service: Service = createServiceClient()): Promise<boolean> {
  const { data } = await service
    .from("dm_blocks")
    .select("blocker")
    .or(`and(blocker.eq.${x},blocked.eq.${y}),and(blocker.eq.${y},blocked.eq.${x})`)
    .limit(1);
  return Boolean(data?.length);
}

/** 구독 · 해지. 구독하면 올린 사람이 알림으로 안다. */
export async function setFollow(follower: string, creator: string, on: boolean): Promise<{ following: boolean; followers: number } | { error: string; status: number }> {
  if (follower === creator) return { error: "self", status: 400 };
  const service = createServiceClient();
  const target = await profileById(creator, service);
  if (!target) return { error: "not-found", status: 404 };
  if (on) {
    const { error } = await service.from("voice_follows").insert({ follower, creator });
    // 이미 구독 중이면(중복) 알림을 또 보내지 않는다.
    if (!error) {
      const me = await profileById(follower, service);
      await notify({
        userId: creator,
        kind: "follow",
        actor: follower,
        push: {
          title: "🔔 새 구독자",
          body: `${me?.nickname ?? "누군가"}님이 당신 목소리를 구독했어요`,
          url: "/notifications",
          tag: "follow",
        },
        pushKey: `push:follow:${creator}:${kstStamp(Date.now(), true)}`,
      });
    }
  } else {
    await service.from("voice_follows").delete().eq("follower", follower).eq("creator", creator);
  }
  return { following: on, followers: await followerCount(creator, service) };
}

export type Thread = {
  id: string;
  other: PublicProfile | null;
  status: "request" | "open" | "declined";
  requester: string;
  lastAt: string;
  last: { body: string; mine: boolean } | null;
  unread: number;
};

const pair = (x: string, y: string) => (x < y ? { a: x, b: y } : { a: y, b: x });

/** 내가 이 사람에게 새로 말을 걸 수 있나 — 구독자만, 상대가 메시지를 켰고, 차단이 없을 때. */
export async function canStart(sender: string, recipient: string, service: Service = createServiceClient()): Promise<string | null> {
  if (sender === recipient) return "self";
  const target = await profileById(recipient, service);
  if (!target) return "not-found";
  if (await blocked(sender, recipient, service)) return "blocked";
  if (target.dmPolicy === "off") return "off";
  if (!(await follows(sender, recipient, service))) return "follow-first";
  return null;
}

/** 메시지 보내기 — 대화방이 없으면 요청으로 만든다. */
export async function sendMessage(sender: string, recipient: string, body: string): Promise<{ threadId: string } | { error: string; status: number }> {
  const text = body.trim().slice(0, 500);
  if (!text) return { error: "empty", status: 400 };
  const service = createServiceClient();
  if (await blocked(sender, recipient, service)) return { error: "blocked", status: 403 };
  const { a, b } = pair(sender, recipient);
  let { data: thread } = await service.from("dm_threads").select("id, status, requester").eq("a", a).eq("b", b).maybeSingle();

  if (!thread) {
    const why = await canStart(sender, recipient, service);
    if (why) return { error: why, status: 403 };
    const { data, error } = await service.from("dm_threads").insert({ a, b, requester: sender }).select("id, status, requester").single();
    if (error || !data) return { error: "failed", status: 500 };
    thread = data;
  } else if (thread.status === "declined") {
    // 거절된 쪽이 다시 보내는 건 막는다. 거절한 쪽이 먼저 말을 걸면 다시 열린다.
    if (thread.requester === sender) return { error: "declined", status: 403 };
    await service.from("dm_threads").update({ status: "open" }).eq("id", thread.id);
    thread = { ...thread, status: "open" };
  } else if (thread.status === "request") {
    if (thread.requester === sender) {
      const { count } = await service.from("dm_messages").select("id", { count: "exact", head: true }).eq("thread_id", thread.id);
      if ((count ?? 0) >= 1) return { error: "wait-accept", status: 403 };
    } else {
      // 받은 쪽이 답장하면 그게 수락이다.
      await service.from("dm_threads").update({ status: "open" }).eq("id", thread.id);
      thread = { ...thread, status: "open" };
    }
  }

  const { error } = await service.from("dm_messages").insert({ thread_id: thread.id, sender, body: text });
  if (error) return { error: "failed", status: 500 };
  await service.from("dm_threads").update({ last_at: new Date().toISOString() }).eq("id", thread.id);

  const me = await profileById(sender, service);
  const request = thread.status === "request";
  await notify({
    userId: recipient,
    kind: request ? "dm_request" : "dm",
    actor: sender,
    threadId: thread.id,
    push: {
      title: request ? "💌 메시지 요청" : `💬 ${me?.nickname ?? "메시지"}`,
      body: request ? `${me?.nickname ?? "누군가"}님이 메시지를 보냈어요` : text.slice(0, 80),
      url: `/messages/${thread.id}`,
      tag: `dm-${thread.id}`,
    },
    pushKey: `push:dm:${recipient}:${thread.id}:${kstStamp(Date.now(), true)}`,
  });
  return { threadId: thread.id };
}

export async function myThreads(me: string): Promise<Thread[]> {
  const service = createServiceClient();
  const { data } = await service
    .from("dm_threads")
    .select("id, a, b, requester, status, last_at")
    .or(`a.eq.${me},b.eq.${me}`)
    .order("last_at", { ascending: false })
    .limit(100);
  const rows = (data ?? []).filter((t) => !(t.status === "declined" && t.requester !== me));
  const others = await nicknames(rows.map((t) => (t.a === me ? t.b : t.a)), service);
  const out: Thread[] = [];
  for (const t of rows) {
    const [{ data: last }, { count }] = await Promise.all([
      service.from("dm_messages").select("body, sender").eq("thread_id", t.id).order("id", { ascending: false }).limit(1).maybeSingle(),
      service.from("dm_messages").select("id", { count: "exact", head: true }).eq("thread_id", t.id).neq("sender", me).is("read_at", null),
    ]);
    out.push({
      id: t.id,
      other: others.get(t.a === me ? t.b : t.a) ?? null,
      // 거절당한 쪽에겐 그냥 "아직 답 없음"으로 보인다 — 거절을 굳이 알리지 않는다.
      status: t.status === "declined" ? "request" : t.status,
      requester: t.requester,
      lastAt: t.last_at,
      last: last ? { body: last.body, mine: last.sender === me } : null,
      unread: count ?? 0,
    });
  }
  return out;
}

export async function threadFor(me: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const service = createServiceClient();
  const { data: t } = await service.from("dm_threads").select("id, a, b, requester, status").eq("id", id).maybeSingle();
  if (!t || (t.a !== me && t.b !== me)) return null;
  const otherId = t.a === me ? t.b : t.a;
  const [other, { data: msgs }] = await Promise.all([
    profileById(otherId, service),
    service.from("dm_messages").select("id, sender, body, created_at").eq("thread_id", id).order("id", { ascending: true }).limit(300),
  ]);
  // 열어 봤으면 읽음.
  await service.from("dm_messages").update({ read_at: new Date().toISOString() }).eq("thread_id", id).neq("sender", me).is("read_at", null);
  await service.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", me).eq("thread_id", id).is("read_at", null);
  return {
    id: t.id,
    other,
    status: t.status === "declined" && t.requester === me ? ("request" as const) : t.status,
    requester: t.requester,
    messages: (msgs ?? []).map((m) => ({ id: m.id, mine: m.sender === me, body: m.body, at: m.created_at })),
  };
}

/** 받은 요청 수락 · 거절 · 차단. 요청을 받은 쪽만 수락·거절할 수 있다. */
export async function actOnThread(me: string, id: string, action: "accept" | "decline" | "block"): Promise<{ ok: true } | { error: string; status: number }> {
  const service = createServiceClient();
  const { data: t } = await service.from("dm_threads").select("id, a, b, requester, status").eq("id", id).maybeSingle();
  if (!t || (t.a !== me && t.b !== me)) return { error: "not-found", status: 404 };
  const other = t.a === me ? t.b : t.a;
  if (action === "block") {
    await service.from("dm_blocks").insert({ blocker: me, blocked: other }); // 이미 차단했으면 중복 오류 — 무시
    await service.from("dm_threads").update({ status: "declined", requester: other }).eq("id", id);
    await service.from("voice_follows").delete().eq("follower", other).eq("creator", me);
    return { ok: true };
  }
  if (t.requester === me) return { error: "not-yours", status: 403 };
  await service.from("dm_threads").update({ status: action === "accept" ? "open" : "declined" }).eq("id", id);
  return { ok: true };
}
