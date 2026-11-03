import { Fragment, createElement, isValidElement, type ReactNode } from "react";
import { AVATAR_COLORS, HAIR_COLORS, type Avatar } from "@/lib/avatar";
import styles from "./voice-avatar.module.css";

/**
 * 소리 크기(level 0~1)에 맞춰 입을 벌리고 튀어 오르는 캐릭터.
 *
 * 순수 렌더다 — 소리를 어디서 읽을지는 부르는 쪽이 정한다(녹음 중엔 마이크 레벨,
 * 재생 중엔 usePlaybackLevel). 그래서 녹음 화면·결과·투표 카드·꾸미기·공유 카드(svgToString)가
 * 같은 얼굴을 쓴다. 훅을 쓰면 공유 카드가 깨지니 넣지 않는다.
 *
 * 그림 규칙 — 40px 목록 썸네일에서도 "귀엽다"가 읽혀야 한다:
 *   · 큰 머리 · 작은 몸 (머리 폭 76 / 120). 얼굴 파츠는 머리 가운데 아래쪽에 모은다.
 *   · 스티커 테두리: 캐릭터 전체를 한 번 더 그려 크림색 굵은 선으로 깐다(rimify). 어두운
 *     부스 배경에서 검은 외곽선이 묻히지 않고, 모자·효과까지 한 장의 스티커로 읽힌다.
 *   · 그라디언트·필터 대신 겹친 면으로 입체감(아래 그늘 + 위 하이라이트). <defs> id 는
 *     한 화면에 같은 캐릭터가 여럿이면 서로 엉키고, 숨겨진 SVG 의 id 는 크롬에서 안 그려진다.
 *
 * 좌표계: 120×120. 머리는 (60,57) 중심, 가로 반지름 38·세로 33 — 정수리 y=24,
 * 눈 y=58, 입 y≈70, 몸통 y 86~112, 바닥 y=113. 겹치는 순서가 곧 표현이다:
 *   효과(뒤) → 머리카락(뒤) → 귀·몸통 → 머리 → 머리카락(앞) → 눈·볼 → 입 → 안경 → 모자 → 효과(앞)
 */
const INK = "#2b2433";
const EYE = "#2a1f2e";
const RIM = "#fff7ea";
const OW = 3.2; // 외곽선 굵기
const RIMW = 7; // 스티커 테두리(양쪽 합)
const L = 46; // 왼눈 x
const R = 74; // 오른눈 x
const EY = 58; // 눈 y
const MY = 70; // 입 윗선 y
const MIRROR = "matrix(-1 0 0 1 120 0)";

const ol = { stroke: INK, strokeWidth: OW, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
const line = (w = 3.2) => ({ stroke: INK, strokeWidth: w, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" });

/* ── 색 ─────────────────────────────────────────────────────────────── */

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a: string, b: string, t: number): string {
  const x = rgb(a);
  const y = rgb(b);
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
}

type Paint = { base: string; shade: string; light: string; deep: string };

function paint(base: string): Paint {
  return {
    base,
    shade: mix(base, "#7a4a6a", 0.2),
    deep: mix(base, "#5a3050", 0.38),
    light: mix(base, "#ffffff", 0.6),
  };
}

/* ── 뼈대 ────────────────────────────────────────────────────────────── */

type Rig = { top: number; dy: number; torso: boolean; float: boolean };

function rigOf(a: Avatar): Rig {
  const body = a.body;
  const dy = body === "blob" ? 7 : body === "ghost" ? 2 : 0;
  const lift = a.hair === "spiky" ? 8 : a.hair === "perm" ? 6 : a.hair === "bun" ? 2 : 0;
  return {
    top: 24 - lift,
    dy,
    torso: body !== "blob" && body !== "ghost",
    float: body === "ghost",
  };
}

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
  const quiet = v < 0.04;
  // 크게 외칠수록 위로 튀고 세로로 늘어난다. 바닥(y=112)을 기준으로 늘려야 발이 안 뜬다.
  const lift = v * 4; // 더 뛰면 귀·볏이 위로 잘린다
  const body = `translate(0 ${-lift}) translate(60 112) scale(${1 - v * 0.03} ${1 + v * 0.05}) translate(-60 -112)`;
  const rig = rigOf(avatar);
  const char = <Character a={avatar} v={v} rig={rig} />;
  const idle = quiet ? (rig.float ? styles.float : styles.idle) : undefined;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <ellipse
        cx="60"
        cy="114"
        rx={(rig.float ? 19 : 27) - v * 6}
        ry="3.6"
        fill="#000"
        opacity={rig.float ? 0.2 : 0.3}
      />
      <g className={idle}>
        {/* 볏·토끼 귀·고깔·불꽃이 위로 잘리지 않게 전체를 바닥 기준으로 살짝 줄인다 */}
        <g transform={`${body} translate(60 116) scale(0.93) translate(-60 -116)`}>
          {createElement("g", null, ...rimify(char, { sw: 0 }))}
          {char}
        </g>
      </g>
    </svg>
  );
}

/**
 * 스티커 테두리 — 캐릭터 트리를 펼쳐 모든 면·선을 크림색 굵은 선으로 바꾼 사본.
 * 원본 아래 깔리면 바깥쪽으로만 테두리가 삐져나온다(안쪽은 원본이 덮는다).
 */
const SHAPES = new Set(["path", "circle", "ellipse", "rect", "polygon", "line"]);
type Inherit = { fill?: string; stroke?: string; sw: number };

