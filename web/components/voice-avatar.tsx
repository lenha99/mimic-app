import type { ReactNode } from "react";
import { AVATAR_COLORS, HAIR_COLORS, type Avatar } from "@/lib/avatar";
import styles from "./voice-avatar.module.css";

/**
 * 소리 크기(level 0~1)에 맞춰 입을 벌리고 튀어 오르는 캐릭터.
 *
 * 순수 렌더다 — 소리를 어디서 읽을지는 부르는 쪽이 정한다(녹음 중엔 마이크 레벨,
 * 재생 중엔 usePlaybackLevel). 그래서 녹음 화면·결과·투표 카드·꾸미기가 같은 얼굴을 쓴다.
 *
 * 좌표계: 120×120. 머리는 (60,72) 중심, 가로 반지름 40·세로 36 — 정수리 y≈36,
 * 눈 y=64, 입 y≈81. 겹치는 순서가 곧 표현이라 레이어를 아래 순서로 쌓는다:
 *   효과(뒤) → 머리카락(뒤) → 몸 → 머리카락(앞) → 눈썹·눈·얼굴 → 입 → 안경 → 모자 → 효과(앞)
 */
const INK = "#0a0a0b";
const L = 45.5; // 왼눈 x
const R = 74.5; // 오른눈 x

export function VoiceAvatar({
  avatar,
  level = 0,
  size = 120,
  label,
}: {
  avatar: Avatar;
  level?: number;
  size?: number;
  /** 스크린리더용. 없으면 장식으로 취급한다. */
  label?: string;
}) {
  const v = Math.max(0, Math.min(1, level));
  const fill = AVATAR_COLORS[avatar.color];
  const hair = HAIR_COLORS[avatar.hairColor];
  // 크게 외칠수록 위로 튀고 세로로 늘어난다. 바닥(y=108)을 기준으로 늘려야 발이 안 뜬다.
  const lift = v * 7;
  const body = `translate(0 ${-lift}) translate(60 108) scale(${1 - v * 0.04} ${1 + v * 0.07}) translate(-60 -108)`;
  const quiet = v < 0.04;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      className={quiet ? styles.idle : undefined}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <ellipse cx="60" cy="112" rx={30 - v * 6} ry="4" fill={INK} opacity="0.35" />
      <g transform={body}>
        <FxBack kind={avatar.fx} level={v} />
        <HairBack kind={avatar.hair} color={hair} />
        <Body shape={avatar.body} fill={fill} />
        <HairFront kind={avatar.hair} color={hair} />
        <Brows eyes={avatar.eyes} />
        <Eyes kind={avatar.eyes} level={v} />
        <Face kind={avatar.face} hair={hair} />
        <Mouth level={v} eyes={avatar.eyes} />
        <Mustache on={avatar.face === "mustache"} color={hair} />
        <Glasses kind={avatar.glasses} />
        <Hat kind={avatar.hat} hair={avatar.hair} body={avatar.body} color={avatar.color} />
        <FxFront kind={avatar.fx} level={v} />
      </g>
    </svg>
  );
}

const stroke = { stroke: INK, strokeWidth: 3, strokeLinejoin: "round" as const };
const line = { stroke: INK, strokeWidth: 3.2, strokeLinecap: "round" as const, fill: "none" };

/* ── 몸 ─────────────────────────────────────────────────────────────── */

