import {
  checkPassword,
  checkUsername,
  normalizeUsername,
  usernameToEmail,
} from "@/lib/id-account";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * 아이디·비밀번호 가입.
 *
 * 브라우저 signUp 을 쓰지 않는 이유: 이 프로젝트는 이메일 확인이 켜져 있어서,
 * 메일이 오가지 않는 내부 주소로 가입하면 영영 확인이 안 돼 로그인이 막힌다.
 * 서버가 확인 완료 상태로 만들고, 로그인은 브라우저가 signInWithPassword 로 한다.
 *
 * 아이디가 곧 닉네임이다(나중에 프로필에서 바꿀 수 있다). 소셜 가입자의 닉네임과
 * 겹치면 받지 않는다 — 랭킹에 같은 이름이 둘 보이면 안 된다.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { username?: unknown; password?: unknown };
  const username = normalizeUsername(body.username);

  const problem = checkUsername(username) ?? checkPassword(body.password);
  if (problem) {
    return Response.json({ error: problem }, { status: 400 });
  }
  const password = body.password as string;

  const service = createServiceClient();

  const { data: taken } = await service
    .from("profiles")
    .select("id")
    .eq("nickname", username)
    .maybeSingle();
  if (taken) {
    return Response.json({ error: "이미 있는 아이디예요." }, { status: 409 });
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
      { error: exists ? "이미 있는 아이디예요." : "가입에 실패했어요. 잠시 후 다시 시도해주세요." },
      { status: exists ? 409 : 500 },
    );
  }

  const { error: profileError } = await service.from("profiles").insert({
    id: created.user.id,
    nickname: username,
    provider: "id",
  });
  if (profileError) {
    // 프로필 없는 계정은 로그인해도 쓸 데가 없다. 되돌린다.
    await service.auth.admin.deleteUser(created.user.id);
    const clash = profileError.code === "23505";
    return Response.json(
      { error: clash ? "이미 있는 아이디예요." : "가입에 실패했어요. 잠시 후 다시 시도해주세요." },
      { status: clash ? 409 : 500 },
    );
  }

  return Response.json({ ok: true });
}
