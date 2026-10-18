"use client";

import { Tour, type TourStep } from "./tour";

/**
 * 화면별 사용법 문구. 비출 대상은 각 화면에 `data-tour` 로 붙어 있다.
 *
 * 문구는 "이게 뭐고 → 누르면 어떻게 되고 → 내 녹음은 어디에 남는지" 순서로 쓴다.
 * 처음 온 사람이 실제로 막히는 질문이 그 셋이다.
 */

const HOME: TourStep[] = [
  {
    target: "home-weekly",
    title: "이번 주 보이스 챌린지",
    body: (
      <p>
        매주 월요일에 대본이 하나 열려요. 연습해서 <b>제일 잘된 녹음 하나를 출전</b>시키면 다른 사용자들이 듣고 ❤ 를
        눌러요. ❤ 많은 순서가 순위예요.
      </p>
    ),
  },
  {
    target: "home-memes",
    title: "명대사 챌린지",
    body: (
      <p>
        무야호 · 어이가 없네 같은 원본을 듣고 따라 외치면 <b>얼마나 비슷한지 점수</b>를 매겨줘요. 점수 링크를 친구에게
        보내 대결할 수 있어요.
      </p>
    ),
  },
  {
    target: "home-practice",
    title: "연습실",
    body: (
      <p>
        성우·아나운서 대본을 읽으면 속도·쉼·억양·말끝을 짚어줘요. 연습 녹음은 <b>🔒 이 폰에만</b> 남아요. 다른 사람
        의견이 궁금하면 연습 피드백 게시판에 올릴 수 있어요.
      </p>
    ),
  },
  {
    target: "home-create",
    title: "내 챌린지 만들기",
    body: (
      <p>
        내 소리 5초(말버릇·성대모사)를 녹음하면 <b>다른 사람들이 날 따라하는 챌린지</b>가 돼요. 로그인해서 만들고,
        계정에 저장돼 <b>나 → 내 챌린지</b>에서 보고 지울 수 있어요.
      </p>
    ),
  },
  {
    target: "nav",
    title: "아래 탭으로 이동해요",
    body: (
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
      </ul>
    ),
  },
  {
    target: "help",
    title: "헷갈리면 ?",
    body: <p>화면마다 위쪽 ? 를 누르면 그 화면 사용법을 다시 볼 수 있어요.</p>,
  },
];

const WEEKLY: TourStep[] = [
  {
    target: "weekly-go",
    title: "출전하는 법",
    body: (
      <p>
        누르면 이번 주 대본 연습실로 가요. 녹음하고, 마음에 드는 테이크 아래 <b>🏆 이번 주 챌린지 출전</b>을 누르면 이
        목록에 바로 올라와요. 로그인 없이 돼요.
      </p>
    ),
  },
  {
    target: "weekly-board",
    title: "듣고 ❤ 누르기",
    body: (
      <p>
        캐릭터(▶)를 누르면 들을 수 있고, 오른쪽 <b>❤ 를 누르면 좋아요</b>가 올라가요. 한 작품에 한 번, 내 작품엔 못
        눌러요. <b>❤ 많은 순서가 곧 순위</b>예요.
      </p>
    ),
  },
  {
    target: "weekly-tabs",
    title: "순위 · 새 목소리",
    body: <p>새 목소리 탭은 아직 덜 들린 출전작부터 보여줘요. 막 올라온 목소리에 ❤ 를 눌러 주세요.</p>,
  },
  {
    target: "weekly-hall",
    title: "명예의 전당",
    body: <p>일요일 밤 마감 때 1~3위가 여기와 프로필에 트로피로 남아요.</p>,
  },
];

const PRACTICE: TourStep[] = [
  {
    target: "practice-start",
    title: "대본 고르기",
    body: <p>대본을 누르면 연습 화면으로 가요. 처음이면 여기서 시작해 보세요.</p>,
  },
  {
    target: "practice-board",
    title: "연습 피드백 게시판",
    body: (
      <p>
        다른 준비생이 올린 연습을 듣고 한 줄 피드백을 남기는 곳이에요. 내 테이크는 연습 화면에서{" "}
        <b>다른 사람한테 피드백 받기</b>를 누르면 여기 올라가요. (로그인 필요 · 14일 뒤 자동 삭제)
      </p>
    ),
  },
  {
    target: "practice-filter",
    title: "찾기 · 좁히기",
    body: <p>성우·아나운서, 분류, 난이도로 대본을 좁혀요.</p>,
  },
  {
    target: "practice-add",
    title: "내 대본 넣기",
    body: <p>오디션 대본처럼 내 글을 넣어 연습해요. 넣은 대본은 이 폰에만 저장돼요.</p>,
  },
];

