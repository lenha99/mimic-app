import { ImageResponse } from "next/og";
import { Piano } from "@/components/piano";
import { VoiceAvatar } from "@/components/voice-avatar";
import { decodeAvatar } from "@/lib/avatar";
import { svgToString } from "@/lib/svg-string";
import { tr } from "@/lib/i18n";
import { noteName, readCard, summary, tierOf } from "@/lib/voice-range";

/**
 * 목소리 음역대 이미지 — 두 벌.
 *  - 기본 1200×630: 링크 미리보기(OG)
 *  - fmt=story 1080×1920: 인스타 스토리에 그대로 올리는 세로 카드
 * 건반은 화면과 같은 SVG 를 그림으로 넣는다. 디스플레이 서체엔 이모지가 없어 악기는 이름만.
 */
export const contentType = "image/png";

const VOLT = "#E8FF3A";
const PINK = "#FF2D78";
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

const dataUri = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const card = readCard(q);
  const story = q.get("fmt") === "story";
  // 그림의 글자는 보는 사람 언어(ui)로, 없으면 만든 사람 언어로.
  const ui = q.get("ui");
  const lang = ui === "en" || ui === "ko" ? ui : (card?.lang ?? "ko");
  const t = tr(lang);
  const s = card ? summary(card, lang) : null;

  const kicker = t("목소리 음역대", "VOCAL RANGE");
  const lead = s?.lead ?? t("내 목소리는", "My voice is");
  const headline = s?.headline ?? t("너의 고음 등급은?", "What's your tier?");
  const emoji = s?.emoji ?? "";
  // 등급 이름 길이가 제각각이다(영어가 특히 길다) — 한 줄에 들어가게 글자 크기를 맞춘다.
  const fit = (max: number, width: number) => Math.min(max, Math.floor(width / Math.max(1, headline.length * (lang === "en" ? 0.56 : 1) + (emoji ? 1.2 : 0))));
  const sub = s?.sub ?? "";
  const facts = s?.facts ?? [];
  const inst = s?.instrument ? t(s.instrument.ko, s.instrument.en) : "";
  const instLead = t("내 목소리를 악기로 치면", "If my voice were an instrument");
  const instWhy = s?.instrument ? t(s.instrument.whyKo, s.instrument.whyEn) : "";
  const cta = t("너는 무슨 등급?", "What's your tier?");
  const tiles = card
    ? ([
        [t("최저음", "Lowest"), card.low, card.low === null ? "" : t(tierOf("low", card.low, card.gender).tier.ko, tierOf("low", card.low, card.gender).tier.en)],
        [t("평소 목소리", "Speaking"), card.speak, ""],
        [t("최고음", "Highest"), card.high, card.high === null ? "" : t(tierOf("high", card.high, card.gender).tier.ko, tierOf("high", card.high, card.gender).tier.en)],
      ] as const)
    : [];
  const tileText = tiles.map(([l, v, tier]) => l + tier + (v === null ? "—" : noteName(v, lang).full)).join("");
  const text = `${kicker}${lead}${headline}${sub}${facts.join("")}${inst}${instLead}${instWhy}${cta}${tileText}${HOST}MIMIC—0123456789`;
  const font = await subsetFont("Black+Han+Sans", text);
  const fonts = font ? [{ name: "Display", data: font, weight: 400 as const, style: "normal" as const }] : [];

  const avatarSize = story ? 260 : 220;
  const avatarSrc = dataUri(svgToString(<VoiceAvatar avatar={decodeAvatar(card?.avatar)} level={0.6} size={avatarSize} />));
  const pianoW = story ? 940 : 1100;
  // 카드가 없으면(테스트 소개 미리보기) 예시 음역을 칠해 둔다.
  const pianoSvg = svgToString(
    <Piano low={card ? card.low : 45} high={card ? card.high : 69} speak={card?.speak} lang={lang} labels={false} width={pianoW} />,
  );
  const pianoSrc = dataUri(pianoSvg);
  // 건반 비율은 칸 수에 따라 달라진다 — SVG 에 적힌 높이를 그대로 쓴다.
  const pianoH = Number(pianoSvg.match(/height="([\d.]+)"/)?.[1] ?? pianoW * 0.19);

  const bg = {
    background: "#0A0A0B",
    backgroundImage: story
      ? "radial-gradient(circle at 50% 18%, rgba(232,255,58,0.18), transparent 45%), radial-gradient(circle at 90% 100%, rgba(0,229,255,0.14), transparent 50%)"
      : "radial-gradient(circle at 20% 30%, rgba(232,255,58,0.16), transparent 55%), radial-gradient(circle at 95% 95%, rgba(0,229,255,0.14), transparent 55%)",
    color: "#F5F5F7",
    fontFamily: font ? "Display" : "sans-serif",
  };
  const headers = { "cache-control": "public, max-age=86400, s-maxage=86400" };

  if (story) {
    return new ImageResponse(
      (
        <div style={{ ...bg, width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", padding: "100px 70px 90px" }}>
          <div style={{ display: "flex", fontSize: 36, letterSpacing: 8, color: ASH }}>{kicker}</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={avatarSrc} width={avatarSize} height={avatarSize} alt="" style={{ marginTop: 26 }} />
          <div style={{ display: "flex", fontSize: 44, color: ASH, marginTop: 18 }}>{lead}</div>
          <div style={{ display: "flex", fontSize: fit(150, 900), lineHeight: 1.1, color: VOLT, marginTop: 4 }}>{emoji ? `${emoji} ${headline}` : headline}</div>
          {sub ? <div style={{ display: "flex", fontSize: 50, marginTop: 10 }}>{sub}</div> : null}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pianoSrc} width={pianoW} height={pianoH} alt="" style={{ marginTop: 44 }} />
          {tiles.length ? (
            <div style={{ display: "flex", width: pianoW, marginTop: 28 }}>
              {tiles.map(([label, v, tier], i) => {
                const n = v === null ? null : noteName(v, lang);
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      flex: 1,
                      margin: i === 1 ? "0 16px" : 0,
                      padding: "22px 10px",
                      borderRadius: 28,
                      background: "#161618",
                    }}
                  >
                    <div style={{ display: "flex", fontSize: 30, color: ASH }}>{label}</div>
                    <div style={{ display: "flex", fontSize: 26, color: ASH, marginTop: 10 }}>{n ? n.octave : ""}</div>
                    <div style={{ display: "flex", fontSize: 62, color: i === 1 ? PINK : "#F5F5F7" }}>{n ? n.note : "—"}</div>
                    {tier ? <div style={{ display: "flex", fontSize: 28, color: VOLT, marginTop: 6 }}>{tier}</div> : null}
                  </div>
                );
              })}
            </div>
          ) : null}
          <div style={{ display: "flex", flexDirection: "column", width: pianoW, marginTop: 34 }}>
            {facts.slice(0, 3).map((f) => (
              <div key={f} style={{ display: "flex", alignItems: "center", fontSize: 38, marginBottom: 14 }}>
                <div style={{ display: "flex", width: 16, height: 16, borderRadius: 4, background: VOLT, marginRight: 20 }} />
                {f}
              </div>
            ))}
          </div>
          {inst ? (
            <div style={{ display: "flex", alignItems: "baseline", marginTop: 20, fontSize: 40 }}>
              <span style={{ color: ASH, marginRight: 18 }}>{instLead}</span>
              <span style={{ fontSize: 64 }}>{inst}</span>
            </div>
          ) : null}
          {instWhy ? (
            <div style={{ display: "flex", fontSize: 36, color: ASH, marginTop: 14, textAlign: "center", lineHeight: 1.45 }}>{instWhy}</div>
          ) : null}
          <div style={{ display: "flex", flex: 1 }} />
          <div style={{ display: "flex", fontSize: 62, color: VOLT }}>{cta}</div>
          <div style={{ display: "flex", fontSize: 32, color: ASH, marginTop: 14, letterSpacing: 2 }}>{HOST}</div>
        </div>
      ),
      { width: 1080, height: 1920, headers, fonts, emoji: "twemoji" },
    );
  }

  return new ImageResponse(
    (
      <div style={{ ...bg, width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: "44px 50px" }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={avatarSrc} width={avatarSize} height={avatarSize} alt="" />
          <div style={{ display: "flex", flexDirection: "column", marginLeft: 36, flex: 1 }}>
            <div style={{ display: "flex", fontSize: 26, letterSpacing: 5, color: ASH }}>{kicker}</div>
            <div style={{ display: "flex", fontSize: fit(102, 820), lineHeight: 1.1, color: VOLT, marginTop: 6 }}>{emoji ? `${emoji} ${headline}` : headline}</div>
            {sub ? <div style={{ display: "flex", fontSize: 40, marginTop: 6 }}>{sub}</div> : null}
            {inst ? <div style={{ display: "flex", fontSize: 32, color: ASH, marginTop: 10 }}>{`${instLead} · ${inst}`}</div> : null}
          </div>
        </div>
        <div style={{ display: "flex", flex: 1 }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={pianoSrc} width={pianoW} height={pianoH} alt="" />
        <div style={{ display: "flex", alignItems: "baseline", marginTop: 18 }}>
          <div style={{ display: "flex", fontSize: 36, color: VOLT }}>{cta}</div>
          <div style={{ display: "flex", fontSize: 24, letterSpacing: 6, color: ASH, marginLeft: 24 }}>MIMIC</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630, headers, fonts, emoji: "twemoji" },
  );
}
