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
      target: "home-weekly",
      title: t("이번 주 보이스 챌린지", "This week's voice challenge"),
      body: t(
        <p>
          매주 월요일, 대본이 하나 열려요. 연습해서 <b>가장 잘 나온 녹음 하나를 출전</b>시키면 다른 사람들이 듣고 ❤ 를
          눌러요. ❤ 가 많을수록 순위가 올라가요.
        </p>,
        <p>
          A new script drops every Monday. Practice, then <b>enter your best take</b> — others listen and tap ❤. Most ❤
          wins.
        </p>,
      ),
    },
    {
      target: "home-memes",
      title: t("명대사 챌린지", "Line Challenge"),
      body: t(
        <p>
          무야호 · 어이가 없네 같은 원본을 듣고 따라 외치면 <b>얼마나 똑같은지 점수</b>로 알려드려요. 점수 링크를 친구에게
          보내서 대결해 보세요.
        </p>,
        <p>
          Hear an iconic Korean movie or meme line, say it back, and get scored on <b>how close you sound</b>. Send the
          score link to a friend and go head to head.
        </p>,
      ),
    },
    {
      target: "home-practice",
      title: t("연습실", "Practice Room"),
      body: t(
        <p>
          성우·아나운서 대본을 읽으면 속도·쉼·억양·말끝을 짚어드려요. 연습 녹음은 <b>🔒 이 폰에만</b> 남아요. 다른 사람
          의견이 궁금하면 피드백 게시판에 올려 보세요.
        </p>,
        <p>
          Read voice-acting and news scripts (in Korean) and get notes on pace, pauses, intonation and endings. Practice
          takes stay <b>🔒 on this phone</b>. Want opinions? Post to the feedback board.
        </p>,
      ),
    },
    {
      target: "home-voice",
      title: t("목소리 음역대 테스트", "Vocal range test"),
      body: t(
        <p>
          1부터 10까지 세고, ‘음~’ 끝까지 내리고, ‘아~’ 끝까지 올리면 <b>평소 목소리 음·최저음·최고음</b>이 건반 위에
          나와요. 녹음 파일은 <b>🔒 만들지 않고</b>, 결과는 스토리 이미지로 자랑할 수 있어요.
        </p>,
        <p>
          Count to 10, hum down as low as you can, then slide up as high as you can — your <b>speaking note, lowest and
          highest note</b> light up on a keyboard. <b>🔒 Nothing is recorded</b>; share it as a story image.
        </p>,
      ),
    },
    {
      target: "nav",
      title: t("아래 탭으로 이동해요", "Get around with the tabs"),
      body: t(
        <ul>
          <li>
            <b>챌린지</b> — 이번 주 순위 · 듣고 ❤ 누르기
          </li>
          <li>
            <b>연습실</b> — 대본 연습 · 피드백 게시판
          </li>
          <li>
            <b>나</b> — 캐릭터 꾸미기 · 내 녹음·출전작·만든 챌린지
          </li>
        </ul>,
        <ul>
          <li>
            <b>Challenge</b> — this week&apos;s ranking · listen and ❤
          </li>
          <li>
            <b>Practice</b> — script practice · feedback board
          </li>
          <li>
            <b>Me</b> — your character · takes, entries, challenges
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

  const WEEKLY: TourStep[] = [
    {
      target: "weekly-hero",
      title: t("주간 보이스 챌린지", "Weekly voice challenge"),
      body: t(
        <p>
          매주 월요일에 <b>대본 하나</b>가 열리고 일요일 밤 12시에 마감돼요. 모두 같은 대본을 읽고, 누가 제일 잘 읽었는지
          ❤ 로 겨뤄요.
        </p>,
        <p>
          <b>One script</b> opens every Monday and closes Sunday at midnight (KST). Everyone reads the same lines — ❤
          decides who did it best.
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
          새 목소리 탭은 아직 덜 들린 출전작부터 보여줘요. 출전하고 나면 <b>친구에게 1:1 대결</b>을 신청해서 같은
          대본으로 맞붙을 수도 있어요.
        </p>,
        <p>
          New voices shows the least-heard entries first. Once you enter, you can <b>challenge a friend 1:1</b> on the
          same script.
        </p>,
      ),
    },
    {
      target: "weekly-go",
      title: t("나도 출전하려면", "Want to enter?"),
      body: t(
        <p>
          이 버튼을 누르면 이번 주 대본 연습 화면으로 가요. 녹음해 보고, 마음에 드는 테이크 아래{" "}
          <b>🏆 이번 주 챌린지 출전</b>을 누르면 끝! 가입 없이도 돼요.
        </p>,
        <p>
          This takes you to this week&apos;s script. Record a few takes, then hit <b>🏆 Enter this week</b> under the one
          you like. No sign-up needed.
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
          성우·아나운서 대본을 혼자 연습하는 곳이에요. 녹음하면 속도·쉼·억양·말끝을 짚어드리고, 연습 녹음은{" "}
          <b>🔒 이 폰에만</b> 남아요.
        </p>,
        <p>
          Solo practice with Korean voice-acting and anchor scripts. We flag pace, pauses, intonation and endings, and
          takes stay <b>🔒 on this phone</b>.
        </p>,
      ),
    },
    {
      target: "practice-start",
      title: t("대본 고르기", "Pick a script"),
      body: t(
        <p>대본을 누르면 연습 화면으로 가요. 처음이라면 여기서 시작해 보세요.</p>,
        <p>Tap a script to start practicing. New here? Start with this one.</p>,
      ),
    },
    {
      target: "practice-board",
      title: t("연습 피드백 게시판", "Feedback board"),
      body: t(
        <p>
          다른 준비생의 연습을 듣고 한 줄 피드백을 남기는 곳이에요. 내 테이크는 연습 화면에서{" "}
          <b>피드백 받기</b>를 누르면 올라가요. (로그인 필요 · 14일 뒤 자동 삭제)
        </p>,
        <p>
          Listen to other learners and leave one-line notes. Post your own take with <b>Get feedback</b> on the practice
          screen. (Login required · auto-deleted after 14 days)
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
          녹음은 🔒 이 폰에만 저장돼 아무도 못 들어요. 직접 <b>출전</b>하거나 <b>게시판에 올린</b> 테이크만 🌐 다른
          사람이 들을 수 있어요.
        </p>,
        <p>
          Takes are 🔒 saved on this phone only. Only takes you <b>enter</b> or <b>post to the board</b> can be 🌐 heard
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
        <p>방금 테이크의 속도·쉼·억양·말끝을 짚어드려요. 고칠 곳을 확인하고 다시 녹음해 비교해 보세요.</p>,
        <p>Pace, pauses, intonation and endings for that take. Check what to fix, record again, compare.</p>,
      ),
    },
    {
      target: "room-ask",
      title: t("피드백 받기", "Get feedback"),
      body: t(
        <p>
          누르면 이 테이크가 <b>연습 피드백 게시판</b>에 올라가고, 다른 사람이 듣고 한 줄 피드백을 남겨요. 14일 뒤 자동
          삭제돼요.
        </p>,
        <p>
          Posts this take to the <b>feedback board</b> so others can leave a one-line note. Auto-deleted after 14 days.
        </p>,
      ),
    },
    {
      target: "room-enter",
      title: t("이번 주 챌린지 출전", "Enter this week"),
      body: t(
        <p>이번 주 대본이라면 이 버튼으로 출전해요. 출전한 테이크는 🌐 순위에 올라가고 다른 사람들이 ❤ 를 눌러요.</p>,
        <p>If this is this week&apos;s script, enter here. Your take goes 🌐 on the ranking for others to ❤.</p>,
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
        <p>챌린지에 출전하면 이 이름으로 보여요. 안 정하면 &lsquo;익명의 목소리&rsquo;로 나와요.</p>,
        <p>This is the name on your entries. Skip it and you&apos;ll show up as &lsquo;Anonymous voice&rsquo;.</p>,
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
        <p>녹음·출전작·트로피·만든 챌린지가 계정에 남아 다른 폰에서도 보여요. 물론 로그인 없이도 다 해볼 수 있어요.</p>,
        <p>Keep your takes, entries, trophies and challenges across devices. You can try everything without it, too.</p>,
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
      target: "profile-posts",
      title: t("피드백 받은 연습", "Takes with feedback"),
      body: t(<p>게시판에 올린 내 연습과 받은 피드백 수예요.</p>, <p>Your board posts and how much feedback they got.</p>),
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
