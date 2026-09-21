import { ImageResponse } from "next/og";

/**
 * 공유 링크 미리보기 카드.
 *
 * 카톡·DM 에 링크를 던지면 지금까지 회색 박스가 떴다. 이 앱의 자가증식 장치는
 * "친구가 87점 찍고 갔다"는 도전장 하나뿐인데, 그 숫자가 미리보기에 안 보이면
 * 받는 사람은 그냥 링크를 안 누른다.
 *
 * opengraph-image 파일 규약 대신 라우트 핸들러를 쓴다 — 파일 규약은 params 만
 * 받고 searchParams 를 못 받는데, 점수는 `?s=87` 로 온다.
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
      "https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@700" +
        `&text=${encodeURIComponent(text)}`,
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
  const title = (q.get("title") ?? "MIMIC").slice(0, 40);
  const line = (q.get("line") ?? "").slice(0, 60);
  const source = (q.get("source") ?? "").slice(0, 40);
  const emoji = (q.get("emoji") ?? "🎙").slice(0, 4);
  const raw = Number(q.get("s"));
  const beat = Number.isInteger(raw) && raw >= 0 && raw <= 100 ? raw : null;

  const headline = beat !== null ? `${beat}점` : "따라하기 챌린지";
  const sub = beat !== null ? "이거 넘어봐" : "설치 없이 탭 한 번";
  const text = `${title}${line}${source}${headline}${sub}MIMIC`;
  const font = await subsetFont(text);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0A0A0B",
          color: "#F5F5F7",
          fontFamily: font ? "Noto" : "sans-serif",
          padding: 64,
        }}
      >
        <div style={{ display: "flex", fontSize: 96, marginBottom: 8 }}>{emoji}</div>
        <div style={{ display: "flex", fontSize: 72, fontWeight: 700 }}>{title}</div>
        {line && (
          <div
            style={{
              display: "flex",
              fontSize: 36,
              color: "#E8FF3A",
              marginTop: 16,
              textAlign: "center",
            }}
          >
            “{line}”
          </div>
        )}
        {source && (
          <div style={{ display: "flex", fontSize: 28, color: "#8A8A92", marginTop: 12 }}>
            {source}
          </div>
        )}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 20,
            marginTop: 44,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: beat !== null ? 104 : 56,
              fontWeight: 700,
              color: beat !== null ? "#FF2D78" : "#F5F5F7",
            }}
          >
            {headline}
          </div>
          <div style={{ display: "flex", fontSize: 32, color: "#8A8A92" }}>{sub}</div>
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 26,
            letterSpacing: 6,
            color: "#E8FF3A",
            marginTop: 40,
          }}
        >
          MIMIC
        </div>
      </div>
    ),
    {
      ...SIZE,
      ...(font
        ? { fonts: [{ name: "Noto", data: font, weight: 700 as const, style: "normal" as const }] }
        : {}),
    },
  );
}