function rimify(node: ReactNode, inh: Inherit): ReactNode[] {
  if (node === null || node === undefined || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap((n) => rimify(n as ReactNode, inh));
  if (!isValidElement(node)) return [];
  const props = (node.props ?? {}) as Record<string, unknown>;
  const { type } = node;
  if (type === Fragment) return rimify(props.children as ReactNode, inh);
  if (typeof type === "function") return rimify((type as (p: Record<string, unknown>) => ReactNode)(props), inh);
  if (typeof type !== "string" || props["data-norim"]) return [];
  const fill = props.fill !== undefined ? String(props.fill) : inh.fill;
  const stroke = props.stroke !== undefined ? String(props.stroke) : inh.stroke;
  const sw = props.strokeWidth !== undefined ? Number(props.strokeWidth) : inh.sw;
  if (type === "g") {
    return [createElement("g", { transform: props.transform }, ...rimify(props.children as ReactNode, { fill, stroke, sw }))];
  }
  if (!SHAPES.has(type)) return [];
  const hasFill = fill !== "none";
  const hasStroke = stroke !== undefined && stroke !== "none";
  if (!hasFill && !hasStroke) return [];
  const rest: Record<string, unknown> = { ...props };
  for (const k of ["children", "fill", "stroke", "strokeWidth", "opacity", "fillOpacity", "strokeOpacity", "className"]) delete rest[k];
  return [
    createElement(type, {
      ...rest,
      fill: hasFill ? RIM : "none",
      stroke: RIM,
      strokeWidth: (hasStroke ? sw : 0) + RIMW,
      strokeLinejoin: "round",
      strokeLinecap: "round",
    }),
  ];
}

function Character({ a, v, rig }: { a: Avatar; v: number; rig: Rig }) {
  const p = paint(AVATAR_COLORS[a.color]);
  const hair = HAIR_COLORS[a.hairColor];
  const blink = [styles.blinkA, styles.blinkB, styles.blinkC][(a.color.length + a.eyes.length + a.hat.length) % 3];
  return (
    <g>
      <FxBack kind={a.fx} level={v} top={rig.top} />
      <HairBack kind={a.hair} color={hair} />
      <Body a={a} p={p} rig={rig} />
      <HairFront kind={a.hair} color={hair} />
      <g transform={rig.dy ? `translate(0 ${rig.dy})` : undefined}>
        <Cheeks a={a} />
        <Brows eyes={a.eyes} />
        <g className={blinkable(a.eyes, v) ? blink : undefined}>
          <Eyes kind={a.eyes} level={v} />
        </g>
        <Face kind={a.face} hair={hair} />
        {a.body === "parrot" ? <Beak level={v} /> : <Mouth level={v} a={a} />}
        <Mustache on={a.face === "mustache"} color={hair} />
        <Glasses kind={a.glasses} />
      </g>
      <Hat kind={a.hat} top={rig.top} color={a.color} body={a.body} />
      <FxFront kind={a.fx} level={v} />
    </g>
  );
}

function blinkable(eyes: Avatar["eyes"], v: number): boolean {
  return v < 0.04 && (eyes === "dot" || eyes === "shiny" || eyes === "star" || eyes === "angry" || eyes === "sad");
}

/* ── 몸 ─────────────────────────────────────────────────────────────── */

/**
 * 입체 면: 그늘색으로 한 번, 위쪽으로 살짝 줄인 바탕색으로 한 번, 외곽선 한 번.
 * 아래쪽에 초승달 그늘이 남아 그라디언트 없이도 말랑해 보인다.
 */
function Vol({
  d,
  e,
  p,
  ox = 60,
  oy,
  k = 0.92,
  w = OW,
}: {
  d?: string;
  e?: [number, number, number, number];
  p: { base: string; shade: string };
  ox?: number;
  oy: number;
  k?: number;
  w?: number;
}) {
  const shape = (extra: Record<string, unknown>) =>
    d ? <path d={d} {...extra} /> : <ellipse cx={e![0]} cy={e![1]} rx={e![2]} ry={e![3]} {...extra} />;
  return (
    <>
      {shape({ fill: p.shade })}
      {shape({ fill: p.base, transform: `translate(${ox} ${oy}) scale(${k}) translate(${-ox} ${-oy})` })}
      {shape({ fill: "none", ...ol, strokeWidth: w })}
    </>
  );
}

const HEAD: [number, number, number, number] = [60, 57, 38, 33];

function Shine({ x = 47, y = 35, s = 1 }: { x?: number; y?: number; s?: number }) {
  return (
    <>
      <ellipse cx={x} cy={y} rx={12 * s} ry={5 * s} fill="#fff" opacity="0.5" transform={`rotate(-18 ${x} ${y})`} />
      <circle cx={x + 17 * s} cy={y - 4 * s} r={2.2 * s} fill="#fff" opacity="0.55" />
    </>
  );
}

function Torso({ p, belly, arm, feet }: { p: Paint; belly: string; arm: string; feet: string }) {
  return (
    <>
      <ellipse cx="49" cy="110.5" rx="7.5" ry="4.5" fill={feet} {...ol} strokeWidth={2.6} />
      <ellipse cx="71" cy="110.5" rx="7.5" ry="4.5" fill={feet} {...ol} strokeWidth={2.6} />
      <Vol e={[60, 98, 22, 14]} p={p} oy={86} k={0.9} />
      <ellipse cx="60" cy="101" rx="12.5" ry="8.5" fill={belly} />
      <ellipse cx="39.5" cy="97" rx="6" ry="9" fill={arm} {...ol} strokeWidth={2.6} transform="rotate(28 39.5 97)" />
      <ellipse cx="80.5" cy="97" rx="6" ry="9" fill={arm} {...ol} strokeWidth={2.6} transform="rotate(-28 80.5 97)" />
    </>
  );
}

function Body({ a, p, rig }: { a: Avatar; p: Paint; rig: Rig }) {
  const head = (
    <>
      <Vol e={HEAD} p={p} oy={26} />
      <Shine />
    </>
  );
  const torso = rig.torso ? <Torso p={p} belly={p.light} arm={p.base} feet={p.shade} /> : null;

  switch (a.body) {
    case "cat": {
      const ear = (
        <>
          <Vol d="M24 50 Q20 22 28 13 Q36 12 54 30 Z" p={p} ox={30} oy={16} k={0.86} />
          <path d="M29 40 Q27 26 31 21 Q36 22 45 31 Z" fill="#ffb3c8" />
        </>
      );
      return (
        <>
          {torso}
          {ear}
          <g transform={MIRROR}>{ear}</g>
          {head}
          {/* 이마 줄무늬 — 고양이라는 게 썸네일에서도 읽힌다 */}
          <path d="M60 26 v7 M52 27 l1.5 5 M68 27 l-1.5 5" stroke={p.deep} strokeWidth="2.6" strokeLinecap="round" opacity="0.55" />
        </>
      );
    }
    case "bear": {
      const ear = (
        <>
          <Vol e={[29, 32, 12, 12]} p={p} ox={29} oy={21} k={0.86} />
          <circle cx="29.5" cy="33" r="6" fill={p.light} />
        </>
      );
      return (
        <>
          {torso}
          {ear}
          <g transform={MIRROR}>{ear}</g>
          {head}
        </>
      );
    }
    case "bunny": {
      const ear = (
        <g transform="rotate(-9 45 30)">
          <Vol e={[45, 19, 8.5, 14.5]} p={p} ox={45} oy={6} k={0.86} />
          <ellipse cx="45" cy="21" rx="3.8" ry="9.5" fill="#ffb3c8" />
        </g>
      );
      return (
        <>
          {torso}
          {ear}
          <g transform={MIRROR}>{ear}</g>
          {head}
        </>
      );
    }
    case "parrot": {
      // 코코네 식구(왕관앵무) — 볏·주황 볼·연보라 날개·크림 배. 얼굴 색만 바뀐다.
      const crest = mix(p.base, "#ffb01e", 0.3);
      const cream = mix(p.base, "#fffaf0", 0.72);
      const wing = "#d9d2e9";
      return (
        <>
          <g fill={crest} {...ol} strokeWidth={2.6}>
            <path d="M50 33 C41 25 40 15 45 9 C47 19 51 25 57 30 Z" />
            <path d="M64 31 C67 22 73 15 81 13 C76 20 72 26 70 33 Z" />
            <path d="M55 31 C49 19 51 8 60 2 C58 12 60 20 65 29 Z" />
          </g>
          {rig.torso && (
            <>
              <ellipse cx="50" cy="110.5" rx="6.5" ry="4" fill="#f0b4a4" {...ol} strokeWidth={2.6} />
              <ellipse cx="70" cy="110.5" rx="6.5" ry="4" fill="#f0b4a4" {...ol} strokeWidth={2.6} />
              <Vol e={[60, 98, 22, 14]} p={{ base: cream, shade: mix(cream, "#7a4a6a", 0.14) }} oy={86} k={0.9} />
              <ellipse cx="60" cy="101" rx="12" ry="8" fill="#fffdf6" />
              <ellipse cx="38.5" cy="98" rx="6.5" ry="11" fill={wing} {...ol} strokeWidth={2.6} transform="rotate(22 38.5 98)" />
              <ellipse cx="81.5" cy="98" rx="6.5" ry="11" fill={wing} {...ol} strokeWidth={2.6} transform="rotate(-22 81.5 98)" />
              <path d="M36 104 q2 3 5 3 M84 104 q-2 3 -5 3" stroke="#bfb6d6" strokeWidth="2" strokeLinecap="round" fill="none" />
            </>
          )}
          {head}
        </>
      );
    }
    case "ghost": {
      const d =
        "M22 60 C22 37 39 23 60 23 C81 23 98 37 98 60 V97 Q98 108 89 104 Q82 100 76 106 Q68 112 60 105 Q52 112 44 106 Q38 100 31 104 Q22 108 22 97 Z";
      return (
        <>
          <ellipse cx="20" cy="80" rx="5.5" ry="8" fill={p.base} {...ol} strokeWidth={2.6} transform="rotate(40 20 80)" />
          <ellipse cx="100" cy="80" rx="5.5" ry="8" fill={p.base} {...ol} strokeWidth={2.6} transform="rotate(-40 100 80)" />
          <Vol d={d} p={p} oy={26} k={0.93} />
          <Shine />
        </>
      );
    }
    default: {
      // 말랑이(찹쌀떡) — 머리와 몸이 한 덩어리. 아래가 살짝 퍼져 앉아 있는 느낌.
      const d = "M60 24 C87 24 101 47 102 74 C103 98 87 111 60 111 C33 111 17 98 18 74 C19 47 33 24 60 24 Z";
      return (
        <>
          <Vol d={d} p={p} oy={26} k={0.93} />
          <Shine y={37} />
          <ellipse cx="25" cy="95" rx="6" ry="4.6" fill={p.base} {...ol} strokeWidth={2.6} transform="rotate(-20 25 95)" />
          <ellipse cx="95" cy="95" rx="6" ry="4.6" fill={p.base} {...ol} strokeWidth={2.6} transform="rotate(20 95 95)" />
        </>
      );
    }
  }
}

/* ── 머리카락 ─────────────────────────────────────────────────────────── */

function curls(points: [number, number, number][], color: string) {
  return points.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill={color} {...ol} />);
}

