/**
 * 입 모양을 사람처럼 움직이게 하는 필터.
 *
 * 소리 크기를 그대로 입에 꽂으면 프레임마다 확확 튄다 — 마이크 RMS 는 잡음처럼
 * 흔들리고, 녹음 파일의 포락선은 1/30초 계단이다. 사람 입은 그렇게 안 움직인다:
 * 벌릴 땐 빠르고(말이 터지는 순간), 다물 땐 천천히 닫힌다.
 *
 * 그래서 올라갈 때와 내려갈 때 시간 상수를 따로 둔 지수 추종을 쓴다.
 * dt 기반이라 프레임이 들쭉날쭉해도(탭 전환, 느린 폰) 같은 속도로 움직인다.
 */
const ATTACK_MS = 55;
const RELEASE_MS = 150;

export function followMouth(prev: number, target: number, dtMs: number): number {
  const tau = target > prev ? ATTACK_MS : RELEASE_MS;
  const k = 1 - Math.exp(-Math.max(0, dtMs) / tau);
  return prev + (target - prev) * k;
}