function Body({ shape, fill }: { shape: Avatar["body"]; fill: string }) {
  const head = <ellipse cx="60" cy="72" rx="40" ry="36" fill={fill} {...stroke} />;
  switch (shape) {
    case "cat":
      return (
        <>
          <path d="M26 50 L30 18 L54 38 Z" fill={fill} {...stroke} />
          <path d="M94 50 L90 18 L66 38 Z" fill={fill} {...stroke} />
          {head}
        </>
      );
    case "bear":
      return (
        <>
          <circle cx="30" cy="40" r="13" fill={fill} {...stroke} />
          <circle cx="90" cy="40" r="13" fill={fill} {...stroke} />
          <circle cx="30" cy="40" r="6" fill={INK} opacity="0.2" />
          <circle cx="90" cy="40" r="6" fill={INK} opacity="0.2" />
          {head}
        </>
      );
    case "bunny":
      return (
        <>
          <ellipse cx="44" cy="22" rx="8" ry="20" fill={fill} {...stroke} transform="rotate(-10 44 22)" />
          <ellipse cx="76" cy="22" rx="8" ry="20" fill={fill} {...stroke} transform="rotate(10 76 22)" />
          <ellipse cx="44" cy="24" rx="3.5" ry="13" fill="#ff8fb8" opacity="0.7" transform="rotate(-10 44 24)" />
          <ellipse cx="76" cy="24" rx="3.5" ry="13" fill="#ff8fb8" opacity="0.7" transform="rotate(10 76 24)" />
          {head}
        </>
      );
    case "ghost":
      return (
        <path
          d="M20 72 A40 40 0 0 1 100 72 V104 Q92 112 84 104 Q76 96 68 104 Q60 112 52 104 Q44 96 36 104 Q28 112 20 104 Z"
          fill={fill}
          {...stroke}
        />
      );
    default:
      return head;
  }
}

/* ── 머리카락 ─────────────────────────────────────────────────────────── */

function curls(points: [number, number, number][], color: string) {
  return points.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill={color} {...stroke} />);
}

function HairBack({ kind, color }: { kind: Avatar["hair"]; color: string }) {
  switch (kind) {
    case "perm":
      return (
        <>
          {curls(
            [[24, 62, 10], [25, 47, 11], [34, 35, 11], [47, 28, 11], [60, 26, 11], [73, 28, 11], [86, 35, 11], [95, 47, 11], [96, 62, 10]],
            color,
          )}
        </>
      );
    case "bun":
      return (
        <>
          <circle cx="60" cy="26" r="13" fill={color} {...stroke} />
          <path d="M52 34 q8 4 16 0" stroke={INK} strokeWidth="2" fill="none" opacity="0.4" />
        </>
      );
    case "twin":
      return (
        <>
          <circle cx="15" cy="80" r="12" fill={color} {...stroke} />
          <circle cx="105" cy="80" r="12" fill={color} {...stroke} />
          <circle cx="24" cy="72" r="4" fill="#ff5d98" stroke={INK} strokeWidth="2" />
          <circle cx="96" cy="72" r="4" fill="#ff5d98" stroke={INK} strokeWidth="2" />
        </>
      );
    default:
      return null;
  }
}

function HairFront({ kind, color }: { kind: Avatar["hair"]; color: string }) {
  switch (kind) {
    case "bangs":
      return (
        <path
          d="M22 64 Q20 34 60 34 Q100 34 98 64 Q93 50 85 52 Q79 44 71 51 Q62 42 54 51 Q46 44 38 52 Q28 49 22 64 Z"
          fill={color}
          {...stroke}
        />
      );
    case "twin":
      return (
        <path d="M23 60 Q25 35 60 35 Q95 35 97 60 Q88 45 62 47 L60 42 L56 47 Q34 46 23 60 Z" fill={color} {...stroke} />
      );
    case "spiky":
      return (
        <path
          d="M24 58 L27 30 L38 42 L43 17 L54 37 L61 12 L68 37 L78 18 L82 42 L93 30 L96 58 Q84 44 60 43 Q36 44 24 58 Z"
          fill={color}
          {...stroke}
        />
      );
    case "perm":
      return <>{curls([[44, 41, 7], [60, 38, 7.5], [76, 41, 7]], color)}</>;
    case "bun":
      return (
        <path d="M23 60 Q23 35 60 35 Q97 35 97 60 Q90 45 62 44 L60 38 L58 44 Q30 45 23 60 Z" fill={color} {...stroke} />
      );
    case "bald":
    case "white": {
      // 옆머리만 남은 아저씨 · 폭신한 백발 옆머리 할아버지. 정수리는 반짝인다.
      const fluffy = kind === "white";
      return (
        <>
          <ellipse cx="49" cy="44" rx="9" ry="4" fill="#fff" opacity="0.45" transform="rotate(-18 49 44)" />
          {fluffy ? (
            <>{curls([[21, 60, 7], [20, 72, 7], [99, 60, 7], [100, 72, 7]], color)}</>
          ) : (
            <>
              <path d="M21 72 Q17 54 30 46 Q27 60 31 72 Z" fill={color} {...stroke} />
              <path d="M99 72 Q103 54 90 46 Q93 60 89 72 Z" fill={color} {...stroke} />
              <path d="M52 38 q6 -4 13 -2 M56 40 q6 -4 12 -1" stroke={color} strokeWidth="1.6" fill="none" strokeLinecap="round" />
            </>
          )}
        </>
      );
    }
    default:
      return null;
  }
}

