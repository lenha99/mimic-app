"use client";

import Link from "next/link";
import { useState } from "react";
import { useT } from "@/components/lang";
import { Judging, LineCard, MicError, OriginalPlayer, ScoreFail, ScoreView, ShoutButton } from "@/components/anime/parts";
import { useTake } from "@/components/anime/use-take";
import { scoreWithOriginal, useOriginal, useWarmScorer } from "@/components/anime/original";
import { animeLine, animeRefId, ANIME_LINES, silentScore, type HypeScore } from "@/lib/anime";
import { track } from "@/lib/track";
import s from "@/components/anime/anime.module.css";

// 원본 비교 점수만 남았다. 예전 추정치 기록(키에 :orig 없음)은 다른 자라 읽지 않는다.
const BEST = "mimic.anime.best";
const bestKey = (id: string) => `${id}:orig`;

function readBest(id: string): number | null {
  try {
    const all = JSON.parse(localStorage.getItem(BEST) ?? "{}") as Record<string, number>;
    return typeof all[bestKey(id)] === "number" ? all[bestKey(id)] : null;
  } catch {
    return null;
  }
}

function saveBest(id: string, v: number) {
  try {
    const all = JSON.parse(localStorage.getItem(BEST) ?? "{}") as Record<string, number>;
    if (!(all[bestKey(id)] >= v)) all[bestKey(id)] = v;
    localStorage.setItem(BEST, JSON.stringify(all));
  } catch {}
}

type Result = { kind: "score"; score: HypeScore; url: string; best: number | null } | { kind: "fail"; url: string };

/** 혼자 외치기 — 원본을 듣든 말든 외치면 원본과 견준 점수. 다시 하거나, 이 대사로 친구 대결 */
export default function Solo({ id }: { id: string }) {
  const t = useT();
  const line = animeLine(id)!;
  const take = useTake(line.span[1] + 3);
  const [result, setResult] = useState<Result | null>(null);
  const [judging, setJudging] = useState<number[] | null>(null);
  const refId = animeRefId(line);
  const original = useOriginal(refId);
  useWarmScorer();
  const idx = ANIME_LINES.findIndex((l) => l.id === id);
  const next = ANIME_LINES[(idx + 1) % ANIME_LINES.length];

  const go = async () => {
    setResult(null);
    const r = await take.start();
    if (!r) return;
    if (r.silent) {
      setResult({ kind: "score", score: silentScore(), url: r.url, best: null });
      return;
    }
    setJudging(r.env);
    const score = await scoreWithOriginal(refId, r.blob);
    setJudging(null);
    if (!score) {
      setResult({ kind: "fail", url: r.url });
      track("anime_take", { meme_id: id, via: "fail" });
      return;
    }
    const best = readBest(id);
    saveBest(id, score.total);
    setResult({ kind: "score", score, url: r.url, best });
    track("anime_take", { meme_id: id, via: `orig:${score.total}` });
  };

  const share = async () => {
    if (result?.kind !== "score") return;
    const url = `${location.origin}/anime/${id}`;
    const text = t(
      `「${line.say}」 원본 싱크로 ${result.score.total}점 — ${result.score.tier.ko}. 너도 외쳐 봐`,
      `"${line.en}" — ${result.score.total} vs the original (${result.score.tier.en}). Your turn`,
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
      {!judging && !result && <OriginalPlayer url={original} hue={line.hue} />}
      {judging ? (
        <Judging env={judging} hue={line.hue} />
      ) : !result ? (
        <>
          <ShoutButton phase={take.phase} count={take.count} level={take.level} onStart={go} onStop={take.stop} />
          <MicError kind={take.error} />
        </>
      ) : result.kind === "fail" ? (
        <ScoreFail url={result.url} onRetry={go} />
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
          <OriginalPlayer url={original} hue={line.hue} />
          <div className={s.row}>
            <button type="button" className={s.btn} onClick={go}>
              {t("한 번 더", "Again")}
            </button>
            <button type="button" className={s.btnAlt} onClick={share} disabled={result.score.silent}>
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
