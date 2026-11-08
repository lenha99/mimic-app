import type { Metadata } from "next";
import Link from "next/link";
import { getT } from "@/lib/i18n-server";
import { LEVEL_XP, RELAY_XP } from "@/lib/pass";
import { TITLES, writesPerDay } from "@/lib/relay";
import s from "@/components/relay/relay.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  const title = t("릴레이 더빙 가이드", "Relay Dubbing guide");
  return { title, description: t("한 줄 녹음으로 장면을 같이 만드는 법 — 배역·갈림길·개봉·제작 계급", "How Relay Dubbing works") };
}

/** 가이드 — 처음 온 사람이 실제로 묻는 순서: 뭐 하는 거? → 내 차례엔? → 사람이 없으면? → 레벨 오르면? */
export default async function RelayGuidePage() {
  const t = await getT();
  const ko = t("ko", "en") === "ko";
  return (
    <main className={`shell ${s.page}`}>
      <Link href="/relay" className={s.back}>
        ‹ {t("릴레이 더빙", "Relay Dubbing")}
      </Link>
      <p className={s.kicker}>GUIDE</p>
      <h1 className={s.h1}>{t("릴레이 더빙 가이드", "Relay Dubbing guide")}</h1>

      <div className={s.guide}>
        <h2>{t("① 뭐 하는 거예요?", "① What is it?")}</h2>
        <p>
          {t(
            "장면 하나는 대사 10줄이에요. 여러 사람이 한 줄씩 녹음해서 이어 붙이면 장면이 완성돼요. 아무도 안 한 줄은 AI 대역(TTS)이 읽어 주니까, 혼자 한 줄만 해도 장면은 굴러가요.",
            "A scene is 10 lines. People record one line each and the takes join into a full scene. TTS reads any empty line, so even one voice keeps it going.",
          )}
        </p>
        <p>
          {t("상영관은 두 곳이 동시에 열려요.", "Two halls run at once.")} <b>{t("🎭 연기관", "🎭 Act hall")}</b>
          {t(" — 모험·애니·영화·호러. ", " — adventure, anime, movies. ")}
          <b>{t("🎙 현실관", "🎙 Real-life hall")}</b>
          {t(" — 면접·아나운서·뉴스·스피치. 가끔 둘이 섞인 크로스오버(마왕이 면접을 본다든가)도 나와요.", " — interviews, announcing, news, speeches. Sometimes they cross over.")}
        </p>

        <h2>{t("② 내 차례엔 버튼 하나", "② One button on your turn")}</h2>
        <ol>
          <li>{t("상영 중인 장면 카드에서 하고 싶은 배역의 「이 배역 하기」를 눌러요. 고르기 귀찮으면 아래 「아무 배역이나 바로」 — 앱이 연습실 기록을 보고 어울리는 배역을 골라 줘요.", "On a scene card, tap “Play this” next to the role you want. Or tap “Any role, now” and we pick one that fits your practice history.")}</li>
          <li>{t("🎙 를 누르면 앞 사람 대사가 흘러나오고, 끝나자마자 녹음이 시작돼요.", "Tap 🎙 — the previous line plays, then you record.")}</li>
          <li>{t("녹음이 끝나면 「앞 대사 + 내 목소리」가 바로 이어서 나와요. 마음에 들면 ✓ 출연하기, 아니면 다시.", "You instantly hear “previous line + you”. Appear, or retake.")}</li>
          <li>{t("출연하고 5초 안에는 되돌릴 수 있어요. 출연한 녹음은 장면에 공개돼요.", "You can undo within 5 seconds. Takes you appear with are public in the scene.")}</li>
        </ol>
        <p>{t("장면 전체는 개봉 때 처음부터 끝까지 이어서 상영돼요. 장면 화면의 「지금까지 이어 듣기」로 미리 들어 볼 수도 있어요.", "The full scene plays at the premiere; you can preview it on the scene page.")}</p>

        <h2>{t("③ 배역 규칙", "③ Role rules")}</h2>
        <ul>
          <li>
            <b>{t("한 장면에 배역은 한 사람 하나.", "One role per person per scene.")}</b> {t("여러 목소리가 섞여야 재밌으니까요.", "Mixed voices are the fun part.")}
          </li>
          <li>
            <b>{t("처음 녹음한 사람이 그 배역의 주인", "First to record owns the role")}</b>
            {t(" — 그 배역의 나머지 줄은 24시간 동안 주인 차례예요. 24시간이 지나도 비어 있으면 누구나 녹음할 수 있어요.", " — the rest of that role's lines are theirs for 24h, then open to anyone.")}
          </li>
          <li>
            <b>{t("막판 캐스팅", "Last-call casting")}</b>
            {t(" — 개봉 24시간 전부터는 아직 아무도 없는 배역을 하나 더 맡을 수 있어요(최대 둘).", " — in the last 24h you can take one more empty role (max two).")}
          </li>
          <li>
            <b>{t("감독 지명", "Director casting")}</b>
            {t(" — 감독이 나를 지명하면 알림이 오고, 녹음 버튼을 누르면 그 배역이 먼저 나와요.", " — if a director casts you, you get a notification and that role comes first.")}
          </li>
        </ul>

        <h2>{t("④ 갈림길과 개봉", "④ Branches & premiere")}</h2>
        <ul>
          <li>
            <b>{t("6번·10번은 갈림길", "Lines 6 and 10 are branches")}</b>
            {t(" — 작가들이 다른 대사를 쓸 수 있어요. 배우가 녹음하는 게 곧 투표, 가장 많은 사람이 녹음한 대사가 정식판에 들어가요(같으면 먼저 쓴 대사). 2위는 「B 루트」로 따로 들을 수 있어요.", " — writers add alternatives; recording one is a vote. The most-recorded makes the cut; runner-up becomes Route B.")}
          </li>
          <li>
            <b>{t("반전 카드", "Twist card")}</b>
            {t(" — LV6 작가가 쓰는 대체 결말. 투표 없이 「반전판」으로 상영돼요.", " — an alternate ending by LV6 writers, shown as the Twist cut.")}
          </li>
          <li>
            <b>{t("사흘째 밤 9시 무조건 개봉", "Premieres on night 3 at 9 pm, always")}</b>
            {t(" — 개봉하면 엔딩 크레딧에 이름이 올라가고, 그 상영관에 바로 다음 장면이 열려요. 일주일 동안 가장 많이 끝까지 들은 개봉작은 「이주의 명작」.", " — credits roll and the next scene opens. Most-listened premiere of the week becomes Scene of the Week.")}
          </li>
        </ul>

        <h2 id="ranks">{t("⑤ 제작 계급 — VOICE PASS 레벨", "⑤ Ranks — your VOICE PASS level")}</h2>
        <p>{t("연습실·갤러리·릴레이 어디서 얻은 XP든 같은 레벨로 쌓여요.", "XP from anywhere in the app counts toward the same level.")}</p>
        <ol className={s.ladder} style={{ paddingLeft: 0 }}>
          {TITLES.map((x) => (
            <li key={x.id} className={s.rung}>
              <span className={s.rungIcon} aria-hidden="true">
                {x.icon}
              </span>
              <span>
                <b>
                  LV{x.from} {ko ? x.ko : x.en}
                </b>
                <small>{ko ? x.perkKo : x.perkEn}</small>
              </span>
              <span className={s.tiny}>{LEVEL_XP[x.from - 1]} XP</span>
            </li>
          ))}
        </ol>
        <ul>
          <li>{t(`작가는 하루 ${writesPerDay(5)}줄(LV6 ${writesPerDay(6)}줄 · LV8 ${writesPerDay(8)}줄). 대사 쓰기·장면 열기는 로그인이 필요해요.`, `Writers: ${writesPerDay(5)} lines/day (LV6 ${writesPerDay(6)}, LV8 ${writesPerDay(8)}). Writing and directing need log-in.`)}</li>
          <li>{t("감독은 한 주에 한 편(LV9 두 편). 첫 두 편은 운영자가 확인한 뒤 상영돼요.", "Directors: one scene a week (two at LV9). The first two are reviewed.")}</li>
          <li>{t("레벨 1도 「이런 장면 보고 싶어요」로 상황을 신청할 수 있어요. 뽑히면 크레딧에 원안으로.", "Anyone can pitch a premise; picked pitches get an idea credit.")}</li>
        </ul>

        <h2>{t("⑥ XP", "⑥ XP")}</h2>
        <ul>
          <li>{t(`출연(장면마다) +${RELAY_XP.act}`, `Appear (per scene) +${RELAY_XP.act}`)}</li>
          <li>{t(`장면 개봉(출연한 장면) +${RELAY_XP.premiere} · 이주의 명작 +${RELAY_XP.best}`, `Premiere you're in +${RELAY_XP.premiere} · Scene of the week +${RELAY_XP.best}`)}</li>
          <li>{t(`갈림길 녹음(투표) +${RELAY_XP.vote} (하루 ${RELAY_XP.votePerDay}번) · 감독 OK +${RELAY_XP.ok}`, `Branch vote +${RELAY_XP.vote} (${RELAY_XP.votePerDay}/day) · Director OK +${RELAY_XP.ok}`)}</li>
          <li>{t(`내가 쓴 대사를 누가 녹음 +${RELAY_XP.voiced} (하루 ${RELAY_XP.voicedPerDay}번) · 내 대사가 정식판에 +${RELAY_XP.win}`, `Someone voices your line +${RELAY_XP.voiced} (${RELAY_XP.voicedPerDay}/day) · Your line wins +${RELAY_XP.win}`)}</li>
          <li>{t(`내 상황 신청이 장면이 됨 +${RELAY_XP.prompt}`, `Your pitch becomes a scene +${RELAY_XP.prompt}`)}</li>
        </ul>

        <h2>{t("⑦ 사람이 없으면?", "⑦ What if nobody shows up?")}</h2>
        <ul>
          <li>
            <b>{t("배우가 없으면", "No actors")}</b> → {t("그 줄은 AI 대역(TTS)이 배역 목소리로 읽어요. 장면은 그대로 개봉.", "TTS reads the line; the scene still premieres.")}
          </li>
          <li>
            <b>{t("애드리브 배우가 없으면", "No ad-libs")}</b> → {t("애드리브 없이 깔끔하게 이어져요.", "Lines just play clean.")}
          </li>
          <li>
            <b>{t("작가가 없으면", "No writers")}</b> → {t("갈림길은 원래 대본 대사로 가요.", "Branches keep the original line.")}
          </li>
          <li>
            <b>{t("감독이 없으면", "No directors")}</b> → {t("코코 PD가 준비해 둔 장면 25편이 차례로 돌아요. NG/OK가 없으면 배역 주인 → 먼저 녹음한 순으로.", "Coco PD's 25 stock scenes rotate. Without stamps, the role owner's take wins, then the earliest.")}
          </li>
          <li>
            <b>{t("아무도 출연 안 한 장면", "A scene with zero actors")}</b> → {t("개봉 대신 조용히 내려가고 나중에 다시 상영돼요.", "Quietly pulled and re-run later.")}
          </li>
        </ul>

        <h2>{t("⑧ 이런 분께 이렇게", "⑧ Who it helps")}</h2>
      </div>
      <div className={s.tracks}>
        <div className={s.track}>
          <b>🎌 {t("애니·성우 연습", "Anime / VO")}</b>
          <span>{t("연기관의 애니 배역. 앞 대사에 반응해서 받아치는 「호흡」 연습이 돼요. LV3부터 애드리브로 캐릭터를 더 살려요.", "Anime roles in the Act hall — practise reacting to a cue.")}</span>
        </div>
        <div className={s.track}>
          <b>🎬 {t("연기·영화", "Acting")}</b>
          <span>{t("느와르·로맨스·법정. 감독의 NG 디렉션(\"더 비열하게\")대로 다시 녹음해 보세요.", "Noir, romance, courtroom — retake with a director's NG note.")}</span>
        </div>
        <div className={s.track}>
          <b>📺 {t("아나운서·뉴스", "Announcer / news")}</b>
          <span>{t("현실관의 앵커·기자·캐스터 배역. 정해진 길이 안에 또박또박 — 시간 막대가 기준이에요.", "Anchor and reporter roles — clear delivery within the time bar.")}</span>
        </div>
        <div className={s.track}>
          <b>🎤 {t("면접·스피치", "Interview / speech")}</b>
          <span>{t("면접관 질문을 듣고 바로 답하는 지원자 배역. 실제 면접처럼 「질문 → 바로 대답」 순발력 연습.", "Hear the question, answer right away — like a real interview.")}</span>
        </div>
      </div>
      <div className={s.bottomBarNav}>
        <Link href="/relay/rec" className={s.cta}>
          🎙 {t("한 줄 녹음하러 가기", "Record a line")}
        </Link>
      </div>
    </main>
  );
}
