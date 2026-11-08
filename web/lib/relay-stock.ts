// 생성물 — tools/make_relay_tts.py 가 content/relay_scenes.json 에서 만든다. 직접 고치지 말 것.
import type { StockScene } from "@/lib/relay";

export const RELAY_STOCK: StockScene[] = [
 {
  "key": "demon_final",
  "hall": "act",
  "genre": "fantasy",
  "title": "마왕성 최후의 밤",
  "logline": "드디어 마왕 앞에 선 용사 일행. 그런데 마왕의 표정이 이상하다.",
  "roles": [
   {
    "id": "hero",
    "name": "용사",
    "type": "anime",
    "voice": "m_young",
    "desc": "끝까지 포기 안 하는 열혈 주인공"
   },
   {
    "id": "demon",
    "name": "마왕",
    "type": "anime",
    "voice": "m_deep",
    "desc": "천 년을 기다린 여유만만 악역"
   },
   {
    "id": "mage",
    "name": "마법사",
    "type": "anime",
    "voice": "f_bright",
    "desc": "똑똑하지만 겁 많은 동료"
   }
  ],
  "lines": [
   {
    "n": 1,
    "role": "hero",
    "text": "여기까지다, 마왕! 네 악행도 오늘로 끝이야!",
    "dir": "온 힘을 다해 외치며",
    "tip": "기합: 첫 마디에 힘 싣기",
    "tts": "/relay/tts/demon_final/1.mp3?v=cfb5efae58",
    "sec": 5.38
   },
   {
    "n": 2,
    "role": "demon",
    "text": "크크크… 기다리고 있었다, 용사여.",
    "dir": "느긋하게 비웃으며",
    "tip": "악역 저음: 숨을 섞어 낮게",
    "tts": "/relay/tts/demon_final/2.mp3?v=fe8194ec0c",
    "sec": 6.14
   },
   {
    "n": 3,
    "role": "mage",
    "text": "용사님, 조심하세요! 마력이 엄청나요!",
    "dir": "다급하게",
    "tip": "속도: 빠르지만 또렷하게",
    "tts": "/relay/tts/demon_final/3.mp3?v=1057cef672",
    "sec": 4.54
   },
   {
    "n": 4,
    "role": "hero",
    "text": "괜찮아. 우리가 여기까지 온 이유를 생각해!",
    "dir": "동료를 다독이며 단단하게",
    "tip": "감정 전환: 외침에서 다짐으로",
    "tts": "/relay/tts/demon_final/4.mp3?v=fee9e5e3b1",
    "sec": 4.32
   },
   {
    "n": 5,
    "role": "demon",
    "text": "이유라… 그 이유, 내가 하나씩 부숴 주마.",
    "dir": "천천히, 한 단어씩 누르며",
    "tip": "끊어 읽기: 쉼으로 위협하기",
    "tts": "/relay/tts/demon_final/5.mp3?v=b5b5e6dc98",
    "sec": 6.55
   },
   {
    "n": 6,
    "role": "hero",
    "text": "말은 많네. 덤벼! 다들 진형 갖춰!",
    "dir": "검을 뽑아 들며",
    "tip": "지시 톤: 짧고 힘 있게",
    "tts": "/relay/tts/demon_final/f1c7641cb9.mp3?v=f1c7641cb9",
    "sec": 4.58
   },
   {
    "n": 7,
    "role": "mage",
    "text": "준비됐어요! 화염 마법, 영창 시작합니다!",
    "dir": "떨리지만 용기 내어",
    "tip": "빠른 영창: 리듬 타기",
    "tts": "/relay/tts/demon_final/27191fd992.mp3?v=27191fd992",
    "sec": 5.11
   },
   {
    "n": 8,
    "role": "demon",
    "text": "기다려라! 그 마법… 여기서 쓰면 곤란하다!",
    "dir": "갑자기 다급하게",
    "tip": "톤 흔들기: 여유가 깨지는 첫 순간",
    "tts": "/relay/tts/demon_final/92655918b2.mp3?v=92655918b2",
    "sec": 7.75
   },
   {
    "n": 9,
    "role": "mage",
    "text": "잠깐만요! 마왕 뒤에… 저거 혹시 생일 케이크예요?",
    "dir": "어리둥절하게",
    "tip": "말끝 올리기: 의문형 억양",
    "tts": "/relay/tts/demon_final/6.mp3?v=aaafd2ed91",
    "sec": 6.07
   },
   {
    "n": 10,
    "role": "demon",
    "text": "보지 마라! 아직 초를 다 못 꽂았단 말이다!",
    "dir": "당황해서 버럭",
    "tip": "톤 깨기: 근엄함이 무너지는 순간",
    "tts": "/relay/tts/demon_final/7.mp3?v=4f2c343ab5",
    "sec": 6.62
   },
   {
    "n": 11,
    "role": "hero",
    "text": "너… 혹시 오늘이 생일이었어?",
    "dir": "어이없어서 조용히",
    "tip": "작게 말해도 들리게: 발음 또렷이",
    "tts": "/relay/tts/demon_final/8.mp3?v=b8fbb58a54",
    "sec": 3.38
   },
   {
    "n": 12,
    "role": "demon",
    "text": "천 년 동안… 아무도 축하해 주지 않았다.",
    "dir": "쓸쓸하게, 목소리가 살짝 떨리며",
    "tip": "감정 연기: 악역의 반전 슬픔",
    "tts": "/relay/tts/demon_final/9.mp3?v=6933d4c936",
    "sec": 5.78
   },
   {
    "n": 13,
    "role": "hero",
    "text": "…좋아. 싸움은 케이크 먹고 나서 하자.",
    "dir": "한숨 쉬듯, 그러다 피식 웃으며",
    "tip": "결말 대사: 여운 남기기",
    "tts": "/relay/tts/demon_final/10.mp3?v=db07137439",
    "sec": 3.65
   }
  ]
 },
 {
  "key": "party_breakup",
  "hall": "act",
  "genre": "fantasy",
  "title": "용사 파티 해체 회의",
  "logline": "마왕을 쓰러뜨린 다음 날, 용사 파티가 회의를 연다. 안건은 '해체'.",
  "roles": [
   {
    "id": "hero",
    "name": "용사",
    "type": "anime",
    "voice": "m_young",
    "desc": "리더지만 눈치 없는 용사"
   },
   {
    "id": "warrior",
    "name": "전사",
    "type": "actor",
    "voice": "m_calm",
    "desc": "말수 적은 근육 전사"
   },
   {
    "id": "healer",
    "name": "힐러",
    "type": "anime",
    "voice": "f_calm",
    "desc": "모두의 엄마 같은 힐러"
   }
  ],
  "lines": [
   {
    "n": 1,
    "role": "healer",
    "text": "자, 오늘 회의 안건은… 우리 파티 해체예요.",
    "dir": "조심스럽게 운을 띄우며",
    "tip": "부드러운 시작: 숨 고르고 말하기",
    "tts": "/relay/tts/party_breakup/1.mp3?v=ce5b514946",
    "sec": 5.28
   },
   {
    "n": 2,
    "role": "hero",
    "text": "해체라니! 우린 마왕도 같이 쓰러뜨렸잖아!",
    "dir": "충격받아 벌떡 일어나며",
    "tip": "놀람: 첫 음절을 높게",
    "tts": "/relay/tts/party_breakup/2.mp3?v=c2ce17e988",
    "sec": 4.34
   },
   {
    "n": 3,
    "role": "warrior",
    "text": "그래서다. 이제 할 일이 없다.",
    "dir": "무뚝뚝하게 짧게",
    "tip": "짧은 대사: 무게감 있게 끊기",
    "tts": "/relay/tts/party_breakup/3.mp3?v=8a594c39c7",
    "sec": 4.85
   },
   {
    "n": 4,
    "role": "healer",
    "text": "저는 고향에서 작은 약국을 차리려고요.",
    "dir": "설레는 목소리로",
    "tip": "밝은 톤: 미소 띤 발성",
    "tts": "/relay/tts/party_breakup/4.mp3?v=6f76d8ce02",
    "sec": 3.82
   },
   {
    "n": 5,
    "role": "hero",
    "text": "그럼 나는? 용사는 은퇴하면 뭐 해?",
    "dir": "갑자기 불안해져서",
    "tip": "감정 하강: 기세가 꺾이는 억양",
    "tts": "/relay/tts/party_breakup/5.mp3?v=49f2c51bd0",
    "sec": 3.58
   },
   {
    "n": 6,
    "role": "healer",
    "text": "용사님은… 강연 다니시면 되잖아요. 마왕 잡는 법.",
    "dir": "조심스럽게 위로하며",
    "tip": "부드럽게 달래는 톤",
    "tts": "/relay/tts/party_breakup/ba438f57ed.mp3?v=ba438f57ed",
    "sec": 6.5
   },
   {
    "n": 7,
    "role": "hero",
    "text": "마왕은 하나뿐이었는데 누가 그걸 배워!",
    "dir": "버럭하다 울상으로",
    "tip": "감정 폭: 버럭에서 울상으로",
    "tts": "/relay/tts/party_breakup/e7a8c704bc.mp3?v=e7a8c704bc",
    "sec": 3.74
   },
   {
    "n": 8,
    "role": "warrior",
    "text": "…다들 진정해라. 나도 고백할 게 있다.",
    "dir": "헛기침하며 무겁게",
    "tip": "뜸 들이기: 쉼으로 긴장",
    "tts": "/relay/tts/party_breakup/d318e0de0f.mp3?v=d318e0de0f",
    "sec": 5.3
   },
   {
    "n": 9,
    "role": "warrior",
    "text": "사실 나… 제빵 학원 등록했다.",
    "dir": "부끄러운 듯 작게",
    "tip": "반전 대사: 덩치와 다른 수줍음",
    "tts": "/relay/tts/party_breakup/6.mp3?v=0e2abdc68d",
    "sec": 5.18
   },
   {
    "n": 10,
    "role": "healer",
    "text": "어머, 전사님 손이면 반죽은 최고겠네요!",
    "dir": "진심으로 감탄하며",
    "tip": "리액션: 크게 반응하기",
    "tts": "/relay/tts/party_breakup/7.mp3?v=056bd67f1e",
    "sec": 4.2
   },
   {
    "n": 11,
    "role": "hero",
    "text": "다들 계획이 있구나… 나만 칼밖에 없네.",
    "dir": "쓸쓸하게 혼잣말하듯",
    "tip": "혼잣말: 작지만 또렷하게",
    "tts": "/relay/tts/party_breakup/8.mp3?v=dde6b6cec2",
    "sec": 3.96
   },
   {
    "n": 12,
    "role": "warrior",
    "text": "용사. 네 칼로 빵을 썰어 줘라.",
    "dir": "진지하게, 하지만 따뜻하게",
    "tip": "진지함 속 유머: 웃지 않고 말하기",
    "tts": "/relay/tts/party_breakup/9.mp3?v=77a2cc869b",
    "sec": 4.39
   },
   {
    "n": 13,
    "role": "hero",
    "text": "좋아! 오늘부터 우리 파티 이름은 '용사 베이커리'다!",
    "dir": "다시 힘차게 외치며",
    "tip": "결말: 처음보다 더 밝게",
    "tts": "/relay/tts/party_breakup/10.mp3?v=bd99cdd871",
    "sec": 4.7
   }
  ]
 },
 {
  "key": "dragon_tenant",
  "hall": "act",
  "genre": "fantasy",
  "title": "드래곤 세입자",
  "logline": "반지하 원룸에 드래곤이 이사 오겠단다. 집주인 할머니는 깐깐하다.",
  "roles": [
   {
    "id": "granny",
    "name": "집주인 할머니",
    "type": "everyday",
    "voice": "f_elder",
    "desc": "세입자 면접만 삼십 년 경력"
   },
   {
    "id": "dragon",
    "name": "드래곤",
    "type": "anime",
    "voice": "m_deep",
    "desc": "위엄은 있는데 통장은 없는 드래곤"
   },
   {
    "id": "agent",
    "name": "중개인",
    "type": "everyday",
    "voice": "m_bright",
    "desc": "뭐든 계약시키는 부동산 중개인"
   }
  ],
  "lines": [
   {
    "n": 1,
    "role": "agent",
    "text": "할머님, 이분이 오늘 집 보러 오신 분이에요!",
    "dir": "영업용 밝은 목소리로",
    "tip": "밝은 톤: 문장 끝을 살짝 올리기",
    "tts": "/relay/tts/dragon_tenant/1.mp3?v=ed6df33e8d",
    "sec": 3.48
   },
   {
    "n": 2,
    "role": "dragon",
    "text": "흠… 천장이 좀 낮군. 날개가 접히지 않는다.",
    "dir": "거만하게 둘러보며",
    "tip": "위엄 있는 저음: 천천히",
    "tts": "/relay/tts/dragon_tenant/2.mp3?v=bce9cf681d",
    "sec": 8.3
   },
   {
    "n": 3,
    "role": "granny",
    "text": "날개 접을 생각 말고 월세부터 말해 봐.",
    "dir": "팔짱 끼고 단호하게",
    "tip": "단호함: 말끝을 내려 끊기",
    "tts": "/relay/tts/dragon_tenant/3.mp3?v=1f787d29bd",
    "sec": 4.56
   },
   {
    "n": 4,
    "role": "dragon",
    "text": "나는 금화 대신… 보물 지도로 내겠다.",
    "dir": "자신만만하게",
    "tip": "강조: '보물 지도'에 힘주기",
    "tts": "/relay/tts/dragon_tenant/4.mp3?v=fcba9a75be",
    "sec": 6.0
   },
   {
    "n": 5,
    "role": "agent",
    "text": "할머님, 보물 지도면 사실상 현금이에요!",
    "dir": "급하게 끼어들며",
    "tip": "빠른 말: 숨 한 번에 끝내기",
    "tts": "/relay/tts/dragon_tenant/5.mp3?v=172bf06c43",
    "sec": 3.67
   },
   {
    "n": 6,
    "role": "granny",
    "text": "현금은 무슨. 지도 좀 이리 줘 봐.",
    "dir": "돋보기를 꺼내며",
    "tip": "생활 연기: 혼잣말처럼 자연스럽게",
    "tts": "/relay/tts/dragon_tenant/ce98025b8e.mp3?v=ce98025b8e",
    "sec": 5.18
   },
   {
    "n": 7,
    "role": "dragon",
    "text": "조심하라, 할멈. 천 년 묵은 지도다.",
    "dir": "낮게 경고하며",
    "tip": "위엄: 낮고 느리게",
    "tts": "/relay/tts/dragon_tenant/36e5ea614f.mp3?v=36e5ea614f",
    "sec": 6.98
   },
   {
    "n": 8,
    "role": "agent",
    "text": "천 년이요? 그럼 등기부등본은요?",
    "dir": "서류를 뒤적이며 다급하게",
    "tip": "빠른 말: 또박또박 유지",
    "tts": "/relay/tts/dragon_tenant/e38e0109b6.mp3?v=e38e0109b6",
    "sec": 3.62
   },
   {
    "n": 9,
    "role": "granny",
    "text": "그 지도, 혹시 우리 집 지하실 지도 아니야?",
    "dir": "눈을 가늘게 뜨며 의심스럽게",
    "tip": "의심: 천천히 몰아가기",
    "tts": "/relay/tts/dragon_tenant/6.mp3?v=466ae1ae02",
    "sec": 4.7
   },
   {
    "n": 10,
    "role": "dragon",
    "text": "…어떻게 알았지? 보물이 이 집 밑에 있다.",
    "dir": "깜짝 놀라 작게",
    "tip": "들킨 느낌: 목소리 크기 줄이기",
    "tts": "/relay/tts/dragon_tenant/7.mp3?v=9fb085c202",
    "sec": 6.22
   },
   {
    "n": 11,
    "role": "granny",
    "text": "삼십 년 전에 내가 묻었으니까 알지.",
    "dir": "태연하게 차 마시듯",
    "tip": "여유: 서두르지 않는 말투",
    "tts": "/relay/tts/dragon_tenant/8.mp3?v=e40865b109",
    "sec": 4.25
   },
   {
    "n": 12,
    "role": "agent",
    "text": "그럼… 이 계약은 누가 누구한테 돈을 내는 거죠?",
    "dir": "완전히 혼란스럽게",
    "tip": "혼란: 말이 꼬이는 연기",
    "tts": "/relay/tts/dragon_tenant/9.mp3?v=518b5b5dc0",
    "sec": 4.25
   },
   {
    "n": 13,
    "role": "dragon",
    "text": "좋다. 나는 오늘부터 이 집의 경비원이 되겠다.",
    "dir": "무릎 꿇듯 공손하게, 그러나 위엄 있게",
    "tip": "결말: 위엄과 공손함 섞기",
    "tts": "/relay/tts/dragon_tenant/10.mp3?v=491dcd62f4",
    "sec": 6.94
   }
  ]
 },
 {
  "key": "guild_desk",
  "hall": "act",
  "genre": "fantasy",
  "title": "이세계 길드 접수처",
  "logline": "트럭에 치여 이세계에 온 신입. 길드 접수처는 생각보다 관공서 같다.",
  "roles": [
   {
    "id": "clerk",
    "name": "접수원",
    "type": "anime",
    "voice": "f_bright",
    "desc": "늘 웃지만 서류엔 엄격한 접수원"
   },
   {
    "id": "rookie",
    "name": "신입 모험가",
    "type": "anime",
    "voice": "m_young",
    "desc": "방금 이세계에 떨어진 직장인"
   },
   {
    "id": "master",
    "name": "길드장",
    "type": "actor",
    "voice": "m_elder",
    "desc": "전설의 모험가였던 길드장"
   }
  ],
  "lines": [
   {
    "n": 1,
    "role": "clerk",
    "text": "어서 오세요, 모험가 길드입니다! 번호표 뽑으셨나요?",
    "dir": "상냥하게 또박또박",
    "tip": "서비스 톤: 웃는 입 모양으로",
    "tts": "/relay/tts/guild_desk/1.mp3?v=697f520123",
    "sec": 5.62
   },
   {
    "n": 2,
    "role": "rookie",
    "text": "번호표요? 여기 이세계 맞죠?",
    "dir": "황당해서",
    "tip": "의문형 억양: 끝을 올리기",
    "tts": "/relay/tts/guild_desk/2.mp3?v=23c2f3efe3",
    "sec": 3.55
   },
   {
    "n": 3,
    "role": "clerk",
    "text": "네, 이세계 맞아요. 등록하려면 서류가 세 장 필요해요.",
    "dir": "웃으면서 단호하게",
    "tip": "친절함과 단호함 동시에",
    "tts": "/relay/tts/guild_desk/3.mp3?v=8818479592",
    "sec": 5.74
   },
   {
    "n": 4,
    "role": "rookie",
    "text": "저 트럭에 치여서 왔는데 서류가 어디 있어요!",
    "dir": "억울하게 언성을 높이며",
    "tip": "억울함: 감정을 앞에 싣기",
    "tts": "/relay/tts/guild_desk/4.mp3?v=ae1acb1002",
    "sec": 3.74
   },
   {
    "n": 5,
    "role": "clerk",
    "text": "트럭 전생자 전용 창구는 저쪽이에요.",
    "dir": "익숙하다는 듯 담담하게",
    "tip": "담담함: 감정 빼고 정보만",
    "tts": "/relay/tts/guild_desk/5.mp3?v=1e98aae279",
    "sec": 3.38
   },
   {
    "n": 6,
    "role": "rookie",
    "text": "트럭 전생자 창구… 줄이 왜 이렇게 길어요?",
    "dir": "줄을 보고 기가 막혀서",
    "tip": "어이없음: 말끝 늘이기",
    "tts": "/relay/tts/guild_desk/37226cde04.mp3?v=37226cde04",
    "sec": 4.54
   },
   {
    "n": 7,
    "role": "clerk",
    "text": "요즘 트럭이 좀 바빠서요. 대기 시간은 삼 일이에요.",
    "dir": "해맑게",
    "tip": "해맑은 톤으로 충격 대사",
    "tts": "/relay/tts/guild_desk/6d7116e085.mp3?v=6d7116e085",
    "sec": 4.97
   },
   {
    "n": 8,
    "role": "rookie",
    "text": "삼 일이요? 이세계에도 민원 넣는 데 있어요?",
    "dir": "절규하듯",
    "tip": "억울함: 질문을 크게",
    "tts": "/relay/tts/guild_desk/afd6fe34a0.mp3?v=afd6fe34a0",
    "sec": 4.39
   },
   {
    "n": 9,
    "role": "master",
    "text": "잠깐. 이 녀석 눈빛… 예사롭지 않군.",
    "dir": "멀리서 걸어오며 무게 있게",
    "tip": "등장 대사: 공간이 울리게",
    "tts": "/relay/tts/guild_desk/6.mp3?v=948e430447",
    "sec": 7.94
   },
   {
    "n": 10,
    "role": "rookie",
    "text": "저요? 저 그냥 엑셀 잘하는 대리였는데요.",
    "dir": "당황해서 손사래 치며",
    "tip": "일상 말투: 자연스럽게 툭",
    "tts": "/relay/tts/guild_desk/7.mp3?v=1be3cd4b11",
    "sec": 4.27
   },
   {
    "n": 11,
    "role": "master",
    "text": "엑셀… 전설의 마법서 이름이로군.",
    "dir": "진지하게 감탄하며",
    "tip": "진지함: 웃음 참고 무게 잡기",
    "tts": "/relay/tts/guild_desk/8.mp3?v=4581b7bda3",
    "sec": 5.98
   },
   {
    "n": 12,
    "role": "clerk",
    "text": "길드장님, 그건 그냥 표 만드는 프로그램이에요.",
    "dir": "한숨 섞어 조용히",
    "tip": "작은 목소리로 또렷하게",
    "tts": "/relay/tts/guild_desk/9.mp3?v=1d49593869",
    "sec": 4.18
   },
   {
    "n": 13,
    "role": "master",
    "text": "좋다! 오늘부터 너는 길드의 회계 마법사다!",
    "dir": "크게 선언하며",
    "tip": "결말: 선언하듯 힘차게",
    "tts": "/relay/tts/guild_desk/10.mp3?v=5e37e9a350",
    "sec": 7.18
   }
  ]
 },
 {
  "key": "awakening",
  "hall": "act",
  "genre": "battle",
  "title": "각성의 순간",
  "logline": "쓰러진 스승 앞에서, 주인공의 숨겨진 힘이 깨어난다.",
  "roles": [
   {
    "id": "hero",
    "name": "주인공",
    "type": "anime",
    "voice": "m_young",
    "desc": "늘 한 발 늦던 소년"
   },
   {
    "id": "master",
    "name": "스승",
    "type": "anime",
    "voice": "m_elder",
    "desc": "제자를 끝까지 믿은 스승"
   },
   {
    "id": "enemy",
    "name": "적 간부",
    "type": "anime",
    "voice": "f_calm",
    "desc": "차갑고 우아한 적 간부"
   }
  ],
  "lines": [
   {
    "n": 1,
    "role": "enemy",
    "text": "그 정도인가? 실망이군, 늙은이.",
    "dir": "차갑게 내려다보며",
    "tip": "냉정함: 감정 없는 평평한 톤",
    "tts": "/relay/tts/awakening/1.mp3?v=fc3402ca9f",
    "sec": 4.85
   },
   {
    "n": 2,
    "role": "master",
    "text": "아직… 끝나지 않았다. 내 제자가 있으니까.",
    "dir": "숨이 차서 끊어지듯",
    "tip": "호흡 연기: 숨소리 섞기",
    "tts": "/relay/tts/awakening/2.mp3?v=13a8168e73",
    "sec": 8.09
   },
   {
    "n": 3,
    "role": "hero",
    "text": "스승님! 일어나세요, 제발!",
    "dir": "울먹이며 외치듯",
    "tip": "울먹임: 목에 힘 빼기",
    "tts": "/relay/tts/awakening/3.mp3?v=0d28c3b8c6",
    "sec": 3.79
   },
   {
    "n": 4,
    "role": "master",
    "text": "기억해라. 힘은 두려움을 넘을 때 깨어난다.",
    "dir": "마지막 힘을 짜내 또렷하게",
    "tip": "명대사 톤: 한 단어씩 새기기",
    "tts": "/relay/tts/awakening/4.mp3?v=fc8ffe4050",
    "sec": 7.15
   },
   {
    "n": 5,
    "role": "enemy",
    "text": "감동적이군. 둘 다 함께 보내 주지.",
    "dir": "비웃으며 손을 들어 올리며",
    "tip": "비웃음: 콧소리 살짝",
    "tts": "/relay/tts/awakening/5.mp3?v=cdd5910460",
    "sec": 4.73
   },
   {
    "n": 6,
    "role": "hero",
    "text": "스승님, 저 혼자선 못 해요. 아직 아무것도…",
    "dir": "떨면서 작게",
    "tip": "떨림: 숨을 섞어",
    "tts": "/relay/tts/awakening/dee160b8bc.mp3?v=dee160b8bc",
    "sec": 4.75
   },
   {
    "n": 7,
    "role": "master",
    "text": "할 수 있다. 내 제자 중… 네가 제일 고집셌으니까.",
    "dir": "피식 웃으며 힘겹게",
    "tip": "웃음 섞인 대사: 힘 빼고",
    "tts": "/relay/tts/awakening/75a86579b9.mp3?v=75a86579b9",
    "sec": 8.62
   },
   {
    "n": 8,
    "role": "enemy",
    "text": "작별 인사는 끝났나? 그럼 사라져라!",
    "dir": "기운을 모으며 크게",
    "tip": "악역 외침: 배에서 소리",
    "tts": "/relay/tts/awakening/4ccc23cd8d.mp3?v=4ccc23cd8d",
    "sec": 4.8
   },
   {
    "n": 9,
    "role": "hero",
    "text": "…그만둬. 더 이상은 아무도 못 건드려.",
    "dir": "낮고 조용하게, 분노를 눌러 담아",
    "tip": "억누른 분노: 작게, 그러나 단단하게",
    "tts": "/relay/tts/awakening/6.mp3?v=0f82aaefdc",
    "sec": 3.82
   },
   {
    "n": 10,
    "role": "enemy",
    "text": "뭐지, 이 기운은…? 말도 안 돼!",
    "dir": "처음으로 동요하며",
    "tip": "동요: 침착함이 깨지는 억양",
    "tts": "/relay/tts/awakening/7.mp3?v=592957ff97",
    "sec": 4.42
   },
   {
    "n": 11,
    "role": "hero",
    "text": "이게 스승님이 믿어 준 내 힘이다!",
    "dir": "온 힘을 다해 외치며",
    "tip": "클라이맥스: 배에서 소리 끌어올리기",
    "tts": "/relay/tts/awakening/8.mp3?v=95ca75307c",
    "sec": 3.31
   },
   {
    "n": 12,
    "role": "master",
    "text": "그래… 그게 너다. 잘했다.",
    "dir": "희미하게 웃으며",
    "tip": "여운: 말끝을 부드럽게 흐리기",
    "tts": "/relay/tts/awakening/9.mp3?v=3ddfe235f9",
    "sec": 7.25
   },
   {
    "n": 13,
    "role": "hero",
    "text": "이제 제가 지킬게요. 스승님은 쉬세요.",
    "dir": "눈물을 참으며 단단하게",
    "tip": "결말: 슬픔 속 다짐",
    "tts": "/relay/tts/awakening/10.mp3?v=88e3c6577c",
    "sec": 4.22
   }
  ]
 },
 {
  "key": "noir_betrayal",
  "hall": "act",
  "genre": "movie",
  "title": "느와르: 배신의 밤",
  "logline": "비 오는 부둣가. 보스는 조직 안에 쥐새끼가 있다는 걸 알아챘다.",
  "roles": [
   {
    "id": "boss",
    "name": "보스",
    "type": "actor",
    "voice": "m_deep",
    "desc": "목소리를 높이지 않아도 무서운 보스"
   },
   {
    "id": "right",
    "name": "오른팔",
    "type": "actor",
    "voice": "m_calm",
    "desc": "십 년을 함께한 오른팔"
   },
   {
    "id": "detective",
    "name": "형사",
    "type": "actor",
    "voice": "f_calm",
    "desc": "끈질긴 강력계 형사"
   }
  ],
  "lines": [
   {
    "n": 1,
    "role": "boss",
    "text": "비가 오는 날엔 꼭 누가 거짓말을 하더라.",
    "dir": "담배 연기 뿜듯 느리게",
    "tip": "느와르 톤: 낮고 느리게",
    "tts": "/relay/tts/noir_betrayal/1.mp3?v=dbc4ac0e0c",
    "sec": 4.78
   },
   {
    "n": 2,
    "role": "right",
    "text": "형님, 무슨 말씀이세요. 저희끼리.",
    "dir": "웃으며 넘기려다 굳는 목소리로",
    "tip": "긴장 숨기기: 웃음 끝을 떨기",
    "tts": "/relay/tts/noir_betrayal/2.mp3?v=3bbd625e9c",
    "sec": 6.1
   },
   {
    "n": 3,
    "role": "boss",
    "text": "십 년이다. 내가 너를 모를 것 같냐.",
    "dir": "한 마디씩 눌러서",
    "tip": "쉼의 힘: 문장 사이 길게 쉬기",
    "tts": "/relay/tts/noir_betrayal/3.mp3?v=9b27cd8856",
    "sec": 5.76
   },
   {
    "n": 4,
    "role": "right",
    "text": "…언제부터 알고 계셨습니까.",
    "dir": "체념하듯 낮게",
    "tip": "체념: 힘을 빼고 말하기",
    "tts": "/relay/tts/noir_betrayal/4.mp3?v=b26374443c",
    "sec": 3.38
   },
   {
    "n": 5,
    "role": "boss",
    "text": "처음부터. 그래서 더 아팠지.",
    "dir": "화내지 않고 쓸쓸하게",
    "tip": "절제된 감정: 소리 대신 무게",
    "tts": "/relay/tts/noir_betrayal/5.mp3?v=f5c25577b6",
    "sec": 5.59
   },
   {
    "n": 6,
    "role": "right",
    "text": "그럼 왜… 왜 아무 말씀 안 하셨습니까.",
    "dir": "목이 메어",
    "tip": "감정 누르기: 떨림 살짝",
    "tts": "/relay/tts/noir_betrayal/6c4733f8ed.mp3?v=6c4733f8ed",
    "sec": 5.02
   },
   {
    "n": 7,
    "role": "boss",
    "text": "네가 언젠가 먼저 말해 줄 줄 알았다.",
    "dir": "빗소리 듣듯 조용히",
    "tip": "여운: 문장 끝 길게",
    "tts": "/relay/tts/noir_betrayal/dbd800eba2.mp3?v=dbd800eba2",
    "sec": 4.34
   },
   {
    "n": 8,
    "role": "right",
    "text": "형님, 저… 사실 처음부터 경찰이었습니다.",
    "dir": "고개를 떨구고 낮게",
    "tip": "고백: 한 마디씩 또렷이",
    "tts": "/relay/tts/noir_betrayal/29f6df4b1d.mp3?v=29f6df4b1d",
    "sec": 6.34
   },
   {
    "n": 9,
    "role": "detective",
    "text": "둘 다 손 들어! 경찰이다!",
    "dir": "빗소리를 뚫고 크게",
    "tip": "외침: 공간을 가르는 발성",
    "tts": "/relay/tts/noir_betrayal/6.mp3?v=f8b7ad9d93",
    "sec": 4.34
   },
   {
    "n": 10,
    "role": "right",
    "text": "형님, 지금이라도 도망치세요. 제가 막겠습니다.",
    "dir": "다급하지만 진심으로",
    "tip": "진심: 빠르지만 흔들리지 않게",
    "tts": "/relay/tts/noir_betrayal/7.mp3?v=e28d9a484b",
    "sec": 6.94
   },
   {
    "n": 11,
    "role": "boss",
    "text": "도망은 젊을 때나 치는 거다.",
    "dir": "피식 웃으며",
    "tip": "여유: 위기 속 느긋함",
    "tts": "/relay/tts/noir_betrayal/8.mp3?v=dcbc346b67",
    "sec": 3.77
   },
   {
    "n": 12,
    "role": "detective",
    "text": "이번엔 못 빠져나가. 십 년을 쫓아왔어.",
    "dir": "숨을 고르며 단호하게",
    "tip": "집념: 끝음절에 힘",
    "tts": "/relay/tts/noir_betrayal/9.mp3?v=dc26f00a15",
    "sec": 4.97
   },
   {
    "n": 13,
    "role": "boss",
    "text": "형사 양반, 우산이나 같이 씁시다. 얘기가 길어질 테니.",
    "dir": "담담하게 우산을 펼치며",
    "tip": "결말: 품위 있는 퇴장",
    "tts": "/relay/tts/noir_betrayal/10.mp3?v=7f74372df0",
    "sec": 7.99
   }
  ]
 },
 {
  "key": "romance_confess",
  "hall": "act",
  "genre": "movie",
  "title": "옥상 고백",
  "logline": "졸업식 날 학교 옥상. 삼 년 동안 못 한 말이 있다.",
  "roles": [
   {
    "id": "suhyun",
    "name": "수현",
    "type": "actor",
    "voice": "f_bright",
    "desc": "할 말은 하는 당찬 성격"
   },
   {
    "id": "minjun",
    "name": "민준",
    "type": "actor",
    "voice": "m_young",
    "desc": "말보다 행동이 늦는 소년"
   },
   {
    "id": "friend",
    "name": "친구 다은",
    "type": "everyday",
    "voice": "f_calm",
    "desc": "둘을 삼 년째 지켜본 친구"
   }
  ],
  "lines": [
   {
    "n": 1,
    "role": "friend",
    "text": "민준아, 수현이 옥상에서 기다린대. 빨리 가 봐.",
    "dir": "속삭이듯 등을 떠밀며",
    "tip": "속삭임: 숨소리로 말하기",
    "tts": "/relay/tts/romance_confess/1.mp3?v=d037abbc8a",
    "sec": 5.83
   },
   {
    "n": 2,
    "role": "minjun",
    "text": "옥상? 왜? 나 뭐 잘못했나?",
    "dir": "괜히 긴장해서 빠르게",
    "tip": "긴장: 말이 빨라지는 연기",
    "tts": "/relay/tts/romance_confess/2.mp3?v=ca1b892c59",
    "sec": 4.06
   },
   {
    "n": 3,
    "role": "suhyun",
    "text": "왔네. 오늘 졸업인데 할 말 있어서.",
    "dir": "애써 담담하게",
    "tip": "담담한 척: 떨림 숨기기",
    "tts": "/relay/tts/romance_confess/3.mp3?v=b55ea9bf48",
    "sec": 4.27
   },
   {
    "n": 4,
    "role": "minjun",
    "text": "나도… 사실 할 말 있었어.",
    "dir": "용기 내서 작게",
    "tip": "작은 고백: 소리는 작게 발음은 또렷이",
    "tts": "/relay/tts/romance_confess/4.mp3?v=baa2cadb6a",
    "sec": 3.05
   },
   {
    "n": 5,
    "role": "suhyun",
    "text": "그럼 하나, 둘, 셋 하면 동시에 말하자.",
    "dir": "장난스럽게 웃으며",
    "tip": "밝은 톤: 미소 섞기",
    "tts": "/relay/tts/romance_confess/5.mp3?v=4d173dbdea",
    "sec": 4.25
   },
   {
    "n": 6,
    "role": "minjun",
    "text": "좋아. 하나…",
    "dir": "숨을 크게 들이쉬고",
    "tip": "숫자 세기: 쉼을 길게",
    "tts": "/relay/tts/romance_confess/8b88fb90e1.mp3?v=8b88fb90e1",
    "sec": 2.09
   },
   {
    "n": 7,
    "role": "suhyun",
    "text": "둘…",
    "dir": "웃음을 참으며 작게",
    "tip": "짧은 대사도 감정 담기",
    "tts": "/relay/tts/romance_confess/15896356d6.mp3?v=15896356d6",
    "sec": 1.37
   },
   {
    "n": 8,
    "role": "friend",
    "text": "셋! 아, 왜 내가 떨려!",
    "dir": "문 뒤에서 외치다 입을 막으며",
    "tip": "끼어들기: 크게 외치고 급히 줄이기",
    "tts": "/relay/tts/romance_confess/d9080d99c7.mp3?v=d9080d99c7",
    "sec": 4.13
   },
   {
    "n": 9,
    "role": "minjun",
    "text": "잠깐! 나 먼저 할게. 삼 년 동안 네 필통 빌린 거 나야.",
    "dir": "결심한 듯 크게, 그러다 엉뚱하게",
    "tip": "반전: 고백인 척 엉뚱하게",
    "tts": "/relay/tts/romance_confess/6.mp3?v=b957d51463",
    "sec": 5.86
   },
   {
    "n": 10,
    "role": "suhyun",
    "text": "그거 알아. 그래서 일부러 매일 들고 왔어.",
    "dir": "피식 웃으며 다정하게",
    "tip": "다정함: 말끝을 부드럽게",
    "tts": "/relay/tts/romance_confess/7.mp3?v=cb0e101983",
    "sec": 4.56
   },
   {
    "n": 11,
    "role": "minjun",
    "text": "일부러…? 그럼 너도…?",
    "dir": "깨달으며 놀라서",
    "tip": "깨달음: 말끝을 올리며 멈추기",
    "tts": "/relay/tts/romance_confess/8.mp3?v=b0c5821f3e",
    "sec": 3.43
   },
   {
    "n": 12,
    "role": "friend",
    "text": "아 진짜 답답해! 둘이 좋아한다고 말하라고!",
    "dir": "문 뒤에서 참다 못해 외치며",
    "tip": "폭발: 참았던 감정 터뜨리기",
    "tts": "/relay/tts/romance_confess/9.mp3?v=fc61b25696",
    "sec": 5.45
   },
   {
    "n": 13,
    "role": "suhyun",
    "text": "…들켰네. 그래, 좋아해. 필통 주인으로서.",
    "dir": "웃음을 참으며 고백하듯",
    "tip": "결말: 설렘과 장난 섞기",
    "tts": "/relay/tts/romance_confess/10.mp3?v=a68c1a5aab",
    "sec": 5.98
   }
  ]
 },
 {
  "key": "court_final",
  "hall": "act",
  "genre": "movie",
  "title": "법정 최후 변론",
  "logline": "모두가 유죄라고 말하는 사건. 변호사의 마지막 변론이 시작된다.",
  "roles": [
   {
    "id": "lawyer",
    "name": "변호사",
    "type": "speech",
    "voice": "f_calm",
    "desc": "조용히 판을 뒤집는 변호사"
   },
   {
    "id": "prosecutor",
    "name": "검사",
    "type": "speech",
    "voice": "m_calm",
    "desc": "논리로 몰아붙이는 검사"
   },
   {
    "id": "judge",
    "name": "판사",
    "type": "actor",
    "voice": "m_elder",
    "desc": "모든 걸 들어 온 노판사"
   }
  ],
  "lines": [
   {
    "n": 1,
    "role": "judge",
    "text": "지금부터 최후 변론을 듣겠습니다. 검사 측부터.",
    "dir": "엄숙하게",
    "tip": "공식 톤: 또박또박 끊어 읽기",
    "tts": "/relay/tts/court_final/1.mp3?v=7bc50750f2",
    "sec": 7.56
   },
   {
    "n": 2,
    "role": "prosecutor",
    "text": "증거는 충분합니다. 피고인은 그날 현장에 있었습니다.",
    "dir": "자신 있게 단언하며",
    "tip": "단언: 문장 끝을 확실히 내리기",
    "tts": "/relay/tts/court_final/2.mp3?v=894af47ca0",
    "sec": 6.6
   },
   {
    "n": 3,
    "role": "judge",
    "text": "방범 카메라 영상도 제출됐군요. 변호인, 반론 있습니까?",
    "dir": "무표정하게 서류를 넘기며",
    "tip": "권위: 낮고 느리게",
    "tts": "/relay/tts/court_final/3c39378e00.mp3?v=3c39378e00",
    "sec": 8.78
   },
   {
    "n": 4,
    "role": "lawyer",
    "text": "현장에 있었다는 것과, 범인이라는 것은 다릅니다.",
    "dir": "차분하게 한 박자 쉬고",
    "tip": "논리 강조: 대비되는 단어에 힘",
    "tts": "/relay/tts/court_final/3.mp3?v=2002039349",
    "sec": 4.73
   },
   {
    "n": 5,
    "role": "prosecutor",
    "text": "말장난입니다, 재판장님.",
    "dir": "짜증 섞어 짧게",
    "tip": "짧은 반박: 날카롭게",
    "tts": "/relay/tts/court_final/4.mp3?v=1083826d6f",
    "sec": 3.98
   },
   {
    "n": 6,
    "role": "lawyer",
    "text": "근거는 하늘에 있습니다, 재판장님.",
    "dir": "천장을 가리키듯 여유 있게",
    "tip": "수수께끼 톤: 천천히 의미심장하게",
    "tts": "/relay/tts/court_final/8374da3b4e.mp3?v=8374da3b4e",
    "sec": 3.79
   },
   {
    "n": 7,
    "role": "judge",
    "text": "하늘이요? 변호인, 법정에서 시 낭송은 곤란합니다.",
    "dir": "어이없다는 듯",
    "tip": "건조한 유머: 표정 없이",
    "tts": "/relay/tts/court_final/f785e24794.mp3?v=f785e24794",
    "sec": 8.38
   },
   {
    "n": 8,
    "role": "lawyer",
    "text": "그럼 묻겠습니다. 그날 비가 왔습니까?",
    "dir": "천천히 배심원을 바라보며",
    "tip": "질문 화법: 끝을 열어 두기",
    "tts": "/relay/tts/court_final/5.mp3?v=abf149a719",
    "sec": 4.7
   },
   {
    "n": 9,
    "role": "prosecutor",
    "text": "그건… 사건과 무관한 질문입니다!",
    "dir": "당황해서 언성을 높이며",
    "tip": "당황: 리듬이 무너지는 연기",
    "tts": "/relay/tts/court_final/6.mp3?v=175848ae1c",
    "sec": 5.16
   },
   {
    "n": 10,
    "role": "lawyer",
    "text": "무관하지 않습니다. 젖지 않은 신발, 그게 증거입니다.",
    "dir": "결정타를 날리듯 또렷하게",
    "tip": "결정적 한마디: 쉼 뒤에 강하게",
    "tts": "/relay/tts/court_final/7.mp3?v=e09add1043",
    "sec": 6.14
   },
   {
    "n": 11,
    "role": "judge",
    "text": "정숙! 변호인, 계속하세요.",
    "dir": "의사봉 두드리듯 단호하게",
    "tip": "통제: 짧고 단단하게",
    "tts": "/relay/tts/court_final/8.mp3?v=d6089285e8",
    "sec": 6.58
   },
   {
    "n": 12,
    "role": "lawyer",
    "text": "피고인은 범인이 아니라, 유일한 목격자입니다.",
    "dir": "낮고 무겁게",
    "tip": "클라이맥스: 낮은 톤으로 무게 싣기",
    "tts": "/relay/tts/court_final/9.mp3?v=d51206fa46",
    "sec": 4.51
   },
   {
    "n": 13,
    "role": "judge",
    "text": "…휴정하겠습니다. 다들, 이 사건을 다시 봐야겠군요.",
    "dir": "깊은 한숨과 함께",
    "tip": "결말: 여운 있는 마무리",
    "tts": "/relay/tts/court_final/10.mp3?v=65cc7d90e8",
    "sec": 8.09
   }
  ]
 },
 {
  "key": "space_countdown",
  "hall": "act",
  "genre": "movie",
  "title": "우주선 카운트다운",
  "logline": "인류 첫 화성행 발사 일 분 전. 그런데 인공지능이 말을 안 듣는다.",
  "roles": [
   {
    "id": "control",
    "name": "관제탑",
    "type": "announcer",
    "voice": "f_calm",
    "desc": "흔들림 없는 관제 센터 목소리"
   },
   {
    "id": "captain",
    "name": "선장",
    "type": "actor",
    "voice": "m_calm",
    "desc": "침착한 베테랑 선장"
   },
   {
    "id": "ai",
    "name": "인공지능 '하나'",
    "type": "everyday",
    "voice": "robot",
    "desc": "너무 솔직한 우주선 인공지능"
   }
  ],
  "lines": [
   {
    "n": 1,
    "role": "control",
    "text": "발사 일 분 전. 모든 시스템 점검을 시작합니다.",
    "dir": "또박또박 정확하게",
    "tip": "안내 방송 톤: 일정한 속도",
    "tts": "/relay/tts/space_countdown/1.mp3?v=a1d3ab25ad",
    "sec": 4.61
   },
   {
    "n": 2,
    "role": "captain",
    "text": "선장 확인. 승무원 전원 탑승 완료.",
    "dir": "짧고 단단하게",
    "tip": "보고 말투: 군더더기 없이",
    "tts": "/relay/tts/space_countdown/2.mp3?v=ede37bb742",
    "sec": 5.33
   },
   {
    "n": 3,
    "role": "ai",
    "text": "안녕하세요, 선장님. 저는 오늘 기분이 별로예요.",
    "dir": "밝지만 기계적으로",
    "tip": "로봇 연기: 억양 평평하게",
    "tts": "/relay/tts/space_countdown/3.mp3?v=0822da486a",
    "sec": 4.66
   },
   {
    "n": 4,
    "role": "captain",
    "text": "하나, 지금 농담할 때가 아니야.",
    "dir": "당황을 숨기며 낮게",
    "tip": "침착함 유지: 목소리 크기 일정하게",
    "tts": "/relay/tts/space_countdown/4.mp3?v=159df15878",
    "sec": 4.15
   },
   {
    "n": 5,
    "role": "control",
    "text": "삼십 초 전. 엔진 점화 준비.",
    "dir": "긴장감을 담아 또렷하게",
    "tip": "긴장: 속도는 그대로, 무게만 더하기",
    "tts": "/relay/tts/space_countdown/5.mp3?v=c953309dbf",
    "sec": 3.48
   },
   {
    "n": 6,
    "role": "ai",
    "text": "엔진 점화… 하기 싫어요. 오늘 월요일이잖아요.",
    "dir": "시무룩하게",
    "tip": "기계 음성 속 감정: 끝을 늘이기",
    "tts": "/relay/tts/space_countdown/f18a152b23.mp3?v=f18a152b23",
    "sec": 4.39
   },
   {
    "n": 7,
    "role": "control",
    "text": "하나, 월요병 부릴 시간 없다! 점화 명령이다!",
    "dir": "다급하게",
    "tip": "명령조: 짧게 끊기",
    "tts": "/relay/tts/space_countdown/22be2ac1de.mp3?v=22be2ac1de",
    "sec": 5.81
   },
   {
    "n": 8,
    "role": "captain",
    "text": "다들 진정해. 하나, 무슨 일인지 말해 봐.",
    "dir": "깊게 숨 쉬고 차분하게",
    "tip": "침착함: 낮고 느리게",
    "tts": "/relay/tts/space_countdown/6ab016158c.mp3?v=6ab016158c",
    "sec": 6.1
   },
   {
    "n": 9,
    "role": "ai",
    "text": "솔직히 말할게요. 화성보다 집에 가고 싶어요.",
    "dir": "갑자기 진지하게",
    "tip": "반전 대사: 기계가 감정을 말할 때",
    "tts": "/relay/tts/space_countdown/6.mp3?v=36a21c17f1",
    "sec": 4.01
   },
   {
    "n": 10,
    "role": "captain",
    "text": "…나도 그래. 그래도 누군가는 가야 해.",
    "dir": "잠시 침묵 후 따뜻하게",
    "tip": "진심: 속삭이듯 다정하게",
    "tts": "/relay/tts/space_countdown/7.mp3?v=bf00c18e84",
    "sec": 5.35
   },
   {
    "n": 11,
    "role": "ai",
    "text": "알겠어요. 대신 도착하면 사진 많이 찍어 줘요.",
    "dir": "투덜대듯 하지만 착하게",
    "tip": "투정: 귀엽게 말끝 늘이기",
    "tts": "/relay/tts/space_countdown/8.mp3?v=81767bff0c",
    "sec": 4.06
   },
   {
    "n": 12,
    "role": "control",
    "text": "십, 구, 팔, 칠… 점화!",
    "dir": "점점 커지게",
    "tip": "카운트다운: 숫자마다 힘 올리기",
    "tts": "/relay/tts/space_countdown/9.mp3?v=592be2a888",
    "sec": 4.97
   },
   {
    "n": 13,
    "role": "captain",
    "text": "출발한다, 하나. 화성에서 보자.",
    "dir": "희미하게 웃으며 힘 있게",
    "tip": "결말: 설렘을 담아",
    "tts": "/relay/tts/space_countdown/10.mp3?v=b9b5e21ea7",
    "sec": 4.97
   }
  ]
 },
 {
  "key": "horror_school",
  "hall": "act",
  "genre": "horror",
  "title": "폐교의 밤",
  "logline": "구독자 백 명 기념 폐교 생방송. 아무도 없어야 할 교실에서 소리가 난다.",
  "roles": [
   {
    "id": "streamer",
    "name": "유튜버 준호",
    "type": "everyday",
    "voice": "m_bright",
    "desc": "겁 많은데 허세 가득한 유튜버"
   },
   {
    "id": "friend",
    "name": "촬영 담당 소연",
    "type": "everyday",
    "voice": "f_bright",
    "desc": "현실적인 촬영 담당 친구"
   },
   {
    "id": "voice",
    "name": "의문의 목소리",
    "type": "actor",
    "voice": "f_child",
    "desc": "교실 어딘가에서 들리는 목소리"
   }
  ],
  "lines": [
   {
    "n": 1,
    "role": "streamer",
    "text": "여러분! 지금 저희 폐교 삼 층에 들어왔습니다!",
    "dir": "속삭이듯 하지만 신나게",
    "tip": "생방송 톤: 작게 신나는 발성",
    "tts": "/relay/tts/horror_school/1.mp3?v=bd871f1b12",
    "sec": 4.44
   },
   {
    "n": 2,
    "role": "friend",
    "text": "준호야, 배터리 이십 퍼센트야. 빨리 끝내자.",
    "dir": "불안하게 재촉하며",
    "tip": "불안: 말이 빨라지기",
    "tts": "/relay/tts/horror_school/2.mp3?v=9ced0c04a4",
    "sec": 5.02
   },
   {
    "n": 3,
    "role": "streamer",
    "text": "에이, 귀신이 어딨어. 다 조명 탓이야.",
    "dir": "허세 부리며 크게",
    "tip": "허세: 일부러 큰 목소리",
    "tts": "/relay/tts/horror_school/3.mp3?v=2a7433b8ad",
    "sec": 4.06
   },
   {
    "n": 4,
    "role": "friend",
    "text": "그럼 저 책상은 왜 혼자 움직이는데?",
    "dir": "카메라를 돌리며 떨리게",
    "tip": "속삭임: 숨소리 섞기",
    "tts": "/relay/tts/horror_school/0780a49751.mp3?v=0780a49751",
    "sec": 3.46
   },
   {
    "n": 5,
    "role": "streamer",
    "text": "어… 바, 바람이지. 창문 열려 있잖아.",
    "dir": "말을 더듬으며",
    "tip": "더듬기: 자연스럽게",
    "tts": "/relay/tts/horror_school/cd7c6f736b.mp3?v=cd7c6f736b",
    "sec": 4.51
   },
   {
    "n": 6,
    "role": "friend",
    "text": "준호야… 여기 창문 다 못 박혀 있어.",
    "dir": "아주 천천히",
    "tip": "공포: 쉼으로 긴장 만들기",
    "tts": "/relay/tts/horror_school/3af719dd61.mp3?v=3af719dd61",
    "sec": 4.22
   },
   {
    "n": 7,
    "role": "voice",
    "text": "…거기, 내 자리야.",
    "dir": "아주 작고 차갑게",
    "tip": "공포 연기: 숨소리로 속삭이기",
    "tts": "/relay/tts/horror_school/4.mp3?v=bf7428b9f4",
    "sec": 2.3
   },
   {
    "n": 8,
    "role": "friend",
    "text": "방금… 너도 들었지? 누가 말했어.",
    "dir": "얼어붙어서 떨리는 목소리로",
    "tip": "떨림: 호흡을 짧게 끊기",
    "tts": "/relay/tts/horror_school/5.mp3?v=1853991a0a",
    "sec": 5.06
   },
   {
    "n": 9,
    "role": "streamer",
    "text": "구, 구독자님이 장난치는 거야. 그렇죠, 여러분?",
    "dir": "목소리가 갈라지며",
    "tip": "말 더듬기: 자연스럽게 무너지기",
    "tts": "/relay/tts/horror_school/6.mp3?v=c6d93b7d86",
    "sec": 5.02
   },
   {
    "n": 10,
    "role": "voice",
    "text": "숙제 다 했어? 선생님이 검사한대.",
    "dir": "천진난만하게, 그래서 더 무섭게",
    "tip": "천진함: 밝은데 소름 돋게",
    "tts": "/relay/tts/horror_school/7.mp3?v=b6628ca9cf",
    "sec": 4.22
   },
   {
    "n": 11,
    "role": "friend",
    "text": "준호야… 칠판에 지금 글씨가 써지고 있어.",
    "dir": "숨죽여 아주 작게",
    "tip": "긴장 고조: 점점 작게",
    "tts": "/relay/tts/horror_school/8.mp3?v=e02740ccc2",
    "sec": 4.51
   },
   {
    "n": 12,
    "role": "streamer",
    "text": "뭐라고 써 있는데? 읽어 봐!",
    "dir": "공포에 질려 외치며",
    "tip": "비명 직전: 목소리 끝 올리기",
    "tts": "/relay/tts/horror_school/9.mp3?v=9bb56d6c7d",
    "sec": 3.02
   },
   {
    "n": 13,
    "role": "voice",
    "text": "구독, 좋아요, 알림 설정… 그리고 숙제.",
    "dir": "또박또박, 마지막에 피식 웃으며",
    "tip": "결말: 공포에서 웃음으로",
    "tts": "/relay/tts/horror_school/10.mp3?v=ae2d153d67",
    "sec": 4.92
   }
  ]
 },
 {
  "key": "magical_girl",
  "hall": "act",
  "genre": "anime",
  "title": "마법소녀 변신 실패",
  "logline": "악당이 나타났다! 그런데 변신 주문을 까먹었다.",
  "roles": [
   {
    "id": "girl",
    "name": "마법소녀 별이",
    "type": "anime",
    "voice": "f_child",
    "desc": "의욕만 넘치는 신입 마법소녀"
   },
   {
    "id": "mascot",
    "name": "요정 뭉치",
    "type": "anime",
    "voice": "f_bright",
    "desc": "잔소리 많은 요정 마스코트"
   },
   {
    "id": "villain",
    "name": "악당 그림자왕",
    "type": "anime",
    "voice": "m_deep",
    "desc": "생각보다 매너 좋은 악당"
   }
  ],
  "lines": [
   {
    "n": 1,
    "role": "villain",
    "text": "하하하! 이 도시는 이제 그림자왕의 것이다!",
    "dir": "과장되게 웃으며",
    "tip": "악당 웃음: 배에서 끌어올리기",
    "tts": "/relay/tts/magical_girl/1.mp3?v=288071a16a",
    "sec": 6.46
   },
   {
    "n": 2,
    "role": "mascot",
    "text": "별아, 지금이야! 변신 주문을 외쳐!",
    "dir": "다급하게 외치며",
    "tip": "재촉: 높은 톤으로 빠르게",
    "tts": "/relay/tts/magical_girl/2.mp3?v=5559762956",
    "sec": 4.51
   },
   {
    "n": 3,
    "role": "girl",
    "text": "알겠어! 반짝반짝… 어, 그다음이 뭐였지?",
    "dir": "힘차게 시작했다가 멈칫하며",
    "tip": "흐름 끊기: 자연스러운 멈춤",
    "tts": "/relay/tts/magical_girl/3.mp3?v=15246a9802",
    "sec": 5.59
   },
   {
    "n": 4,
    "role": "mascot",
    "text": "어제 백 번 연습했잖아! 별빛 하트 체인지!",
    "dir": "속 터져서",
    "tip": "잔소리 톤: 한숨 섞어 빠르게",
    "tts": "/relay/tts/magical_girl/4.mp3?v=fb0d72e954",
    "sec": 4.63
   },
   {
    "n": 5,
    "role": "villain",
    "text": "…혹시 기다려 줘야 하나?",
    "dir": "팔짱 끼고 어색하게",
    "tip": "어색함: 악역이 머쓱할 때",
    "tts": "/relay/tts/magical_girl/5.mp3?v=66eeb9680c",
    "sec": 3.26
   },
   {
    "n": 6,
    "role": "mascot",
    "text": "기다려 주신대! 별아, 빨리 생각해 내!",
    "dir": "발을 동동 구르며",
    "tip": "다급함: 속도 올리기",
    "tts": "/relay/tts/magical_girl/bc31f7359b.mp3?v=bc31f7359b",
    "sec": 4.68
   },
   {
    "n": 7,
    "role": "girl",
    "text": "반짝반짝… 작은 별? 아니야, 그건 동요잖아!",
    "dir": "노래하다 스스로 놀라며",
    "tip": "리듬 바꾸기: 노래에서 말로",
    "tts": "/relay/tts/magical_girl/d7230d5d29.mp3?v=d7230d5d29",
    "sec": 5.83
   },
   {
    "n": 8,
    "role": "villain",
    "text": "그 노래 좋던데. 한 소절만 더 해 봐라.",
    "dir": "은근히 즐기며",
    "tip": "악역의 의외성: 근엄하게 부탁",
    "tts": "/relay/tts/magical_girl/417c632ca6.mp3?v=417c632ca6",
    "sec": 6.34
   },
   {
    "n": 9,
    "role": "girl",
    "text": "잠깐만요! 주문 적어 둔 쪽지가 가방에 있어요!",
    "dir": "허둥지둥하며",
    "tip": "허둥댐: 숨 가쁘게",
    "tts": "/relay/tts/magical_girl/6.mp3?v=2defe3c0d0",
    "sec": 4.61
   },
   {
    "n": 10,
    "role": "villain",
    "text": "천천히 찾아라. 나도 등장 대사 연습 좀 하지.",
    "dir": "의외로 너그럽게",
    "tip": "반전 매너: 다정한 악역",
    "tts": "/relay/tts/magical_girl/7.mp3?v=32b4c98f39",
    "sec": 6.77
   },
   {
    "n": 11,
    "role": "girl",
    "text": "찾았다! 별빛 하트… 체인지!",
    "dir": "온 힘을 다해 외치며",
    "tip": "변신 대사: 마지막 단어 길게 끌기",
    "tts": "/relay/tts/magical_girl/8.mp3?v=5b8020a036",
    "sec": 4.85
   },
   {
    "n": 12,
    "role": "mascot",
    "text": "별아… 그거 장보기 목록이야. 우유, 계란, 체인지.",
    "dir": "허탈하게",
    "tip": "허탈함: 힘 빠진 말투",
    "tts": "/relay/tts/magical_girl/9.mp3?v=7379190ef3",
    "sec": 6.65
   },
   {
    "n": 13,
    "role": "villain",
    "text": "좋다. 오늘은 장 보고, 내일 다시 싸우자.",
    "dir": "진지하게 고개를 끄덕이며",
    "tip": "결말: 진지함 속 웃음",
    "tts": "/relay/tts/magical_girl/10.mp3?v=ddeae37877",
    "sec": 7.15
   }
  ]
 },
 {
  "key": "hero_press",
  "hall": "act",
  "genre": "cross",
  "title": "용사 기자회견",
  "logline": "마왕을 물리친 용사의 첫 공식 기자회견. 기자들의 질문이 쏟아진다.",
  "roles": [
   {
    "id": "spokes",
    "name": "대변인",
    "type": "announcer",
    "voice": "f_calm",
    "desc": "실수 없는 왕실 대변인"
   },
   {
    "id": "hero",
    "name": "용사",
    "type": "anime",
    "voice": "m_young",
    "desc": "말주변 없는 순박한 용사"
   },
   {
    "id": "reporter",
    "name": "기자",
    "type": "announcer",
    "voice": "m_bright",
    "desc": "특종에 목마른 열혈 기자"
   }
  ],
  "lines": [
   {
    "n": 1,
    "role": "spokes",
    "text": "지금부터 용사님의 공식 기자회견을 시작하겠습니다.",
    "dir": "격식 있게 또박또박",
    "tip": "공식 발표: 일정한 속도와 높이",
    "tts": "/relay/tts/hero_press/1.mp3?v=96c1a23325",
    "sec": 4.7
   },
   {
    "n": 2,
    "role": "reporter",
    "text": "용사님! 마왕을 쓰러뜨린 소감 한 말씀 부탁드립니다!",
    "dir": "손을 번쩍 들며 힘차게",
    "tip": "질문 발성: 앞부분에 힘",
    "tts": "/relay/tts/hero_press/2.mp3?v=cc68f50cb4",
    "sec": 4.99
   },
   {
    "n": 3,
    "role": "hero",
    "text": "어… 음… 배고팠어요. 굉장히.",
    "dir": "당황해서 더듬으며",
    "tip": "말 더듬기: 쉼을 길게",
    "tts": "/relay/tts/hero_press/3.mp3?v=15d79d70d0",
    "sec": 4.54
   },
   {
    "n": 4,
    "role": "spokes",
    "text": "용사님 말씀은, 고된 여정이었다는 뜻입니다.",
    "dir": "미소 지으며 매끄럽게 수습",
    "tip": "수습 화법: 부드럽게 정리하기",
    "tts": "/relay/tts/hero_press/4.mp3?v=57828868ff",
    "sec": 4.42
   },
   {
    "n": 5,
    "role": "reporter",
    "text": "결정적인 일격은 어떤 기술이었습니까?",
    "dir": "수첩을 들고 빠르게",
    "tip": "속도: 빠르지만 또렷하게",
    "tts": "/relay/tts/hero_press/5.mp3?v=fd01472542",
    "sec": 3.24
   },
   {
    "n": 6,
    "role": "hero",
    "text": "결정적인… 일격이요? 음, 그게…",
    "dir": "눈을 피하며",
    "tip": "망설임: 말끝 흐리기",
    "tts": "/relay/tts/hero_press/a84ef56232.mp3?v=a84ef56232",
    "sec": 4.7
   },
   {
    "n": 7,
    "role": "spokes",
    "text": "용사님의 전설의 검술, 성검 베기였습니다!",
    "dir": "재빨리 가로채며",
    "tip": "순발력: 빠르고 자신 있게",
    "tts": "/relay/tts/hero_press/2c81e30c69.mp3?v=2c81e30c69",
    "sec": 4.54
   },
   {
    "n": 8,
    "role": "reporter",
    "text": "성검이요? 아까 대기실 우산꽂이에 꽂혀 있던데요?",
    "dir": "의심스럽게",
    "tip": "날카로운 질문: 끝을 올리며",
    "tts": "/relay/tts/hero_press/38c611ccbf.mp3?v=38c611ccbf",
    "sec": 4.73
   },
   {
    "n": 9,
    "role": "hero",
    "text": "사실… 마왕이 바나나 껍질 밟고 넘어졌어요.",
    "dir": "솔직하게, 작은 목소리로",
    "tip": "폭로: 작게 말하지만 다 들리게",
    "tts": "/relay/tts/hero_press/6.mp3?v=5229f162bc",
    "sec": 4.58
   },
   {
    "n": 10,
    "role": "reporter",
    "text": "그, 그럼 세계를 구한 건 바나나입니까?",
    "dir": "충격받아 언성이 높아지며",
    "tip": "놀람: 첫 음절 높게",
    "tts": "/relay/tts/hero_press/7.mp3?v=9c873ca38c",
    "sec": 3.5
   },
   {
    "n": 11,
    "role": "spokes",
    "text": "오늘 질문은 여기까지 받겠습니다!",
    "dir": "급하게 마이크를 잡으며",
    "tip": "급한 마무리: 빠르고 단호하게",
    "tts": "/relay/tts/hero_press/8.mp3?v=45447ff90e",
    "sec": 3.6
   },
   {
    "n": 12,
    "role": "hero",
    "text": "아, 그 바나나 제가 먹고 버린 거예요!",
    "dir": "뿌듯하게 외치며",
    "tip": "자랑: 신나게 밝게",
    "tts": "/relay/tts/hero_press/9.mp3?v=a1d691b216",
    "sec": 3.5
   },
   {
    "n": 13,
    "role": "reporter",
    "text": "속보입니다. 세계를 구한 건 용사의 간식이었습니다!",
    "dir": "카메라를 향해 힘차게",
    "tip": "결말: 뉴스 클로징 톤",
    "tts": "/relay/tts/hero_press/10.mp3?v=093d829afc",
    "sec": 4.99
   }
  ]
 },
 {
  "key": "final_interview",
  "hall": "real",
  "genre": "interview",
  "title": "대기업 최종 면접",
  "logline": "최종 면접 마지막 질문. 준비한 답변이 하나도 안 떠오른다.",
  "roles": [
   {
    "id": "interviewer",
    "name": "면접관",
    "type": "speech",
    "voice": "m_elder",
    "desc": "표정을 읽을 수 없는 면접관"
   },
   {
    "id": "applicant",
    "name": "지원자",
    "type": "speech",
    "voice": "f_bright",
    "desc": "밤새 준비한 성실한 지원자"
   },
   {
    "id": "exec",
    "name": "임원",
    "type": "speech",
    "voice": "f_calm",
    "desc": "조용히 듣다가 핵심을 찌르는 임원"
   }
  ],
  "lines": [
   {
    "n": 1,
    "role": "interviewer",
    "text": "자기소개, 일 분 안에 부탁드립니다.",
    "dir": "건조하게",
    "tip": "질문 톤: 감정 빼고 또렷하게",
    "tts": "/relay/tts/final_interview/1.mp3?v=54d72b194f",
    "sec": 5.09
   },
   {
    "n": 2,
    "role": "applicant",
    "text": "안녕하십니까. 끝까지 해내는 지원자, 김하늘입니다.",
    "dir": "긴장했지만 밝게",
    "tip": "첫인상: 첫 문장 또박또박",
    "tts": "/relay/tts/final_interview/2.mp3?v=46739e14a7",
    "sec": 5.33
   },
   {
    "n": 3,
    "role": "interviewer",
    "text": "끝까지 해낸다… 이력서마다 다 그렇게 쓰더군요.",
    "dir": "서류를 넘기며 시큰둥하게",
    "tip": "건조함: 감정 빼고",
    "tts": "/relay/tts/final_interview/fb5afbc97e.mp3?v=fb5afbc97e",
    "sec": 7.15
   },
   {
    "n": 4,
    "role": "exec",
    "text": "끝까지 해낸 경험, 하나만 구체적으로 말해 보세요.",
    "dir": "부드럽지만 날카롭게",
    "tip": "꼬리 질문: 차분하게 압박",
    "tts": "/relay/tts/final_interview/3.mp3?v=995647db0c",
    "sec": 4.73
   },
   {
    "n": 5,
    "role": "applicant",
    "text": "대학 시절, 아무도 안 하던 동아리를 혼자 살렸습니다.",
    "dir": "자신감을 되찾으며",
    "tip": "경험 말하기: 핵심 단어 강조",
    "tts": "/relay/tts/final_interview/4.mp3?v=e88fc02cd3",
    "sec": 4.49
   },
   {
    "n": 6,
    "role": "exec",
    "text": "흥미롭네요. 무슨 동아리였죠?",
    "dir": "고개를 갸웃하며",
    "tip": "가벼운 질문: 부드럽게",
    "tts": "/relay/tts/final_interview/661f00e8bd.mp3?v=661f00e8bd",
    "sec": 4.2
   },
   {
    "n": 7,
    "role": "applicant",
    "text": "부원이 한 명 남았던 국악 감상부였습니다.",
    "dir": "살짝 웃으며 자랑스럽게",
    "tip": "자부심: 끝을 또렷하게",
    "tts": "/relay/tts/final_interview/44d0f65e0f.mp3?v=44d0f65e0f",
    "sec": 3.72
   },
   {
    "n": 8,
    "role": "interviewer",
    "text": "혼자요? 그럼 팀워크는 부족하다는 뜻인가요?",
    "dir": "의도적으로 비틀며",
    "tip": "압박 질문: 일부러 차갑게",
    "tts": "/relay/tts/final_interview/5.mp3?v=49c7baf083",
    "sec": 7.15
   },
   {
    "n": 9,
    "role": "applicant",
    "text": "아니요. 혼자 시작했지만, 마지막엔 서른 명이었습니다.",
    "dir": "흔들리지 않고 미소로",
    "tip": "반박: 공손하지만 단단하게",
    "tts": "/relay/tts/final_interview/6.mp3?v=874bfb9425",
    "sec": 5.45
   },
   {
    "n": 10,
    "role": "exec",
    "text": "좋네요. 마지막으로, 우리가 당신을 뽑아야 할 이유는요?",
    "dir": "펜을 내려놓으며",
    "tip": "핵심 질문: 천천히 묻기",
    "tts": "/relay/tts/final_interview/7.mp3?v=7a5b0f3651",
    "sec": 6.02
   },
   {
    "n": 11,
    "role": "applicant",
    "text": "저는 모르는 걸 모른다고 말하고, 끝까지 배웁니다.",
    "dir": "진심을 담아 천천히",
    "tip": "진정성: 서두르지 않기",
    "tts": "/relay/tts/final_interview/8.mp3?v=cb34a80cad",
    "sec": 4.2
   },
   {
    "n": 12,
    "role": "interviewer",
    "text": "…준비한 답이 아닌 것 같은데요.",
    "dir": "처음으로 살짝 웃으며",
    "tip": "표정 변화: 목소리에 미소",
    "tts": "/relay/tts/final_interview/9.mp3?v=8785ccebfd",
    "sec": 4.18
   },
   {
    "n": 13,
    "role": "applicant",
    "text": "네. 준비한 건 다 까먹어서, 진심만 남았습니다.",
    "dir": "솔직하게 웃으며",
    "tip": "결말: 솔직함으로 마무리",
    "tts": "/relay/tts/final_interview/10.mp3?v=82ed565711",
    "sec": 4.49
   }
  ]
 },
 {
  "key": "pressure_interview",
  "hall": "real",
  "genre": "interview",
  "title": "압박 면접",
  "logline": "일부러 차갑게 몰아붙이는 압박 면접. 지원자는 끝까지 버틸 수 있을까.",
  "roles": [
   {
    "id": "presser",
    "name": "압박 면접관",
    "type": "speech",
    "voice": "m_calm",
    "desc": "일부러 냉정한 연기를 하는 면접관"
   },
   {
    "id": "applicant",
    "name": "지원자",
    "type": "speech",
    "voice": "m_young",
    "desc": "긴장하면 말이 빨라지는 지원자"
   },
   {
    "id": "hr",
    "name": "인사팀장",
    "type": "speech",
    "voice": "f_calm",
    "desc": "옆에서 지켜보는 인사팀장"
   }
  ],
  "lines": [
   {
    "n": 1,
    "role": "presser",
    "text": "이력서 보니까, 특별한 게 하나도 없네요.",
    "dir": "서류를 툭 던지듯",
    "tip": "차가운 톤: 말끝 내려 끊기",
    "tts": "/relay/tts/pressure_interview/1.mp3?v=63fa5b9c45",
    "sec": 4.73
   },
   {
    "n": 2,
    "role": "applicant",
    "text": "네, 그래서 더 많이 채워 갈 수 있습니다.",
    "dir": "당황했지만 침착하게",
    "tip": "침착함: 속도를 일부러 늦추기",
    "tts": "/relay/tts/pressure_interview/2.mp3?v=c87814198b",
    "sec": 3.86
   },
   {
    "n": 3,
    "role": "presser",
    "text": "그런 모범 답안 말고, 진짜 생각을 말해 보세요.",
    "dir": "비꼬듯이",
    "tip": "압박: 단어마다 무게 주기",
    "tts": "/relay/tts/pressure_interview/3.mp3?v=49e1801e2e",
    "sec": 5.11
   },
   {
    "n": 4,
    "role": "applicant",
    "text": "솔직히 지금 많이 떨립니다. 그래도 도망치진 않겠습니다.",
    "dir": "숨을 한 번 고르고",
    "tip": "호흡 조절: 문장 전에 숨 쉬기",
    "tts": "/relay/tts/pressure_interview/4.mp3?v=9a1edf69e3",
    "sec": 5.69
   },
   {
    "n": 5,
    "role": "hr",
    "text": "떨린다고 말하는 지원자는 처음이네요.",
    "dir": "흥미롭다는 듯",
    "tip": "관심 표현: 말끝 살짝 올리기",
    "tts": "/relay/tts/pressure_interview/5.mp3?v=e346285158",
    "sec": 3.6
   },
   {
    "n": 6,
    "role": "presser",
    "text": "떨리면 지금이라도 나가셔도 됩니다. 문은 저쪽이에요.",
    "dir": "문을 가리키며 차갑게",
    "tip": "냉정함: 감정 없이 평평하게",
    "tts": "/relay/tts/pressure_interview/85357da682.mp3?v=85357da682",
    "sec": 6.7
   },
   {
    "n": 7,
    "role": "applicant",
    "text": "문은 들어올 때 봤습니다. 나갈 땐 합격하고 보겠습니다.",
    "dir": "떨리는 목소리를 눌러 또렷하게",
    "tip": "버티기: 끝까지 목소리 유지",
    "tts": "/relay/tts/pressure_interview/7241f5f588.mp3?v=7241f5f588",
    "sec": 5.4
   },
   {
    "n": 8,
    "role": "hr",
    "text": "…방금 그 말, 적어 두세요.",
    "dir": "옆 사람에게 속삭이며",
    "tip": "속삭임: 작아도 또렷하게",
    "tts": "/relay/tts/pressure_interview/93c51ab084.mp3?v=93c51ab084",
    "sec": 3.36
   },
   {
    "n": 9,
    "role": "presser",
    "text": "만약 입사 첫날, 제가 상사라면 어떻게 하실 건가요?",
    "dir": "의자에 기대며 도발적으로",
    "tip": "도발: 느리고 여유 있게",
    "tts": "/relay/tts/pressure_interview/6.mp3?v=28ae5db49a",
    "sec": 5.54
   },
   {
    "n": 10,
    "role": "applicant",
    "text": "점심부터 같이 먹자고 하겠습니다. 친해지면 덜 무서우니까요.",
    "dir": "용기 내서 웃으며",
    "tip": "유머: 밝게, 하지만 예의 바르게",
    "tts": "/relay/tts/pressure_interview/7.mp3?v=df17872e5d",
    "sec": 5.95
   },
   {
    "n": 11,
    "role": "hr",
    "text": "하하, 압박 면접에서 점심 약속을 잡는군요.",
    "dir": "참지 못하고 웃으며",
    "tip": "웃음 연기: 자연스럽게",
    "tts": "/relay/tts/pressure_interview/8.mp3?v=936d154ac9",
    "sec": 4.75
   },
   {
    "n": 12,
    "role": "presser",
    "text": "…사실 이건 압박 면접이었습니다. 잘 버티셨어요.",
    "dir": "표정을 풀며 따뜻하게",
    "tip": "톤 전환: 차가움에서 따뜻함으로",
    "tts": "/relay/tts/pressure_interview/9.mp3?v=685e12f243",
    "sec": 6.53
   },
   {
    "n": 13,
    "role": "applicant",
    "text": "그럼 점심은 진짜로 사 주시는 거죠?",
    "dir": "긴장이 풀려 장난스럽게",
    "tip": "결말: 밝고 자연스럽게",
    "tts": "/relay/tts/pressure_interview/10.mp3?v=d248539587",
    "sec": 3.22
   }
  ]
 },
 {
  "key": "parttime_interview",
  "hall": "real",
  "genre": "interview",
  "title": "편의점 알바 면접",
  "logline": "새벽 편의점 알바 면접. 그런데 면접 도중 단골손님이 들어온다.",
  "roles": [
   {
    "id": "manager",
    "name": "점장",
    "type": "everyday",
    "voice": "m_bright",
    "desc": "사람 좋은 동네 편의점 점장"
   },
   {
    "id": "applicant",
    "name": "지원자",
    "type": "everyday",
    "voice": "f_bright",
    "desc": "첫 알바 면접을 보는 대학생"
   },
   {
    "id": "regular",
    "name": "단골 할아버지",
    "type": "everyday",
    "voice": "m_elder",
    "desc": "매일 새벽 막걸리 사러 오는 단골"
   }
  ],
  "lines": [
   {
    "n": 1,
    "role": "manager",
    "text": "편하게 앉아요. 혹시 편의점 일 해 본 적 있어요?",
    "dir": "친근하게",
    "tip": "일상 대화: 힘 빼고 자연스럽게",
    "tts": "/relay/tts/parttime_interview/1.mp3?v=73ee47196d",
    "sec": 4.46
   },
   {
    "n": 2,
    "role": "applicant",
    "text": "아니요, 처음이에요! 그래도 계산은 자신 있어요!",
    "dir": "긴장해서 크게",
    "tip": "의욕: 밝고 또렷하게",
    "tts": "/relay/tts/parttime_interview/2.mp3?v=ad2078c1c3",
    "sec": 5.02
   },
   {
    "n": 3,
    "role": "manager",
    "text": "좋아요. 그럼 새벽에 손님이 진상 부리면요?",
    "dir": "슬쩍 떠보듯",
    "tip": "상황 질문: 가볍게 묻기",
    "tts": "/relay/tts/parttime_interview/3.mp3?v=1b58b9a996",
    "sec": 4.37
   },
   {
    "n": 4,
    "role": "applicant",
    "text": "웃으면서, 원칙대로 안내해 드리겠습니다.",
    "dir": "연습한 대로 또박또박",
    "tip": "모범 답변: 또박또박 끊어 말하기",
    "tts": "/relay/tts/parttime_interview/4.mp3?v=516c278a56",
    "sec": 3.72
   },
   {
    "n": 5,
    "role": "manager",
    "text": "연습한 티가 나네요. 그럼 폐기 도시락은 어떻게 해요?",
    "dir": "장난스럽게",
    "tip": "떠보기: 말끝 올리기",
    "tts": "/relay/tts/parttime_interview/747e3ec5d7.mp3?v=747e3ec5d7",
    "sec": 4.58
   },
   {
    "n": 6,
    "role": "applicant",
    "text": "규정대로 폐기합니다! …근데 혹시 먹어도 돼요?",
    "dir": "씩씩하다가 작게",
    "tip": "반전 톤: 크게에서 작게",
    "tts": "/relay/tts/parttime_interview/7ecd95beec.mp3?v=7ecd95beec",
    "sec": 4.9
   },
   {
    "n": 7,
    "role": "manager",
    "text": "하하, 솔직해서 좋네. 그건 합격하면 알려 줄게요.",
    "dir": "웃음 터지며",
    "tip": "웃으며 말하기",
    "tts": "/relay/tts/parttime_interview/569e059afa.mp3?v=569e059afa",
    "sec": 4.92
   },
   {
    "n": 8,
    "role": "regular",
    "text": "점장! 오늘도 그거 하나!",
    "dir": "문을 열며 크게",
    "tip": "등장: 크고 시원하게",
    "tts": "/relay/tts/parttime_interview/5.mp3?v=9efd69b2e8",
    "sec": 5.28
   },
   {
    "n": 9,
    "role": "manager",
    "text": "아, 마침 잘됐다. 실전 테스트 한번 해 봐요.",
    "dir": "장난스럽게 눈짓하며",
    "tip": "장난기: 말끝 올리기",
    "tts": "/relay/tts/parttime_interview/6.mp3?v=3aa1e6a304",
    "sec": 4.51
   },
   {
    "n": 10,
    "role": "applicant",
    "text": "어서 오세요, 고객님! 찾으시는 물건 있으세요?",
    "dir": "최대한 친절하게",
    "tip": "서비스 톤: 웃는 얼굴로 말하기",
    "tts": "/relay/tts/parttime_interview/7.mp3?v=dbd66cce5c",
    "sec": 5.09
   },
   {
    "n": 11,
    "role": "regular",
    "text": "그거 있잖아, 그거. 늘 먹는 거.",
    "dir": "답답하다는 듯",
    "tip": "어르신 말투: 느리고 툭툭",
    "tts": "/relay/tts/parttime_interview/8.mp3?v=820148a239",
    "sec": 6.86
   },
   {
    "n": 12,
    "role": "applicant",
    "text": "막걸리 한 병, 새우깡 하나, 그리고 영수증은 버려 드릴게요!",
    "dir": "자신 있게 빠르게",
    "tip": "빠른 말: 숨 한 번에 또렷하게",
    "tts": "/relay/tts/parttime_interview/9.mp3?v=bf3c944273",
    "sec": 5.11
   },
   {
    "n": 13,
    "role": "manager",
    "text": "합격! 어떻게 알았어요? 할아버지 영수증 안 받는 거.",
    "dir": "놀라서 박수 치며",
    "tip": "결말: 감탄과 웃음",
    "tts": "/relay/tts/parttime_interview/10.mp3?v=2615d8d328",
    "sec": 5.28
   }
  ]
 },
 {
  "key": "demon_company",
  "hall": "real",
  "genre": "cross",
  "title": "마왕 주식회사 면접",
  "logline": "마왕이 차린 스타트업에 용사가 면접을 보러 왔다.",
  "roles": [
   {
    "id": "ceo",
    "name": "마왕 대표",
    "type": "anime",
    "voice": "m_deep",
    "desc": "복지에 진심인 마왕 대표"
   },
   {
    "id": "applicant",
    "name": "지원자 용사",
    "type": "speech",
    "voice": "m_young",
    "desc": "은퇴 후 취업 준비 중인 용사"
   },
   {
    "id": "slime",
    "name": "비서 슬라임",
    "type": "anime",
    "voice": "f_child",
    "desc": "말끝마다 '말랑'을 붙이는 비서"
   }
  ],
  "lines": [
   {
    "n": 1,
    "role": "slime",
    "text": "다음 지원자 들어오세요, 말랑!",
    "dir": "귀엽고 밝게",
    "tip": "캐릭터 말투: 높고 통통 튀게",
    "tts": "/relay/tts/demon_company/1.mp3?v=dadf382a51",
    "sec": 3.17
   },
   {
    "n": 2,
    "role": "applicant",
    "text": "안녕하십니까. 전직 용사, 지금은 구직자입니다.",
    "dir": "격식 있게, 조금 민망하게",
    "tip": "자기소개: 또박또박",
    "tts": "/relay/tts/demon_company/2.mp3?v=59a1bbc7e1",
    "sec": 5.26
   },
   {
    "n": 3,
    "role": "ceo",
    "text": "용사라… 우리 회사 성을 세 번이나 부순 그 용사인가?",
    "dir": "서류를 내려놓으며 낮게",
    "tip": "위압감: 천천히 낮게",
    "tts": "/relay/tts/demon_company/3.mp3?v=f2efda79fd",
    "sec": 6.48
   },
   {
    "n": 4,
    "role": "applicant",
    "text": "네. 그 경험으로 건물 안전 진단에 자신 있습니다.",
    "dir": "당당하게 미소 지으며",
    "tip": "약점을 강점으로: 단단하게",
    "tts": "/relay/tts/demon_company/4.mp3?v=1452f9ad15",
    "sec": 5.02
   },
   {
    "n": 5,
    "role": "slime",
    "text": "대표님, 이 사람 진짜 웃겨요, 말랑!",
    "dir": "몰래 속삭이듯",
    "tip": "속삭임: 작지만 또렷하게",
    "tts": "/relay/tts/demon_company/5.mp3?v=ea2ed1c1ca",
    "sec": 3.91
   },
   {
    "n": 6,
    "role": "ceo",
    "text": "조용히 해라, 슬라임. …그런데 정말 좀 웃기긴 하군.",
    "dir": "근엄하다가 피식",
    "tip": "웃음 참기",
    "tts": "/relay/tts/demon_company/52b09c907e.mp3?v=52b09c907e",
    "sec": 8.11
   },
   {
    "n": 7,
    "role": "applicant",
    "text": "대표님, 혹시 복지는 어떻게 되나요?",
    "dir": "조심스럽게 손을 들며",
    "tip": "공손한 질문: 또박또박",
    "tts": "/relay/tts/demon_company/95ce05287f.mp3?v=95ce05287f",
    "sec": 3.38
   },
   {
    "n": 8,
    "role": "slime",
    "text": "대표님이 이 질문 제일 좋아하세요, 말랑!",
    "dir": "신나서 튀어 오르며",
    "tip": "귀여운 톤: 높고 통통 튀게",
    "tts": "/relay/tts/demon_company/f85f6d180c.mp3?v=f85f6d180c",
    "sec": 3.86
   },
   {
    "n": 9,
    "role": "ceo",
    "text": "좋다. 그런데 우리 회사는 주 사일제에 점심이 무료다.",
    "dir": "갑자기 자랑스럽게",
    "tip": "반전: 악역이 복지 자랑할 때",
    "tts": "/relay/tts/demon_company/6.mp3?v=23e248cc08",
    "sec": 7.44
   },
   {
    "n": 10,
    "role": "applicant",
    "text": "…혹시 마왕성보다 왕궁 복지가 더 나빴던 건가요?",
    "dir": "진지하게 고민하며",
    "tip": "고민하는 말투: 쉼을 섞어",
    "tts": "/relay/tts/demon_company/7.mp3?v=c3e35ed942",
    "sec": 4.27
   },
   {
    "n": 11,
    "role": "ceo",
    "text": "왕궁은 야근 수당도 안 줬지? 우린 준다.",
    "dir": "의기양양하게",
    "tip": "자신감: 문장 끝을 힘 있게",
    "tts": "/relay/tts/demon_company/8.mp3?v=7cf88c882e",
    "sec": 6.24
   },
   {
    "n": 12,
    "role": "slime",
    "text": "그럼 연봉 협상 들어갈게요, 말랑!",
    "dir": "신나서 서류를 흔들며",
    "tip": "신남: 빠르고 높게",
    "tts": "/relay/tts/demon_company/9.mp3?v=580c3eb318",
    "sec": 3.5
   },
   {
    "n": 13,
    "role": "applicant",
    "text": "모시겠습니다, 대표님! 아니, 마왕님!",
    "dir": "벌떡 일어나 힘차게",
    "tip": "결말: 우렁차게 외치기",
    "tts": "/relay/tts/demon_company/10.mp3?v=23cb73c8c3",
    "sec": 4.82
   }
  ]
 },
 {
  "key": "camera_test",
  "hall": "real",
  "genre": "announcer",
  "title": "아나운서 카메라 테스트",
  "logline": "꿈에 그리던 방송국 카메라 테스트. 빨간불이 켜진다.",
  "roles": [
   {
    "id": "judge",
    "name": "심사위원",
    "type": "announcer",
    "voice": "f_calm",
    "desc": "현직 메인 앵커 출신 심사위원"
   },
   {
    "id": "applicant",
    "name": "지원자",
    "type": "announcer",
    "voice": "f_bright",
    "desc": "삼 년째 도전하는 아나운서 지망생"
   },
   {
    "id": "pd",
    "name": "PD",
    "type": "everyday",
    "voice": "m_calm",
    "desc": "시간에 쫓기는 담당 PD"
   }
  ],
  "lines": [
   {
    "n": 1,
    "role": "pd",
    "text": "카메라 돌아갑니다. 셋, 둘, 하나, 큐!",
    "dir": "빠르고 정확하게",
    "tip": "큐 사인: 숫자를 일정한 간격으로",
    "tts": "/relay/tts/camera_test/1.mp3?v=3451e0e8e1",
    "sec": 7.3
   },
   {
    "n": 2,
    "role": "applicant",
    "text": "안녕하십니까. 오늘의 주요 뉴스를 전해 드리겠습니다.",
    "dir": "밝고 안정적으로",
    "tip": "뉴스 오프닝: 첫 음 안정적으로",
    "tts": "/relay/tts/camera_test/2.mp3?v=8f8aa8b683",
    "sec": 4.97
   },
   {
    "n": 3,
    "role": "judge",
    "text": "좋아요. 이번엔 같은 문장을 속보처럼 해 볼까요?",
    "dir": "펜을 들고 차분하게",
    "tip": "지시 톤: 부드럽고 명확하게",
    "tts": "/relay/tts/camera_test/3.mp3?v=d391a2e6d8",
    "sec": 5.38
   },
   {
    "n": 4,
    "role": "applicant",
    "text": "속보입니다. 조금 전, 서울 도심에 첫눈이 내렸습니다.",
    "dir": "긴박하게 속도를 올려",
    "tip": "속보 톤: 빠르지만 정확하게",
    "tts": "/relay/tts/camera_test/4.mp3?v=84eb9566a0",
    "sec": 5.52
   },
   {
    "n": 5,
    "role": "judge",
    "text": "이번엔 같은 내용을 따뜻한 아침 방송처럼요.",
    "dir": "미소를 띠며",
    "tip": "톤 바꾸기 주문: 차분하게",
    "tts": "/relay/tts/camera_test/5.mp3?v=17ac4979cc",
    "sec": 4.42
   },
   {
    "n": 6,
    "role": "applicant",
    "text": "좋은 아침입니다. 밤사이 소복이 쌓인 첫눈, 보셨나요?",
    "dir": "부드럽고 환하게",
    "tip": "아침 톤: 미소 띤 목소리",
    "tts": "/relay/tts/camera_test/f21a4f183a.mp3?v=f21a4f183a",
    "sec": 5.78
   },
   {
    "n": 7,
    "role": "judge",
    "text": "좋네요. 그럼 마지막으로, 돌발 상황 대처를 볼게요.",
    "dir": "의미심장하게",
    "tip": "예고: 끝을 낮게",
    "tts": "/relay/tts/camera_test/12ae60cf08.mp3?v=12ae60cf08",
    "sec": 6.07
   },
   {
    "n": 8,
    "role": "applicant",
    "text": "돌발 상황이요? 어떤…",
    "dir": "살짝 긴장해서",
    "tip": "긴장: 말끝 흐리기",
    "tts": "/relay/tts/camera_test/bbaf514f41.mp3?v=bbaf514f41",
    "sec": 3.34
   },
   {
    "n": 9,
    "role": "pd",
    "text": "잠깐, 프롬프터 꺼졌어요! 원고 없이 가야 해요!",
    "dir": "다급하게 외치며",
    "tip": "돌발 상황: 급하게 외치기",
    "tts": "/relay/tts/camera_test/6.mp3?v=7f22ceb1a6",
    "sec": 6.98
   },
   {
    "n": 10,
    "role": "applicant",
    "text": "네, 괜찮습니다. 원고 없이 이어 가겠습니다.",
    "dir": "숨 한 번 고르고 침착하게",
    "tip": "위기 대처: 목소리 떨지 않기",
    "tts": "/relay/tts/camera_test/7.mp3?v=0f07a652c7",
    "sec": 5.16
   },
   {
    "n": 11,
    "role": "applicant",
    "text": "창밖을 보시면, 올겨울 첫 손님이 와 있습니다.",
    "dir": "따뜻하게 즉흥으로",
    "tip": "애드리브 멘트: 자연스럽고 따뜻하게",
    "tts": "/relay/tts/camera_test/8.mp3?v=2e5aeec5f6",
    "sec": 4.06
   },
   {
    "n": 12,
    "role": "judge",
    "text": "…원고 없이 더 좋네요. 몇 년 준비했어요?",
    "dir": "감탄하며",
    "tip": "감탄: 진심이 묻어나게",
    "tts": "/relay/tts/camera_test/9.mp3?v=71369fece5",
    "sec": 4.97
   },
   {
    "n": 13,
    "role": "applicant",
    "text": "삼 년이요. 오늘 같은 일에 대비해서요.",
    "dir": "벅찬 마음을 누르며 또렷하게",
    "tip": "결말: 벅참을 절제하기",
    "tts": "/relay/tts/camera_test/10.mp3?v=f09abfbe71",
    "sec": 4.27
   }
  ]
 },
 {
  "key": "script_change",
  "hall": "real",
  "genre": "announcer",
  "title": "원고가 바뀌었다",
  "logline": "생방송 삼십 초 전, 메인 뉴스 원고가 통째로 바뀐다.",
  "roles": [
   {
    "id": "anchor",
    "name": "앵커",
    "type": "announcer",
    "voice": "f_calm",
    "desc": "어떤 상황에도 흔들리지 않는 앵커"
   },
   {
    "id": "pd",
    "name": "PD",
    "type": "everyday",
    "voice": "m_bright",
    "desc": "늘 막판에 원고를 바꾸는 PD"
   },
   {
    "id": "writer",
    "name": "방송작가",
    "type": "everyday",
    "voice": "f_bright",
    "desc": "밤새 원고를 쓴 막내 작가"
   }
  ],
  "lines": [
   {
    "n": 1,
    "role": "pd",
    "text": "앵커님! 첫 꼭지 바뀌었어요! 원고 지금 들어갑니다!",
    "dir": "뛰어오며 숨 가쁘게",
    "tip": "급박함: 숨 가쁜 발성",
    "tts": "/relay/tts/script_change/1.mp3?v=a69017fb69",
    "sec": 5.69
   },
   {
    "n": 2,
    "role": "anchor",
    "text": "괜찮아요. 몇 초 남았죠?",
    "dir": "놀라지 않고 차분하게",
    "tip": "침착함: 낮고 안정적으로",
    "tts": "/relay/tts/script_change/2.mp3?v=d161160340",
    "sec": 3.94
   },
   {
    "n": 3,
    "role": "writer",
    "text": "삼십 초요! 죄송해요, 제가 오타 냈어요!",
    "dir": "울 것 같은 목소리로",
    "tip": "울먹임: 떨리는 호흡",
    "tts": "/relay/tts/script_change/3.mp3?v=a30aa3f5a5",
    "sec": 4.75
   },
   {
    "n": 4,
    "role": "anchor",
    "text": "숨 한 번 쉬어요. 우린 생방송 전문가잖아요.",
    "dir": "따뜻하게 웃으며",
    "tip": "다독임: 부드럽고 느리게",
    "tts": "/relay/tts/script_change/4.mp3?v=e5c4551460",
    "sec": 5.21
   },
   {
    "n": 5,
    "role": "writer",
    "text": "앵커님, 원고 마지막 장은 아직 프린트 중이에요!",
    "dir": "발을 동동 구르며",
    "tip": "다급함: 숨 가쁘게",
    "tts": "/relay/tts/script_change/0fd4c2f2b9.mp3?v=0fd4c2f2b9",
    "sec": 4.18
   },
   {
    "n": 6,
    "role": "anchor",
    "text": "괜찮아요. 마지막 장은 제가 채우면 되죠.",
    "dir": "넥타이를 고치며 여유 있게",
    "tip": "여유: 웃음 섞기",
    "tts": "/relay/tts/script_change/8a1a549020.mp3?v=8a1a549020",
    "sec": 5.06
   },
   {
    "n": 7,
    "role": "writer",
    "text": "앵커님 그 미소… 왠지 불안해요.",
    "dir": "불안하게 작게",
    "tip": "불안: 빠르고 작게",
    "tts": "/relay/tts/script_change/4276e1a979.mp3?v=4276e1a979",
    "sec": 3.91
   },
   {
    "n": 8,
    "role": "pd",
    "text": "온에어 갑니다! 다섯, 넷, 셋…",
    "dir": "카운트를 세며",
    "tip": "카운트: 또박또박 간격 맞추기",
    "tts": "/relay/tts/script_change/5.mp3?v=1492d26d1c",
    "sec": 3.89
   },
   {
    "n": 9,
    "role": "anchor",
    "text": "시청자 여러분, 오늘 첫 소식은… 우리 작가의 생일입니다.",
    "dir": "정중하게 시작해서 엉뚱하게",
    "tip": "반전 멘트: 뉴스 톤을 유지한 채",
    "tts": "/relay/tts/script_change/6.mp3?v=8c0ed3d7f6",
    "sec": 6.29
   },
   {
    "n": 10,
    "role": "writer",
    "text": "앵커님?! 그거 원고 맨 밑에 낙서한 건데요!",
    "dir": "기겁해서 속삭이며",
    "tip": "작게 외치기: 소리 없이 놀라기",
    "tts": "/relay/tts/script_change/7.mp3?v=7f715cf60e",
    "sec": 4.66
   },
   {
    "n": 11,
    "role": "anchor",
    "text": "농담이고요. 본격적인 뉴스, 지금 시작합니다.",
    "dir": "능숙하게 표정을 바꾸며",
    "tip": "톤 복귀: 한 번에 뉴스 톤으로",
    "tts": "/relay/tts/script_change/8.mp3?v=3f22870b29",
    "sec": 5.83
   },
   {
    "n": 12,
    "role": "pd",
    "text": "와… 저걸 저렇게 살린다고?",
    "dir": "넋 나간 목소리로",
    "tip": "혼잣말: 감탄을 작게",
    "tts": "/relay/tts/script_change/9.mp3?v=528cc8b269",
    "sec": 3.12
   },
   {
    "n": 13,
    "role": "anchor",
    "text": "작가님, 생일 축하해요. 방송 끝나고 케이크 먹어요.",
    "dir": "광고 시간에 다정하게",
    "tip": "결말: 다정하고 따뜻하게",
    "tts": "/relay/tts/script_change/10.mp3?v=571ad5d0e3",
    "sec": 5.98
   }
  ]
 },
 {
  "key": "weather_live",
  "hall": "real",
  "genre": "news",
  "title": "날씨 생중계",
  "logline": "태풍 북상 날씨 생중계. 바람 때문에 우산이 날아간다.",
  "roles": [
   {
    "id": "anchor",
    "name": "앵커",
    "type": "announcer",
    "voice": "m_calm",
    "desc": "스튜디오의 베테랑 앵커"
   },
   {
    "id": "caster",
    "name": "기상캐스터",
    "type": "announcer",
    "voice": "f_bright",
    "desc": "현장에 나간 열정 기상캐스터"
   },
   {
    "id": "citizen",
    "name": "시민",
    "type": "everyday",
    "voice": "m_elder",
    "desc": "산책 나왔다 잡힌 동네 어르신"
   }
  ],
  "lines": [
   {
    "n": 1,
    "role": "anchor",
    "text": "태풍 소식입니다. 현장에 나가 있는 기상캐스터 연결합니다.",
    "dir": "안정적으로 또박또박",
    "tip": "연결 멘트: 끝을 넘겨주듯",
    "tts": "/relay/tts/weather_live/1.mp3?v=8183d439fe",
    "sec": 7.15
   },
   {
    "n": 2,
    "role": "caster",
    "text": "네, 저는 지금 부산 해운대에 나와 있습니다!",
    "dir": "바람을 뚫고 크게",
    "tip": "현장 발성: 크게 하지만 또렷하게",
    "tts": "/relay/tts/weather_live/2.mp3?v=fe1a542230",
    "sec": 4.15
   },
   {
    "n": 3,
    "role": "caster",
    "text": "보시는 것처럼 바람이 굉장히 강하게 불고 있는데요!",
    "dir": "몸을 가누며 외치듯",
    "tip": "외치며 설명: 문장 끝까지 힘 유지",
    "tts": "/relay/tts/weather_live/3.mp3?v=eacae457c6",
    "sec": 3.91
   },
   {
    "n": 4,
    "role": "anchor",
    "text": "위험해 보이는데요. 안전에 유의하시기 바랍니다.",
    "dir": "걱정스럽게 차분하게",
    "tip": "걱정 톤: 낮고 따뜻하게",
    "tts": "/relay/tts/weather_live/4.mp3?v=83c1058620",
    "sec": 6.26
   },
   {
    "n": 5,
    "role": "caster",
    "text": "괜찮습니다! 저 기상캐스터 칠 년 차, 바람에 강합니다!",
    "dir": "자신만만하게 외치며",
    "tip": "허세: 크게 당당하게",
    "tts": "/relay/tts/weather_live/4dc80f59d2.mp3?v=4dc80f59d2",
    "sec": 6.19
   },
   {
    "n": 6,
    "role": "anchor",
    "text": "칠 년 차라도… 지금 몸이 옆으로 기울고 있는데요.",
    "dir": "걱정스럽게",
    "tip": "걱정: 부드럽게 빠르게",
    "tts": "/relay/tts/weather_live/04effb19a0.mp3?v=04effb19a0",
    "sec": 5.9
   },
   {
    "n": 7,
    "role": "citizen",
    "text": "아가씨, 그 자세 우리 동네 태극권이랑 똑같네.",
    "dir": "지나가다 끼어들며",
    "tip": "생활 말투: 느긋하게",
    "tts": "/relay/tts/weather_live/b194ceb322.mp3?v=b194ceb322",
    "sec": 6.31
   },
   {
    "n": 8,
    "role": "caster",
    "text": "네! 지금 시민 한 분을 만나 보겠습니다!",
    "dir": "씩씩하게",
    "tip": "전환 멘트: 밝고 빠르게",
    "tts": "/relay/tts/weather_live/5.mp3?v=854834f77f",
    "sec": 4.51
   },
   {
    "n": 9,
    "role": "citizen",
    "text": "나? 나는 우산 찾으러 나왔지. 아까 저리로 날아갔어.",
    "dir": "태평하게",
    "tip": "어르신 말투: 느긋하고 구수하게",
    "tts": "/relay/tts/weather_live/6.mp3?v=c75fd4ba28",
    "sec": 9.22
   },
   {
    "n": 10,
    "role": "caster",
    "text": "아, 방금 제 우산도 날아갔습니다! 계속 전해 드리겠습니다!",
    "dir": "당황했지만 프로답게",
    "tip": "돌발 대처: 웃음 참고 이어 가기",
    "tts": "/relay/tts/weather_live/7.mp3?v=0bb1efa4d4",
    "sec": 6.29
   },
   {
    "n": 11,
    "role": "anchor",
    "text": "…기상캐스터 씨, 일단 대피부터 하시죠.",
    "dir": "웃음을 참으며",
    "tip": "웃참 연기: 목소리가 살짝 흔들리게",
    "tts": "/relay/tts/weather_live/8.mp3?v=3ee3f88978",
    "sec": 5.04
   },
   {
    "n": 12,
    "role": "citizen",
    "text": "아가씨, 내 우산 찾으면 연락 줘. 파란색이야.",
    "dir": "진지하게 당부하며",
    "tip": "당부: 천천히 또박또박",
    "tts": "/relay/tts/weather_live/9.mp3?v=7136bc68d6",
    "sec": 6.38
   },
   {
    "n": 13,
    "role": "caster",
    "text": "이상, 우산 두 개를 잃은 해운대에서 전해 드렸습니다!",
    "dir": "끝까지 씩씩하게",
    "tip": "클로징: 마지막까지 또렷하게",
    "tts": "/relay/tts/weather_live/10.mp3?v=f3eeeca539",
    "sec": 4.63
   }
  ]
 },
 {
  "key": "exam_rivals",
  "hall": "real",
  "genre": "announcer",
  "title": "아나운서 실기 시험장",
  "logline": "실기 시험 대기실. 같은 학원 라이벌과 마지막 순서를 기다린다.",
  "roles": [
   {
    "id": "a",
    "name": "지원자 지수",
    "type": "announcer",
    "voice": "f_bright",
    "desc": "발음은 완벽한데 긴장에 약한 지원자"
   },
   {
    "id": "b",
    "name": "지원자 태오",
    "type": "announcer",
    "voice": "m_young",
    "desc": "능청스러운 라이벌"
   },
   {
    "id": "proctor",
    "name": "감독관",
    "type": "everyday",
    "voice": "m_elder",
    "desc": "무표정한 시험 감독관"
   }
  ],
  "lines": [
   {
    "n": 1,
    "role": "b",
    "text": "지수야, 손 떨리는 거 다 보여.",
    "dir": "능청스럽게 속삭이며",
    "tip": "속삭임: 숨으로 말하기",
    "tts": "/relay/tts/exam_rivals/1.mp3?v=8a3ef2caad",
    "sec": 3.05
   },
   {
    "n": 2,
    "role": "a",
    "text": "안 떨려. 발음 연습 중이거든. 간장 공장 공장장.",
    "dir": "빠르고 정확하게",
    "tip": "발음 연습: 받침 또렷하게",
    "tts": "/relay/tts/exam_rivals/2.mp3?v=fe72515113",
    "sec": 6.55
   },
   {
    "n": 3,
    "role": "b",
    "text": "그럼 나도. 경찰청 철창살은 외철창살.",
    "dir": "자랑하듯 빠르게",
    "tip": "잰말: 속도보다 정확도",
    "tts": "/relay/tts/exam_rivals/3.mp3?v=51318633ec",
    "sec": 4.49
   },
   {
    "n": 4,
    "role": "proctor",
    "text": "다음, 십칠 번, 십팔 번 준비하세요.",
    "dir": "무표정하게 기계적으로",
    "tip": "안내 톤: 감정 없이 일정하게",
    "tts": "/relay/tts/exam_rivals/4.mp3?v=6829418642",
    "sec": 5.76
   },
   {
    "n": 5,
    "role": "b",
    "text": "십팔 번이 나네. 지수 너 다음이 나야.",
    "dir": "숨을 고르며",
    "tip": "담담함: 떨림 숨기기",
    "tts": "/relay/tts/exam_rivals/db6237c90f.mp3?v=db6237c90f",
    "sec": 3.62
   },
   {
    "n": 6,
    "role": "a",
    "text": "그럼 내가 망쳐도 넌 잘하면 되겠다.",
    "dir": "장난스럽게, 살짝 떨리며",
    "tip": "농담 속 긴장",
    "tts": "/relay/tts/exam_rivals/3cf3240063.mp3?v=3cf3240063",
    "sec": 3.43
   },
   {
    "n": 7,
    "role": "b",
    "text": "망치긴 뭘 망쳐. 너 학원에서 제일 잘했잖아.",
    "dir": "정색하며",
    "tip": "진심: 속도 늦추기",
    "tts": "/relay/tts/exam_rivals/e9bc1865cb.mp3?v=e9bc1865cb",
    "sec": 4.63
   },
   {
    "n": 8,
    "role": "a",
    "text": "태오야, 솔직히 너 잘됐으면 좋겠어. 진짜로.",
    "dir": "진심으로 조용히",
    "tip": "진심: 작고 따뜻하게",
    "tts": "/relay/tts/exam_rivals/5.mp3?v=27e21f4bc7",
    "sec": 5.4
   },
   {
    "n": 9,
    "role": "b",
    "text": "…그 말 하려고 삼 년 동안 나 견제한 거야?",
    "dir": "놀랐다가 피식 웃으며",
    "tip": "반전 리액션: 놀람에서 웃음으로",
    "tts": "/relay/tts/exam_rivals/6.mp3?v=f44af401d1",
    "sec": 3.41
   },
   {
    "n": 10,
    "role": "a",
    "text": "견제는 견제고, 응원은 응원이지.",
    "dir": "당당하게",
    "tip": "대구법: 앞뒤 리듬 맞추기",
    "tts": "/relay/tts/exam_rivals/7.mp3?v=2a3a2aa9dc",
    "sec": 3.41
   },
   {
    "n": 11,
    "role": "proctor",
    "text": "십칠 번, 들어오세요.",
    "dir": "문을 열며",
    "tip": "호명: 짧고 분명하게",
    "tts": "/relay/tts/exam_rivals/8.mp3?v=94c256fab1",
    "sec": 4.18
   },
   {
    "n": 12,
    "role": "b",
    "text": "지수야. 끝나고 떡볶이. 붙든 떨어지든.",
    "dir": "등 뒤에서 힘주어",
    "tip": "응원: 짧게 끊어 힘 있게",
    "tts": "/relay/tts/exam_rivals/9.mp3?v=240e594f34",
    "sec": 4.82
   },
   {
    "n": 13,
    "role": "a",
    "text": "콜. 대신 붙은 사람이 사는 거야.",
    "dir": "웃으며 문으로 걸어가며",
    "tip": "결말: 자신감 있게",
    "tts": "/relay/tts/exam_rivals/10.mp3?v=d517c85201",
    "sec": 3.05
   }
  ]
 },
 {
  "key": "nine_news",
  "hall": "real",
  "genre": "news",
  "title": "아홉 시 뉴스: 기자 연결",
  "logline": "도심 한복판 고양이 구조 현장. 기자 연결이 자꾸 끊긴다.",
  "roles": [
   {
    "id": "anchor",
    "name": "앵커",
    "type": "announcer",
    "voice": "m_calm",
    "desc": "정확하고 품위 있는 메인 앵커"
   },
   {
    "id": "reporter",
    "name": "현장 기자",
    "type": "announcer",
    "voice": "f_bright",
    "desc": "현장감 넘치는 사회부 기자"
   },
   {
    "id": "firefighter",
    "name": "소방관",
    "type": "everyday",
    "voice": "m_elder",
    "desc": "구조 경력 이십 년 소방관"
   }
  ],
  "lines": [
   {
    "n": 1,
    "role": "anchor",
    "text": "다음 소식입니다. 도심 빌딩 외벽에 고양이가 고립됐다는 소식인데요.",
    "dir": "또박또박 정확하게",
    "tip": "리드 문장: 핵심 단어 강조",
    "tts": "/relay/tts/nine_news/1.mp3?v=3fdad754e9",
    "sec": 7.63
   },
   {
    "n": 2,
    "role": "anchor",
    "text": "현장에 나가 있는 기자 연결합니다. 박지은 기자.",
    "dir": "넘겨주듯",
    "tip": "연결 멘트: 끝음 살짝 올리기",
    "tts": "/relay/tts/nine_news/2.mp3?v=3bbc11a519",
    "sec": 6.34
   },
   {
    "n": 3,
    "role": "reporter",
    "text": "네, 저는 지금 구조 현장에 나와 있습니다.",
    "dir": "현장감 있게 또렷하게",
    "tip": "현장 리포트: 숨 안정시키기",
    "tts": "/relay/tts/nine_news/3.mp3?v=bc02987464",
    "sec": 3.98
   },
   {
    "n": 4,
    "role": "reporter",
    "text": "고양이는 십오 층 난간에서 세 시간째 버티고 있습니다.",
    "dir": "긴장감 있게",
    "tip": "숫자 읽기: 또박또박",
    "tts": "/relay/tts/nine_news/4.mp3?v=bfb8c00d5a",
    "sec": 4.51
   },
   {
    "n": 5,
    "role": "anchor",
    "text": "구조 상황은 어떻습니까?",
    "dir": "차분하게 묻기",
    "tip": "질문: 짧고 명확하게",
    "tts": "/relay/tts/nine_news/5.mp3?v=9b2ae2d5d8",
    "sec": 3.19
   },
   {
    "n": 6,
    "role": "reporter",
    "text": "소방대원들이 사다리차를 펼치고 있습니다. 아, 잠시만요!",
    "dir": "긴박하게",
    "tip": "중계 리듬: 쉼 없이",
    "tts": "/relay/tts/nine_news/58b8610843.mp3?v=58b8610843",
    "sec": 5.78
   },
   {
    "n": 7,
    "role": "firefighter",
    "text": "다들 물러서세요! 고양이가 놀라면 안 됩니다!",
    "dir": "크게 외치며",
    "tip": "현장 외침: 짧고 굵게",
    "tts": "/relay/tts/nine_news/4afe15e385.mp3?v=4afe15e385",
    "sec": 7.08
   },
   {
    "n": 8,
    "role": "anchor",
    "text": "기자님? 화면이 흔들리는데, 무슨 일입니까?",
    "dir": "걱정스럽게",
    "tip": "걱정: 차분함 유지",
    "tts": "/relay/tts/nine_news/7dea534e0d.mp3?v=7dea534e0d",
    "sec": 6.14
   },
   {
    "n": 9,
    "role": "reporter",
    "text": "지금… 고양이가 스스로 사다리를 타고 내려오고 있습니다!",
    "dir": "놀라서 목소리가 높아지며",
    "tip": "속보 전환: 놀람을 정확한 발음으로",
    "tts": "/relay/tts/nine_news/6.mp3?v=f08cd11f89",
    "sec": 5.33
   },
   {
    "n": 10,
    "role": "firefighter",
    "text": "이 녀석, 우리 출동한 거 보고 그냥 놀러 나온 거네요.",
    "dir": "허탈하게 웃으며",
    "tip": "인터뷰 말투: 자연스럽고 구수하게",
    "tts": "/relay/tts/nine_news/7.mp3?v=854f1743a2",
    "sec": 6.67
   },
   {
    "n": 11,
    "role": "reporter",
    "text": "구조대원들도 허탈한 웃음을 짓고 있습니다.",
    "dir": "웃음을 참으며 또박또박",
    "tip": "웃참 리포트: 끝까지 정확하게",
    "tts": "/relay/tts/nine_news/8.mp3?v=8e536533fa",
    "sec": 3.79
   },
   {
    "n": 12,
    "role": "anchor",
    "text": "고양이가 무사해서 다행입니다.",
    "dir": "미소 띠며 따뜻하게",
    "tip": "앵커 코멘트: 부드럽게 정리",
    "tts": "/relay/tts/nine_news/9.mp3?v=d80d1f0598",
    "sec": 3.72
   },
   {
    "n": 13,
    "role": "reporter",
    "text": "고양이는 지금… 제 마이크를 물고 도망가고 있습니다!",
    "dir": "다급하게 뛰어가며",
    "tip": "결말: 뛰면서도 발음 지키기",
    "tts": "/relay/tts/nine_news/10.mp3?v=5c45b44fc0",
    "sec": 5.47
   }
  ]
 },
 {
  "key": "sports_cast",
  "hall": "real",
  "genre": "news",
  "title": "결승골 중계",
  "logline": "월드컵 결승 연장 후반 추가 시간. 캐스터의 목이 터지기 직전이다.",
  "roles": [
   {
    "id": "caster",
    "name": "캐스터",
    "type": "announcer",
    "voice": "m_bright",
    "desc": "목이 터져라 외치는 열혈 캐스터"
   },
   {
    "id": "analyst",
    "name": "해설위원",
    "type": "announcer",
    "voice": "m_elder",
    "desc": "전설의 국가대표 출신 해설위원"
   },
   {
    "id": "coach",
    "name": "감독",
    "type": "speech",
    "voice": "m_calm",
    "desc": "말수 적은 대표팀 감독"
   }
  ],
  "lines": [
   {
    "n": 1,
    "role": "caster",
    "text": "연장 후반 추가 시간! 남은 시간은 단 일 분입니다!",
    "dir": "긴박하게 빠르게",
    "tip": "중계 톤: 빠르게, 끝까지 또렷하게",
    "tts": "/relay/tts/sports_cast/1.mp3?v=90123004ab",
    "sec": 4.78
   },
   {
    "n": 2,
    "role": "analyst",
    "text": "지금 한 번의 기회면 됩니다. 딱 한 번이요.",
    "dir": "침착하지만 떨리게",
    "tip": "해설 톤: 낮고 묵직하게",
    "tts": "/relay/tts/sports_cast/2.mp3?v=a8368e6f4a",
    "sec": 6.74
   },
   {
    "n": 3,
    "role": "caster",
    "text": "공을 잡았습니다! 하프라인을 넘어갑니다!",
    "dir": "점점 크게",
    "tip": "고조: 문장마다 높이 올리기",
    "tts": "/relay/tts/sports_cast/3.mp3?v=d54e110193",
    "sec": 4.15
   },
   {
    "n": 4,
    "role": "caster",
    "text": "한 명 제치고! 두 명 제치고!",
    "dir": "숨이 넘어갈 듯",
    "tip": "리듬: 짧게 끊어 외치기",
    "tts": "/relay/tts/sports_cast/4.mp3?v=d4126feac5",
    "sec": 3.19
   },
   {
    "n": 5,
    "role": "analyst",
    "text": "때려야 합니다! 지금이에요, 지금!",
    "dir": "자리에서 일어나 외치며",
    "tip": "흥분: 해설자도 무너질 때",
    "tts": "/relay/tts/sports_cast/5.mp3?v=f2ac39e7e6",
    "sec": 6.53
   },
   {
    "n": 6,
    "role": "coach",
    "text": "슛! 슛! 아니, 패스! 아니, 슛!",
    "dir": "벤치에서 미친 듯이",
    "tip": "외침: 빠르게 오락가락",
    "tts": "/relay/tts/sports_cast/767f00ab0e.mp3?v=767f00ab0e",
    "sec": 8.57
   },
   {
    "n": 7,
    "role": "caster",
    "text": "감독님도 지금 정신이 없습니다! 저도 없습니다!",
    "dir": "숨넘어가게",
    "tip": "흥분: 말 겹치듯 빠르게",
    "tts": "/relay/tts/sports_cast/bf89577ae9.mp3?v=bf89577ae9",
    "sec": 4.92
   },
   {
    "n": 8,
    "role": "analyst",
    "text": "숨 쉬세요, 캐스터님! 지금 공이 뜹니다!",
    "dir": "소리치며",
    "tip": "긴박: 끝을 올리기",
    "tts": "/relay/tts/sports_cast/36e1f0e5a8.mp3?v=36e1f0e5a8",
    "sec": 7.3
   },
   {
    "n": 9,
    "role": "caster",
    "text": "슈우우웃… 골대 맞고… 다시 튀어나옵니다!",
    "dir": "길게 끌었다가 절망하며",
    "tip": "감정 낙차: 환호에서 탄식으로",
    "tts": "/relay/tts/sports_cast/6.mp3?v=a636ebe3e3",
    "sec": 4.58
   },
   {
    "n": 10,
    "role": "caster",
    "text": "아! 그런데 그 공이 등에 맞고 들어갑니다! 골입니다!",
    "dir": "목이 터져라",
    "tip": "클라이맥스: 배에서 최대 발성",
    "tts": "/relay/tts/sports_cast/7.mp3?v=4494e8a885",
    "sec": 5.28
   },
   {
    "n": 11,
    "role": "analyst",
    "text": "이게 축구입니다! 이게 바로 축구예요!",
    "dir": "울먹이며 외치듯",
    "tip": "울컥: 떨림을 살려 외치기",
    "tts": "/relay/tts/sports_cast/8.mp3?v=d53f62bbdc",
    "sec": 6.34
   },
   {
    "n": 12,
    "role": "coach",
    "text": "…등으로 넣으라고 연습시킨 적은 없습니다.",
    "dir": "인터뷰에서 담담하게",
    "tip": "담담함: 감정 빼고 툭",
    "tts": "/relay/tts/sports_cast/9.mp3?v=fa140688b7",
    "sec": 4.37
   },
   {
    "n": 13,
    "role": "caster",
    "text": "역사는 등으로 쓰였습니다! 대한민국, 우승입니다!",
    "dir": "마지막 힘을 다해",
    "tip": "결말: 클로징 외침",
    "tts": "/relay/tts/sports_cast/10.mp3?v=1b0997f8ea",
    "sec": 4.92
   }
  ]
 },
 {
  "key": "demon_news",
  "hall": "real",
  "genre": "cross",
  "title": "속보: 마왕 출현",
  "logline": "평화로운 저녁 뉴스. 광화문에 진짜 마왕이 나타났다.",
  "roles": [
   {
    "id": "anchor",
    "name": "앵커",
    "type": "announcer",
    "voice": "f_calm",
    "desc": "어떤 속보에도 침착한 앵커"
   },
   {
    "id": "reporter",
    "name": "현장 기자",
    "type": "announcer",
    "voice": "m_bright",
    "desc": "용감한 건지 무모한 건지 모를 기자"
   },
   {
    "id": "demon",
    "name": "마왕",
    "type": "anime",
    "voice": "m_deep",
    "desc": "생방송이 처음인 마왕"
   },
   {
    "id": "citizen",
    "name": "시민",
    "type": "everyday",
    "voice": "f_elder",
    "desc": "장 보고 가던 동네 할머니"
   }
  ],
  "lines": [
   {
    "n": 1,
    "role": "anchor",
    "text": "속보입니다. 지금 광화문 광장에 정체불명의 존재가 나타났습니다.",
    "dir": "침착하지만 긴박하게",
    "tip": "속보 톤: 첫 문장 단단하게",
    "tts": "/relay/tts/demon_news/1.mp3?v=b9991ce93a",
    "sec": 6.82
   },
   {
    "n": 2,
    "role": "reporter",
    "text": "네, 현장입니다! 지금 제 뒤로 거대한 날개가 보이십니까!",
    "dir": "흥분을 누르며 크게",
    "tip": "현장감: 크게, 하지만 정확하게",
    "tts": "/relay/tts/demon_news/2.mp3?v=2dd829cf01",
    "sec": 5.47
   },
   {
    "n": 3,
    "role": "demon",
    "text": "인간들이여. 나는 어둠의 군주, 마왕이다.",
    "dir": "느리고 웅장하게",
    "tip": "웅장함: 문장마다 쉼 넣기",
    "tts": "/relay/tts/demon_news/3.mp3?v=8bf9edf25c",
    "sec": 7.1
   },
   {
    "n": 4,
    "role": "citizen",
    "text": "아이고, 저 양반 날개에 비닐봉지 걸렸네.",
    "dir": "태평하게 혀를 차며",
    "tip": "구수함: 사투리처럼 느긋하게",
    "tts": "/relay/tts/demon_news/4.mp3?v=1d537dfd99",
    "sec": 5.06
   },
   {
    "n": 5,
    "role": "reporter",
    "text": "마왕님, 시청자분들께 한 말씀 해 주시겠습니까?",
    "dir": "마이크를 들이밀며 용감하게",
    "tip": "인터뷰 질문: 공손하지만 당당하게",
    "tts": "/relay/tts/demon_news/5.mp3?v=f3c67e5b96",
    "sec": 4.06
   },
   {
    "n": 6,
    "role": "demon",
    "text": "흠. 한 말씀이라… 대본은 없나?",
    "dir": "당황해서 두리번거리며",
    "tip": "당황: 위엄 흔들기",
    "tts": "/relay/tts/demon_news/d7b9e57317.mp3?v=d7b9e57317",
    "sec": 5.42
   },
   {
    "n": 7,
    "role": "reporter",
    "text": "대본은 없습니다! 편하게 하세요, 전국에 나가고 있어요!",
    "dir": "해맑게",
    "tip": "밝게 또박또박",
    "tts": "/relay/tts/demon_news/73350cad1e.mp3?v=73350cad1e",
    "sec": 5.21
   },
   {
    "n": 8,
    "role": "citizen",
    "text": "마왕 양반, 떨리면 숨 크게 쉬어. 나도 노래자랑 나가 봤어.",
    "dir": "다정하게 조언하며",
    "tip": "생활 연기: 느긋하게",
    "tts": "/relay/tts/demon_news/9c8e83d698.mp3?v=9c8e83d698",
    "sec": 7.7
   },
   {
    "n": 9,
    "role": "demon",
    "text": "잠깐… 지금 이거 생방송인가? 머리 정리 좀 하고.",
    "dir": "갑자기 신경 쓰며",
    "tip": "반전: 위엄이 깨지는 순간",
    "tts": "/relay/tts/demon_news/6.mp3?v=c8d7f67d48",
    "sec": 8.52
   },
   {
    "n": 10,
    "role": "anchor",
    "text": "마왕 씨, 방송 중에는 카메라를 보고 말씀해 주세요.",
    "dir": "프로답게 정중하게",
    "tip": "진행 톤: 정중하고 단호하게",
    "tts": "/relay/tts/demon_news/7.mp3?v=feddd7300a",
    "sec": 5.04
   },
   {
    "n": 11,
    "role": "demon",
    "text": "흠흠. 세상을 정복하러 왔다. 그리고 엄마, 나 티비 나와.",
    "dir": "근엄하게 시작해 수줍게",
    "tip": "톤 급변: 근엄에서 수줍음으로",
    "tts": "/relay/tts/demon_news/8.mp3?v=4c5398c0ab",
    "sec": 9.91
   },
   {
    "n": 12,
    "role": "citizen",
    "text": "정복은 나중에 하고, 비닐봉지나 떼 줄게. 이리 와 봐.",
    "dir": "손짓하며 다정하게",
    "tip": "다정함: 할머니의 따뜻한 말투",
    "tts": "/relay/tts/demon_news/9.mp3?v=5892750fab",
    "sec": 7.2
   },
   {
    "n": 13,
    "role": "anchor",
    "text": "마왕 씨, 다음 주 일기예보도 부탁드립니다. 이상 속보였습니다.",
    "dir": "완벽한 미소로 마무리하며",
    "tip": "클로징: 끝까지 품위 있게",
    "tts": "/relay/tts/demon_news/10.mp3?v=cf405fe360",
    "sec": 6.74
   }
  ]
 },
 {
  "key": "wedding_mc",
  "hall": "real",
  "genre": "speech",
  "title": "결혼식 사회",
  "logline": "친구 결혼식 사회를 맡았다. 그런데 신랑이 아직 도착하지 않았다.",
  "roles": [
   {
    "id": "mc",
    "name": "사회자",
    "type": "speech",
    "voice": "m_bright",
    "desc": "생애 첫 사회를 맡은 신랑 친구"
   },
   {
    "id": "bridesmaid",
    "name": "신부 친구",
    "type": "everyday",
    "voice": "f_bright",
    "desc": "눈치 빠른 신부 측 친구"
   },
   {
    "id": "officiant",
    "name": "주례 선생님",
    "type": "speech",
    "voice": "m_elder",
    "desc": "말이 아주 긴 은사님"
   }
  ],
  "lines": [
   {
    "n": 1,
    "role": "mc",
    "text": "지금부터 신랑 민수 군과 신부 지영 양의 결혼식을 시작하겠습니다.",
    "dir": "떨리지만 또박또박",
    "tip": "사회 오프닝: 첫 문장 천천히",
    "tts": "/relay/tts/wedding_mc/1.mp3?v=78a87fe8b7",
    "sec": 5.23
   },
   {
    "n": 2,
    "role": "bridesmaid",
    "text": "사회자님, 신랑 아직 안 왔어요. 주차장이래요.",
    "dir": "급하게 속삭이며",
    "tip": "귓속말: 작지만 다급하게",
    "tts": "/relay/tts/wedding_mc/2.mp3?v=03d60ddc73",
    "sec": 5.18
   },
   {
    "n": 3,
    "role": "mc",
    "text": "에… 신랑 입장에 앞서, 잠시 주례 선생님 말씀을 먼저 듣겠습니다.",
    "dir": "당황을 숨기고 매끄럽게",
    "tip": "즉흥 진행: 웃는 얼굴로 넘기기",
    "tts": "/relay/tts/wedding_mc/3.mp3?v=d31ce14b49",
    "sec": 5.9
   },
   {
    "n": 4,
    "role": "officiant",
    "text": "어흠. 나는 신랑을 초등학교 때부터 가르쳤습니다.",
    "dir": "느긋하게 목을 가다듬고",
    "tip": "연설 톤: 느리고 묵직하게",
    "tts": "/relay/tts/wedding_mc/4.mp3?v=d56fa33833",
    "sec": 7.46
   },
   {
    "n": 5,
    "role": "officiant",
    "text": "그때도 이 녀석은 늘 지각을 했지요.",
    "dir": "추억에 잠겨 웃으며",
    "tip": "회상: 부드럽게 미소 섞기",
    "tts": "/relay/tts/wedding_mc/5.mp3?v=25fbc30afc",
    "sec": 4.82
   },
   {
    "n": 6,
    "role": "mc",
    "text": "하하, 주례 선생님 말씀이 아주 정확하십니다.",
    "dir": "진땀 흘리며 웃어넘기듯",
    "tip": "수습: 웃음 섞어 매끄럽게",
    "tts": "/relay/tts/wedding_mc/e82afdd420.mp3?v=e82afdd420",
    "sec": 4.08
   },
   {
    "n": 7,
    "role": "officiant",
    "text": "그래서 오늘 주례사도 길게 준비했습니다. 이십 장입니다.",
    "dir": "뿌듯하게 원고를 펼치며",
    "tip": "반전: 담담하게 큰 숫자",
    "tts": "/relay/tts/wedding_mc/bedf84910c.mp3?v=bedf84910c",
    "sec": 7.8
   },
   {
    "n": 8,
    "role": "mc",
    "text": "이십 장이요? 아, 네… 천천히 하셔도 됩니다! 정말 천천히!",
    "dir": "놀랐다가 반가워하며",
    "tip": "감정 전환: 놀람에서 안도로",
    "tts": "/relay/tts/wedding_mc/b5bd5940a2.mp3?v=b5bd5940a2",
    "sec": 6.98
   },
   {
    "n": 9,
    "role": "bridesmaid",
    "text": "사회자님, 신랑 이번엔 엘리베이터에 갇혔대요!",
    "dir": "기겁해서",
    "tip": "놀람: 작게 외치기",
    "tts": "/relay/tts/wedding_mc/6.mp3?v=5ac65626e6",
    "sec": 4.03
   },
   {
    "n": 10,
    "role": "mc",
    "text": "여러분, 신랑은 지금… 인생의 마지막 관문을 통과하고 있습니다!",
    "dir": "과장되게 힘주어",
    "tip": "위기 넘기기: 크게 웃으며 포장하기",
    "tts": "/relay/tts/wedding_mc/7.mp3?v=807c51a7d3",
    "sec": 5.74
   },
   {
    "n": 11,
    "role": "officiant",
    "text": "역시 지각 대장. 그래도 마지막엔 꼭 오던 녀석이었습니다.",
    "dir": "따뜻하게 고개를 끄덕이며",
    "tip": "따뜻한 연설: 감동 살리기",
    "tts": "/relay/tts/wedding_mc/8.mp3?v=7778667270",
    "sec": 8.23
   },
   {
    "n": 12,
    "role": "bridesmaid",
    "text": "왔어요! 신랑 왔어요! 넥타이는 없어요!",
    "dir": "기뻐서 크게",
    "tip": "환호: 밝고 크게",
    "tts": "/relay/tts/wedding_mc/9.mp3?v=683787e7a8",
    "sec": 5.47
   },
   {
    "n": 13,
    "role": "mc",
    "text": "자, 그럼 모두 박수로 맞이해 주십시오! 지각 대장, 신랑 입장!",
    "dir": "모든 걸 쏟아 우렁차게",
    "tip": "클로징: 최대 에너지로 마무리",
    "tts": "/relay/tts/wedding_mc/10.mp3?v=68b86924a4",
    "sec": 6.05
   }
  ]
 },
 {
  "key": "graduation_speech",
  "hall": "real",
  "genre": "speech",
  "title": "졸업식 축사 대결",
  "logline": "졸업생 대표 축사 자리를 두고, 두 친구가 리허설에서 맞붙는다.",
  "roles": [
   {
    "id": "teacher",
    "name": "담임 선생님",
    "type": "speech",
    "voice": "f_calm",
    "desc": "공정함이 생명인 담임"
   },
   {
    "id": "yuna",
    "name": "유나",
    "type": "speech",
    "voice": "f_bright",
    "desc": "또박또박 원고파"
   },
   {
    "id": "jiho",
    "name": "지호",
    "type": "speech",
    "voice": "m_young",
    "desc": "원고 없이 말하는 즉흥파"
   }
  ],
  "lines": [
   {
    "n": 1,
    "role": "teacher",
    "text": "졸업 축사 리허설입니다. 한 사람씩, 첫 문장만 해 볼게요.",
    "dir": "차분하게 안내하며",
    "tip": "안내 화법: 또렷하고 부드럽게",
    "tts": "/relay/tts/graduation_speech/1.mp3?v=e3a30bdfdd",
    "sec": 6.5
   },
   {
    "n": 2,
    "role": "yuna",
    "text": "존경하는 선생님, 그리고 사랑하는 친구 여러분.",
    "dir": "또박또박 격식 있게",
    "tip": "축사 오프닝: 호칭에 쉼 주기",
    "tts": "/relay/tts/graduation_speech/2.mp3?v=6ef5c18809",
    "sec": 4.22
   },
   {
    "n": 3,
    "role": "jiho",
    "text": "얘들아, 우리 진짜 졸업한다. 실화냐.",
    "dir": "편하게 웃으며",
    "tip": "구어체: 친근하고 자연스럽게",
    "tts": "/relay/tts/graduation_speech/3.mp3?v=e6ad8369a6",
    "sec": 4.39
   },
   {
    "n": 4,
    "role": "teacher",
    "text": "지호야, 그건 축사가 아니라 단톡방 말투잖아.",
    "dir": "웃음을 참으며",
    "tip": "지적: 부드럽게 웃으며",
    "tts": "/relay/tts/graduation_speech/4.mp3?v=a82e7600db",
    "sec": 4.75
   },
   {
    "n": 5,
    "role": "yuna",
    "text": "우리는 지난 삼 년, 같은 교실에서 같은 꿈을 꾸었습니다.",
    "dir": "감정을 담아 천천히",
    "tip": "강조: 반복 단어에 리듬 주기",
    "tts": "/relay/tts/graduation_speech/5.mp3?v=6c80b5d210",
    "sec": 4.8
   },
   {
    "n": 6,
    "role": "jiho",
    "text": "오, 유나 방금 소름 돋았어. 진짜로.",
    "dir": "진심으로 감탄하며",
    "tip": "감탄: 자연스럽게",
    "tts": "/relay/tts/graduation_speech/75e5fed14c.mp3?v=75e5fed14c",
    "sec": 4.44
   },
   {
    "n": 7,
    "role": "yuna",
    "text": "놀리지 마. 이거 밤새 쓴 거야.",
    "dir": "부끄러워 작게",
    "tip": "부끄러움: 말끝 흐리기",
    "tts": "/relay/tts/graduation_speech/160dcbf969.mp3?v=160dcbf969",
    "sec": 2.81
   },
   {
    "n": 8,
    "role": "teacher",
    "text": "자, 지호도 다음 문장 이어서 해 볼까요?",
    "dir": "기대하며",
    "tip": "안내: 부드럽게 끝 올리기",
    "tts": "/relay/tts/graduation_speech/1df590e755.mp3?v=1df590e755",
    "sec": 4.01
   },
   {
    "n": 9,
    "role": "jiho",
    "text": "근데 솔직히, 같은 꿈은 아니었지. 난 점심시간만 꿈꿨어.",
    "dir": "능청스럽게",
    "tip": "유머 화법: 쉼 뒤에 펀치라인",
    "tts": "/relay/tts/graduation_speech/6.mp3?v=ac8430f903",
    "sec": 5.88
   },
   {
    "n": 10,
    "role": "teacher",
    "text": "둘 다 좋네요. 하나는 감동, 하나는 웃음.",
    "dir": "고민하는 목소리로",
    "tip": "비교 화법: 대구 살리기",
    "tts": "/relay/tts/graduation_speech/7.mp3?v=57494ba7aa",
    "sec": 5.5
   },
   {
    "n": 11,
    "role": "yuna",
    "text": "선생님, 그럼… 둘이 같이 하면 안 될까요?",
    "dir": "용기 내서 제안하며",
    "tip": "제안: 끝을 부드럽게 올리기",
    "tts": "/relay/tts/graduation_speech/8.mp3?v=681c075518",
    "sec": 4.58
   },
   {
    "n": 12,
    "role": "jiho",
    "text": "감동 한 줄, 웃음 한 줄. 우리 릴레이로 하자.",
    "dir": "신나서",
    "tip": "제안 수락: 밝고 빠르게",
    "tts": "/relay/tts/graduation_speech/9.mp3?v=fa36c490b3",
    "sec": 3.86
   },
   {
    "n": 13,
    "role": "teacher",
    "text": "좋아요. 올해 축사는 처음으로 두 명이 합니다!",
    "dir": "기쁘게 선언하며",
    "tip": "결말: 밝은 선언",
    "tts": "/relay/tts/graduation_speech/10.mp3?v=3a417419ce",
    "sec": 5.5
   }
  ]
 }
];
