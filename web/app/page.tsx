import Link from "next/link";
import { HomeBeacon } from "@/components/home-beacon";
import { MyShoutingAvatar, ViewerBadge } from "@/components/viewer";
import { ViewerWelcome } from "@/components/viewer-welcome";
import { VoiceAvatar } from "@/components/voice-avatar";
import { PRESETS } from "@/lib/avatar";
import { listApprovedChallenges } from "@/lib/challenges";
import { extraLine, getMemes, playCount, type Meme } from "@/lib/memes";
import { createPublicClient } from "@/lib/supabase/public";
import styles from "./page.module.css";

/**
 * 정적 페이지로 두고 5분마다 다시 만든다.
 *
 * 요청마다 서버에서 그리던 때는 첫 응답이 6초였다 — 트래픽이 없으니 매번
 * 콜드 스타트였고, 그 뒤로 Modal 카탈로그와 Supabase 까지 기다렸다. 카톡 링크를
 * 눌렀는데 6초 동안 하얀 화면이면 대부분 닫는다. 누구인지(로그인·내 캐릭터)는
 * 브라우저에서 나중에 채운다 (components/viewer).
 */
export const revalidate = 300;

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

/** 캐릭터 소개 줄에 세울 얼굴들 — 이런 녀석들까지 된다는 걸 한 줄로 보여준다. */
const CAST = ["버럭이", "슬픔이", "아저씨", "할머니", "MZ"].map((name, i) => ({
  avatar: PRESETS.find((p) => p.name === name)!.avatar,
  level: [0.7, 0, 0.3, 0, 0.9][i],
}));

export default async function Home() {
  const [{ memes }, social, friends] = await Promise.all([
    getMemes(),
    socialReady(),
    listApprovedChallenges(),
  ]);

  const today = pickToday(memes);
  const rest = memes.filter((m) => m !== today);

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
          {/* 카탈로그 서버가 늦으면 내장 목록(FALLBACK)으로 그린다. 사용자에겐 의미 없는 말이라 안 보인다. */}
          {social && (
            <Link href="/rank" className={styles.navPill}>
              🏆 랭킹
            </Link>
          )}
          <Link href="/avatar" className={styles.navPill}>
            🎨 캐릭터
          </Link>
          <ViewerBadge />
        </nav>
      </header>

      <ViewerWelcome todayId={today?.id} todayTitle={today?.title} />

      {today && (
        <section className={styles.hero}>
          <div className={styles.heroTop}>
            <span className={styles.kicker}>
              <span className={styles.live} aria-hidden="true" />
              오늘의 소리
            </span>
            {playCount(today) !== null && (
              <span className={styles.plays}>
                {playCount(today)!.toLocaleString("ko-KR")}명 도전
              </span>
            )}
          </div>

          <div className={styles.stage}>
            <p className={styles.bubble}>{today.line ?? today.title}</p>
            <MyShoutingAvatar size={148} />
          </div>

          <h1 className={styles.heroTitle}>
            <span aria-hidden="true">{today.emoji} </span>
            {today.title}
          </h1>
          <p className={styles.heroSource}>{today.source}</p>

          <Link href={`/record/${today.id}`} className={styles.heroGo}>
            듣고 바로 따라하기
          </Link>
          <p className={styles.heroNote}>로그인 없이 · 탭 한 번이면 시작</p>

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

      {friends.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>친구들이 만든 챌린지</h2>
            <Link href="/create">나도 만들기 →</Link>
          </div>
          <ul className={styles.rail}>
            {friends.map((m, i) => (
              <li key={m.id}>
                <LineCard meme={m} accent={ACCENTS[(i + 2) % ACCENTS.length]} />
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
        {/* 콘텐츠가 모자란 걸 사용자 목소리로 메운다. 만든 사람이 곧 링크를 던진다. */}
        <Link href="/create" className={`${styles.promo} ${styles.promoCreate}`}>
          <p className={styles.promoTitle}>🎤 내 소리로 챌린지 만들기</p>
          <p className={styles.promoText}>
            엄마 전화 받는 소리, 친구 말버릇, 사투리 한마디. 5초 녹음하면 친구들이 날 따라해
          </p>
          <span className={styles.promoGo}>만들러 가기 →</span>
        </Link>

        <Link href="/avatar" className={styles.promo}>
          <div className={styles.cast} aria-hidden="true">
            {CAST.map((c, i) => (
              <span key={i} style={{ animationDelay: `${i * 180}ms` }}>
                <VoiceAvatar avatar={c.avatar} level={c.level} size={52} />
              </span>
            ))}
          </div>
          <p className={styles.promoTitle}>내 목소리 캐릭터</p>
          <p className={styles.promoText}>
            버럭이·슬픔이부터 아저씨·할머니까지. 녹음하면 이 녀석이 네 목소리로 외쳐
          </p>
          <span className={styles.promoGo}>내 캐릭터 만들기 →</span>
        </Link>

        {social && (
          <Link href="/vote" className={`${styles.promo} ${styles.promoVote}`}>
            <p className={styles.promoTitle}>이 목소리에 투표</p>
            <p className={styles.promoText}>
              웃겨도 좋고, 똑같아도 좋고. 남의 녹음 둘 듣고 끌리는 쪽에 한 표
            </p>
            <span className={styles.promoGo}>투표하러 가기 →</span>
          </Link>
        )}
      </section>

      <HomeBeacon />

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
        {playCount(meme) !== null && <span>{compact(playCount(meme)!)}명</span>}
      </span>
    </Link>
  );
}

/**
 * "오늘의 소리"는 정말 날마다 바뀐다(한국 시간 자정 기준). 예전엔 목록 첫 줄이
 * 고정으로 앉아 있어서 "오늘의"가 거짓말이었고, 다시 올 이유도 못 만들었다.
 * 페이지가 5분마다 다시 만들어지므로 자정이 지나면 늦어도 5분 안에 바뀐다.
 */
function pickToday(memes: Meme[]): Meme | undefined {
  if (memes.length === 0) return undefined;
  const day = Math.floor((Date.now() + 9 * 3_600_000) / 86_400_000);
  return memes[day % memes.length];
}

/**
 * 투표·랭킹을 홈에 내세워도 되는가.
 *
 * 대결은 같은 밈에 공개 녹음이 둘 이상 있어야 만들어진다. 그 전에 홈에서 "투표"를
 * 내세우면 새로 온 사람은 로그인 벽을 넘고 빈 방을 본다 — 죽은 앱처럼 보인다.
 * 조건이 채워지는 순간 저절로 나타난다(5분 안에).
 */
async function socialReady(): Promise<boolean> {
  try {
    const { data } = await createPublicClient()
      .from("recordings")
      .select("meme_id")
      .eq("is_public", true)
      .eq("hidden", false)
      .limit(1000);
    const per = new Map<string, number>();
    for (const r of data ?? []) per.set(r.meme_id, (per.get(r.meme_id) ?? 0) + 1);
    return [...per.values()].some((n) => n >= 2);
  } catch {
    return false;
  }
}

/** 128,400 → 12.8만. 타일이 좁아서 긴 숫자는 줄바꿈된다. */
function compact(n: number): string {
  if (n >= 10_000) return `${(n / 10_000).toFixed(n >= 100_000 ? 0 : 1).replace(/\.0$/, "")}만`;
  return n.toLocaleString("ko-KR");
}
