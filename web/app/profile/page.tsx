import { redirect } from "next/navigation";
import { BackHome } from "@/components/back-home";
import { signAudio } from "@/lib/audio-url";
import { normalizeAvatar } from "@/lib/avatar";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "./sign-out-button";
import { NicknameEditor } from "./nickname-editor";
import { ClaimPending } from "./claim-pending";
import { DeleteAccount } from "./delete-account";
import { AvatarEditor } from "./avatar-editor";
import { MyRecordings, type MyRecording } from "./my-recordings";
import styles from "./profile.module.css";

/**
 * TODO(Dev A): 내 순위 뱃지.
 * profiles row는 /auth/callback의 ensureProfile()이 첫 로그인 때 만들어줌.
 */
export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: profile }, { data: recordings }, { data: memes }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("recordings")
      .select("id, meme_id, score, grade, is_public, hidden, audio_path, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("memes").select("id, title"),
  ]);

  // 내 녹음만 조회했으니(user_id 조건 + RLS) 서명해도 된다.
  const urls = await signAudio((recordings ?? []).map((r) => r.audio_path));
  const items: MyRecording[] = (recordings ?? []).map((r) => ({
    id: r.id,
    memeTitle: memes?.find((m) => m.id === r.meme_id)?.title ?? r.meme_id,
    score: r.score,
    grade: r.grade,
    isPublic: r.is_public,
    hidden: r.hidden,
    audioUrl: urls.get(r.audio_path) ?? null,
    createdAt: r.created_at,
  }));

  return (
    <main className="shell">
      <BackHome />
      <div className={styles.head}>
        <div>
          <div className="eyebrow">마이 프로필</div>
          <p className={styles.email}>
            {/* 아이디 가입자의 이메일은 내부 주소라 보여줄 이유가 없다 (lib/id-account.ts). */}
            {typeof user.user_metadata?.username === "string"
              ? `@${user.user_metadata.username}`
              : (user.email ?? user.id)}
          </p>
        </div>
        <SignOutButton />
      </div>

      <ClaimPending />

      {profile ? (
        <div className={styles.stack}>
          <div className={styles.card}>
            <p className={styles.nickname}>{profile.nickname}</p>
            <NicknameEditor userId={user.id} initialNickname={profile.nickname} />
          </div>
          <AvatarEditor userId={user.id} initial={normalizeAvatar(profile.avatar)} />
          <MyRecordings items={items} />
          <DeleteAccount />
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
