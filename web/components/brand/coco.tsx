/**
 * 코코 — MIMIC 마스코트(왕관앵무).
 *
 * 흉내 = 앵무새. 볼의 주황 동그라미는 왕관앵무에게 원래 있는 무늬라 따로 "귀엽게" 꾸밀
 * 필요가 없다. 머리 볏은 목소리 높이를 보여 주는 장치다 — 고음이면 서고(high), 평소엔 눕는다.
 *
 * 순수 SVG(외부 파일·폰트 없음)라 앱 아이콘·홈·심사표·로딩 어디에 그려도 몇 KB 다.
 * 좌표계 200×214 (볏이 서면 위로 14 더 쓴다).
 */
export type CocoMood = "idle" | "happy" | "sing" | "wow" | "high" | "think";

export const COCO = {
  crest: "#FFD84D",
  head: "#FFE47E",
  body: "#FFF6DD",
  belly: "#FFFCF2",
  cheek: "#FF9A4D",
  wing: "#D9D2E9",
  wingTip: "#BFB6D6",
  beak: "#D8B1A2",
  beakLow: "#C49686",
  feet: "#F0B4A4",
  ink: "#2A2A35",
  mouth: "#8C2F45",
} as const;

export function Coco({
  mood = "idle",
  size = 120,
  label,
  className,
  headset = true,
}: {
  mood?: CocoMood;
  size?: number;
  /** 녹음 부스 헤드셋. 아주 작게 그릴 땐(파비콘 등) 꺼서 얼굴만 */
  headset?: boolean;
  /** 스크린리더용. 없으면 장식. */
  label?: string;
  className?: string;
}) {
  const c = COCO;
  const crestUp = mood === "high" || mood === "wow";
  const open = mood === "sing" || mood === "high" || mood === "wow";
  const wingsUp = mood === "sing" || mood === "happy";
  return (
    <svg
      width={size}
      height={size * 1.07}
      viewBox="0 -14 200 214"
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {/* 꼬리·발 */}
      <path d="M86 168 L100 198 L114 168Z" fill={c.wing} />
      <ellipse cx="84" cy="182" rx="11" ry="6" fill={c.feet} />
      <ellipse cx="116" cy="182" rx="11" ry="6" fill={c.feet} />

      {/* 볏 — 몸보다 먼저 그려야 머리 뒤에서 솟는다 */}
      {crestUp ? (
        <g fill={c.crest}>
          <path d="M94 50 C90 28 92 6 100 -8 C106 8 108 30 106 50Z" />
          <path d="M86 54 C78 34 76 14 82 0 C88 16 94 34 98 50Z" />
          <path d="M104 52 C108 34 114 16 122 4 C124 20 118 40 112 54Z" />
        </g>
      ) : (
        <g fill={c.crest}>
          <path d="M94 50 C84 26 88 8 102 2 C96 18 98 32 106 48Z" />
          <path d="M86 54 C72 38 68 22 76 12 C80 28 88 38 98 50Z" />
          <path d="M106 50 C112 32 122 22 136 20 C124 30 118 40 114 54Z" />
        </g>
      )}

      {/* 몸 */}
      <circle cx="100" cy="112" r="70" fill={c.body} />
      <ellipse cx="100" cy="152" rx="40" ry="24" fill={c.belly} />

      {/* 날개 — 신나면 위로 든다 */}
      {wingsUp ? (
        <>
          <ellipse cx="30" cy="110" rx="13" ry="26" fill={c.wing} transform="rotate(52 30 110)" />
          <ellipse cx="170" cy="110" rx="13" ry="26" fill={c.wing} transform="rotate(-52 170 110)" />
          <ellipse cx="18" cy="100" rx="6" ry="10" fill={c.wingTip} transform="rotate(52 18 100)" />
          <ellipse cx="182" cy="100" rx="6" ry="10" fill={c.wingTip} transform="rotate(-52 182 100)" />
        </>
      ) : (
        <>
          <ellipse cx="34" cy="130" rx="13" ry="26" fill={c.wing} transform="rotate(18 34 130)" />
          <ellipse cx="166" cy="130" rx="13" ry="26" fill={c.wing} transform="rotate(-18 166 130)" />
          <ellipse cx="30" cy="148" rx="7" ry="10" fill={c.wingTip} transform="rotate(18 30 148)" />
          <ellipse cx="170" cy="148" rx="7" ry="10" fill={c.wingTip} transform="rotate(-18 170 148)" />
        </>
      )}

      {/* 노란 얼굴 */}
      <path d="M30.7 102 A70 70 0 0 1 169.3 102 Q140 124 100 124 Q60 124 30.7 102Z" fill={c.head} />

      {/* 볼 */}
      <circle cx="60" cy="112" r="14" fill={c.cheek} />
      <circle cx="140" cy="112" r="14" fill={c.cheek} />
      <circle cx="55" cy="107" r="3.5" fill="#FFFFFF" opacity="0.45" />
      <circle cx="135" cy="107" r="3.5" fill="#FFFFFF" opacity="0.45" />

      {/* 헤드셋 — 녹음 부스. 귀여움은 얼굴이 맡고, 소품은 "연습하는 곳"을 말한다 */}
      {headset && (
        <g>
          <path d="M33 104 C30 30 170 30 167 104" stroke={c.ink} strokeWidth="8" fill="none" strokeLinecap="round" />
          <rect x="19" y="88" width="24" height="36" rx="10" fill={c.ink} />
          <rect x="157" y="88" width="24" height="36" rx="10" fill={c.ink} />
          <rect x="25" y="96" width="7" height="20" rx="3.5" fill={c.cheek} />
          <rect x="168" y="96" width="7" height="20" rx="3.5" fill={c.cheek} />
          <path d="M31 122 Q38 146 70 140" stroke={c.ink} strokeWidth="5" fill="none" strokeLinecap="round" />
          <rect x="68" y="133" width="14" height="13" rx="6" fill={c.ink} />
        </g>
      )}

      <Eyes mood={mood} />

      {/* 부리 */}
      {open ? (
        <>
          <path d="M92 100 Q100 94 108 100 Q105 107 100 108 Q95 107 92 100Z" fill={c.beak} />
          <ellipse cx="100" cy={mood === "sing" ? 114 : 116} rx={mood === "sing" ? 8 : 6} ry="7" fill={c.mouth} />
          <path d="M92 117 Q100 128 108 117 Q100 121 92 117Z" fill={c.beakLow} />
        </>
      ) : (
        <>
          <path d="M91 102 Q100 96 109 102 Q106 115 100 118 Q94 115 91 102Z" fill={c.beak} />
          <path d="M95 110 Q100 113 105 110" stroke={c.beakLow} strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </>
      )}

      {/* 소품 */}
      {mood === "sing" && (
        <g>
          <path d="M160 34 V14 L178 9 V29" stroke={c.ink} strokeWidth="4" fill="none" strokeLinejoin="round" />
          <circle cx="155" cy="34" r="6" fill={c.ink} />
          <circle cx="173" cy="29" r="6" fill={c.ink} />
        </g>
      )}
      {(mood === "wow" || mood === "high") && (
        <path d="M152 4 L155 14 L165 17 L155 20 L152 30 L149 20 L139 17 L149 14Z" fill={c.cheek} />
      )}
      {mood === "think" && (
        <g fill={c.wingTip}>
          <circle cx="152" cy="40" r="5" />
          <circle cx="164" cy="26" r="7" />
          <circle cx="178" cy="8" r="9" />
        </g>
      )}
    </svg>
  );
}