function HairShine({ d = "M35 34 Q43 26 53 24" }: { d?: string }) {
  return <path d={d} stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.45" />;
}

function HairBack({ kind, color }: { kind: Avatar["hair"]; color: string }) {
  switch (kind) {
    case "perm":
      return (
        <>
          {curls(
            [[22, 60, 10], [22, 45, 11], [30, 32, 11], [43, 23, 11], [60, 19, 11.5], [77, 23, 11], [90, 32, 11], [98, 45, 11], [98, 60, 10]],
            color,
          )}
        </>
      );
    case "bun":
      return (
        <>
          <path d="M70 10 L82 2" stroke="#c98a4a" strokeWidth="3" strokeLinecap="round" />
          <circle cx="60" cy="17" r="11" fill={color} {...ol} />
          <path d="M53 14 q6 -5 12 -1" stroke="#fff" strokeWidth="2.4" fill="none" opacity="0.45" strokeLinecap="round" />
        </>
      );
    case "twin":
      return (
        <>
          <circle cx="14" cy="66" r="11" fill={color} {...ol} />
          <circle cx="106" cy="66" r="11" fill={color} {...ol} />
          <circle cx="23" cy="58" r="4" fill="#ff7aa8" stroke={INK} strokeWidth="2.2" />
          <circle cx="97" cy="58" r="4" fill="#ff7aa8" stroke={INK} strokeWidth="2.2" />
        </>
      );
    case "bob":
      return (
        <path
          d="M17 62 C14 30 36 17 60 17 C84 17 106 30 103 62 L104 82 C104 89 96 90 93 84 L90 70 L30 70 L27 84 C24 90 16 89 16 82 Z"
          fill={color}
          {...ol}
        />
      );
    default:
      return null;
  }
}