/* ── 눈썹 · 눈 ────────────────────────────────────────────────────────── */

function Brows({ eyes }: { eyes: Avatar["eyes"] }) {
  const b = { stroke: INK, strokeWidth: 3.6, strokeLinecap: "round" as const, fill: "none" };
  if (eyes === "angry") {
    // 미간으로 내리꽂는 눈썹 — 버럭의 전부다.
    return (
      <>
        <path d="M36 53 L52 59" {...b} />
        <path d="M84 53 L68 59" {...b} />
      </>
    );
  }
  if (eyes === "sad") {
    return (
      <>
        <path d="M37 58 L52 53" {...b} />
        <path d="M83 58 L68 53" {...b} />
      </>
    );
  }
  return null;
}

function heart(cx: number, cy: number, s: number) {
  return `M${cx} ${cy + s * 0.9} C${cx - s * 1.6} ${cy - s * 0.2} ${cx - s * 0.7} ${cy - s * 1.3} ${cx} ${cy - s * 0.4} C${cx + s * 0.7} ${cy - s * 1.3} ${cx + s * 1.6} ${cy - s * 0.2} ${cx} ${cy + s * 0.9} Z`;
}

function Eyes({ kind, level }: { kind: Avatar["eyes"]; level: number }) {
  const loud = level > 0.55;
  const dot = (x: number, r: number) => (
    <>
      <circle cx={x} cy="64" r={r} fill={INK} />
      <circle cx={x + 1.5} cy="62.4" r={r * 0.32} fill="#fff" />
    </>
  );

  // 졸린 눈은 크게 외치면 번쩍 뜬다 — 소리에 반응하는 게 제일 잘 보이는 자리다.
  if (kind === "sleepy" && !loud) {
    return (
      <>
        <path d={`M${L - 5.5} 64 h11`} {...line} />
        <path d={`M${R - 5.5} 64 h11`} {...line} />
      </>
    );
  }
  if (kind === "happy") {
    return (
      <>
        <path d={`M${L - 5.5} 66 q5.5 -8 11 0`} {...line} />
        <path d={`M${R - 5.5} 66 q5.5 -8 11 0`} {...line} />
      </>
    );
  }
  if (kind === "wink") {
    return (
      <>
        <path d={`M${L - 5.5} 65 q5.5 5 11 0`} {...line} />
        {dot(R, 4.6 * (1 + level * 0.4))}
      </>
    );
  }
  if (kind === "star") {
    const star = (cx: number) =>
      `M${cx} ${56 - level * 2} L${cx + 2.6} 61.4 L${cx + 8 + level * 2} 64 L${cx + 2.6} 66.6 L${cx} ${72 + level * 2} L${cx - 2.6} 66.6 L${cx - 8 - level * 2} 64 L${cx - 2.6} 61.4 Z`;
    return (
      <>
        <path d={star(L)} fill={INK} />
        <path d={star(R)} fill={INK} />
      </>
    );
  }
  if (kind === "heart") {
    const s = 5.5 * (1 + level * 0.35);
    return (
      <>
        <path d={heart(L, 64, s)} fill="#ff2d78" stroke={INK} strokeWidth="1.6" />
        <path d={heart(R, 64, s)} fill="#ff2d78" stroke={INK} strokeWidth="1.6" />
      </>
    );
  }
  if (kind === "sad") {
    // 물기 어린 큰 눈 — 하이라이트를 두 개 넣어 글썽이게.
    const r = 5.4;
    return (
      <>
        {[L, R].map((x) => (
          <g key={x}>
            <circle cx={x} cy="65" r={r} fill={INK} />
            <circle cx={x + 1.8} cy="63" r="1.9" fill="#fff" />
            <circle cx={x - 1.6} cy="67" r="0.9" fill="#fff" />
          </g>
        ))}
      </>
    );
  }
  if (kind === "angry") {
    return (
      <>
        {dot(L, 4 * (1 + level * 0.3))}
        {dot(R, 4 * (1 + level * 0.3))}
      </>
    );
  }
  const r = 4.6 * (1 + level * 0.4);
  return (
    <>
      {dot(L, r)}
      {dot(R, r)}
    </>
  );
}