const ROOM: TourStep[] = [
  {
    target: "room-script",
    title: "디렉션과 대본",
    body: <p>어떤 느낌으로 읽을지(디렉션)와 목표 속도·억양이에요. 아래 대본을 보면서 읽어요.</p>,
  },
  {
    target: "room-record",
    title: "녹음하기",
    body: (
      <p>
        누르면 3·2·1 뒤에 녹음이 시작돼요. 다 읽으면 한 번 더 눌러 끝내요. 처음엔 브라우저가 마이크를 물어보니{" "}
        <b>허용</b>을 눌러 주세요.
      </p>
    ),
  },
  {
    target: "room-privacy",
    title: "연습 녹음은 내 폰에만",
    body: (
      <p>
        녹음은 🔒 이 폰에만 저장돼 아무도 못 들어요. 직접 <b>출전</b>하거나 <b>게시판에 올린</b> 테이크만 🌐 다른
        사람이 들을 수 있어요.
      </p>
    ),
  },
];

const ROOM_AFTER: TourStep[] = [
  {
    target: "room-result",
    title: "진단 결과",
    body: <p>방금 테이크의 속도·쉼·억양·말끝을 짚어줘요. 고칠 곳을 보고 다시 녹음해 비교해 보세요.</p>,
  },
  {
    target: "room-ask",
    title: "피드백 받기",
    body: (
      <p>
        누르면 이 테이크가 <b>연습 피드백 게시판</b>에 올라가 다른 사람이 듣고 한 줄 피드백을 남겨요. 14일 뒤 자동
        삭제돼요.
      </p>
    ),
  },
  {
    target: "room-enter",
    title: "이번 주 챌린지 출전",
    body: (
      <p>
        이번 주 대본이면 이 버튼으로 출전해요. 출전한 테이크는 🌐 순위 목록에 올라가고 다른 사용자들이 ❤ 를 눌러요.
      </p>
    ),
  },
  {
    target: "room-takes",
    title: "내 기록",
    body: <p>테이크가 여기 쌓여요. 눌러서 다시 보고, ▶ 로 듣고, ✕ 로 지워요. 🔒/🌐 표시로 공개 여부를 봐요.</p>,
  },
];

const RECORD: TourStep[] = [
  {
    target: "record-listen",
    title: "먼저 원본 듣기",
    body: <p>따라 할 원본 소리예요. 몇 번이고 들어 보세요.</p>,
  },
  {
    target: "record-go",
    title: "따라 외치기",
    body: (
      <p>
        누르면 원본이 한 번 나온 뒤 녹음돼요. 끝나면 <b>억양·음색·타이밍</b>을 비교해 점수를 줘요. 저장하지 않으면
        녹음은 바로 버려져요.
      </p>
    ),
  },
];

const BOARD: TourStep[] = [
  {
    target: "board-list",
    title: "올라온 연습",
    body: (
      <p>
        카드를 누르면 녹음을 듣고 <b>한 줄 피드백</b>을 남길 수 있어요. 내 연습은 연습실 테이크 아래{" "}
        <b>다른 사람한테 피드백 받기</b>로 올려요.
      </p>
    ),
  },
  {
    target: "board-tabs",
    title: "기다리는 중 · 최신",
    body: <p>기다리는 중은 피드백을 아직 못 받은 연습부터 보여줘요.</p>,
  },
];

const AVATAR: TourStep[] = [
  {
    target: "avatar-preview",
    title: "내 캐릭터",
    body: <p>녹음하면 이 캐릭터가 내 목소리에 맞춰 입을 움직여요. 누르면 외쳐 봐요.</p>,
  },
  {
    target: "avatar-presets",
    title: "바로 쓰는 캐릭터",
    body: <p>하나 누르면 통째로 바뀌어요. 🎲 랜덤도 있어요.</p>,
  },
  {
    target: "avatar-tabs",
    title: "부위별로 고치기",
    body: <p>탭을 고르고 아래에서 머리·눈·소품을 하나씩 바꿔요.</p>,
  },
  {
    target: "avatar-save",
    title: "꼭 저장",
    body: (
      <p>
        <b>이 캐릭터로 저장</b>을 눌러야 남아요. 로그인 안 했으면 이 폰에만, 로그인하면 계정에 저장돼 순위·공유
        화면에 이 캐릭터로 나와요.
      </p>
    ),
  },
];

