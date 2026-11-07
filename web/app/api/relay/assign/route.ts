import { assign, levelFor, liveScenes, publicView } from "@/lib/relay-server";
import { json, requestViewer } from "@/lib/relay-req";
import type { RoleType } from "@/lib/relay";

const TYPES = new Set(["anime", "actor", "announcer", "speech", "everyday"]);

/**
 * 다음에 녹음할 줄 — 앱이 정해 준다. sceneId 를 주면 그 장면에서 먼저 찾고, 없으면 다른 상영관.
 * skip: ["장면id:배역"] — "다른 배역" 버튼으로 넘긴 것.
 */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { client?: string; pref?: string; skip?: string[]; sceneId?: string };
  const v = await requestViewer(b.client);
  if (!v.keys.length) return json({ error: "no identity" }, 401);
  const scenes = await liveScenes(v);
  const pref = TYPES.has(String(b.pref)) ? (b.pref as RoleType) : null;
  const skip = Array.isArray(b.skip) ? b.skip.slice(0, 40).map(String) : [];
  const first = b.sceneId ? scenes.filter((s) => s.id === b.sceneId) : [];
  const a = (first.length ? assign(first, v, pref, skip) : null) ?? assign(scenes, v, pref, skip);
  const scene = a ? scenes.find((s) => s.id === a.sceneId) : null;
  return json({ assignment: a, scene: scene ? publicView(scene) : null, level: await levelFor(v) });
}