function HairFront({ kind, color }: { kind: Avatar["hair"]; color: string }) {
  switch (kind) {
    case "sprout":
      return (
        <>
          <path d="M60 25 Q59 17 61 11" stroke={INK} strokeWidth="2.6" fill="none" strokeLinecap="round" />
          <path d="M60 16 C52 8 44 11 45 17 C51 20 56 19 60 16 Z" fill="#8fd96b" {...ol} strokeWidth={2.4} />
          <path d="M61 12 C66 3 76 5 75 11 C70 15 65 15 61 12 Z" fill="#a6e77f" {...ol} strokeWidth={2.4} />
        </>
      );
    case "bangs":
      return (
        <>
          <path
            d="M21 60 C18 33 37 20 60 20 C83 20 102 33 99 60 C96 50 90 44 83 46 C79 39 71 38 66 44 C62 37 54 37 51 43 C45 38 37 40 35 47 C29 46 24 51 21 60 Z"
            fill={color}
            {...ol}
          />
          <HairShine />
        </>
      );
    case "bob":
      return (
        <>
          <path
            d="M21 60 C19 32 37 20 60 20 C83 20 101 32 99 60 C92 50 82 46 72 47 Q60 41 48 47 C38 46 28 50 21 60 Z"
            fill={color}
            {...ol}
          />
          <HairShine />
        </>
      );
    case "twin":
      return (
        <>
          <path
            d="M22 58 C20 32 38 20 60 20 C82 20 100 32 98 58 C92 46 78 42 66 44 C63 40 61 37 58 35 C55 42 40 44 22 58 Z"
            fill={color}
            {...ol}
          />
          <HairShine />
        </>
      );
    case "spiky":
      return (
        <>
          <path
            d="M22 56 L23 31 L35 39 L39 15 L52 32 L60 9 L68 32 L81 15 L85 39 L97 31 L98 56 C88 45 74 42 60 42 C46 42 32 45 22 56 Z"
            fill={color}
            {...ol}
          />
          <path d="M40 34 L44 24" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" opacity="0.4" />
        </>
      );
    case "perm":
      return <>{curls([[44, 32, 7], [60, 29, 7.5], [76, 32, 7]], color)}</>;
    case "bun":
      return (
        <>
          <path d="M22 58 C22 32 38 21 60 21 C82 21 98 32 98 58 C90 44 74 40 62 41 L60 35 L58 41 C46 40 30 44 22 58 Z" fill={color} {...ol} />
          <HairShine />
        </>
      );
    case "bald":
    case "white": {
      // 옆머리만 남은 아저씨 · 폭신한 백발 옆머리 할아버지.
      return kind === "white" ? (
        <>{curls([[21, 55, 7], [20, 67, 7], [99, 55, 7], [100, 67, 7]], color)}</>
      ) : (
        <>
          <path d="M21 70 Q17 51 31 43 Q27 57 31 70 Z" fill={color} {...ol} />
          <path d="M99 70 Q103 51 89 43 Q93 57 89 70 Z" fill={color} {...ol} />
          <path d="M53 26 q6 -4 13 -2 M56 28 q6 -4 12 -1" stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round" />
        </>
      );
    }
    default:
      return null;
  }
}

/* ── 볼 · 눈썹 · 눈 ────────────────────────────────────────────────────── */

function Cheeks({ a }: { a: Avatar }) {
  if (a.body === "parrot") {
    // 왕관앵무의 주황 볼은 원래 무늬다.
    const r = a.face === "blush" ? 7.5 : 6.8;
    return (
      <>
        {[33, 87].map((x) => (
          <g key={x}>
            <circle cx={x} cy="70" r={r} fill="#ff9a4d" />
            <circle cx={x - 2.4} cy="67.6" r="1.8" fill="#fff" opacity="0.55" />
          </g>
        ))}
      </>
    );
  }
  const strong = a.face === "blush";
  const op = strong ? 0.6 : a.face === "none" ? 0.28 : 0.2;
  return (
    <>
      {[35, 85].map((x) => (
        <g key={x}>
          <ellipse cx={x} cy="70" rx="6.5" ry="4" fill="#ff7aa2" opacity={op} />
          {strong && (
            <path
              d={`M${x - 3.5} 71.5 l1.5 -3 M${x - 0.5} 71.5 l1.5 -3 M${x + 2.5} 71.5 l1.5 -3`}
              stroke="#ff5d8f"
              strokeWidth="1.2"
              strokeLinecap="round"
              opacity="0.7"
            />
          )}
        </g>
      ))}
    </>
  );
}

function Brows({ eyes }: { eyes: Avatar["eyes"] }) {
  const b = line(3.4);
  if (eyes === "angry") {
    // 미간으로 내리꽂는 눈썹 — 버럭의 전부다.
    return (
      <>
        <path d={`M${L - 8} 46 L${L + 6} 51`} {...b} />
        <path d={`M${R + 8} 46 L${R - 6} 51`} {...b} />
      </>
    );
  }
  if (eyes === "sad") {
    return (
      <>
        <path d={`M${L - 7} 50 Q${L} 45 ${L + 6} 46`} {...b} />
        <path d={`M${R + 7} 50 Q${R} 45 ${R - 6} 46`} {...b} />
      </>
    );
  }
  return null;
}

function heart(cx: number, cy: number, s: number) {
  return `M${cx} ${cy + s * 0.9} C${cx - s * 1.6} ${cy - s * 0.2} ${cx - s * 0.7} ${cy - s * 1.3} ${cx} ${cy - s * 0.4} C${cx + s * 0.7} ${cy - s * 1.3} ${cx + s * 1.6} ${cy - s * 0.2} ${cx} ${cy + s * 0.9} Z`;
}

function star4(cx: number, cy: number, s: number) {
  return `M${cx} ${cy - s} Q${cx + s * 0.22} ${cy - s * 0.22} ${cx + s} ${cy} Q${cx + s * 0.22} ${cy + s * 0.22} ${cx} ${cy + s} Q${cx - s * 0.22} ${cy + s * 0.22} ${cx - s} ${cy} Q${cx - s * 0.22} ${cy - s * 0.22} ${cx} ${cy - s} Z`;
}

/** 반짝이는 눈 — 큰 캐치라이트 하나, 작은 것 하나, 아래쪽 은은한 홍채 빛. */
function Glossy({ x, rx, ry, iris = true }: { x: number; rx: number; ry: number; iris?: boolean }) {
  return (
    <>
      <ellipse cx={x} cy={EY} rx={rx} ry={ry} fill={EYE} />
      {iris && <ellipse cx={x} cy={EY + ry * 0.42} rx={rx * 0.66} ry={ry * 0.36} fill="#8a6a9a" opacity="0.65" />}
      <circle cx={x + rx * 0.32} cy={EY - ry * 0.38} r={Math.max(1.6, rx * 0.42)} fill="#fff" />
      <circle cx={x - rx * 0.38} cy={EY + ry * 0.36} r={Math.max(0.8, rx * 0.18)} fill="#fff" opacity="0.9" />
    </>
  );
}

