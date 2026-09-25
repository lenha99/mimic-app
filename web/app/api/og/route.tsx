import { ImageResponse } from "next/og";
import { VoiceAvatar } from "@/components/voice-avatar";
import { decodeAvatar } from "@/lib/avatar";
import { svgToString } from "@/lib/svg-string";

/**
 * 공유 링크 미리보기 카드.
 *
 * 카톡 단톡방에서 링크가 이기려면 스크롤하다 멈추게 해야 한다. 이모지 한 개와
 * 제목으로는 약하다 — 할머니 캐릭터가 입을 쫙 벌리고 "밥은 먹고 다니냐"를
 * 외치고 있으면 누른다. 그래서 캐릭터(?a=)를 외치는 모양으로 크게 그리고,
 * 점수(?s=)를 도전장처럼 옆에 박는다.
 *
 * opengraph-image 파일 규약 대신 라우트 핸들러를 쓴다 — 파일 규약은 params 만
 * 받고 searchParams 를 못 받는데, 점수와 캐릭터는 쿼리로 온다.
 *
 * 한글은 시스템 폰트가 없으면 네모로 깨진다. 폰트를 번들에 넣으면 500KB 제한에
 * 걸리기 쉬워서, 필요한 글자만 잘라낸 서브셋을 구글에서 받아 쓴다.
 */
export const contentType = "image/png";

const SIZE = { width: 1200, height: 630 };

/** 이 카드에 실제로 그릴 글자만 담은 폰트를 받는다 (전체 한글 폰트는 수 MB 다). */
async function subsetFont(text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      "https://fonts.googleapis.com/css2?family=Black+Han+Sans" + `&text=${encodeURIComponent(text)}`,
      { headers: { "User-Agent": "Mozilla/5.0" } },
    ).then((r) => r.text());
    const url = css.match(/src:\s*url\(([^)]+)\)/)?.[1];
    if (!url) return null;
    return await fetch(url).then((r) => r.arrayBuffer());
  } catch {
    return null; // 폰트를 못 받아도 카드는 나가야 한다
  }
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const title = (q.get("title") ?? "MIMIC").slice(0, 24);
  const line = (q.get("line") ?? "").slice(0, 30);
  const who = (q.get("who") ?? "").slice(0, 16);
  const avatar = decodeAvatar(q.get("a"));
  // Number(null) 은 0 이라, 점수 없는 링크가 "0점"으로 나갔다. 없으면 없는 것이다.
  const rawS = q.get("s");
  const raw = rawS === null || rawS === "" ? NaN : Number(rawS);
  const beat = Number.isInteger(raw) && raw >= 0 && raw <= 100 ? raw : null;

  const shout = line || title;
  const kicker = beat !== null ? `${who || "친구"}의 도전장` : "따라하기 챌린지";
  const sub = beat !== null ? "이거 넘어봐" : "설치 없이 탭 한 번";
  const text = `${title}${shout}${kicker}${sub}${beat ?? ""}점MIMIC`;
  const font = await subsetFont(text);

  // 캐릭터는 SVG 문자열로 만들어 이미지로 넣는다 (lib/svg-string 주석 참고).
  const svg = svgToString(<VoiceAvatar avatar={avatar} level={0.85} size={440} />);
  const avatarSrc = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          background: "#0A0A0B",
          backgroundImage:
            "radial-gradient(circle at 25% 30%, rgba(232,255,58,0.22), transparent 55%), radial-gradient(circle at 90% 90%, rgba(255,45,120,0.22), transparent 55%)",
          color: "#F5F5F7",
          fontFamily: font ? "Display" : "sans-serif",
          padding: "40px 64px 40px 40px",
        }}
      >
        {/* 왼쪽: 외치는 캐릭터 + 말풍선 */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 520 }}>
          <div
            style={{
              display: "flex",
              background: "#F5F5F7",
              color: "#0A0A0B",
              fontSize: 44,
              padding: "10px 26px",
              borderRadius: 28,
              transform: "rotate(-5deg)",
              marginBottom: -6,
              maxWidth: 500,
            }}
          >
            {shout}
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={avatarSrc} width={440} height={440} alt="" />
        </div>

        {/* 오른쪽: 누가 · 무엇을 · 몇 점 */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, marginLeft: 24 }}>
          <div style={{ display: "flex", fontSize: 32, color: "#FF2D78" }}>{kicker}</div>
          <div style={{ display: "flex", fontSize: 72, lineHeight: 1.1, marginTop: 8 }}>{title}</div>
          {beat !== null ? (
            <div style={{ display: "flex", alignItems: "baseline", marginTop: 18 }}>
              <div style={{ display: "flex", fontSize: 168, lineHeight: 1, color: "#E8FF3A" }}>{beat}</div>
              <div style={{ display: "flex", fontSize: 56, color: "#8A8A92", marginLeft: 8 }}>점</div>
            </div>
          ) : null}
          <div style={{ display: "flex", fontSize: 40, color: "#F5F5F7", marginTop: beat !== null ? 4 : 24 }}>
            {sub}
          </div>
          <div style={{ display: "flex", fontSize: 30, letterSpacing: 6, color: "#E8FF3A", marginTop: 34 }}>
            MIMIC
          </div>
        </div>
      </div>
    ),
    {
      ...SIZE,
      ...(font
        ? { fonts: [{ name: "Display", data: font, weight: 400 as const, style: "normal" as const }] }
        : {}),
    },
  );
}
