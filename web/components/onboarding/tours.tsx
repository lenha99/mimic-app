"use client";

import { useT } from "@/components/lang";
import type { T } from "@/lib/i18n";
import { Tour, type TourStep } from "./tour";

/**
 * 화면별 사용법 문구. 비출 대상은 각 화면에 `data-tour` 로 붙어 있다.
 *
 * 문구는 "이게 뭐고 → 누르면 어떻게 되고 → 내 녹음은 어디에 남는지" 순서로 쓴다.
 * 처음 온 사람이 실제로 막히는 질문이 그 셋이다.
 */
const sets = (t: T) => {
  const HOME: TourStep[] = [
    {
      target: "home-stories",
      title: t("이번 주 올라온 목소리", "This week's voices"),
      body: t(
        <p>
          동그라미 하나가 목소리 하나예요. <b>색 테두리는 아직 안 들어 본 목소리</b>, 누르면 바로 들을 수 있어요. 맨 앞{" "}
          <b>+ 내 목소리</b>를 누르면 연습실로 가요 — 아무 대본이나 골라 녹음하고 올리면 돼요.
        </p>,
        <p>
          Each circle is one voice. <b>A colored ring means you haven&apos;t heard it yet</b> — tap to listen. Tap <b>+ Your voice</b>{" "}
          to open the Practice Room — pick any script, record, and post.
        </p>,
      ),
    },
    {
      target: "home-practice",
      title: t("연습실 — 여기서 시작해요", "Practice Room — start here"),
      body: t(
        <p>
          성우·아나운서·스피치 대본을 골라 읽으면 <b>코코가 대본대로 읽었는지</b> 대본 위에 형광펜으로 짚어 줘요.
          <b> 내 목소리 타입</b>도 알려 줘요. 녹음은 🔒 이 폰에만 남아요. 뭘 읽을지 모르겠으면 아래 <b>이번 주 추천 대본</b>부터.
        </p>,
        <p>
          Pick a script and read it — <b>Coco highlights what you skipped or misread</b> right on the script. You also get your{" "}
          <b>voice type</b>. Takes stay 🔒 on this phone. Not sure what to read? Start with <b>this week&apos;s pick</b> below.
        </p>,
      ),
    },
    {
      target: "home-weekly",
      title: t("목소리 갤러리 — 올리고 ❤ 받기", "Voice gallery — post & get ❤"),
      body: t(
        <p>
          잘 나온 테이크는 갤러리에 올릴 수 있어요. <b>어떤 대본이든</b> 이번 주에 올린 목소리는 모두 같은 <b>❤ 순위</b>에 들어가고,
          매주 1~3위는 명예의 전당에 남아요. 올리기 전에 ✨ 목소리 보정을 켤 수 있고, 가입 없이 돼요.
        </p>,
        <p>
          Post your best take to the gallery. Voices posted this week on <b>any script</b> share one <b>❤ ranking</b>, and the weekly
          top 3 go to the Hall of Fame. You can switch on ✨ voice polish before posting. No sign-up needed.
        </p>,
      ),
    },
    {
      target: "top-activity",
      title: t("♡ 활동", "♡ Activity"),
      body: t(
        <p>
          누가 내 목소리를 듣고 · 구독했는지, 구독한 목소리가 새로 올렸는지 여기 모여요. <b>구독 중</b> 탭에서 내가 구독한
          목소리를 한눈에 봐요.
        </p>,
        <p>
          Who listened to or subscribed to your voice, and new takes from voices you follow. The <b>Following</b> tab lists everyone you
          subscribe to.
        </p>,
      ),
    },
    {
      target: "top-dm",
      title: t("✈ 메시지", "✈ Messages"),
      body: t(
        <p>
          내 목소리를 <b>구독한 사람만</b> 말을 걸 수 있고, 받아주기 전엔 요청 1개만 와요. 마음에 드는 목소리가 있으면
          구독하고 메시지를 보내 보세요(로그인 필요).
        </p>,
        <p>
          Only <b>your subscribers</b> can message you, and just one request until you accept. Like a voice? Subscribe and say hi (log-in
          needed).
        </p>,
      ),
    },
    {
      target: "top-lang",
      title: t("🌐 언어", "🌐 Language"),
      body: t(<p>누르면 영어 ↔ 한국어로 바뀌어요. 친구가 받은 링크는 그 사람 폰 언어로 열려요.</p>, <p>Switch between English and Korean. Links you share open in the receiver&apos;s language.</p>),
    },
    {
      target: "home-portfolio",
      title: t("내 목소리 페이지", "Your voice page"),
      body: t(
        <p>
          출전작 · ❤ · 트로피 · 구독자를 모은 <b>나만의 링크</b>예요. 인스타 프로필에 걸어 두면 거기서 바로 듣고 구독해요.
          로그인하면 생겨요.
        </p>,
        <p>
          <b>Your own link</b> with your entries, ❤, trophies and subscribers. Put it in your Instagram bio so people can listen and
          subscribe. Log in to get one.
        </p>,
      ),
    },
    {
      target: "home-voice",
      title: t("더 놀거리", "More to try"),
      body: t(
        <ul>
          <li>
            <b>음역대 테스트</b> — 10초면 내 최고음·최저음 등급
          </li>
          <li>
            <b>명대사 따라하기</b> — 원본과 얼마나 똑같은지 점수로 친구와 대결
          </li>
        </ul>,
        <ul>
          <li>
            <b>Vocal range</b> — your high and low tiers in 10 seconds
          </li>
          <li>
            <b>Movie lines</b> — copy a famous line, get scored, challenge friends
          </li>
        </ul>,
      ),
    },
    {
      target: "nav",
      title: t("아래 탭으로 이동해요", "Get around with the tabs"),
      body: t(
        <ul>
          <li>
            <b>목소리</b> — 올라온 목소리 듣기 · ❤ 순위 · 운영자 픽
          </li>
          <li>
            <b>연습실</b> — 대본 연습 · 피드백 게시판
          </li>
          <li>
            <b>나</b> — 캐릭터 · 내 출전작 · 알림 설정
          </li>
        </ul>,
        <ul>
          <li>
            <b>Voices</b> — listen to everyone · editor&apos;s picks · this week&apos;s script
          </li>
          <li>
            <b>Practice</b> — script practice · feedback board
          </li>
          <li>
            <b>Me</b> — your character · entries · alert settings
          </li>
        </ul>,
      ),
    },
    {
      target: "help",
      title: t("헷갈리면 사용법 보기", "Stuck? Tap 💡 Guide"),
      body: t(
        <p>화면마다 위쪽 💡 사용법 보기를 누르면 그 화면의 버튼을 하나씩 알려드려요.</p>,
        <p>Tap 💡 at the top of any screen and we&apos;ll walk you through its buttons.</p>,
      ),
    },
  ];

  const VOICES: TourStep[] = [
    {
      target: "voices-pick",
      title: t("⭐ 운영자 픽", "⭐ Editor's pick"),
      body: t(
        <p>운영자가 직접 듣고 고른 단 하나의 목소리예요. 새 픽이 나올 때까지 여기와 홈 맨 위에 걸려 있고, 내려가도 &lsquo;지난 픽&rsquo;으로 남아요.</p>,
        <p>The one voice the team hand-picked. It stays here and at the top of Home until the next pick, then moves to Past picks.</p>,
      ),
    },
    {
      target: "voices-prompt",
      title: t("이번 주 추천 대본", "This week's pick"),
      body: t(
        <p>
          뭘 읽을지 모를 때를 위한 추천이에요. <b>다른 대본으로 올려도 똑같이 ❤ 순위</b>에 들어가요. 연습실에서 몇 번이고 연습한 뒤
          마음에 드는 테이크를 올리면 돼요. <b>이번 주 8명이 올리면 ❤ 순위판</b>이 열려요.
        </p>,
        <p>
          A suggestion for when you don&apos;t know what to read — <b>any script counts the same for ❤</b>. Practice as much as you like,
          then post your favorite take. <b>Once 8 people post this week, the ❤ ranking board opens.</b>
        </p>,
      ),
    },
    {
      target: "voices-filter",
      title: t("정렬", "Sort"),
      body: t(<p>최신 · ♥ 인기 · 이번 주 대본만 골라 볼 수 있어요.</p>, <p>Latest, most ♥, or just this week&apos;s script.</p>),
    },
    {
      target: "voices-list",
      title: t("얼굴을 누르면 바로 들려요", "Tap a face to listen"),
      body: t(
        <p>
          아래에 재생 막대가 떠요. 이름을 누르면 그 목소리 화면으로 가서 <b>♥ · 🔔 구독 · 💬 메시지</b>를 할 수 있어요. 배지는 그 녹음에서 잘한 점이에요.
        </p>,
        <p>
          A player pops up at the bottom. Tap the name to open the voice page — <b>♥, 🔔 subscribe, 💬 message</b>. Badges show what the take did well.
        </p>,
      ),
    },
  ];

  const WEEKLY: TourStep[] = [
    {
      target: "weekly-hero",
      title: t("이번 주 ❤ 순위", "This week's ❤ ranking"),
      body: t(
        <p>
          이번 주(월요일 ~ 일요일 밤 12시)에 올린 목소리는 <b>대본과 상관없이</b> 모두 같은 ❤ 순위에 들어가요. 위에 보이는 건
          뭘 읽을지 모를 때를 위한 <b>추천 대본</b>이에요.
        </p>,
        <p>
          Every voice posted this week (Mon – Sun midnight KST) joins the same ❤ ranking, <b>whatever the script</b>. The one up top
          is just <b>this week&apos;s pick</b> in case you don&apos;t know what to read.
        </p>,
      ),
    },
    {
      target: "weekly-board",
      title: t("출전작 — 듣고 ❤ 누르기", "Entries — listen & ❤"),
      body: t(
        <p>
          다른 사람들이 올린 녹음이에요. 캐릭터(▶)를 누르면 들을 수 있고, 오른쪽 <b>❤ 를 누르면 응원</b>이 돼요. 한
          작품에 한 번, 내 작품엔 못 눌러요. <b>❤ 많은 순서가 곧 순위</b>예요.
        </p>,
        <p>
          Takes from other players. Tap a character (▶) to listen and <b>tap ❤ to cheer</b>. One ❤ per entry, not on
          your own. <b>Most ❤ = top rank</b>.
        </p>,
      ),
    },
    {
      target: "weekly-tabs",
      title: t("순위 · 새 목소리", "Top · New voices"),
      body: t(
        <p>
          새 목소리 탭은 아직 덜 들린 출전작부터 보여줘요. 추천 대본으로 올리면 <b>친구에게 1:1 대결</b>을 신청해서 같은
          대본으로 맞붙을 수도 있어요.
        </p>,
        <p>
          New voices shows the least-heard entries first. Post on this week&apos;s pick to <b>challenge a friend 1:1</b> on the
          same script.
        </p>,
      ),
    },
    {
      target: "weekly-go",
      title: t("나도 올리려면", "Want to post?"),
      body: t(
        <p>
          이 버튼은 이번 주 추천 대본으로 가요. 다른 대본이 좋으면 연습실에서 아무거나 골라도 돼요. 녹음해 보고, 마음에 드는
          테이크 아래 <b>이 목소리 들려주기</b>를 누르면 바로 올라가요! 가입 없이도 돼요.
        </p>,
        <p>
          This opens this week&apos;s pick — or choose any script in the Practice Room. Record a few takes, then hit{" "}
          <b>Let people hear this</b> under the one you like — it goes live right away. No sign-up needed.
        </p>,
      ),
    },
    {
      target: "weekly-hall",
      title: t("명예의 전당", "Hall of Fame"),
      body: t(
        <p>마감되면 1~3위가 여기와 프로필에 트로피로 영원히 남아요.</p>,
        <p>When the week closes, the top 3 get trophies here and on their profiles — forever.</p>,
      ),
    },
  ];

  const PRACTICE: TourStep[] = [
    {
      target: "practice-intro",
      title: t("연습실", "Practice Room"),
      body: t(
        <p>
          성우·아나운서 대본을 혼자 연습하는 곳이에요. 녹음하면 <b>코코의 심사표</b>가 대본대로 읽었는지 짚어 주고 목소리 타입도
          알려 줘요. 연습 녹음은 <b>🔒 이 폰에만</b> 남고, 잘 나온 테이크는 목소리 갤러리에 올릴 수 있어요.
        </p>,
        <p>
          Solo practice with Korean voice-acting and anchor scripts. <b>Coco&apos;s scorecard</b> checks you read it word for
          word and gives you a voice type. Takes stay <b>🔒 on this phone</b>; post your best one to the voice gallery.
        </p>,
      ),
    },
    {
      target: "practice-start",
      title: t("오늘의 연습", "Today's practice"),
      body: t(
        <p>뭘 읽을지 고민될 땐 오늘의 한 편부터. 매일 바뀌고, 안 읽은 대본 중에서 골라 줘요. 아래 목표 칩(면접·발음·감정…)으로 바로 좁혀 볼 수도 있어요.</p>,
        <p>Not sure what to read? Start with today&apos;s pick — it changes daily and favors scripts you haven&apos;t read. Or jump in by goal with the chips below.</p>,
      ),
    },
    {
      target: "practice-board",
      title: t("서로 들어주기", "Listen to each other"),
      body: t(
        <p>
          피드백을 원하는 목소리가 모인 갤러리로 가요. 듣고 댓글로 한 줄 남겨 보세요. 내 테이크는 연습 화면에서{" "}
          <b>들려주기</b>를 누를 때 <b>피드백도 받을래요</b>를 켜 두면 돼요.
        </p>,
        <p>
          Opens the gallery of voices asking for feedback. Listen and leave a line as a comment. For your own take, keep{" "}
          <b>I&apos;d like feedback too</b> on when you post.
        </p>,
      ),
    },
    {
      target: "practice-filter",
      title: t("찾기 · 좁히기", "Filter"),
      body: t(
        <p>성우·아나운서, 분류, 난이도로 대본을 좁혀 보세요.</p>,
        <p>Narrow scripts by track, category and level.</p>,
      ),
    },
    {
      target: "practice-add",
      title: t("내 대본 넣기", "Add your own script"),
      body: t(
        <p>오디션 대본처럼 내 글을 넣어 연습할 수 있어요. 넣은 대본은 이 폰에만 저장돼요.</p>,
        <p>Paste your own text, like an audition script. It&apos;s saved on this phone only.</p>,
      ),
    },
  ];

  const ROOM: TourStep[] = [
    {
      target: "room-head",
      title: t("대본 연습 화면", "Practice screen"),
      body: t(
        <p>이 대본 하나를 연습하는 화면이에요. 위에서부터 디렉션 → 대본 → 맨 아래 녹음 버튼 순서예요.</p>,
        <p>Everything for one script: direction → script → record button at the bottom.</p>,
      ),
    },
    {
      target: "room-script",
      title: t("디렉션과 대본", "Direction & script"),
      body: t(
        <p>어떤 느낌으로 읽을지(디렉션)와 목표 속도·억양이에요. 아래 대본을 보면서 읽어 보세요.</p>,
        <p>How to read it (direction) plus target pace and pitch. Read the script below out loud.</p>,
      ),
    },
    {
      target: "room-record",
      title: t("녹음하기", "Record"),
      body: t(
        <p>
          누르면 3·2·1 뒤에 녹음이 시작돼요. 다 읽으면 한 번 더 눌러 끝내요. 처음엔 브라우저가 마이크 권한을 물어보니{" "}
          <b>허용</b>을 눌러 주세요.
        </p>,
        <p>
          Tap to record after 3·2·1, tap again when done. Your browser will ask for the mic the first time — tap{" "}
          <b>Allow</b>.
        </p>,
      ),
    },
    {
      target: "room-privacy",
      title: t("연습 녹음은 내 폰에만", "Practice takes stay private"),
      body: t(
        <p>
          녹음은 🔒 이 폰에만 저장돼 아무도 못 들어요. <b>목소리 갤러리</b>나 <b>피드백 게시판</b>에 직접 올린 테이크만 🌐 다른
          사람이 들을 수 있어요.
        </p>,
        <p>
          Takes are 🔒 saved on this phone only. Only takes you <b>post to the gallery</b> or <b>the feedback board</b> can be 🌐 heard
          by others.
        </p>,
      ),
    },
  ];

  const ROOM_AFTER: TourStep[] = [
    {
      target: "room-result",
      title: t("진단 결과", "Your notes"),
      body: t(
        <p>
          <b>🦜 코코한테 확인받기</b>를 누르면 빠뜨리거나 다르게 읽은 말을 대본 위에 형광펜으로 표시해요. 표시는 다음 테이크를
          녹음할 때도 남아 있으니 보면서 고쳐 읽어 보세요(확인은 테이크당 한 번). 아래엔 목소리 타입과 속도·쉼·억양 폭·말끝 수치가 있어요.
        </p>,
        <p>
          Tap <b>🦜 Ask Coco to check</b> and skipped or misread words get highlighted on the script — and stay there while you record your next take.
          Below: your voice type plus pace, pauses, pitch range and endings.
        </p>,
      ),
    },
    {
      target: "room-enter",
      title: t("이 목소리 들려주기", "Let people hear it"),
      body: t(
        <p>누르면 바로 올라가요(5초 안에 되돌리기 가능). 다른 사람들이 듣고 ❤ 를 누르면 XP 가 쌓여요. 언제든 내릴 수 있어요.</p>,
        <p>One tap and it&apos;s live (undo within 5 seconds). When people listen and ❤, you earn XP. Remove it anytime.</p>,
      ),
    },
    {
      target: "room-takes",
      title: t("내 기록", "Your takes"),
      body: t(
        <p>테이크가 여기 쌓여요. 눌러서 다시 보고, ▶ 로 듣고, ✕ 로 지워요. 🔒/🌐 표시로 공개 여부를 확인하세요.</p>,
        <p>Takes pile up here. Tap to review, ▶ to listen, ✕ to delete. 🔒/🌐 shows who can hear it.</p>,
      ),
    },
  ];

  const RECORD: TourStep[] = [
    {
      target: "record-listen",
      title: t("먼저 원본 듣기", "Hear the original first"),
      body: t(<p>따라 할 원본 소리예요. 몇 번이고 들어 보세요.</p>, <p>This is what you&apos;ll copy. Listen as many times as you like.</p>),
    },
    {
      target: "record-go",
      title: t("따라 외치기", "Say it back"),
      body: t(
        <p>
          원본을 한 번 들려드린 뒤, 준비되면 <b>따라 하기 시작</b>을 눌러 녹음해요. 끝나면 <b>억양·음색·타이밍</b>을
          비교해 점수를 드려요. 저장하지 않으면 녹음은 바로 사라져요.
        </p>,
        <p>
          We play the original once, then tap <b>Start</b> when ready. You&apos;ll be scored on <b>pitch, tone and
          rhythm</b>. Unsaved takes are deleted right away.
        </p>,
      ),
    },
  ];

  const BOARD: TourStep[] = [
    {
      target: "board-intro",
      title: t("연습 피드백 게시판", "Feedback board"),
      body: t(
        <p>준비생끼리 서로의 연습 녹음을 듣고 한 줄씩 짚어주는 곳이에요.</p>,
        <p>Learners listen to each other&apos;s practice and leave one-line notes.</p>,
      ),
    },
    {
      target: "board-list",
      title: t("올라온 연습", "Posted takes"),
      body: t(
        <p>
          카드를 누르면 녹음을 듣고 <b>한 줄 피드백</b>을 남길 수 있어요. 내 연습은 연습실 테이크 아래{" "}
          <b>피드백 받기</b>로 올려요.
        </p>,
        <p>
          Tap a card to listen and leave <b>a one-line note</b>. Post yours via <b>Get feedback</b> under a practice
          take.
        </p>,
      ),
    },
    {
      target: "board-tabs",
      title: t("기다리는 중 · 최신", "Waiting · Latest"),
      body: t(<p>기다리는 중은 아직 피드백을 못 받은 연습부터 보여줘요.</p>, <p>Waiting shows takes with no feedback yet first.</p>),
    },
  ];

  const AVATAR: TourStep[] = [
    {
      target: "avatar-preview",
      title: t("내 캐릭터", "Your character"),
      body: t(
        <p>녹음하면 이 캐릭터가 내 목소리에 맞춰 입을 움직여요. 누르면 외쳐 봐요.</p>,
        <p>When you record, this character lip-syncs to your voice. Tap it to hear a shout.</p>,
      ),
    },
    {
      target: "avatar-presets",
      title: t("바로 쓰는 캐릭터", "Ready-made characters"),
      body: t(<p>하나 누르면 통째로 바뀌어요. 🎲 랜덤도 있어요.</p>, <p>Tap one to swap everything. There&apos;s 🎲 random too.</p>),
    },
    {
      target: "avatar-tabs",
      title: t("부위별로 고치기", "Customize parts"),
      body: t(<p>탭을 고르고 아래에서 머리·눈·소품을 하나씩 바꿔요.</p>, <p>Pick a tab, then change hair, eyes and props below.</p>),
    },
    {
      target: "avatar-save",
      title: t("꼭 저장하기", "Don't forget to save"),
      body: t(
        <p>
          <b>이 캐릭터로 저장</b>을 눌러야 남아요. 로그인 전엔 이 폰에만, 로그인하면 계정에 저장돼 순위·공유 화면에 이
          캐릭터로 나와요.
        </p>,
        <p>
          Tap <b>Save this character</b> to keep it. Logged out it&apos;s saved on this phone; logged in it shows up on
          rankings and shares.
        </p>,
      ),
    },
  ];

  const CREATE: TourStep[] = [
    {
      target: "create-head",
      title: t("내 챌린지란?", "What's a custom challenge?"),
      body: t(
        <p>내 목소리 5초를 녹음하면, 다른 사람들이 그걸 듣고 따라 외치며 점수를 받는 챌린지가 돼요.</p>,
        <p>Record 5 seconds of your voice, and others try to copy it and get scored.</p>,
      ),
    },
    {
      target: "create-rec",
      title: t("녹음 → 제목 → 링크", "Record → name → link"),
      body: t(
        <p>
          누르고 말하면 5초 뒤 자동으로 끊겨요. 들어보고 제목을 붙이면 <b>링크가 바로 생겨요</b>. <b>나 → 내 챌린지</b>
          에서 보고 지울 수 있고, 챌린지 목록엔 운영자가 확인 후 올려요.
        </p>,
        <p>
          Tap and talk — it stops after 5 seconds. Give it a title and <b>your link is ready</b>. Manage it under{" "}
          <b>Me → My challenges</b>; we review it before it appears in the public list.
        </p>,
      ),
    },
    {
      target: "create-gate",
      title: t("로그인이 필요해요", "Login required"),
      body: t(
        <p>누가 만들었는지, 몇 명이 따라 했는지 보여드려야 해서 챌린지는 로그인 후 만들 수 있어요.</p>,
        <p>We show who made it and how many people tried, so creating needs a login.</p>,
      ),
    },
  ];

  const ME: TourStep[] = [
    {
      target: "me-head",
      title: t("나", "Me"),
      body: t(
        <p>로그인하지 않아도 캐릭터·닉네임·연습 기록이 이 폰에 저장돼요.</p>,
        <p>Even without logging in, your character, nickname and practice history are saved on this phone.</p>,
      ),
    },
    {
      target: "me-nickname",
      title: t("닉네임", "Nickname"),
      body: t(
        <p>목소리를 올리면 이 이름으로 보여요. 안 정하면 &lsquo;익명의 목소리&rsquo;로 나와요.</p>,
        <p>This is the name on voices you post. Skip it and you&apos;ll show up as &lsquo;Anonymous voice&rsquo;.</p>,
      ),
    },
    {
      target: "me-avatar",
      title: t("캐릭터 꾸미기", "Style your character"),
      body: t(<p>녹음할 때 내 목소리로 외치는 캐릭터를 꾸며요.</p>, <p>The character that shouts in your voice when you record.</p>),
    },
    {
      target: "me-practice",
      title: t("연습 기록", "Practice history"),
      body: t(<p>대본마다 내 테이크가 이 폰에 쌓여 있어요.</p>, <p>Your takes for each script, stored on this phone.</p>),
    },
    {
      target: "me-login",
      title: t("로그인하면", "Why log in?"),
      body: t(
        <p>녹음·출전작·트로피가 계정에 남고, <b>누가 구독했는지</b> 보이고 <b>메시지</b>를 주고받고, <b>내 목소리 페이지</b> 링크가 생겨요. 물론 로그인 없이도 다 해볼 수 있어요.</p>,
        <p>Keep your takes, entries and trophies, see <b>who subscribed</b>, send <b>messages</b>, and get your own <b>voice page</b> link. You can try everything without it, too.</p>,
      ),
    },
  ];

  const PROFILE: TourStep[] = [
    {
      target: "profile-nick",
      title: t("닉네임", "Nickname"),
      body: t(<p>순위·게시판에 보이는 이름이에요. 눌러서 바꿀 수 있어요.</p>, <p>Shown on rankings and the board. Tap to change.</p>),
    },
    {
      target: "profile-avatar",
      title: t("내 캐릭터", "Your character"),
      body: t(
        <p>눌러서 캐릭터를 꾸며요. 순위·공유 화면에 이 캐릭터로 나와요.</p>,
        <p>Tap to customize. This character appears on rankings and shares.</p>,
      ),
    },
    {
      target: "profile-weekly",
      title: t("주간 챌린지 기록", "Weekly challenge history"),
      body: t(
        <p>출전작과 트로피가 여기 남아요. 출전작을 눌러 순위를 보고 공유해 보세요.</p>,
        <p>Your entries and trophies. Tap an entry to see its rank and share it.</p>,
      ),
    },
    {
      target: "profile-challenges",
      title: t("내가 만든 챌린지", "Challenges you made"),
      body: t(
        <p>만든 챌린지와 상태(검토 중·공개)가 보여요. 링크를 복사해 친구에게 보내 보세요.</p>,
        <p>Your challenges and their status (in review / live). Copy the link and send it to friends.</p>,
      ),
    },
    {
      target: "profile-recordings",
      title: t("저장한 명대사 녹음", "Saved line takes"),
      body: t(
        <p>🔒 나만 · 🔗 링크 · 🌐 공개 표시로 누가 들을 수 있는지 확인하세요. 공개를 켜고 끄거나 지울 수 있어요.</p>,
        <p>🔒 Only me · 🔗 Link · 🌐 Public show who can listen. Toggle public or delete anytime.</p>,
      ),
    },
  ];

  const CHALLENGES: TourStep[] = [
    {
      target: "challenges-head",
      title: t("명대사 챌린지", "Line Challenge"),
      body: t(
        <p>원본을 듣고 따라 외치면 얼마나 똑같은지 점수로 알려드려요. 가볍게 즐기는 곳이에요.</p>,
        <p>Hear the original, say it back, see how close you got. Pure fun.</p>,
      ),
    },
    {
      target: "challenges-tabs",
      title: t("종류 고르기", "Pick a category"),
      body: t(
        <p>명대사 · 친구가 만든 · 몸풀기(동물 소리) 중에 골라 보세요.</p>,
        <p>Movie lines · Made by friends · Warm-ups (animal sounds).</p>,
      ),
    },
    {
      target: "challenges-list",
      title: t("누르면 바로 도전", "Tap to play"),
      body: t(
        <p>원본을 듣고 따라 외치면 점수가 나와요. 점수 링크로 친구에게 도전장을 보내 보세요.</p>,
        <p>Listen, copy, get your score — then send the score link to challenge a friend.</p>,
      ),
    },
    {
      target: "challenges-create",
      title: t("내 목소리로 만들기", "Make one with your voice"),
      body: t(
        <p>내 목소리 5초로 다른 사람들이 날 따라 하는 챌린지를 만들어요.</p>,
        <p>Turn 5 seconds of your voice into a challenge for others.</p>,
      ),
    },
  ];

  return {
    home: HOME,
    weekly: WEEKLY,
    voices: VOICES,
    practice: PRACTICE,
    room: ROOM,
    room_after: ROOM_AFTER,
    record: RECORD,
    board: BOARD,
    avatar: AVATAR,
    create: CREATE,
    me: ME,
    profile: PROFILE,
    challenges: CHALLENGES,
  } satisfies Record<string, TourStep[]>;
};

export type TourId = keyof ReturnType<typeof sets>;

/** 화면의 "사용법 보기"(TourHelp)를 누르면 뜬다. */
export function ScreenTour({ id }: { id: TourId }) {
  const t = useT();
  return <Tour id={id} steps={sets(t)[id]} />;
}