const CREATE: TourStep[] = [
  {
    target: "create-head",
    title: "내 챌린지란?",
    body: <p>내 소리 5초를 녹음하면, 다른 사람들이 그걸 듣고 따라 외치며 점수를 받는 챌린지가 돼요.</p>,
  },
  {
    target: "create-rec",
    title: "녹음 → 이름 붙이기 → 링크",
    body: (
      <p>
        누르고 말하면 5초에 자동으로 끊겨요. 들어보고 제목을 붙이면 <b>링크가 바로 생겨요</b>. 계정에 저장돼{" "}
        <b>나 → 내 챌린지</b>에서 보고 지울 수 있고, 챌린지 목록엔 운영자가 듣고 올려요.
      </p>
    ),
  },
  {
    target: "create-gate",
    title: "로그인이 필요해요",
    body: <p>누가 만들었는지, 몇 명이 따라했는지 보여줘야 해서 챌린지는 로그인하고 만들어요.</p>,
  },
];

const ME: TourStep[] = [
  {
    target: "me-avatar",
    title: "캐릭터 꾸미기",
    body: <p>녹음할 때 내 목소리로 외치는 캐릭터를 고쳐요.</p>,
  },
  {
    target: "me-practice",
    title: "연습 기록",
    body: <p>대본마다 내 테이크가 이 폰에 쌓여 있어요.</p>,
  },
  {
    target: "me-login",
    title: "로그인하면",
    body: <p>녹음·출전작·트로피·만든 챌린지가 계정에 남아 다른 폰에서도 보여요. 로그인 없이도 다 해볼 수 있어요.</p>,
  },
];

const PROFILE: TourStep[] = [
  {
    target: "profile-avatar",
    title: "내 캐릭터",
    body: <p>눌러서 캐릭터를 고쳐요. 순위·공유 화면에 이 캐릭터로 나와요.</p>,
  },
  {
    target: "profile-weekly",
    title: "주간 챌린지 기록",
    body: <p>출전작과 트로피가 여기 남아요. 출전작을 눌러 순위를 보고 공유해요.</p>,
  },
  {
    target: "profile-posts",
    title: "피드백 받은 연습",
    body: <p>게시판에 올린 내 연습과 받은 피드백 수예요.</p>,
  },
  {
    target: "profile-challenges",
    title: "내가 만든 챌린지",
    body: <p>만든 챌린지와 상태(검토 중·공개)가 보여요. 링크를 복사해 보내요.</p>,
  },
  {
    target: "profile-recordings",
    title: "저장한 명대사 녹음",
    body: <p>🔒 나만 · 🔗 링크 · 🌐 공개 표시로 누가 들을 수 있는지 봐요. 공개를 켜고 끄거나 지울 수 있어요.</p>,
  },
];

const CHALLENGES: TourStep[] = [
  {
    target: "challenges-tabs",
    title: "종류 고르기",
    body: <p>명대사 · 친구가 만든 · 몸풀기(동물 소리) 중에 골라요.</p>,
  },
  {
    target: "challenges-list",
    title: "누르면 바로 도전",
    body: <p>원본을 듣고 따라 외치면 점수가 나와요. 점수 링크로 친구에게 도전장을 보내요.</p>,
  },
  {
    target: "challenges-create",
    title: "내 소리로 만들기",
    body: <p>내 소리 5초로 다른 사람들이 날 따라하는 챌린지를 만들어요.</p>,
  },
];

const SETS = {
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

export type TourId = keyof typeof SETS;

/** `auto={false}` 면 ? 를 눌렀을 때만 뜬다 — 공유 링크로 온 사람처럼 할 일이 정해진 경우. */
export function ScreenTour({ id, auto = true }: { id: TourId; auto?: boolean }) {
  return <Tour id={id} steps={SETS[id]} auto={auto} />;
}
