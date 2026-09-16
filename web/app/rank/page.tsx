import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import styles from "./rank.module.css";

type RankRow = {
  user_id: string;
  meme_id: string;
  nickname: string;
  avatar_emoji: string;
  wins: number;
  losses: number;
  elo_rating: number;
};

/** TODO(Dev A): 페이지네이션, 내 순위 하이라이트. */
export default async function RankPage({
  searchParams,
}: {
  searchParams: Promise<{ meme?: string }>;
}) {
  const { meme: selectedMeme } = await searchParams;
  const supabase = await createClient();

  const [{ data: memes }, { data: rankings, error }] = await Promise.all([
    supabase.from("memes").select("id, title, emoji").order("title"),
    supabase.from("rankings").select("*"),
  ]);

  const rows = aggregate(rankings ?? [], selectedMeme);

  return (
    <main className="shell">
      <h1 className={styles.title}>🏆 랭킹</h1>
      <p className={styles.note}>Elo 레이팅 기준 · 재도전 중 가장 잘한 기록으로 집계</p>

      <div className={styles.tabs}>
        <TabLink href="/rank" active={!selectedMeme}>
          전체
        </TabLink>
        {memes?.map((m) => (
          <TabLink key={m.id} href={`/rank?meme=${m.id}`} active={selectedMeme === m.id}>
            {m.emoji} {m.title}
          </TabLink>
        ))}
      </div>

      {error && <p className={styles.warn}>랭킹을 불러오지 못했어요 ({error.message}).</p>}

      {!error && rows.length === 0 && (
        <p className={styles.empty}>아직 집계된 투표가 없어요. 투표가 쌓이면 여기 순위가 나타나요.</p>
      )}

      <ul className={styles.list}>
        {rows.map((r, i) => (
          <li key={r.user_id} className={styles.row}>
            <span className={styles.rank}>#{i + 1}</span>
            <span className={styles.name}>
              {r.avatar_emoji} {r.nickname}
            </span>
            <span className={styles.record}>
              {r.wins}승 {r.losses}패
            </span>
            <span className={styles.elo}>{r.elo_rating}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}

/** 밈이 선택되어 있으면 그 밈만(elo 순), 아니면 유저별 최고 elo로 전체 집계. */
function aggregate(rankings: RankRow[], meme?: string): RankRow[] {
  if (meme) {
    return rankings.filter((r) => r.meme_id === meme).sort((a, b) => b.elo_rating - a.elo_rating);
  }

  const byUser = new Map<string, RankRow>();
  for (const r of rankings) {
    const acc = byUser.get(r.user_id);
    if (!acc) {
      byUser.set(r.user_id, { ...r });
    } else {
      acc.wins += r.wins;
      acc.losses += r.losses;
      acc.elo_rating = Math.max(acc.elo_rating, r.elo_rating);
    }
  }
  return [...byUser.values()].sort((a, b) => b.elo_rating - a.elo_rating);
}

function TabLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className={`${styles.tab} ${active ? styles.tabActive : ""}`}>
      {children}
    </Link>
  );
}