/* ── 얼굴 디테일 ───────────────────────────────────────────────────────── */

function Cheeks({ opacity = 0.28 }: { opacity?: number }) {
  return (
    <>
      <circle cx="38" cy="79" r="5" fill="#ff2d78" opacity={opacity} />
      <circle cx="82" cy="79" r="5" fill="#ff2d78" opacity={opacity} />
    </>
  );
}

function Face({ kind, hair }: { kind: Avatar["face"]; hair: string }) {
  switch (kind) {
    case "blush":
      return <Cheeks />;
    case "freckles":
      return (
        <>
          <Cheeks opacity={0.14} />
          {[[35, 76], [39, 79], [36, 81], [85, 76], [81, 79], [84, 81]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="1.1" fill="#8a4b2a" />
          ))}
        </>
      );
    case "beard":
      // 입보다 먼저 그린다 — 수염 위로 입이 보여야 외치는 게 보인다.
      return (
        <path
          d="M25 82 Q27 112 60 115 Q93 112 95 82 Q87 97 73 95 Q60 101 47 95 Q33 97 25 82 Z"
          fill={hair}
          {...stroke}
        />
      );
    case "wrinkles": {
      const w = { stroke: INK, strokeWidth: 1.6, strokeLinecap: "round" as const, fill: "none", opacity: 0.4 };
      return (
        <>
          <Cheeks opacity={0.18} />
          <path d="M50 46 q10 -3 20 0" {...w} />
          <path d="M53 50 q7 -2 14 0" {...w} />
          <path d="M33 63 l-4 -2 M33 66 l-4 1" {...w} />
          <path d="M87 63 l4 -2 M87 66 l4 1" {...w} />
        </>
      );
    }
    case "tears":
      return (
        <>
          <path d={`M${L - 1} 71 q-4 8 0 11 q4 -3 0 -11 Z`} fill="#7fd0ff" stroke={INK} strokeWidth="1.4" />
          <path d={`M${R + 1} 71 q-4 8 0 11 q4 -3 0 -11 Z`} fill="#7fd0ff" stroke={INK} strokeWidth="1.4" />
          <path d={`M${L - 4} 70 v14 M${R + 4} 70 v14`} stroke="#7fd0ff" strokeWidth="2" opacity="0.6" />
        </>
      );
    case "bandaid":
      return (
        <>
          <Cheeks opacity={0.2} />
          <g transform="rotate(-24 84 77)">
            <rect x="75" y="73.5" width="18" height="7" rx="3.5" fill="#f6d3a6" stroke={INK} strokeWidth="1.6" />
            <rect x="81" y="73.5" width="6" height="7" fill="#e9b98a" />
          </g>
        </>
      );
    default:
      return null;
  }
}