function Eyes({ kind, level }: { kind: Avatar["eyes"]; level: number }) {
  const loud = level > 0.55;
  const grow = 1 + level * 0.25;

  // 졸린 눈은 크게 외치면 번쩍 뜬다 — 소리에 반응하는 게 제일 잘 보이는 자리다.
  if (kind === "sleepy" && !loud) {
    return (
      <>
        <path d={`M${L - 5.5} ${EY} q5.5 4.5 11 0`} {...line(3)} />
        <path d={`M${R - 5.5} ${EY} q5.5 4.5 11 0`} {...line(3)} />
        <path d={`M${L - 6.5} ${EY + 1} l-2 1.5 M${R + 6.5} ${EY + 1} l2 1.5`} {...line(2)} />
      </>
    );
  }
  if (kind === "happy") {
    return (
      <>
        <path d={`M${L - 6} ${EY + 2} q6 -9 12 0`} {...line(3.4)} />
        <path d={`M${R - 6} ${EY + 2} q6 -9 12 0`} {...line(3.4)} />
      </>
    );
  }
  if (kind === "wink") {
    return (
      <>
        <path d={`M${L - 6} ${EY - 3} L${L + 3} ${EY} L${L - 6} ${EY + 3}`} {...line(3.2)} />
        <Glossy x={R} rx={5 * grow} ry={6 * grow} />
      </>
    );
  }
  if (kind === "star") {
    return (
      <>
        {[L, R].map((x) => (
          <g key={x}>
            <ellipse cx={x} cy={EY} rx={6 * grow} ry={7 * grow} fill={EYE} />
            <path d={star4(x + 0.6, EY - 0.6, 4.6 * grow)} fill="#ffd84d" />
            <circle cx={x - 3} cy={EY + 3.6} r="1" fill="#fff" />
          </g>
        ))}
      </>
    );
  }
  if (kind === "heart") {
    const s = 5.4 * (1 + level * 0.35);
    return (
      <>
        {[L, R].map((x) => (
          <g key={x}>
            <path d={heart(x, EY, s)} fill="#ff4f8b" stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
            <circle cx={x - s * 0.6} cy={EY - s * 0.45} r={s * 0.24} fill="#fff" opacity="0.85" />
          </g>
        ))}
      </>
    );
  }
  if (kind === "sad") {
    // 물기 어린 큰 눈 — 아래 눈물막이 고여 글썽인다.
    return (
      <>
        {[L, R].map((x) => (
          <g key={x}>
            <Glossy x={x} rx={6} ry={7} iris={false} />
            <path d={`M${x - 5} ${EY + 4} q5 3.5 10 0`} stroke="#8fd3ff" strokeWidth="2.2" fill="none" strokeLinecap="round" />
          </g>
        ))}
      </>
    );
  }
  if (kind === "angry") {
    return (
      <>
        <Glossy x={L} rx={4.6 * grow} ry={4.6 * grow} iris={false} />
        <Glossy x={R} rx={4.6 * grow} ry={4.6 * grow} iris={false} />
      </>
    );
  }
  if (kind === "shiny") {
    return (
      <>
        {[L, R].map((x, i) => (
          <g key={x}>
            <Glossy x={x} rx={6.4 * grow} ry={7.4 * grow} />
            <path d={i === 0 ? `M${x - 6} ${EY - 4} l-3 -2.5` : `M${x + 6} ${EY - 4} l3 -2.5`} {...line(2.2)} />
          </g>
        ))}
      </>
    );
  }
  // dot — 기본. 작고 동그란데 반짝인다.
  return (
    <>
      <Glossy x={L} rx={4.9 * grow} ry={5.7 * grow} iris={false} />
      <Glossy x={R} rx={4.9 * grow} ry={5.7 * grow} iris={false} />
    </>
  );
}

/* ── 얼굴 디테일 ───────────────────────────────────────────────────────── */

function Face({ kind, hair }: { kind: Avatar["face"]; hair: string }) {
  switch (kind) {
    case "freckles":
      return (
        <>
          {[[32, 68], [36, 66.5], [35, 71], [88, 68], [84, 66.5], [85, 71]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="1.2" fill="#a0603a" opacity="0.8" />
          ))}
        </>
      );
    case "beard":
      // 입보다 먼저 그린다 — 수염 위로 입이 보여야 외치는 게 보인다.
      return (
        <path
          d="M24 68 Q25 100 60 104 Q95 100 96 68 Q88 83 74 81 Q60 87 46 81 Q32 83 24 68 Z"
          fill={hair}
          {...ol}
        />
      );
    case "wrinkles": {
      const w = { stroke: INK, strokeWidth: 1.6, strokeLinecap: "round" as const, fill: "none", opacity: 0.4 };
      return (
        <>
          <path d="M50 38 q10 -3 20 0" {...w} />
          <path d="M53 42 q7 -2 14 0" {...w} />
          <path d={`M${L - 9} ${EY - 1} l-4 -2 M${L - 9} ${EY + 2} l-4 1`} {...w} />
          <path d={`M${R + 9} ${EY - 1} l4 -2 M${R + 9} ${EY + 2} l4 1`} {...w} />
        </>
      );
    }
    case "tears":
      return (
        <>
          <path d={`M${L - 3} ${EY + 6} v12 M${R + 3} ${EY + 6} v12`} stroke="#8fd3ff" strokeWidth="2.4" strokeLinecap="round" opacity="0.7" />
          <path d={`M${L - 4} ${EY + 13} q-4 7 0 10 q4 -3 0 -10 Z`} fill="#8fd3ff" stroke={INK} strokeWidth="1.5" />
          <path d={`M${R + 4} ${EY + 13} q-4 7 0 10 q4 -3 0 -10 Z`} fill="#8fd3ff" stroke={INK} strokeWidth="1.5" />
        </>
      );
    case "bandaid":
      return (
        <g transform="rotate(-24 85 66)">
          <rect x="76" y="62.5" width="18" height="7" rx="3.5" fill="#f6d3a6" stroke={INK} strokeWidth="1.7" />
          <rect x="82" y="62.5" width="6" height="7" fill="#e9b98a" />
        </g>
      );
    default:
      return null;
  }
}

function Mustache({ on, color }: { on: boolean; color: string }) {
  if (!on) return null;
  return (
    <path
      d="M45 69 Q51 61 60 66 Q69 61 75 69 Q69 72 60 68.5 Q51 72 45 69 Z"
      fill={color}
      stroke={INK}
      strokeWidth="2"
      strokeLinejoin="round"
    />
  );
}

/* ── 입 ─────────────────────────────────────────────────────────────── */

/**
 * 다문 입(표정 선)과 벌린 입 사이를 끊지 않고 넘어간다.
 *
 * level 0.03~0.13 구간에서 선은 서서히 사라지고 벌린 입은 작게 시작해 서서히 커진다.
 * 크기는 제곱근 곡선이라 작은 소리에 살짝 열리고 큰 소리에 쫙 벌어진다.
 * 곰·토끼·고양이는 코가 입 위에 있다.
 */
