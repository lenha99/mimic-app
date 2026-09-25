import Link from "next/link";
import { ShoutingAvatar } from "@/components/shouting-avatar";
import { VoiceAvatar } from "@/components/voice-avatar";
import type { Avatar } from "@/lib/avatar";
import { extraLine, getMemes, playCount, type Meme } from "@/lib/memes";
import { getViewer } from "@/lib/viewer";
import styles from "./page.module.css";

/**
 * 홈은 목록이 아니라 첫 챌린지다.
 *
 * 이전 홈은 "고르기"를 첫 관문으로 세웠다 — 목록에서 하나 고르고, 상세로 들어가고,
 * 거기서 또 두 번 눌러야 소리가 났다. 고르는 행위가 체험보다 앞서면 대부분은
 * 고르다 나간다. 그래서 맨 위 하나를 바로 도전 가능한 상태로 놓고, 나머지는
 * 그 아래에 둔다.
 *
 * 첫 화면의 주인공은 캐릭터다. "녹음하면 이 녀석이 네 목소리로 외친다"를 글보다
 * 먼저 보여준다. 로그인했으면 내가 꾸민 캐릭터가 외친다 — 내 것이 움직이는 게
 * 제일 먼저 눈에 들어와야 다시 온다.
 */

/** 카드마다 조명 색을 돌린다. 같은 색이 이어지면 목록이 한 덩어리로 보인다. */
const ACCENTS = ["volt", "cyan", "pink", "lime"] as const;

/** 캐릭터 소개 줄에 세울 얼굴들. 조합이 이만큼 된다는 걸 한 줄로 보여준다. */
const CAST: { avatar: Avatar; level: number }[] = [
  { avatar: { body: "cat", color: "pink", eyes: "happy", hat: "bow" }, level: 0 },
  { avatar: { body: "bear", color: "peach", eyes: "dot", hat: "cap" }, level: 0.7 },
  { avatar: { body: "ghost", color: "lilac", eyes: "star", hat: "crown" }, level: 0.3 },
  { avatar: { body: "blob", color: "cyan", eyes: "sleepy", hat: "headset" }, level: 0 },
  { avatar: { body: "cat", color: "lime", eyes: "dot", hat: "none" }, level: 0.9 },
];

