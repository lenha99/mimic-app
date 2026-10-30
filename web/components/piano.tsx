import type { Lang } from "@/lib/i18n";

/**
 * 건반 위에 내 목소리 — 음역은 칠하고, 평소 말하는 음은 점, 지금 내는 음은 파랗게.
 *
 * 훅 없는 순수 SVG 라서 화면과 공유 이미지(/api/og/voice, svgToString)가 같은 그림을 쓴다.
 * 기본은 C2~C6 네 옥타브(사람 목소리가 거의 다 들어간다). 벗어난 값이 있으면 옥타브 단위로 넓힌다.
 */
const BLACK_PCS = new Set([1, 3, 6, 8, 10]);
const W = 10;
const H = 56;
const BW = 6.4;
const BH = 34;

const VOLT = "#E8FF3A";
const VOLT_DARK = "#93A21C";
const PINK = "#FF2D78";
const CYAN = "#00E5FF";

export function keyboardSpan(values: (number | null | undefined)[]): [number, number] {
  let from = 36;
  let to = 84;
  for (const v of values) {
    if (v === null || v === undefined) continue;
    while (v < from && from > 24) from -= 12;
    while (v > to && to < 96) to += 12;
  }
  return [from, to];
}

export function Piano({
  low,
  high,
  speak,
  live,
  lang,
  labels = true,
  width,
  span,
}: {
  low?: number | null;
  high?: number | null;
  speak?: number | null;
  live?: number | null;
  lang: Lang;
  labels?: boolean;
  /** 고정 폭(px). 없으면 부모 폭을 채운다. */
  width?: number;
  /** 보여 줄 건반 범위를 직접 정한다(작은 장식용). */
  span?: [number, number];
}) {
  const [from, to] = span ?? keyboardSpan([low, high, speak, live]);
  const whites: number[] = [];
  const blacks: number[] = [];
  for (let m = from; m <= to; m += 1) (BLACK_PCS.has(m % 12) ? blacks : whites).push(m);
  const xOf = new Map<number, number>();
  whites.forEach((m, i) => xOf.set(m, i * W));
  const vbW = whites.length * W;
  const vbH = labels ? H + 14 : H;
  // 둘 다 있으면 그 사이를 칠하고, 하나만 있으면(재는 중의 기록) 그 건반만 칠한다.
  const lit = (m: number) =>
    low != null && high != null ? m >= low && m <= high : m === low || m === high;
  const liveKey = live == null ? null : Math.round(live);
  const keyCenter = (m: number) => (BLACK_PCS.has(m % 12) ? (xOf.get(m - 1) ?? 0) + W : (xOf.get(m) ?? 0) + W / 2);
  const speakKey = speak == null ? null : Math.round(speak);

  return (
    <svg
      viewBox={`0 0 ${vbW} ${vbH}`}
      width={width ?? "100%"}
      height={width ? (width * vbH) / vbW : undefined}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      {whites.map((m) => (
        <rect
          key={`w${m}`}
          x={(xOf.get(m) ?? 0) + 0.4}
          y={0}
          width={W - 0.8}
          height={H}
          rx={1.6}
          fill={m === liveKey ? CYAN : lit(m) ? VOLT : "#F5F5F7"}
        />
      ))}
      {blacks.map((m) => (
        <rect
          key={`b${m}`}
          x={(xOf.get(m - 1) ?? 0) + W - BW / 2}
          y={0}
          width={BW}
          height={BH}
          rx={1.2}
          fill={m === liveKey ? CYAN : lit(m) ? VOLT_DARK : "#0A0A0B"}
        />
      ))}
      {speakKey != null && (
        <circle
          cx={keyCenter(speakKey)}
          cy={BLACK_PCS.has(speakKey % 12) ? BH - 6 : H - 7}
          r={3.6}
          fill={PINK}
          stroke="#0A0A0B"
          strokeWidth={1}
        />
      )}
      {labels &&
        whites
          .filter((m) => m % 12 === 0 && m < to)
          .map((m) => {
            const o = Math.floor(m / 12) - 1;
            return (
              <text key={`l${m}`} x={(xOf.get(m) ?? 0) + 1} y={H + 11} fontSize={7.5} fill="#8A8A92" fontWeight={700}>
                {lang === "en" ? `C${o}` : `${o - 2}옥 도`}
              </text>
            );
          })}
    </svg>
  );
}