function Mouth({ level, a }: { level: number; a: Avatar }) {
  const open = Math.max(0, Math.min(1, (level - 0.03) / 0.1));
  const amt = Math.sqrt(level);
  const snout = a.body === "cat" || a.body === "bear" || a.body === "bunny";
  const y0 = snout ? MY + 1 : MY;
  const closed =
    a.eyes === "angry"
      ? `M54 ${y0 + 3.5} q6 -4.5 12 0`
      : a.eyes === "sad"
        ? `M54.5 ${y0 + 3.5} q2.75 -3 5.5 -1 q2.75 -2 5.5 1`
        : snout
          ? `M54 ${y0} q3 3.6 6 0 q3 3.6 6 0`
          : `M54.5 ${y0} q5.5 5 11 0`;
  const rx = 4.4 + amt * 5.6;
  const depth = (1.5 + amt * 13) * open;
  const u = `M${60 - rx} ${y0} C${60 - rx} ${y0 + depth * 1.33} ${60 + rx} ${y0 + depth * 1.33} ${60 + rx} ${y0} Z`;
  const tongue = Math.max(0, Math.min(1, (depth - 4) / 4));
  return (
    <>
      {snout && <Snout body={a.body} />}
      {open < 1 && <path d={closed} {...line(2.8)} opacity={1 - open} />}
      {open > 0 && (
        <g opacity={open}>
          <path d={u} fill="#6a2440" />
          {tongue > 0 && (
            <ellipse cx="60" cy={y0 + depth * 0.74} rx={rx * 0.56} ry={depth * 0.24} fill="#ff8aa8" opacity={tongue} />
          )}
          <path d={u} fill="none" stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
        </g>
      )}
    </>
  );
}

function Snout({ body }: { body: Avatar["body"] }) {
  if (body === "bear") {
    return (
      <>
        <ellipse cx="60" cy="68" rx="11" ry="7.5" fill="#fff" opacity="0.45" />
        <ellipse cx="60" cy="65" rx="4.2" ry="3" fill={INK} />
        <ellipse cx="58.8" cy="64" rx="1.4" ry="0.8" fill="#fff" opacity="0.8" />
      </>
    );
  }
  if (body === "cat") {
    return (
      <>
        <path d="M57 64.5 Q60 63.5 63 64.5 Q61.5 67.5 60 67.5 Q58.5 67.5 57 64.5 Z" fill="#ff8fae" stroke={INK} strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M20 64 l10 2 M19 70 l11 -1 M100 64 l-10 2 M101 70 l-11 -1" stroke={INK} strokeWidth="1.6" strokeLinecap="round" opacity="0.55" />
      </>
    );
  }
  return <ellipse cx="60" cy="65.5" rx="2.8" ry="2.1" fill="#ff8fae" stroke={INK} strokeWidth="1.4" />;
}

/** 앵무새 부리 — 소리가 커질수록 아래 부리가 내려가며 벌어진다. */
function Beak({ level }: { level: number }) {
  const open = Math.max(0, Math.min(1, (level - 0.03) / 0.1));
  const gap = open * (2 + Math.sqrt(level) * 9);
  return (
    <>
      {gap > 0.5 && <ellipse cx="60" cy={72 + gap * 0.5} rx={4.5 + gap * 0.25} ry={gap * 0.6} fill="#8c2f45" />}
      <path
        d={`M54 ${73 + gap} Q60 ${79.5 + gap} 66 ${73 + gap} Q60 ${75.5 + gap} 54 ${73 + gap} Z`}
        fill="#c49686"
        {...ol}
        strokeWidth={2.2}
      />
      <path d="M52.5 63.5 Q60 58.5 67.5 63.5 Q66.5 72 60 75.5 Q53.5 72 52.5 63.5 Z" fill="#e2bcab" {...ol} strokeWidth={2.4} />
      <path d="M56 63 q3 -1.6 6 -0.6" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.7" />
    </>
  );
}

/* ── 안경 ───────────────────────────────────────────────────────────── */

function Glasses({ kind }: { kind: Avatar["glasses"] }) {
  const lens = { stroke: INK, fill: "#fff", fillOpacity: 0.2 };
  const arms = <path d={`M${L - 11} ${EY - 2} L21 ${EY - 4} M${R + 11} ${EY - 2} L99 ${EY - 4}`} stroke={INK} strokeWidth="2.4" strokeLinecap="round" />;
  switch (kind) {
    case "round":
      return (
        <>
          {arms}
          <circle cx={L} cy={EY} r="10" strokeWidth="2.6" {...lens} />
          <circle cx={R} cy={EY} r="10" strokeWidth="2.6" {...lens} />
          <path d={`M56 ${EY - 1} q4 -3 8 0`} stroke={INK} strokeWidth="2.4" fill="none" />
          <path d={`M${L - 5} ${EY - 5} q3 -2.5 6 -2.5 M${R - 5} ${EY - 5} q3 -2.5 6 -2.5`} stroke="#fff" strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.8" />
        </>
      );
    case "thick":
      return (
        <>
          {arms}
          <rect x="33" y={EY - 8.5} width="26" height="17" rx="6" strokeWidth="4" {...lens} />
          <rect x="61" y={EY - 8.5} width="26" height="17" rx="6" strokeWidth="4" {...lens} />
          <path d={`M58.5 ${EY - 2} h3`} stroke={INK} strokeWidth="4" />
        </>
      );
    case "sun":
      return (
        <>
          {arms}
          <path d={`M32 ${EY - 7} h27 q0 15 -13.5 15 q-13.5 0 -13.5 -15 Z`} fill="#1d1a26" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
          <path d={`M61 ${EY - 7} h27 q0 15 -13.5 15 q-13.5 0 -13.5 -15 Z`} fill="#1d1a26" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
          <path d={`M59 ${EY - 5} h2`} stroke={INK} strokeWidth="3" />
          <path d={`M37 ${EY - 3} l6 -2 M66 ${EY - 3} l6 -2`} stroke="#fff" strokeWidth="2.2" strokeLinecap="round" opacity="0.75" />
        </>
      );
    case "heart":
      return (
        <>
          {arms}
          <path d={heart(L, EY + 0.5, 8.6)} fill="#ff6fa0" fillOpacity="0.55" stroke="#e8336f" strokeWidth="2.8" strokeLinejoin="round" />
          <path d={heart(R, EY + 0.5, 8.6)} fill="#ff6fa0" fillOpacity="0.55" stroke="#e8336f" strokeWidth="2.8" strokeLinejoin="round" />
          <path d={`M56 ${EY - 2} q4 -2.5 8 0`} stroke="#e8336f" strokeWidth="2.4" fill="none" />
          <circle cx={L - 4} cy={EY - 3} r="1.6" fill="#fff" opacity="0.85" />
          <circle cx={R - 4} cy={EY - 3} r="1.6" fill="#fff" opacity="0.85" />
        </>
      );
    case "reading":
      // 콧등에 걸친 반달 돋보기 — 눈은 테 위로 넘겨다본다.
      return (
        <>
          <path d={`M36 ${EY + 5} h20 q0 9 -10 9 q-10 0 -10 -9 Z`} fill="#fff" fillOpacity="0.25" stroke="#b8901c" strokeWidth="2.4" />
          <path d={`M64 ${EY + 5} h20 q0 9 -10 9 q-10 0 -10 -9 Z`} fill="#fff" fillOpacity="0.25" stroke="#b8901c" strokeWidth="2.4" />
          <path d={`M56 ${EY + 6} q4 -3 8 0`} stroke="#b8901c" strokeWidth="2" fill="none" />
          <path d={`M36 ${EY + 5} L22 ${EY} M84 ${EY + 5} L98 ${EY}`} stroke="#b8901c" strokeWidth="1.8" />
        </>
      );
    default:
      return null;
  }
}

