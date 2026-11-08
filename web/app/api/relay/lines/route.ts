import { allow, clientIp, tooMany } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/service";
import { requestT } from "@/lib/i18n";
import { can, isBranch, MAX_LINE_CHARS, sceneLength, twistN, writesPerDay } from "@/lib/relay";
import { badText, cleanLine, displayName, levelFor, loadScene } from "@/lib/relay-server";
import { ttsForLine } from "@/lib/relay-tts";
import { json, requestViewer } from "@/lib/relay-req";

export const maxDuration = 30;

/**
 * 작가 — 갈림길(전개·결말 줄) 대사 쓰기. STAR(LV5) · 로그인. 반전 카드(결말 대신 들어갈 결말)는 LV6, 장면당 한 장.
 * 쓰면 그 배역 목소리로 TTS 를 한 번 읽어 둔다 — 작가는 녹음하지 않는다. 배우가 녹음하면 1표.
 */
export async function POST(req: Request) {
  const t = requestT(req);
  if (!allow(`relay-line:${clientIp(req)}`, 20, 3_600_000)) return tooMany(t("잠시 뒤에 다시 써 주세요.", "Try again later."));
  const b = (await req.json().catch(() => ({}))) as { client?: string; sceneId?: string; n?: number; role?: string; text?: string; twist?: boolean };
  const v = await requestViewer(b.client);
  if (!v.userId) return json({ error: t("대사를 쓰려면 로그인해 주세요.", "Log in to write lines."), needLogin: true }, 401);
  const service = createServiceClient();
  const level = await levelFor(v, service);
  const twist = Boolean(b.twist);
  if (!can.write(level)) return json({ error: t("대사 쓰기는 STAR(LV5) 작가부터예요.", "Writing unlocks at LV5.") }, 403);
  if (twist && !can.twist(level)) return json({ error: t("반전 카드는 LV6부터예요.", "Twist cards unlock at LV6.") }, 403);

  const scene = await loadScene(String(b.sceneId ?? ""), v, service);
  if (!scene || scene.status !== "live") return json({ error: t("상영 중인 장면이 아니에요.", "Not a live scene.") }, 409);
  const n = Number(b.n);
  const total = sceneLength(scene.lines);
  if (!isBranch(n, total) || (twist && n !== total)) return json({ error: t(`갈림길 자리(${twistN(total)}번·${total}번)에만 쓸 수 있어요.`, `Only lines ${twistN(total)} and ${total}.`) }, 400);
  const role = scene.roles.find((r) => r.id === b.role);
  if (!role) return json({ error: t("배역을 골라 주세요.", "Pick a role.") }, 400);
  const text = cleanLine(b.text, MAX_LINE_CHARS);
  if (!text) return json({ error: t(`대사는 2~${MAX_LINE_CHARS}자로 써 주세요.`, `Lines must be 2–${MAX_LINE_CHARS} characters.`) }, 400);
  if (badText(text)) return json({ error: t("쓸 수 없는 말이 들어 있어요.", "That line contains blocked words.") }, 400);

  const author = `u:${v.userId}`;
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { count } = await service.from("relay_lines").select("id", { count: "exact", head: true }).eq("author", author).eq("candidate", true).gte("created_at", since);
  if ((count ?? 0) >= writesPerDay(level)) {
    return json({ error: t(`오늘은 ${writesPerDay(level)}줄까지 쓸 수 있어요. 내일 또 써 주세요!`, `Up to ${writesPerDay(level)} lines a day.`) }, 429);
  }
  if (twist && scene.lines.some((l) => l.twist && l.mineAuthor)) return json({ error: t("반전 카드는 장면당 한 장이에요.", "One twist per scene.") }, 409);
  if (scene.lines.some((l) => l.candidate && l.n === n && l.text === text)) return json({ error: t("같은 대사가 이미 있어요.", "Same line exists.") }, 409);

  const base = scene.lines.find((l) => l.n === n && !l.candidate);
  const name = await displayName(v, null, service);
  const { data: line, error } = await service
    .from("relay_lines")
    .insert({ scene_id: scene.id, n, role: role.id, text, dir: base?.role === role.id ? base.dir : "", tip: "작가 대사", candidate: true, twist, author, author_user: v.userId, author_name: name, sec: Math.max(2, text.length * 0.18) })
    .select("id")
    .single();
  if (error || !line) return json({ error: t("올리지 못했어요. 다시 해 주세요.", "Couldn't post.") }, 500);
  const tts = await ttsForLine(line.id, text, role.voice);
  if (tts) await service.from("relay_lines").update({ tts: tts.path, sec: tts.sec }).eq("id", line.id);
  return json({ id: line.id, tts: Boolean(tts) });
}
