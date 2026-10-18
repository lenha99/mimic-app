import { ImageResponse } from "next/og";
import { VoiceAvatar } from "@/components/voice-avatar";
import { normalizeAvatar } from "@/lib/avatar";
import { svgToString } from "@/lib/svg-string";
import { seasonLabel } from "@/lib/weekly";
import { getEntry } from "@/lib/weekly-server";

/**
 * 출전작 공유 카드 — 단톡방에 링크를 붙이면 이게 뜬다.
 *
 * 받는 사람이 눌러야 할 이유는 "친구가 몇 위인가"다. 캐릭터 + 순위 + ❤ 를 크게,
 * 그리고 "들어보고 ❤" 한 줄. 레이아웃·폰트 처리는 /api/og 와 같다(주석 참고).
 */
export const contentType = "image/png";

const SIZE = { width: 1200, height: 630 };

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
    return null;
  }
}

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const entry = await getEntry(id).catch(() => null);

  const name = (entry?.name ?? "익명의 목소리").slice(0, 16);
  const title = (entry?.week.title ?? "보이스 챌린지").slice(0, 20);
  const kicker = entry ? `${seasonLabel(entry.week)} 보이스 챌린지` : "MIMIC 보이스 챌린지";
  const rank = entry ? `${entry.rank}위` : "";
  const of = entry ? `/ ${entry.total}명` : "";
  // 디스플레이 서체엔 ❤ 글리프가 없다 — 하트는 SVG 로 그리고 글자는 숫자만.
  const likes = entry ? String(entry.likes) : "";
  const sub = "들어보고 하트 눌러줘";
  const font = await subsetFont(`${name}${title}${kicker}${rank}${of}${likes}${sub}MIMIC`);

  const svg = svgToString(<VoiceAvatar avatar={normalizeAvatar(entry?.avatar)} level={0.75} size={420} />);
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
            "radial-gradient(circle at 25% 40%, rgba(232,255,58,0.25), transparent 55%), radial-gradient(circle at 95% 95%, rgba(255,45,120,0.25), transparent 55%)",
          color: "#F5F5F7",
          fontFamily: font ? "Display" : "sans-serif",
          padding: "40px 64px 40px 40px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 500 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={avatarSrc} width={420} height={420} alt="" />
          <div style={{ display: "flex", fontSize: 44, marginTop: -6 }}>{name}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, marginLeft: 30 }}>
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              fontSize: 28,
              background: "#E8FF3A",
              color: "#0A0A0B",
              padding: "6px 18px",
              borderRadius: 999,
            }}
          >
            {kicker}
          </div>
          <div style={{ display: "flex", fontSize: 68, lineHeight: 1.1, marginTop: 18 }}>{title}</div>
          {entry ? (
            <div style={{ display: "flex", alignItems: "baseline", marginTop: 14 }}>
              <div style={{ display: "flex", fontSize: 150, lineHeight: 1, color: "#E8FF3A" }}>{rank}</div>
              <div style={{ display: "flex", fontSize: 44, color: "#8A8A92", marginLeft: 14 }}>{of}</div>
            </div>
          ) : null}
          <div style={{ display: "flex", alignItems: "center", marginTop: 12 }}>
            {entry ? (
              <div style={{ display: "flex", alignItems: "center", color: "#FF2D78", fontSize: 48 }}>
                <svg width="48" height="48" viewBox="0 0 48 48">
                  <path
                    fill="#FF2D78"
                    d="M24 42s-17-10-17-22A9.5 9.5 0 0 1 24 14a9.5 9.5 0 0 1 17 6c0 12-17 22-17 22Z"
                  />
                </svg>
                <div style={{ display: "flex", marginLeft: 10 }}>{likes}</div>
              </div>
            ) : null}
            <div style={{ display: "flex", fontSize: 40, marginLeft: entry ? 28 : 0 }}>{sub}</div>
          </div>
          <div style={{ display: "flex", fontSize: 30, letterSpacing: 6, color: "#E8FF3A", marginTop: 30 }}>MIMIC</div>
        </div>
      </div>
    ),
    {
      ...SIZE,
      headers: { "cache-control": "public, max-age=60, s-maxage=300" },
      ...(font ? { fonts: [{ name: "Display", data: font, weight: 400 as const, style: "normal" as const }] } : {}),
    },
  );
}
