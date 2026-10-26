import {
  checkPassword,
  checkUsername,
  normalizeUsername,
  usernameToEmail,
} from "@/lib/id-account";
import { allow, clientIp, tooMany } from "@/lib/rate-limit";
import { cleanNickname, nicknameProblem } from "@/lib/nickname";
import { createServiceClient } from "@/lib/supabase/service";
import { requestLang, tr } from "@/lib/i18n";

/**
 * 아이디·비밀번호 가입.
 *
 * 브라우저 signUp 을 쓰지 않는 이유: 이 프로젝트는 이메일 확인이 켜져 있어서,
 * 메일이 오가지 않는 내부 주소로 가입하면 영영 확인이 안 돼 로그인이 막힌다.
 * 서버가 확인 완료 상태로 만들고, 로그인은 브라우저가 signInWithPassword 로 한다.
 *
 * 닉네임은 가입할 때 따로 정할 수 있고, 안 정하면 아이디가 곧 닉네임이다(프로필에서 바꾼다).
 * 다른 사람 닉네임과 겹치면 받지 않는다 — 랭킹에 같은 이름이 둘 보이면 안 된다.
 */
export async function POST(req: Request) {
  const lang = requestLang(req);
  const t = tr(lang);
  // 가입은 서비스 키로 만들어서 Supabase 자체 가입 제한을 안 탄다. 여기서 막는다.
  if (!allow(`signup:${clientIp(req)}`, 5, 3_600_000)) {
    return tooMany(t("가입 시도가 너무 많아요. 한 시간 뒤에 다시 시도해 주세요.", "Too many sign-up attempts. Try again in an hour."));
  }
  const body = (await req.json().catch(() => ({}))) as { username?: unknown; password?: unknown; nickname?: unknown };
  const username = normalizeUsername(body.username);
  // 닉네임은 고를 수 있다. 안 적으면 아이디가 곧 닉네임이다.
  const wanted = typeof body.nickname === "string" && body.nickname.trim() ? body.nickname : null;
  const nickname = wanted === null ? username : cleanNickname(wanted);
  if (!nickname) {
    return Response.json({ error: nicknameProblem(String(wanted), lang) }, { status: 400 });
  }

  const problem = checkUsername(username, lang) ?? checkPassword(body.password, lang);
  if (problem) {
    return Response.json({ error: problem }, { status: 400 });
  }
  const password = body.password as string;

  const service = createServiceClient();

  const { data: taken } = await service
    .from("profiles")
    .select("id")
    .eq("nickname", nickname)
    .maybeSingle();
  if (taken) {
    return Response.json(
      { error: wanted === null ? t("이미 있는 아이디예요.", "That username is taken.") : t("이미 누가 쓰는 닉네임이에요.", "That nickname is taken.") },
      { status: 409 },
    );
  }

  const { data: created, error: createError } = await service.auth.admin.createUser({
    email: usernameToEmail(username),
    password,
    email_confirm: true,
    user_metadata: { username },
  });
  if (createError || !created.user) {
    const exists = /already|registered|exists/i.test(createError?.message ?? "");
    return Response.json(
      { error: exists ? t("이미 있는 아이디예요.", "That username is taken.") : t("가입이 안 됐어요. 잠시 후 다시 시도해 주세요.", "Sign-up failed. Please try again shortly.") },
      { status: exists ? 409 : 500 },
    );
  }

  const { error: profileError } = await service.from("profiles").insert({
    id: created.user.id,
    nickname,
    provider: "id",
  });
  if (profileError) {
    // 프로필 없는 계정은 로그인해도 쓸 데가 없다. 되돌린다.
    await service.auth.admin.deleteUser(created.user.id);
    const clash = profileError.code === "23505";
    return Response.json(
      { error: clash ? t("이미 누가 쓰는 닉네임이에요.", "That nickname is taken.") : t("가입이 안 됐어요. 잠시 후 다시 시도해 주세요.", "Sign-up failed. Please try again shortly.") },
      { status: clash ? 409 : 500 },
    );
  }

  return Response.json({ ok: true });
}
