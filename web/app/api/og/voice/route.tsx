import { ImageResponse } from "next/og";
import { VoiceAvatar } from "@/components/voice-avatar";
import { decodeAvatar } from "@/lib/avatar";
import { svgToString } from "@/lib/svg-string";
import { tr } from "@/lib/i18n";
import { AXES, readCard, ROLES, SEALS, sliders, verdict } from "@/lib/voice-card";

/**
 * 목소리 사극 판정 이미지 — 두 벌.
 *  - 기본 1200×630: 링크 미리보기(OG)
 *  - fmt=story 1080×1920: 인스타 스토리에 그대로 올리는 세로 카드
 * 레이아웃·폰트 처리는 /api/og/weekly 와 같다. 디스플레이 서체엔 이모지가 없다.
 */
export const contentType = "image/png";

const RED = "#E0314B";
const VOLT = "#E8FF3A";
const ASH = "#8A8A92";
const HOST = "mimic-web-omega.vercel.app/voice";

async function subsetFont(family: string, text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=${family}&text=${encodeURIComponent(text)}`,
      { headers: { "User-Agent": "Mozilla/5.0" } },
    ).then((r) => r.text());
    const url = css.match(/src:\s*url\(([^)]+)\)/)?.[1];
    if (!url) return null;
    return await fetch(url).then((r) => r.arrayBuffer());
  } catch {
    return null;
  }
}

function Seal({ char, size }: { char: string; size: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: size * 0.14,
        background: RED,
        border: `${Math.round(size * 0.035)}px solid #FFF6EE`,
        boxShadow: `0 0 0 ${Math.round(size * 0.03)}px ${RED}`,
        color: "#FFF6EE",
        fontFamily: "Seal",
        fontSize: size * 0.6,
        transform: "rotate(-6deg)",
      }}
    >
      {char}
    </div>
  );
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const card = readCard(q);
  const story = q.get("fmt") === "story";
  // 그림의 글자는 보는 사람 언어(ui)로, 없으면 만든 사람 언어로.
  const ui = q.get("ui");
  const lang = ui === "en" || ui === "ko" ? ui : (card?.lang ?? "ko");
  const t = tr(lang);
  const v = card ? verdict(card) : null;
  const role = v?.role ?? null;

  const kicker = t("목소리 사극 판정", "VOICE CASTING");
  const lead = t("내 목소리, 사극에선", "In a period drama, my voice plays");
  const name = role ? t(`「${role.ko}」 역`, role.en) : t("너는 무슨 역?", "What's your role?");
  const why = role ? t(role.whyKo, role.whyEn) : "";
  const line = role ? `“${t(role.lineKo, role.lineEn)}”` : "";
  const lean = v?.lean ? t(`${ROLES[v.lean].ko} 기질 살짝`, `with a hint of ${ROLES[v.lean].en}`) : "";
  const best = role ? ROLES[role.best] : null;
  const rival = role ? ROLES[role.rival] : null;
  const pairText = best && rival ? `${t("찰떡", "Best")} ${t(best.ko, best.en)}${t("천적", "Rival")} ${t(rival.ko, rival.en)}` : "";
  const cta = t("너는 무슨 역?", "What's yours?");
  const axisText = AXES.map((a) => (lang === "en" ? a.en : a.ko).join("")).join("");
  const text = `${kicker}${lead}${name}${why}${line}${lean}${pairText}${cta}${axisText}${HOST}MIMIC`;
  const [font, sealFont] = await Promise.all([
    subsetFont("Black+Han+Sans", text),
    subsetFont("Noto+Serif+KR:wght@900", SEALS),
  ]);
  const fonts = [
    ...(font ? [{ name: "Display", data: font, weight: 400 as const, style: "normal" as const }] : []),
    ...(sealFont ? [{ name: "Seal", data: sealFont, weight: 900 as const, style: "normal" as const }] : []),
  ];

  const avatarSize = story ? 460 : 330;
  const svg = svgToString(<VoiceAvatar avatar={decodeAvatar(card?.avatar)} level={0.6} size={avatarSize} />);
  const avatarSrc = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  const seal = role?.seal ?? "?";
  const bg = {
    background: "#0A0A0B",
    backgroundImage: story
      ? "radial-gradient(circle at 50% 22%, rgba(224,49,75,0.35), transparent 45%), radial-gradient(circle at 90% 100%, rgba(232,255,58,0.14), transparent 50%)"
      : "radial-gradient(circle at 22% 45%, rgba(224,49,75,0.32), transparent 55%), radial-gradient(circle at 95% 95%, rgba(232,255,58,0.14), transparent 55%)",
    color: "#F5F5F7",
    fontFamily: font ? "Display" : "sans-serif",
  };
  const headers = { "cache-control": "public, max-age=86400, s-maxage=86400" };

  if (story) {
    const pos = card ? sliders(card) : [];
    return new ImageResponse(
      (
        <div style={{ ...bg, width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", padding: "110px 80px 90px" }}>
          <div style={{ display: "flex", fontSize: 38, letterSpacing: 8, color: ASH }}>{kicker}</div>
          <div style={{ display: "flex", alignItems: "flex-end", marginTop: 30 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatarSrc} width={avatarSize} height={avatarSize} alt="" />
            <div style={{ display: "flex", marginLeft: -90, marginBottom: 20 }}>
              <Seal char={seal} size={230} />
            </div>
          </div>
          <div style={{ display: "flex", fontSize: 46, color: ASH, marginTop: 30 }}>{lead}</div>
          <div style={{ display: "flex", fontSize: 128, lineHeight: 1.1, marginTop: 6, textAlign: "center" }}>{name}</div>
          {lean ? <div style={{ display: "flex", fontSize: 40, color: VOLT, marginTop: 10 }}>{lean}</div> : null}
          {why ? (
            <div style={{ display: "flex", fontSize: 44, lineHeight: 1.45, marginTop: 34, textAlign: "center", color: "#E6E6EA" }}>{why}</div>
          ) : null}
          {card ? (
            <div style={{ display: "flex", flexDirection: "column", width: "100%", marginTop: 46 }}>
              {AXES.map((a, i) => {
                const p = pos[i];
                if (p === null || p === undefined) return null;
                const l = lang === "en" ? a.en : a.ko;
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", marginBottom: 26, fontSize: 36 }}>
                    <div style={{ display: "flex", width: 170, color: p < 0.5 ? "#F5F5F7" : "#5D5D65" }}>{l[0]}</div>
                    <div style={{ display: "flex", flex: 1, height: 12, borderRadius: 999, background: "#26262A", position: "relative" }}>
                      <div
                        style={{
                          position: "absolute",
                          left: `${p * 100}%`,
                          top: -12,
                          width: 36,
                          height: 36,
                          marginLeft: -18,
                          borderRadius: 999,
                          background: p < 0.5 ? RED : VOLT,
                        }}
                      />
                    </div>
                    <div style={{ display: "flex", width: 170, justifyContent: "flex-end", color: p >= 0.5 ? "#F5F5F7" : "#5D5D65" }}>
                      {l[1]}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
          {line ? <div style={{ display: "flex", fontSize: 52, marginTop: 20, textAlign: "center" }}>{line}</div> : null}
          {best && rival ? (
            <div style={{ display: "flex", flexDirection: lang === "en" ? "column" : "row", alignItems: "center", marginTop: 44, fontSize: 38 }}>
              <div style={{ display: "flex", alignItems: "center", margin: lang === "en" ? "0 0 12px" : "0 50px 0 0" }}>
                <span style={{ color: ASH, marginRight: 14 }}>{t("찰떡", "Best")}</span>
                {t(best.ko, best.en)}
              </div>
              <div style={{ display: "flex", alignItems: "center" }}>
                <span style={{ color: ASH, marginRight: 14 }}>{t("천적", "Rival")}</span>
                {t(rival.ko, rival.en)}
              </div>
            </div>
          ) : null}
          <div style={{ display: "flex", flex: 1 }} />
          <div style={{ display: "flex", fontSize: 58, color: RED }}>{cta}</div>
          <div style={{ display: "flex", fontSize: 34, color: VOLT, marginTop: 14, letterSpacing: 2 }}>{HOST}</div>
        </div>
      ),
      { width: 1080, height: 1920, headers, fonts },
    );
  }

  return new ImageResponse(
    (
      <div style={{ ...bg, width: "100%", height: "100%", display: "flex", alignItems: "center", padding: "40px 60px 40px 50px" }}>
        <div style={{ display: "flex", alignItems: "flex-end" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={avatarSrc} width={avatarSize} height={avatarSize} alt="" />
          <div style={{ display: "flex", marginLeft: -80, marginBottom: 10 }}>
            <Seal char={seal} size={170} />
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, marginLeft: 40 }}>
          <div style={{ display: "flex", fontSize: 26, letterSpacing: 5, color: ASH }}>{kicker}</div>
          <div style={{ display: "flex", fontSize: 34, color: ASH, marginTop: 14 }}>{lead}</div>
          <div style={{ display: "flex", fontSize: 92, lineHeight: 1.1, marginTop: 4 }}>{name}</div>
          {line ? <div style={{ display: "flex", fontSize: 38, marginTop: 18 }}>{line}</div> : null}
          <div style={{ display: "flex", alignItems: "baseline", marginTop: 30 }}>
            <div style={{ display: "flex", fontSize: 40, color: RED }}>{cta}</div>
            <div style={{ display: "flex", fontSize: 26, letterSpacing: 6, color: VOLT, marginLeft: 24 }}>MIMIC</div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630, headers, fonts },
  );
}
