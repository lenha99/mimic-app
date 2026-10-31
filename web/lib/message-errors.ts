/** 메시지 보내기 실패 코드 → 화면 문구. */
export function messageError(code: string, t: (ko: string, en: string) => string): string {
  switch (code) {
    case "follow-first":
      return t("먼저 구독해야 메시지를 보낼 수 있어요.", "Subscribe first to send a message.");
    case "off":
      return t("이 분은 메시지를 받지 않아요.", "This person isn't taking messages.");
    case "wait-accept":
      return t("상대가 받아주면 더 보낼 수 있어요.", "You can send more once they accept.");
    case "blocked":
    case "declined":
      return t("메시지를 보낼 수 없어요.", "You can't message this person.");
    case "empty":
      return t("내용을 써 주세요.", "Write something first.");
    case "self":
      return t("나에게는 보낼 수 없어요.", "You can't message yourself.");
    default:
      return t("보내지 못했어요. 다시 해주세요.", "Couldn't send. Try again.");
  }
}
