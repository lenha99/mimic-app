import { allow, clientIp, tooMany } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/service";
import { cleanNickname } from "@/lib/nickname";
import { requestT } from "@/lib/i18n";
import { MAX_PROMPT_CHARS } from "@/lib/relay";
import { badText, cleanLine, displayName, ownerOf } from "@/lib/relay-server";
import { json, requestViewer } from "@/lib/relay-req";

/** 상황 신청 — 누구나(LV1 도). 감독이 골라 장면으로 만들면 크레딧에 "원안: 이름" · +40 XP */
export async function POST(req: Request) {
  const t = requestT(req);
  if (!allow(`relay-prompt:${clientIp(req)}`, 8, 3_600_000)) return tooMany(t("잠시 뒤에 다시 해 주세요.", "Try again later."));
  const b = (await req.json().catch(() => ({}))) as { client?: string; text?: string; name?: string };
  const v = await requestViewer(b.client);
  const owner = ownerOf(v);
  if (!owner) return json({ error: t("로그인하거나 저장을 허용해 주세요.", "Log in first.") }, 401);
  const text = cleanLine(b.text, MAX_PROMPT_CHARS);
  if (!text || text.length < 4) return json({ error: t(`4~${MAX_PROMPT_CHARS}자로 써 주세요.`, `4–${MAX_PROMPT_CHARS} characters.`) }, 400);
  if (badText(text)) return json({ error: t("쓸 수 없는 말이 들어 있어요.", "Blocked words found.") }, 400);
  const service = createServiceClient();
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await service.from("relay_prompts").select("id", { count: "exact", head: true }).eq("owner", owner).gte("created_at", since);
  if ((count ?? 0) >= 3) return json({ error: t("상황 신청은 하루 세 개까지예요.", "Up to 3 a day.") }, 429);
  const name = await displayName(v, cleanNickname(b.name), service);
  const { error } = await service.from("relay_prompts").insert({ owner, user_id: v.userId, name, text });
  if (error) return json({ error: t("신청하지 못했어요.", "Couldn't submit.") }, 500);
  return json({ ok: true });
}