function Eyes({ mood }: { mood: CocoMood }) {
  const ink = COCO.ink;
  if (mood === "happy" || mood === "sing") {
    return (
      <g stroke={ink} strokeWidth="5" fill="none" strokeLinecap="round">
        <path d="M67 96 Q77 84 87 96" />
        <path d="M113 96 Q123 84 133 96" />
      </g>
    );
  }
  if (mood === "think") {
    return (
      <g>
        <circle cx="78" cy="92" r="9.5" fill={ink} />
        <circle cx="122" cy="92" r="9.5" fill={ink} />
        <circle cx="82" cy="88" r="3.4" fill="#FFFFFF" />
        <circle cx="126" cy="88" r="3.4" fill="#FFFFFF" />
      </g>
    );
  }
  const big = mood === "wow" || mood === "high";
  const r = big ? 13 : 9.5;
  return (
    <g>
      <circle cx={big ? 76 : 77} cy={big ? 92 : 94} r={r} fill={ink} />
      <circle cx={big ? 124 : 123} cy={big ? 92 : 94} r={r} fill={ink} />
      <circle cx={big ? 81 : 80.5} cy={big ? 87 : 90.5} r={big ? 4.5 : 3.4} fill="#FFFFFF" />
      <circle cx={big ? 129 : 126.5} cy={big ? 87 : 90.5} r={big ? 4.5 : 3.4} fill="#FFFFFF" />
      <circle cx={big ? 72 : 74} cy={big ? 97 : 98} r={big ? 2.2 : 1.6} fill="#FFFFFF" />
      <circle cx={big ? 120 : 120} cy={big ? 97 : 98} r={big ? 2.2 : 1.6} fill="#FFFFFF" />
    </g>
  );
}
