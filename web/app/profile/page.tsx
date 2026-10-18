import { redirect } from "next/navigation";
import { signAudio } from "@/lib/audio-url";
import { normalizeAvatar } from "@/lib/avatar";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "./sign-out-button";
import { NicknameEditor } from "./nickname-editor";
import { ClaimPending } from "./claim-pending";
import { DeleteAccount } from "./delete-account";
import Link from "next/link";
import { VoiceAvatar } from "@/components/voice-avatar";
import { MyChallenges, type MyChallenge } from "./my-challenges";
import { MyRecordings, type MyRecording } from "./my-recordings";
import { MyPracticePosts } from "./my-practice-posts";
import { myPosts } from "@/lib/board-server";
import { isAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/service";
import { AdminLinks } from "./admin-links";
import { MyWeekly } from "./my-weekly";
import { myAwards, myEntries } from "@/lib/weekly-server";
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
      .select("id, meme_id, score, grade, is_public, shared, hidden, audio_path, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("memes").select("id, title"),
  ]);
  // 내 챌린지 (RLS: 내 것은 상태와 상관없이 보인다).
  const { data: challenges } = await supabase
    .from("challenges")
    .select("id, title, emoji, line, status")
    .eq("creator_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);

  const [practicePosts, admin, awards, weeklyEntries] = await Promise.all([
    myPosts(user.id).catch(() => []),
    adminCounts(),
    myAwards(user.id).catch(() => []),
    myEntries(user.id).catch(() => []),
  ]);

  // 내 녹음만 조회했으니(user_id 조건 + RLS) 서명해도 된다.
  const urls = await signAudio((recordings ?? []).map((r) => r.audio_path));
  const items: MyRecording[] = (recordings ?? []).map((r) => ({
    id: r.id,
    memeTitle: memes?.find((m) => m.id === r.meme_id)?.title ?? r.meme_id,
    score: r.score,
    grade: r.grade,
    isPublic: r.is_public,
    shared: Boolean(r.shared),
    hidden: r.hidden,
    audioUrl: urls.get(r.audio_path) ?? null,
    createdAt: r.created_at,
  }));

  return (
    <main className="shell">
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
          {admin && <AdminLinks pending={admin.pending} feedback={admin.feedback} reported={admin.reported} />}
          <div className={styles.card}>
            <p className={styles.nickname}>{profile.nickname}</p>
            <NicknameEditor userId={user.id} initialNickname={profile.nickname} />
          </div>
          <Link href="/avatar" className={styles.avatarCard}>
            <VoiceAvatar avatar={normalizeAvatar(profile.avatar)} size={72} />
            <span>
              <strong>내 캐릭터</strong>
              <em>버럭이·할머니·MZ… 꾸미러 가기 →</em>
            </span>
          </Link>
          {/* 동적 페이지라 요청 시각이 곧 지금이다. */}
          {/* eslint-disable-next-line react-hooks/purity */}
          <MyWeekly awards={awards} entries={weeklyEntries} now={Date.now()} />
          <MyPracticePosts items={practicePosts} />
          <MyChallenges items={(challenges ?? []) as MyChallenge[]} />
          <MyRecordings items={items} />
          <Link href="/?intro=1" className={styles.guideLink}>
            사용법 다시 보기 →
          </Link>
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

/** 운영자면 메뉴에 띄울 숫자, 아니면 null. */
async function adminCounts(): Promise<{ pending: number; feedback: number; reported: number } | null> {
  if (!(await isAdmin())) return null;
  const service = createServiceClient();
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [{ count: pending }, { count: feedback }, { count: reported }] = await Promise.all([
    service.from("challenges").select("id", { count: "exact", head: true }).eq("status", "pending"),
    service.from("app_feedback").select("id", { count: "exact", head: true }).gte("created_at", since),
    service.from("weekly_entries").select("id", { count: "exact", head: true }).gt("reports", 0),
  ]);
  return { pending: pending ?? 0, feedback: feedback ?? 0, reported: reported ?? 0 };
}