function Mustache({ on, color }: { on: boolean; color: string }) {
  if (!on) return null;
  return (
    <path
      d="M46 79 Q52 72 60 77 Q68 72 74 79 Q68 82 60 79 Q52 82 46 79 Z"
      fill={color}
      stroke={INK}
      strokeWidth="2"
      strokeLinejoin="round"
    />
  );
}

/* ── 입 ─────────────────────────────────────────────────────────────── */

function Mouth({ level, eyes }: { level: number; eyes: Avatar["eyes"] }) {
  if (level < 0.06) {
    // 가만히 있을 때 입 모양이 표정의 절반이다.
    const d = eyes === "angry" ? "M52 84 q8 -5 16 0" : eyes === "sad" ? "M53 85 q7 -5 14 0" : "M54 81 q6 5 12 0";
    return <path d={d} stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none" />;
  }
  const rx = 5 + level * 6;
  const ry = 2 + level * 12;
  return (
    <>
      <ellipse cx="60" cy={82 + ry * 0.35} rx={rx} ry={ry} fill={INK} />
      {ry > 7 && <ellipse cx="60" cy={82 + ry * 1.05} rx={rx * 0.55} ry={ry * 0.28} fill="#ff5d98" />}
    </>
  );
}

/* ── 안경 ───────────────────────────────────────────────────────────── */

function Glasses({ kind }: { kind: Avatar["glasses"] }) {
  const frame = { stroke: INK, fill: "#fff", fillOpacity: 0.16 };
  const arms = <path d="M33 62 L21 60 M87 62 L99 60" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />;
  switch (kind) {
    case "round":
      return (
        <>
          {arms}
          <circle cx={L} cy="64" r="10" strokeWidth="2.6" {...frame} />
          <circle cx={R} cy="64" r="10" strokeWidth="2.6" {...frame} />
          <path d="M55.5 63 q4.5 -3 9 0" stroke={INK} strokeWidth="2.4" fill="none" />
        </>
      );
    case "thick":
      return (
        <>
          {arms}
          <rect x="32" y="56" width="26" height="17" rx="5" strokeWidth="4.2" {...frame} />
          <rect x="62" y="56" width="26" height="17" rx="5" strokeWidth="4.2" {...frame} />
          <path d="M58 62 h4" stroke={INK} strokeWidth="4" />
        </>
      );
    case "sun":
      return (
        <>
          {arms}
          <path d="M31 57 h28 q0 16 -14 16 q-14 0 -14 -16 Z" fill="#15151c" stroke={INK} strokeWidth="2.4" />
          <path d="M61 57 h28 q0 16 -14 16 q-14 0 -14 -16 Z" fill="#15151c" stroke={INK} strokeWidth="2.4" />
          <path d="M59 59 h2" stroke={INK} strokeWidth="3" />
          <path d="M36 61 l6 -2 M66 61 l6 -2" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
        </>
      );
    case "reading":
      // 콧등에 걸친 반달 돋보기 — 눈은 테 위로 넘겨다본다.
      return (
        <>
          <path d="M35 69 h20 q0 9 -10 9 q-10 0 -10 -9 Z" fill="#fff" fillOpacity="0.2" stroke="#b8901c" strokeWidth="2.4" />
          <path d="M65 69 h20 q0 9 -10 9 q-10 0 -10 -9 Z" fill="#fff" fillOpacity="0.2" stroke="#b8901c" strokeWidth="2.4" />
          <path d="M55 70 q5 -3 10 0" stroke="#b8901c" strokeWidth="2" fill="none" />
          <path d="M35 69 L22 64 M85 69 L98 64" stroke="#b8901c" strokeWidth="1.8" />
        </>
      );
    default:
      return null;
  }
}

/* ── 모자 ───────────────────────────────────────────────────────────── */