/* ── 모자 ───────────────────────────────────────────────────────────── */

function Hat({ kind, top, color, body }: { kind: Avatar["hat"]; top: number; color: Avatar["color"]; body: Avatar["body"] }) {
  // 몸과 같은 계열이면 모자가 안 보인다.
  const warm = color === "pink" || color === "red" || color === "peach";
  const accent = warm ? "#6fb6ff" : "#ff6f9c";
  const t = top;

  switch (kind) {
    case "headset": {
      // 코코의 녹음 부스 헤드셋 — 밴드는 정수리에 걸치고, 마이크는 입가로.
      const c = (t - 1 - 0.25 * 62) / 0.75;
      return (
        <>
          <path d={`M20 62 C18 ${c} 102 ${c} 100 62`} stroke={INK} strokeWidth="6" fill="none" strokeLinecap="round" />
          <path d={`M27 50 C30 ${c + 10} 90 ${c + 10} 93 50`} stroke="#fff" strokeWidth="1.6" fill="none" opacity="0.25" strokeLinecap="round" />
          {[0, 1].map((i) => (
            <g key={i} transform={i ? MIRROR : undefined}>
              <rect x="11" y="49" width="15" height="23" rx="7" fill={INK} />
              <rect x="14.5" y="53" width="5.5" height="15" rx="2.75" fill="#ff9a4d" />
            </g>
          ))}
          <path d="M18 71 Q21 84 40 81" stroke={INK} strokeWidth="3.2" fill="none" strokeLinecap="round" />
          <rect x="38" y="77" width="9" height="8" rx="4" fill={INK} />
          <circle cx="42.5" cy="81" r="1.6" fill="#ffd84d" />
        </>
      );
    }
    case "cap":
      return (
        <>
          <path d={`M29 ${t + 13} C28 ${t - 15} 92 ${t - 15} 91 ${t + 13} Z`} fill={accent} {...ol} />
          <path d={`M58 ${t + 11} Q84 ${t + 5} 106 ${t + 13} Q94 ${t + 21} 70 ${t + 16} Z`} fill={accent} {...ol} />
          <circle cx="60" cy={t - 7.5} r="2.6" fill={accent} {...ol} strokeWidth={2} />
          <path d={star4(52, t + 1, 4.4)} fill="#ffd84d" />
          <path d={`M38 ${t + 2} Q42 ${t - 6} 50 ${t - 9}`} stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" opacity="0.45" />
        </>
      );
    case "beanie":
      return (
        <>
          <path d={`M27 ${t + 12} C26 ${t - 20} 94 ${t - 20} 93 ${t + 12} Z`} fill="#9b8cff" {...ol} />
          <rect x="24" y={t + 4} width="72" height="12" rx="6" fill="#7b6ae8" {...ol} />
          <path
            d={[32, 40, 48, 56, 64, 72, 80, 88].map((x) => `M${x} ${t + 7} v6`).join(" ")}
            stroke="#5e4ec8"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <circle cx="60" cy={t - 16} r="6.5" fill="#fff7ea" {...ol} />
          <path d={`M38 ${t} Q42 ${t - 8} 50 ${t - 11}`} stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" opacity="0.4" />
        </>
      );
    case "bucket":
      return (
        <>
          <path d={`M34 ${t + 8} C33 ${t - 16} 87 ${t - 16} 86 ${t + 8} Z`} fill="#f6e6b8" {...ol} />
          <path d={`M17 ${t + 12} Q60 ${t - 2} 103 ${t + 12} Q60 ${t + 23} 17 ${t + 12} Z`} fill="#f6e6b8" {...ol} />
          <path d={`M35 ${t + 4} Q60 ${t - 2} 85 ${t + 4}`} stroke="#e8a64a" strokeWidth="3.2" fill="none" />
        </>
      );
    case "beret":
      return (
        <g transform={`rotate(-12 58 ${t + 2})`}>
          <path d={`M60 ${t - 12} l1 -5`} stroke={INK} strokeWidth="3" strokeLinecap="round" />
          <ellipse cx="58" cy={t + 1} rx="31" ry="11.5" fill="#ff6b6b" {...ol} />
          <path d={`M33 ${t + 4} Q58 ${t + 12} 83 ${t + 4}`} stroke="#d94a55" strokeWidth="2.4" fill="none" strokeLinecap="round" />
          <path d={`M40 ${t - 4} Q48 ${t - 9} 58 ${t - 9}`} stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" opacity="0.45" />
        </g>
      );
    case "party":
      return (
        <>
          <path d={`M45 ${t + 6} L70 ${t - 15} L80 ${t + 4} Q62 ${t + 11} 45 ${t + 6} Z`} fill="#7fd0ff" {...ol} />
          <path d={`M53 ${t - 1} L74 ${t - 5} M60 ${t - 7} L72 ${t - 9}`} stroke="#ff6f9c" strokeWidth="3.4" strokeLinecap="round" />
          <circle cx="70" cy={t - 15} r="4.4" fill="#ffd84d" {...ol} strokeWidth={2.4} />
        </>
      );
    case "visor":
      // 아줌마 선캡 — 이마를 덮는 반투명 챙.
      return (
        <>
          <path d={`M24 ${t + 15} Q60 ${t - 1} 96 ${t + 15}`} stroke="#ff7aa8" strokeWidth="6" fill="none" strokeLinecap="round" />
          <path
            d={`M26 ${t + 17} Q60 ${t + 6} 102 ${t + 18} Q76 ${t + 33} 28 ${t + 23} Z`}
            fill="#5fe0b0"
            fillOpacity="0.75"
            stroke={INK}
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
        </>
      );
    case "crown":
      return (
        <>
          <path
            d={`M41 ${t + 5} L43 ${t - 13} L52 ${t - 4} L60 ${t - 17} L68 ${t - 4} L77 ${t - 13} L79 ${t + 5} Z`}
            fill="#ffd23a"
            {...ol}
          />
          <rect x="41" y={t + 1} width="38" height="5" rx="2" fill="#f2a91f" />
          <circle cx="60" cy={t - 3} r="2.8" fill="#ff6f9c" />
          <circle cx="49" cy={t - 1} r="1.8" fill="#6fb6ff" />
          <circle cx="71" cy={t - 1} r="1.8" fill="#6fb6ff" />
          <path d={`M46 ${t - 6} l1 -4`} stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
        </>
      );
    case "bow": {
      const cx = body === "bunny" ? 60 : 80;
      const cy = body === "bunny" ? t + 2 : t + 4;
      const c = body === "bunny" ? "#ff6f9c" : accent;
      return (
        <>
          <path d={`M${cx} ${cy} C${cx - 6} ${cy - 13} ${cx - 18} ${cy - 10} ${cx - 15} ${cy + 1} C${cx - 13} ${cy + 9} ${cx - 5} ${cy + 6} ${cx} ${cy} Z`} fill={c} {...ol} />
          <path d={`M${cx} ${cy} C${cx + 6} ${cy - 13} ${cx + 18} ${cy - 10} ${cx + 15} ${cy + 1} C${cx + 13} ${cy + 9} ${cx + 5} ${cy + 6} ${cx} ${cy} Z`} fill={c} {...ol} />
          <circle cx={cx} cy={cy} r="4.4" fill={c} {...ol} />
          <path d={`M${cx - 11} ${cy - 3} q2 -4 5 -4`} stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.55" />
        </>
      );
    }
    case "flower": {
      const cx = 84;
      const cy = t + 6;
      return (
        <>
          {[0, 72, 144, 216, 288].map((a) => (
            <circle
              key={a}
              cx={cx + Math.cos(((a - 90) * Math.PI) / 180) * 5.5}
              cy={cy + Math.sin(((a - 90) * Math.PI) / 180) * 5.5}
              r="4.8"
              fill="#ffa3c4"
              stroke={INK}
              strokeWidth="1.8"
            />
          ))}
          <circle cx={cx} cy={cy} r="3.6" fill="#ffd23a" stroke={INK} strokeWidth="1.8" />
        </>
      );
    }
    default:
      return null;
  }
}

