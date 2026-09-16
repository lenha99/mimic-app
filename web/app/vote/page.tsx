import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { VoteMatch } from "./vote-match";
import styles from "./vote.module.css";

/**
 * TODO(Dev A/B 공유 계약, 이슈 #17): 게스트(비로그인) 투표 허용 여부가 아직 미결정이라
 * 지금은 로그인 유저만 투표 가능하게 막아둠.
 *
 * 매칭은 get_vote_matchup() RPC가 담당한다 — 노출(투표 등장) 횟수가 적은 순으로 우선하고,
 * 응모작이 2개 이상인 밈 중에서만 고른다. 그런 밈이 하나도 없으면 빈 결과가 온다.
 */
export default async function VotePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="shell">
        <div className={styles.empty}>
          <h1 className={styles.title}>🗳️ 투표하려면 로그인이 필요해요</h1>
          <Link href="/login" className={styles.loginBtn}>
            로그인하러 가기
          </Link>
        </div>
      </main>
    );
  }

  const { data: matchup, error } = await supabase.rpc("get_vote_matchup", {
    p_exclude_user: user.id,
  });

  if (error || !matchup || matchup.length < 2) {
    return (
      <main className="shell">
        <p className={styles.empty}>
          아직 투표할 녹음이 없어요. 먼저 밈을 따라 해보고 결과 화면에서 공개해보세요!
        </p>
      </main>
    );
  }

  const [a, b] = matchup;
  const { data: meme } = await supabase
    .from("memes")
    .select("id, title, emoji")
    .eq("id", a.meme_id)
    .single();

  return (
    <main className="shell">
      <h1 className={styles.title}>
        {meme?.emoji} {meme?.title} 배틀
      </h1>
      <p className={styles.sub}>둘 중 더 웃긴 건?</p>
      <VoteMatch memeId={a.meme_id} recordingA={a} recordingB={b} />
    </main>
  );
}