function Hat({
  kind,
  hair,
  body,
  color,
}: {
  kind: Avatar["hat"];
  hair: Avatar["hair"];
  body: Avatar["body"];
  color: Avatar["color"];
}) {
  // 몸과 같은 계열이면 모자가 안 보인다.
  const accent = color === "pink" || color === "red" ? "#3cebff" : "#ff2d78";
  // 머리숱이 많으면 모자가 그만큼 위에 얹힌다.
  const top = hair === "perm" ? 28 : hair === "spiky" ? 24 : body === "ghost" ? 34 : 38;

  switch (kind) {
    case "cap":
      return (
        <>
          <path d={`M32 ${top + 10} Q60 ${top - 22} 88 ${top + 10} Z`} fill={accent} {...stroke} />
          <path d={`M80 ${top + 8} h24 q-1 6 -10 6 h-16 Z`} fill={accent} {...stroke} />
        </>
      );
    case "beanie":
      return (
        <>
          <path d={`M27 ${top + 10} Q27 ${top - 20} 60 ${top - 20} Q93 ${top - 20} 93 ${top + 10} Z`} fill="#8b7cff" {...stroke} />
          <rect x="24" y={top + 4} width="72" height="11" rx="5.5" fill="#6d5ce6" {...stroke} />
          <circle cx="60" cy={top - 22} r="6.5" fill="#fff" {...stroke} />
        </>
      );
    case "bucket":
      return (
        <>
          <path d={`M33 ${top + 6} Q35 ${top - 17} 60 ${top - 17} Q85 ${top - 17} 87 ${top + 6} Z`} fill="#f3e3b3" {...stroke} />
          <path d={`M16 ${top + 11} Q60 ${top - 3} 104 ${top + 11} Q60 ${top + 20} 16 ${top + 11} Z`} fill="#f3e3b3" {...stroke} />
          <path d={`M36 ${top + 1} Q60 ${top - 5} 84 ${top + 1}`} stroke={INK} strokeWidth="2" fill="none" opacity="0.35" />
        </>
      );
    case "visor":
      // 아줌마 선캡 — 이마를 덮는 반투명 챙.
      return (
        <>
          <path d={`M26 ${top + 12} Q60 ${top - 2} 94 ${top + 12}`} stroke="#ff6fa8" strokeWidth="6" fill="none" strokeLinecap="round" />
          <path
            d={`M28 ${top + 14} Q60 ${top + 4} 100 ${top + 16} Q74 ${top + 30} 30 ${top + 20} Z`}
            fill="#5fe0b0"
            fillOpacity="0.72"
            stroke={INK}
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
        </>
      );
    case "crown":
      return (
        <path
          d={`M40 ${top + 4} L43 ${top - 16} L52 ${top - 5} L60 ${top - 20} L68 ${top - 5} L77 ${top - 16} L80 ${top + 4} Z`}
          fill="#ffd23a"
          {...stroke}
        />
      );
    case "bow":
      return (
        <>
          <path d={`M82 ${top} L68 ${top - 9} L68 ${top + 9} Z`} fill={accent} {...stroke} />
          <path d={`M82 ${top} L96 ${top - 9} L96 ${top + 9} Z`} fill={accent} {...stroke} />
          <circle cx="82" cy={top} r="4.5" fill={accent} {...stroke} />
        </>
      );
    case "flower": {
      const cx = 84;
      const cy = top + 2;
      return (
        <>
          {[0, 72, 144, 216, 288].map((a) => (
            <circle
              key={a}
              cx={cx + Math.cos((a * Math.PI) / 180) * 5.5}
              cy={cy + Math.sin((a * Math.PI) / 180) * 5.5}
              r="4.6"
              fill="#ff8fb8"
              stroke={INK}
              strokeWidth="1.6"
            />
          ))}
          <circle cx={cx} cy={cy} r="3.4" fill="#ffd23a" stroke={INK} strokeWidth="1.6" />
        </>
      );
    }
    case "headset":
      // 머리 위 밴드는 배경(어두운 무대) 위에 걸리므로 밝은 색이어야 보인다.
      return (
        <>
          <path d="M22 70 A38 38 0 0 1 98 70" stroke="#e4e4ea" strokeWidth="5" fill="none" />
          <rect x="14" y="60" width="12" height="22" rx="5" fill={INK} stroke="#e4e4ea" strokeWidth="2" />
          <rect x="94" y="60" width="12" height="22" rx="5" fill={INK} stroke="#e4e4ea" strokeWidth="2" />
          <path d="M20 80 Q24 96 42 94" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />
          <circle cx="44" cy="94" r="4" fill={INK} />
        </>
      );
    default:
      return null;
  }
}

