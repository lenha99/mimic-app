import { isAdmin } from "@/lib/admin";
import { notify } from "@/lib/notify-server";
import { createServiceClient } from "@/lib/supabase/service";
import { json, requestViewer } from "@/lib/relay-req";

/** 공개용 이름표 — 남의 기기 id 를 화면에 내보내지 않는다(lib/relay-server publicView 와 같은 해시). */
function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return "p" + (h >>> 0).toString(36);
}

async function directorOk(sceneId: string, keys: string[]) {
  const service = createServiceClient();
  const { data: s } = await service.from("relay_scenes").select("id, title, status, director").eq("id", sceneId).maybeSingle();
  if (!s || s.status !== "live") return null;
  const mine = !!s.director && keys.includes(s.director);
  if (mine || ((!s.director || s.director === "admin") && (await isAdmin()))) return s;
  return null;
}

/** 캐스팅 후보 — 릴레이에 출연해 본 목소리들(최근 순) */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const v = await requestViewer(url.searchParams.get("client"));
  const s = await directorOk(String(url.searchParams.get("scene") ?? ""), v.keys);
  if (!s) return json({ error: "forbidden" }, 403);
  const { data } = await createServiceClient().from("relay_takes").select("owner, name, avatar, scene_id").eq("kind", "line").eq("hidden", false).order("created_at", { ascending: false }).limit(800);
  const seen = new Map<string, { id: string; name: string; avatar: unknown; scenes: Set<string> }>();
  for (const r of data ?? []) {
    if (v.keys.includes(r.owner)) continue;
    const cur = seen.get(r.owner) ?? { id: hash(r.owner), name: r.name, avatar: r.avatar, scenes: new Set<string>() };
    cur.scenes.add(r.scene_id);
    seen.set(r.owner, cur);
  }
  return json({ actors: [...seen.values()].slice(0, 40).map((a) => ({ id: a.id, name: a.name, avatar: a.avatar, scenes: a.scenes.size })) });
}

/** 지명 — 빈 배역에, 장면당 둘까지. 지명받은 사람은 "릴레이 더빙" 버튼을 누르면 바로 그 배역으로 간다. */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { client?: string; sceneId?: string; role?: string; actor?: string | null };
  const v = await requestViewer(b.client);
  const s = await directorOk(String(b.sceneId ?? ""), v.keys);
  if (!s) return json({ error: "forbidden" }, 403);
  const service = createServiceClient();
  const role = String(b.role ?? "");
  if (!b.actor) {
    await service.from("relay_casts").delete().eq("scene_id", s.id).eq("role", role);
    return json({ ok: true });
  }
  const { data: taken } = await service.from("relay_roles").select("role").eq("scene_id", s.id).eq("role", role).maybeSingle();
  if (taken) return json({ error: "이미 배우가 맡은 배역이에요." }, 409);
  const { count } = await service.from("relay_casts").select("role", { count: "exact", head: true }).eq("scene_id", s.id).neq("role", role);
  if ((count ?? 0) >= 2) return json({ error: "지명은 장면당 둘까지예요." }, 409);
  const { data: owners } = await service.from("relay_takes").select("owner, user_id").eq("kind", "line").order("created_at", { ascending: false }).limit(2000);
  const hit = (owners ?? []).find((o) => hash(o.owner) === b.actor);
  if (!hit) return json({ error: "배우를 찾지 못했어요." }, 404);
  await service.from("relay_casts").upsert({ scene_id: s.id, role, owner: hit.owner });
  await notify({
    userId: hit.user_id,
    client: hit.owner.startsWith("g:") ? hit.owner.slice(2) : null,
    kind: "relay_cast",
    sceneId: s.id,
    push: { title: "🎬 캐스팅 제의", body: `「${s.title}」 감독이 당신을 캐스팅했어요. 눌러서 바로 녹음`, url: `/relay/rec?scene=${s.id}`, tag: "relay" },
    pushKey: `relay-cast:${s.id}:${role}:${hit.owner}`,
  });
  return json({ ok: true });
}
