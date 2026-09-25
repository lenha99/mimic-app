import { AVATAR_COLORS, type Avatar } from "@/lib/avatar";
import styles from "./voice-avatar.module.css";

/**
 * 소리 크기(level 0~1)에 맞춰 입을 벌리고 튀어 오르는 캐릭터.
 *
 * 순수 렌더다 — 소리를 어디서 읽을지는 부르는 쪽이 정한다(녹음 중엔 마이크 레벨,
 * 재생 중엔 usePlaybackLevel). 그래서 녹음 화면·결과·투표 카드가 같은 얼굴을 쓴다.
 */
const INK = "#0a0a0b";

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
  // 크게 외칠수록 위로 튀고 세로로 늘어난다. 바닥(y=108)을 기준으로 늘려야 발이 안 뜬다.
  const lift = v * 7;
  const sx = 1 - v * 0.04;
  const sy = 1 + v * 0.07;
  const body = `translate(0 ${-lift}) translate(60 108) scale(${sx} ${sy}) translate(-60 -108)`;
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
        <Body shape={avatar.body} fill={fill} />
        <Eyes kind={avatar.eyes} level={v} />
        <circle cx="38" cy="80" r="5" fill="#ff2d78" opacity="0.28" />
        <circle cx="82" cy="80" r="5" fill="#ff2d78" opacity="0.28" />
        <Mouth level={v} />
        <Hat kind={avatar.hat} body={avatar.body} color={avatar.color} />
      </g>
    </svg>
  );
}

function Body({ shape, fill }: { shape: Avatar["body"]; fill: string }) {
  const stroke = { stroke: INK, strokeWidth: 3, strokeLinejoin: "round" as const };
  switch (shape) {
    case "cat":
      return (
        <>
          <path d="M26 50 L30 18 L54 38 Z" fill={fill} {...stroke} />
          <path d="M94 50 L90 18 L66 38 Z" fill={fill} {...stroke} />
          <ellipse cx="60" cy="72" rx="40" ry="36" fill={fill} {...stroke} />
        </>
      );
    case "bear":
      return (
        <>
          <circle cx="30" cy="40" r="13" fill={fill} {...stroke} />
          <circle cx="90" cy="40" r="13" fill={fill} {...stroke} />
          <circle cx="30" cy="40" r="6" fill={INK} opacity="0.25" />
          <circle cx="90" cy="40" r="6" fill={INK} opacity="0.25" />
          <ellipse cx="60" cy="72" rx="40" ry="36" fill={fill} {...stroke} />
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
      return <ellipse cx="60" cy="72" rx="40" ry="36" fill={fill} {...stroke} />;
  }
}

function Eyes({ kind, level }: { kind: Avatar["eyes"]; level: number }) {
  const loud = level > 0.55;
  const line = { stroke: INK, strokeWidth: 3.2, strokeLinecap: "round" as const, fill: "none" };

  // 졸린 눈은 크게 외치면 번쩍 뜬다 — 소리에 반응하는 게 제일 잘 보이는 자리다.
  if (kind === "sleepy" && !loud) {
    return (
      <>
        <path d="M40 64 h11" {...line} />
        <path d="M69 64 h11" {...line} />
      </>
    );
  }
  if (kind === "happy") {
    return (
      <>
        <path d="M40 66 q5.5 -8 11 0" {...line} />
        <path d="M69 66 q5.5 -8 11 0" {...line} />
      </>
    );
  }
  if (kind === "star") {
    const star = (cx: number) =>
      `M${cx} ${56 - level * 2} L${cx + 2.6} ${61.4} L${cx + 8 + level * 2} 64 L${cx + 2.6} 66.6 L${cx} ${72 + level * 2} L${cx - 2.6} 66.6 L${cx - 8 - level * 2} 64 L${cx - 2.6} 61.4 Z`;
    return (
      <>
        <path d={star(45.5)} fill={INK} />
        <path d={star(74.5)} fill={INK} />
      </>
    );
  }
  const r = 4.6 * (1 + level * 0.4);
  return (
    <>
      <circle cx="45.5" cy="64" r={r} fill={INK} />
      <circle cx="74.5" cy="64" r={r} fill={INK} />
      <circle cx="47" cy="62.4" r={r * 0.32} fill="#fff" />
      <circle cx="76" cy="62.4" r={r * 0.32} fill="#fff" />
    </>
  );
}

function Mouth({ level }: { level: number }) {
  if (level < 0.06) {
    return (
      <path
        d="M54 81 q6 5 12 0"
        stroke={INK}
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
    );
  }
  const rx = 5 + level * 6;
  const ry = 2 + level * 12;
  return (
    <>
      <ellipse cx="60" cy={82 + ry * 0.35} rx={rx} ry={ry} fill={INK} />
      {ry > 7 && (
        <ellipse cx="60" cy={82 + ry * 1.05} rx={rx * 0.55} ry={ry * 0.28} fill="#ff5d98" />
      )}
    </>
  );
}

function Hat({
  kind,
  body,
  color,
}: {
  kind: Avatar["hat"];
  body: Avatar["body"];
  color: Avatar["color"];
}) {
  const stroke = { stroke: INK, strokeWidth: 3, strokeLinejoin: "round" as const };
  // 몸과 같은 색이면 모자가 안 보인다.
  const accent = color === "pink" ? "#3cebff" : "#ff2d78";
  const top = body === "ghost" ? 34 : 38;

  switch (kind) {
    case "cap":
      return (
        <>
          <path d={`M32 ${top + 10} Q60 ${top - 22} 88 ${top + 10} Z`} fill={accent} {...stroke} />
          <path d={`M80 ${top + 8} h24 q-1 6 -10 6 h-16 Z`} fill={accent} {...stroke} />
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
