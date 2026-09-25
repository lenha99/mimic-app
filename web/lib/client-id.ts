/**
 * 익명 기기 식별자.
 *
 * 랭킹에서 "같은 사람이 30번 시도한 것"과 "서른 명이 한 번씩 한 것"을 구분하려면
 * 뭔가는 있어야 한다. 계정을 만들게 하면 그 자리에서 대부분 나가므로, 브라우저에
 * 난수 하나를 두고 그걸 보낸다. 사람에 대한 정보는 들어 있지 않고, 브라우저
 * 데이터를 지우면 사라진다. 저장이 막힌 환경(사생활 보호 창 등)에서는 조용히
 * 빈 값이 되고 서버는 그냥 기록하지 않는다.
 */
export function clientId(): string {
  try {
    const k = "mimic.cid";
    let v = localStorage.getItem(k);
    if (!v) {
      v = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(k, v);
    }
    return v;
  } catch {
    return "";
  }
}
