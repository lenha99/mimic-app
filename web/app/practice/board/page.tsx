import type { Metadata } from "next";
import Link from "next/link";
import { BOARD_TRACK_LABEL, POST_DAYS } from "@/lib/board";
import { listPosts } from "@/lib/board-server";
import { ago } from "@/lib/practice";
import { createClient } from "@/lib/supabase/server";
import { ScreenTour } from "@/components/onboarding/tours";
import { TourHelp } from "@/components/onboarding/tour";
import styles from "./board.module.css";

export const metadata: Metadata = {
  title: "연습 피드백",
  description: "성우·아나운서 준비생끼리 서로의 낭독을 듣고 짚어주는 곳.",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/**
 * 연습 피드백 게시판 목록.
 *
 * 기본 정렬은 "기다리는 중" — 피드백이 적은 것부터. 첫 피드백이 제일 받기 어렵고,
 * 한 번도 못 받은 사람은 다시 안 올린다. 최신순은 탭으로 둔다.
 */
export default async function BoardPage({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
  const sort = (await searchParams).sort === "new" ? "new" : "waiting";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const posts = await listPosts(user?.id ?? null, sort);

  return (
    <main className="shell">
      <TourHelp id="board" corner />
      <nav className={styles.top}>
        <Link href="/practice" className={styles.back}>
          ← 연습실
        </Link>
      </nav>

      <header className={styles.intro} data-tour="board-intro">
        <p className={styles.eyebrow}>연습 피드백</p>
        <h1 className={styles.h1}>서로 들어주기</h1>
        <p className={styles.lede}>
          준비생끼리 낭독을 듣고 짚어줘요. 한 줄이면 충분해요 — 내가 남긴 만큼 내 연습에도 돌아와요.
          올린 녹음은 {POST_DAYS}일 뒤 지워져요.
        </p>
      </header>

      <div className={styles.tabs} data-tour="board-tabs">
        <Link href="/practice/board" className={sort === "waiting" ? styles.tabOn : styles.tab}>
          피드백 기다리는 중
        </Link>
        <Link href="/practice/board?sort=new" className={sort === "new" ? styles.tabOn : styles.tab}>
          최신
        </Link>
      </div>

      {posts.length === 0 ? (
        <div className={styles.demo} data-tour="board-list">
          <p className={styles.demoHead}>
            <span className={styles.demoBadge}>예시</span>
            아직 올라온 연습이 없어서, 올리면 어떻게 보이는지 예시로 보여드려요.
          </p>
          <div className={`${styles.card} ${styles.demoCard}`} aria-hidden="true">
            <span className={styles.cardTop}>
              <span className={styles.track}>아나운서</span>
              <span className={styles.who}>새벽라디오 · 방금</span>
            </span>
            <span className={styles.cardTitle}>뉴스 오프닝</span>
            <span className={styles.ask}>“문장 끝이 자꾸 올라가는데 어떻게 들리나요?”</span>
            <span className={styles.countZero}>아직 피드백 없음 · 첫 번째로 들어주기</span>
          </div>
          <ol className={styles.steps}>
            <li>
              <b>1</b>
              <span>연습실에서 대본을 읽어 녹음해요</span>
            </li>
            <li>
              <b>2</b>
              <span>테이크 아래 <em>🎧 다른 사람한테 피드백 받기</em>를 눌러요 — 듣고 싶은 점을 한 줄 적어요</span>
            </li>
            <li>
              <b>3</b>
              <span>위 카드처럼 여기 올라와요. 다른 사람이 카드를 눌러 듣고 한 줄 피드백을 남겨요</span>
            </li>
            <li>
              <b>4</b>
              <span>받은 피드백은 연습 화면과 <em>나 → 피드백 받은 연습</em>에서 봐요</span>
            </li>
          </ol>
          <p className={styles.demoNote}>
            🌐 올린 녹음·대본·닉네임은 다른 사람이 볼 수 있어요 · 로그인 필요 · {POST_DAYS}일 뒤 자동 삭제
          </p>
          <Link href="/practice" className={styles.emptyGo}>
            연습하러 가기 →
          </Link>
        </div>
      ) : (
        <ol className={styles.list} data-tour="board-list">
          {posts.map((p) => (
            <li key={p.id}>
              <Link href={`/practice/board/${p.id}`} className={styles.card}>
                <span className={styles.cardTop}>
                  <span className={styles.track}>{BOARD_TRACK_LABEL[p.track]}</span>
                  <span className={styles.who}>
                    {p.nickname}
                    {p.mine && <i> · 나</i>} · {ago(Date.parse(p.createdAt))}
                  </span>
                </span>
                <span className={styles.cardTitle}>{p.title}</span>
                {p.ask && <span className={styles.ask}>“{p.ask}”</span>}
                <span className={p.notes === 0 ? styles.countZero : styles.count}>
                  {p.notes === 0 ? "아직 피드백 없음 · 첫 번째로 들어주기" : `피드백 ${p.notes}개`}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
      <ScreenTour id="board" />
    </main>
  );
}
