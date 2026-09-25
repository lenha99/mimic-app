import Link from "next/link";
import { VoiceAvatar } from "@/components/voice-avatar";
import { normalizeAvatar } from "@/lib/avatar";
import { createClient } from "@/lib/supabase/server";
import styles from "./rank.module.css";

type RankRow = {
  user_id: string;
  meme_id: string;
  nickname: string;
  avatar_emoji: string;
  avatar: unknown;
  wins: number;
  losses: number;
  elo_rating: number;
};

/**
 * 이만큼 붙어본 녹음부터 순위에 올린다.
 *
 * Elo 는 판이 쌓여야 뜻이 생긴다. 1판 이긴 녹음(1216)이 열 판 검증된 녹음보다
 * 위에 서면, 사람이 적은 지금은 순위가 "먼저 한 번 이긴 사람" 순서가 된다.
 */
const MIN_GAMES = 3;

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

  // 판 수는 밈별 녹음 단위로 센다. 전체 순위에서 밈 세 개에 한 판씩 붙은 사람이
  // 합쳐서 세 판이 됐다고 올라가면, 결국 한 판짜리 Elo 가 순위를 정한다.
  const seasoned = (r: RankRow) => r.wins + r.losses >= MIN_GAMES;
  const all = rankings ?? [];
  const rows = aggregate(all.filter(seasoned), selectedMeme);
  const ranked = new Set(rows.map((r) => r.user_id));
  const rookies = aggregate(
    all.filter((r) => !seasoned(r)),
    selectedMeme,
  )
    .filter((r) => !ranked.has(r.user_id))
    .sort((a, b) => b.wins + b.losses - (a.wins + a.losses));

  return (
    <main className="shell">
      <h1 className={styles.title}>🏆 랭킹</h1>
      <p className={styles.note}>
        &ldquo;이 목소리에 투표&rdquo;를 받은 만큼 올라가요 · {MIN_GAMES}판 이상 붙어본 녹음부터
        순위에 올라요
      </p>

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

      {!error && all.length === 0 && (
        <p className={styles.empty}>아직 집계된 투표가 없어요. 투표가 쌓이면 여기 순위가 나타나요.</p>
      )}

      <ul className={styles.list}>
        {rows.map((r, i) => (
          <li key={r.user_id} className={styles.row}>
            <span className={styles.rank}>#{i + 1}</span>
            <VoiceAvatar avatar={normalizeAvatar(r.avatar)} size={34} />
            <span className={styles.name}>{r.nickname}</span>
            <span className={styles.record}>
              {r.wins}승 {r.losses}패
            </span>
            <span className={styles.elo}>{r.elo_rating}</span>
          </li>
        ))}
      </ul>

      {rookies.length > 0 && (
        <>
          <h2 className={styles.subhead}>심사 중</h2>
          <ul className={styles.list}>
            {rookies.map((r) => (
              <li key={r.user_id} className={styles.row}>
                <VoiceAvatar avatar={normalizeAvatar(r.avatar)} size={34} />
                <span className={styles.name}>{r.nickname}</span>
                <span className={styles.record}>
                  {r.wins}승 {r.losses}패
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
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
