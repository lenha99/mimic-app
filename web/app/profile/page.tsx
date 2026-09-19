import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "./sign-out-button";
import { NicknameEditor } from "./nickname-editor";
import { ClaimPending } from "./claim-pending";
import styles from "./profile.module.css";

/**
 * TODO(Dev A): 내 녹음 목록, 내 순위 뱃지.
 * profiles row는 /auth/callback의 ensureProfile()이 첫 로그인 때 만들어줌.
 */
export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (
    <main className="shell">
      <div className={styles.head}>
        <div>
          <div className="eyebrow">마이 프로필</div>
          <p className={styles.email}>{user.email ?? user.id}</p>
        </div>
        <SignOutButton />
      </div>

      <ClaimPending />

      {profile ? (
        <div className={styles.card}>
          <p className={styles.nickname}>
            {profile.avatar_emoji} {profile.nickname}
          </p>
          <NicknameEditor userId={user.id} initialNickname={profile.nickname} />
        </div>
      ) : (
        <p className={styles.warn}>
          profiles row 생성이 실패한 것 같아요. 콜백 로직(ensureProfile)이나
          profiles insert RLS 정책을 확인해주세요.
        </p>
      )}
    </main>
  );
}