/* ── 효과 ───────────────────────────────────────────────────────────── */

function FxBack({ kind, level, top }: { kind: Avatar["fx"]; level: number; top: number }) {
  if (kind !== "fire") return null;
  // 외칠수록 불길이 치솟는다 — 버럭이의 핵심. 기준점을 불길 아래에 두고 조금만 키운다.
  const base = top + 26;
  const grow = `translate(60 ${base}) scale(${1 + level * 0.08} ${1 + level * 0.22}) translate(-60 ${-base}) translate(0 ${top - 24})`;
  return (
    <g transform={grow}>
      <path
        d="M26 52 Q17 34 29 18 Q31 32 41 32 Q37 18 49 6 Q54 24 60 25 Q62 12 75 8 Q70 25 81 27 Q89 18 91 12 Q99 32 94 52 Z"
        fill="#ff7a1a"
        stroke={INK}
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path d="M38 50 Q33 39 40 30 Q42 39 50 39 Q48 28 58 20 Q62 33 68 34 Q70 26 78 24 Q84 39 80 50 Z" fill="#ffd23a" />
    </g>
  );
}

function note(x: number, y: number, s: number, fill: string, key: number): ReactNode {
  return (
    <g key={key} transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M3 0 V-11 L10 -13 V-9 L5 -7.6 V0" fill={fill} stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
      <ellipse cx="0.5" cy="0.5" rx="3.6" ry="2.8" fill={fill} stroke={INK} strokeWidth="1.6" transform="rotate(-20 0.5 0.5)" />
    </g>
  );
}

function FxFront({ kind, level }: { kind: Avatar["fx"]; level: number }) {
  const float = -level * 5;
  switch (kind) {
    case "notes":
      return (
        <g transform={`translate(0 ${float})`}>
          {note(101, 34, 1.15, "#ffd84d", 1)}
          {note(14, 46, 0.95, "#ff9a4d", 2)}
          {note(107, 58, 0.75, "#ff9a4d", 3)}
        </g>
      );
    case "rain":
      return (
        <g transform={`translate(0 ${-level * 3})`}>
          <path
            d="M80 22 Q78 12 88 12 Q90 4 100 6 Q108 4 110 12 Q118 14 114 22 Z"
            fill="#a8b4ca"
            stroke={INK}
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <path d="M88 27 l-2 6 M98 28 l-2 6 M108 27 l-2 6" stroke="#6fb6ff" strokeWidth="2.6" strokeLinecap="round" />
        </g>
      );
    case "sparkle":
      return (
        <g transform={`translate(0 ${float})`}>
          <path d={star4(13, 44, 6.5)} fill="#fff7c2" stroke={INK} strokeWidth="1.4" strokeLinejoin="round" />
          <path d={star4(107, 52, 5.5)} fill="#ffd84d" stroke={INK} strokeWidth="1.4" strokeLinejoin="round" />
          <path d={star4(101, 20, 4)} fill="#fff7c2" stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
          <circle cx="20" cy="24" r="2" fill="#ffd84d" />
        </g>
      );
    case "hearts":
      return (
        <g transform={`translate(0 ${float})`}>
          <path d={heart(104, 40, 5.5)} fill="#ff5d98" stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
          <path d={heart(15, 52, 4.2)} fill="#ff8fb8" stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
          <path d={heart(97, 17, 3.6)} fill="#ff8fb8" stroke={INK} strokeWidth="1.4" strokeLinejoin="round" />
        </g>
      );
    case "sweat":
      return (
        <g transform={`translate(0 ${level * 3})`}>
          <path d="M93 36 q-6.5 10 0 13 q6.5 -3 0 -13 Z" fill="#8fd6ff" stroke={INK} strokeWidth="1.7" />
          <path d="M91.4 44 q0 2 1.6 3" stroke="#fff" strokeWidth="1.3" fill="none" strokeLinecap="round" />
        </g>
      );
    default:
      return null;
  }
}
