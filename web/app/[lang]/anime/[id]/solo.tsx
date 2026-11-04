"use client";

import Link from "next/link";
import { useState } from "react";
import { useT } from "@/components/lang";
import { LineCard, MicError, ScoreView, ShoutButton } from "@/components/anime/parts";
import { useTake } from "@/components/anime/use-take";
import { animeLine, ANIME_LINES, hypeScore, type HypeScore } from "@/lib/anime";
import { track } from "@/lib/track";
import s from "@/components/anime/anime.module.css";

const BEST = "mimic.anime.best";

function readBest(id: string): number | null {
  try {
    const all = JSON.parse(localStorage.getItem(BEST) ?? "{}") as Record<string, number>;
    return typeof all[id] === "number" ? all[id] : null;
  } catch {
    return null;
  }
}

function saveBest(id: string, v: number) {
  try {
    const all = JSON.parse(localStorage.getItem(BEST) ?? "{}") as Record<string, number>;
    if (!(all[id] >= v)) all[id] = v;
    localStorage.setItem(BEST, JSON.stringify(all));
  } catch {}
}

/** 혼자 외치기 — 점수 받고, 다시 하거나, 이 대사로 친구 대결 */
export default function Solo({ id }: { id: string }) {
  const t = useT();
  const line = animeLine(id)!;
  const take = useTake(line.span[1] + 3);
  const [result, setResult] = useState<{ score: HypeScore; url: string; best: number | null } | null>(null);
  const idx = ANIME_LINES.findIndex((l) => l.id === id);
  const next = ANIME_LINES[(idx + 1) % ANIME_LINES.length];

  const go = async () => {
    setResult(null);
    const r = await take.start();
    if (!r) return;
    const score = hypeScore(r.analysis, line);
    const best = readBest(id);
    if (!score.silent) saveBest(id, score.total);
    setResult({ score, url: r.url, best });
    track("anime_take", { meme_id: id, via: String(score.total) });
  };

  const share = async () => {
    if (!result) return;
    const url = `${location.origin}/anime/${id}`;
    const text = t(
      `「${line.say}」 기합 ${result.score.total}점 — ${result.score.tier.ko}. 너도 외쳐 봐`,
      `"${line.en}" — hype ${result.score.total} (${result.score.tier.en}). Your turn`,
    );
    try {
      if (navigator.share) await navigator.share({ title: "MIMIC", text, url });
      else await navigator.clipboard.writeText(`${text} ${url}`);
    } catch {}
  };

  return (
    <main className={`shell ${s.page}`}>
      <Link href="/anime" className={s.back}>
        ‹ {t("애니 명대사", "Anime lines")}
      </Link>
      <LineCard line={line} big />
      {take.phase !== "done" || !result ? (
        <>
          <ShoutButton phase={take.phase} count={take.count} level={take.level} onStart={go} onStop={take.stop} />
          <MicError kind={take.error} />
        </>
      ) : (
        <>
          <ScoreView score={result.score} url={result.url} />
          {result.best !== null && !result.score.silent && (
            <p className={s.note} style={{ textAlign: "center", marginTop: 8 }}>
              {result.score.total > result.best
                ? t(`내 최고 기록 경신! (전에 ${result.best}점)`, `New best! (was ${result.best})`)
                : t(`내 최고 ${result.best}점`, `Your best: ${result.best}`)}
            </p>
          )}
          <div className={s.row}>
            <button type="button" className={s.btn} onClick={go}>
              {t("한 번 더", "Again")}
            </button>
            <button type="button" className={s.btnAlt} onClick={share}>
              {t("점수 자랑", "Share")}
            </button>
            <Link href={`/anime/duel?line=${id}`} className={`${s.btnAlt} ${s.wide}`}>
              {t("이 대사로 친구랑 대결 →", "Battle friends with this line →")}
            </Link>
          </div>
        </>
      )}
      <Link href={`/anime/${next.id}`} className={s.back} style={{ display: "block", marginTop: 18, textAlign: "center" }}>
        {t(`다음 대사: ${next.say} ›`, `Next: ${next.en} ›`)}
      </Link>
    </main>
  );
}
