import { ImageResponse } from "next/og";
import { VoiceAvatar } from "@/components/voice-avatar";
import { decodeAvatar } from "@/lib/avatar";
import { svgToString } from "@/lib/svg-string";
import { tr } from "@/lib/i18n";
import { EXPR_LABEL, exprOf, readCard, REGISTER_LABEL, registerOf, VOICE_TYPES } from "@/lib/voice-card";

/**
 * 보이스 카드 이미지 — 공유 시트에 파일로, 링크 미리보기에 OG 로 같은 그림이 간다.
 * 레이아웃·폰트 처리는 /api/og/weekly 와 같다. 디스플레이 서체엔 이모지가 없다.
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
  const q = new URL(req.url).searchParams;
  const card = readCard(q);
  // 그림의 글자는 받는 사람 언어(ui)로, 없으면 만든 사람 언어로.
  const lang = q.get("ui") === "en" || q.get("ui") === "ko" ? (q.get("ui") as "ko" | "en") : (card?.lang ?? "ko");
  const t = tr(lang);
  const type = card ? VOICE_TYPES[card.type] : null;

  const kicker = t("MIMIC 보이스 카드", "MIMIC VOICE CARD");
  const lead = t("내 목소리 유형은", "My voice type is");
  const name = type ? t(type.ko, type.en) : t("너의 목소리 유형은?", "What's your voice type?");
  const tags = card
    ? [REGISTER_LABEL[registerOf(card.hz)], EXPR_LABEL[exprOf(card.st10 / 10)]].map((l) => t(l[0], l[1]))
    : [];
  const stats = card
    ? [
        [t("평균 음높이", "Avg pitch"), `${card.hz}Hz`],
        [t("억양 폭", "Range"), `${(card.st10 / 10).toFixed(1)}${t("반음", "st")}`],
        ...(card.pace10 !== null ? [[t("말 속도", "Pace"), `${(card.pace10 / 10).toFixed(1)}/s`]] : []),
      ]
    : [];
  const role = type ? t(type.roleKo, type.roleEn) : "";
  const cta = t("너는 무슨 유형?", "What's yours?");
  const font = await subsetFont(`${kicker}${lead}${name}${tags.join("")}${stats.flat().join("")}${role}${cta}MIMIC`);

  const svg = svgToString(<VoiceAvatar avatar={decodeAvatar(card?.avatar)} level={0.6} size={400} />);
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
            "radial-gradient(circle at 22% 40%, rgba(232,255,58,0.25), transparent 55%), radial-gradient(circle at 95% 95%, rgba(255,45,120,0.25), transparent 55%)",
          color: "#F5F5F7",
          fontFamily: font ? "Display" : "sans-serif",
          padding: "40px 60px 40px 40px",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={avatarSrc} width={400} height={400} alt="" />
        <div style={{ display: "flex", flexDirection: "column", flex: 1, marginLeft: 36 }}>
          <div style={{ display: "flex", fontSize: 26, letterSpacing: 4, color: "#E8FF3A" }}>{kicker}</div>
          <div style={{ display: "flex", fontSize: 34, color: "#8A8A92", marginTop: 16 }}>{lead}</div>
          <div style={{ display: "flex", fontSize: 84, lineHeight: 1.1, marginTop: 4 }}>{name}</div>
          <div style={{ display: "flex", marginTop: 16 }}>
            {tags.map((x) => (
              <div
                key={x}
                style={{
                  display: "flex",
                  fontSize: 26,
                  padding: "6px 16px",
                  marginRight: 10,
                  borderRadius: 999,
                  background: "rgba(245,245,247,0.12)",
                }}
              >
                {x}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", marginTop: 22 }}>
            {stats.map(([k, v]) => (
              <div key={k} style={{ display: "flex", flexDirection: "column", marginRight: 34 }}>
                <div style={{ display: "flex", fontSize: 22, color: "#8A8A92" }}>{k}</div>
                <div style={{ display: "flex", fontSize: 40, color: "#E8FF3A" }}>{v}</div>
              </div>
            ))}
          </div>
          {role ? <div style={{ display: "flex", fontSize: 30, marginTop: 20 }}>{role}</div> : null}
          <div style={{ display: "flex", alignItems: "baseline", marginTop: 24 }}>
            <div style={{ display: "flex", fontSize: 34, color: "#FF2D78" }}>{cta}</div>
            <div style={{ display: "flex", fontSize: 26, letterSpacing: 6, color: "#E8FF3A", marginLeft: 24 }}>MIMIC</div>
          </div>
        </div>
      </div>
    ),
    {
      ...SIZE,
      headers: { "cache-control": "public, max-age=86400, s-maxage=86400" },
      ...(font ? { fonts: [{ name: "Display", data: font, weight: 400 as const, style: "normal" as const }] } : {}),
    },
  );
}