export default async function Home() {
  const [{ memes, stale }, viewer] = await Promise.all([getMemes(), getViewer()]);
  const [today, ...rest] = memes;

  // 명대사와 동물 소리는 고르는 마음이 다르다 — 하나는 "저거 나도 할 줄 알아",
  // 다른 하나는 "저건 웃기겠다". 한 줄로 섞어두면 둘 다 안 보인다.
  // 구분 기준은 line 의 유무다 (말소리 밈에만 대사가 있다는 레지스트리 규칙).
  const lines = rest.filter((m) => m.line);
  const sounds = rest.filter((m) => !m.line);

  return (
    <main className="shell">
      <header className={styles.head}>
        <span className={styles.logo}>MIMIC</span>
        <nav className={styles.nav}>
          {stale && <span className={styles.stale}>내장 목록</span>}
          <Link href="/rank" className={styles.navPill}>
            🏆 랭킹
          </Link>
          {viewer.loggedIn ? (
            <Link href="/profile" className={styles.me} aria-label="내 프로필">
              <VoiceAvatar avatar={viewer.avatar} size={34} />
            </Link>
          ) : (
            <Link href="/login" className={styles.navPill}>
              로그인
            </Link>
          )}
        </nav>
      </header>

      {today && (
        <section className={styles.hero}>
          <div className={styles.heroTop}>
            <span className={styles.kicker}>
              <span className={styles.live} aria-hidden="true" />
              오늘의 소리
            </span>
            {playCount(today) !== null ? (
              <span className={styles.plays}>
                {playCount(today)!.toLocaleString("ko-KR")}명 도전
              </span>
            ) : (
              <span className={styles.new}>NEW</span>
            )}
          </div>

          <div className={styles.stage}>
            <p className={styles.bubble}>{today.line ?? today.title}</p>
            <ShoutingAvatar avatar={viewer.avatar} size={148} />
          </div>

          <h1 className={styles.heroTitle}>
            <span aria-hidden="true">{today.emoji} </span>
            {today.title}
          </h1>
          <p className={styles.heroSource}>{today.source}</p>

          <Link href={`/record/${today.id}`} className={styles.heroGo}>
            듣고 바로 따라하기
          </Link>
          <p className={styles.heroNote}>로그인 없이 · 탭 한 번 · 점수는 몇 초 만에</p>

          <div className={styles.eq} aria-hidden="true">
            {Array.from({ length: 28 }, (_, i) => (
              <span key={i} style={{ animationDelay: `${(i * 137) % 900}ms` }} />
            ))}
          </div>
        </section>
      )}

      <ol className={styles.steps}>
        <li>
          <b>1</b> 원본 듣고
        </li>
        <li>
          <b>2</b> 따라 외치고
        </li>
        <li>
          <b>3</b> 친구한테 던지기
        </li>
      </ol>

      {lines.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>명대사</h2>
            <span>옆으로 넘겨봐 →</span>
          </div>
          <ul className={styles.rail}>
            {lines.map((m, i) => (
              <li key={m.id}>
                <LineCard meme={m} accent={ACCENTS[i % ACCENTS.length]} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {sounds.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>동물 소리</h2>
            <span>짧고 웃긴 걸로 몸풀기</span>
          </div>
          <ul className={styles.tiles}>
            {sounds.map((m) => (
              <li key={m.id}>
                <Link href={`/record/${m.id}`} className={styles.tile}>
                  <span className={styles.tileFace} aria-hidden="true">
                    {m.emoji}
                  </span>
                  <span className={styles.tileTitle}>{m.title}</span>
                  <span className={styles.tileMeta}>
                    {playCount(m) !== null
                      ? `${compact(playCount(m)!)}명`
                      : m.source}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={styles.promos}>
        <Link href={viewer.loggedIn ? "/profile" : "/login"} className={styles.promo}>
          <div className={styles.cast} aria-hidden="true">
            {CAST.map((c, i) => (
              <span key={i} style={{ animationDelay: `${i * 180}ms` }}>
                <VoiceAvatar avatar={c.avatar} level={c.level} size={52} />
              </span>
            ))}
          </div>
          <p className={styles.promoTitle}>내 목소리 캐릭터</p>
          <p className={styles.promoText}>녹음하면 이 녀석들이 네 목소리로 외쳐. 몸·색·눈·모자 골라서 꾸미기</p>
          <span className={styles.promoGo}>
            {viewer.loggedIn ? "캐릭터 꾸미러 가기 →" : "로그인하고 만들기 →"}
          </span>
        </Link>

        <Link href="/vote" className={`${styles.promo} ${styles.promoVote}`}>
          <p className={styles.promoTitle}>이 목소리에 투표</p>
          <p className={styles.promoText}>
            웃겨도 좋고, 똑같아도 좋고. 남의 녹음 둘 듣고 끌리는 쪽에 한 표
          </p>
          <span className={styles.promoGo}>투표하러 가기 →</span>
        </Link>
      </section>

      <footer className={styles.foot}>
        <p className={styles.footNote}>
          녹음은 &ldquo;저장하기&rdquo;를 눌러야만 남아요 · 저장 안 하면 바로 버려요
        </p>
        <Link href="/probe" className={styles.footLink}>
          녹음이 안 되면 마이크 검사 →
        </Link>
      </footer>
    </main>
  );
}

function LineCard({ meme, accent }: { meme: Meme; accent: (typeof ACCENTS)[number] }) {
  const line = extraLine(meme);
  return (
    <Link href={`/record/${meme.id}`} className={`${styles.card} ${styles[accent]}`}>
      <span className={styles.cardFace} aria-hidden="true">
        {meme.emoji}
      </span>
      <span className={styles.cardTitle}>{meme.title}</span>
      {/* 대사가 곧 후크다 — 뭘 외칠지가 출처보다 먼저다. */}
      {line && <span className={styles.cardLine}>“{line}”</span>}
      <span className={styles.cardFoot}>
        <span>{meme.source}</span>
        {playCount(meme) !== null ? (
          <span>{compact(playCount(meme)!)}명</span>
        ) : (
          <span className={styles.cardNew}>NEW</span>
        )}
      </span>
    </Link>
  );
}

/** 128,400 → 12.8만. 타일이 좁아서 긴 숫자는 줄바꿈된다. */
function compact(n: number): string {
  if (n >= 10_000) return `${(n / 10_000).toFixed(n >= 100_000 ? 0 : 1).replace(/\.0$/, "")}만`;
  return n.toLocaleString("ko-KR");
}
