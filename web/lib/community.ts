/**
 * 카카오톡 오픈채팅방 = "MIMIC 라운지" (11/27) — components/lounge.tsx 가 쓴다.
 *
 * 앱엔 다시 부르는 장치가 거의 없다(웹 푸시 구독 2건, 11/10). 밖으로 빠져도 괜찮다 —
 * 단톡방에서 서로 "올렸다" "들어 봐" 하면서 앱으로 다시 들어오게 하는 게 목적이다.
 *
 * 비우면 라운지 입구가 다 숨는다. 링크를 바꿀 땐 이 줄만 고치면 된다.
 */
export const KAKAO_OPENCHAT_URL = process.env.NEXT_PUBLIC_KAKAO_OPENCHAT_URL ?? "https://open.kakao.com/o/glWKXWYi";