/* ── 효과 ───────────────────────────────────────────────────────────── */

function FxBack({ kind, level }: { kind: Avatar["fx"]; level: number }) {
  if (kind !== "fire") return null;
  // 외칠수록 불길이 치솟는다 — 버럭이의 핵심.
  // 위로만 자라면 화면 밖으로 잘린다. 기준점을 불길 아래(y=56)에 두고 조금만 키운다.
  const grow = `translate(60 56) scale(${1 + level * 0.08} ${1 + level * 0.22}) translate(-60 -56)`;
  return (
    <g transform={grow}>
      <path
        d="M28 56 Q19 38 31 22 Q33 36 43 36 Q39 22 51 10 Q56 28 62 29 Q64 16 77 12 Q72 29 83 31 Q91 22 93 16 Q101 36 92 56 Z"
        fill="#ff7a1a"
        stroke={INK}
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path d="M40 52 Q35 41 42 32 Q44 41 52 41 Q50 30 60 22 Q64 35 70 36 Q72 28 80 26 Q84 41 78 52 Z" fill="#ffd23a" />
    </g>
  );
}

function sparkle(cx: number, cy: number, s: number, fill: string, key: number): ReactNode {
  return (
    <path
      key={key}
      d={`M${cx} ${cy - s} Q${cx + s * 0.25} ${cy - s * 0.25} ${cx + s} ${cy} Q${cx + s * 0.25} ${cy + s * 0.25} ${cx} ${cy + s} Q${cx - s * 0.25} ${cy + s * 0.25} ${cx - s} ${cy} Q${cx - s * 0.25} ${cy - s * 0.25} ${cx} ${cy - s} Z`}
      fill={fill}
    />
  );
}

function FxFront({ kind, level }: { kind: Avatar["fx"]; level: number }) {
  const float = -level * 5;
  switch (kind) {
    case "rain":
      return (
        <g transform={`translate(0 ${-level * 3})`}>
          <path
            d="M78 22 Q76 12 86 12 Q88 4 98 6 Q106 4 108 12 Q116 14 112 22 Z"
            fill="#9aa7bd"
            stroke={INK}
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <path d="M86 27 l-2 6 M96 28 l-2 6 M106 27 l-2 6" stroke="#6fb6ff" strokeWidth="2.4" strokeLinecap="round" />
        </g>
      );
    case "sparkle":
      return (
        <g transform={`translate(0 ${float})`}>
          {sparkle(13, 44, 6, "#fff", 1)}
          {sparkle(106, 54, 5, "#e8ff3a", 2)}
          {sparkle(101, 20, 4, "#fff", 3)}
          {sparkle(20, 22, 3.5, "#e8ff3a", 4)}
        </g>
      );
    case "hearts":
      return (
        <g transform={`translate(0 ${float})`}>
          <path d={heart(104, 40, 5)} fill="#ff5d98" stroke={INK} strokeWidth="1.4" />
          <path d={heart(15, 52, 4)} fill="#ff8fb8" stroke={INK} strokeWidth="1.4" />
          <path d={heart(97, 17, 3.5)} fill="#ff8fb8" stroke={INK} strokeWidth="1.4" />
        </g>
      );
    case "sweat":
      return (
        <g transform={`translate(0 ${level * 3})`}>
          <path d="M92 42 q-6 9 0 12 q6 -3 0 -12 Z" fill="#8fd6ff" stroke={INK} strokeWidth="1.6" />
          <path d="M90.5 49 q0 2 1.5 3" stroke="#fff" strokeWidth="1.2" fill="none" />
        </g>
      );
    default:
      return null;
  }
}
