import { DEFAULT_AVATAR, normalizeAvatar, type Avatar } from "@/lib/avatar";
import { createClient } from "@/lib/supabase/server";

/**
 * 지금 보는 사람 — 로그인 여부와 캐릭터. 서버 컴포넌트 전용.
 *
 * Supabase 가 응답하지 않아도 페이지는 떠야 한다. 도전은 로그인 없이 되는 게
 * 이 앱의 약속이라, 여기서 실패하면 게스트로 취급하고 넘어간다.
 */
export async function getViewer(): Promise<{ loggedIn: boolean; avatar: Avatar }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { loggedIn: false, avatar: DEFAULT_AVATAR };

    const { data } = await supabase
      .from("profiles")
      .select("avatar")
      .eq("id", user.id)
      .maybeSingle();
    return { loggedIn: true, avatar: normalizeAvatar(data?.avatar) };
  } catch {
    return { loggedIn: false, avatar: DEFAULT_AVATAR };
  }
}
