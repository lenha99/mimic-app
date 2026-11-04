"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useT } from "@/components/lang";
import { LineCard, MicError, Replay, ScoreView, ShoutButton } from "@/components/anime/parts";
import { useTake } from "@/components/anime/use-take";
import {
  animeLine,
  animeRefId,
  ANIME_LINES,
  fromOriginal,
  hypeScore,
  type HypeScore,
  type OriginalScore,
} from "@/lib/anime";
import { clientId } from "@/lib/client-id";
import { track } from "@/lib/track";
import s from "@/components/anime/anime.module.css";

const BEST = "mimic.anime.best";

/**
 * 원본 클립이 올라가 있나 — /api/ref 가 200 이면 원본과 견줘 채점한다.
 * 픽커로 구간을 골라 올리기 전엔 404 이고, 그땐 브라우저 기합 점수(최대 89)로 간다.
 */
async function probeRef(id: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/ref/${id}`);
    if (!res.ok) return null;
    return URL.createObjectURL(await res.blob());
  } catch {
    return null;
  }
}

async function scoreWithOriginal(refId: string, takeUrl: string): Promise<HypeScore | null> {
  try {
    const blob = await (await fetch(takeUrl)).blob();
    const body = new FormData();
    body.append("file", blob, "recording.webm");
    const res = await fetch(
      `/api/score?meme_id=${encodeURIComponent(refId)}&profile=anime&client=${encodeURIComponent(clientId())}`,
      { method: "POST", body },
    );
    const data = (await res.json()) as OriginalScore & { error?: string };
    if (!res.ok || data.error || typeof data.score !== "number") return null;
    return fromOriginal(data);
  } catch {
    return null;
  }
}

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
  const [original, setOriginal] = useState<string | null>(null);
  const [judging, setJudging] = useState(false);
  const refId = animeRefId(line);

  useEffect(() => {
    let alive = true;
    let made: string | null = null;
    void probeRef(refId).then((u) => {
      made = u;
      if (alive) setOriginal(u);
      else if (u) URL.revokeObjectURL(u);
    });
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [refId]);
  const idx = ANIME_LINES.findIndex((l) => l.id === id);
  const next = ANIME_LINES[(idx + 1) % ANIME_LINES.length];

  const go = async () => {
    setResult(null);
    if (original) void fetch("/api/warm", { method: "POST" }).catch(() => {});
    const r = await take.start();
    if (!r) return;
    const local = hypeScore(r.analysis, line);
    let score = local;
    // 원본이 있으면 원본과 견준다. 무음은 서버까지 안 보낸다. 서버가 실패하면 추정치로.
    if (original && !local.silent) {
      setJudging(true);
      score = (await scoreWithOriginal(refId, r.url)) ?? local;
      setJudging(false);
    }
    // 원본 비교 점수와 추정치는 다른 자라 최고 기록을 따로 둔다.
    const key = score.estimate ? id : `${id}:orig`;
    const best = readBest(key);
    if (!score.silent) saveBest(key, score.total);
    setResult({ score, url: r.url, best });
    track("anime_take", { meme_id: id, via: `${score.estimate ? "est" : "orig"}:${score.total}` });
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
      {original && (
        <div className={s.row} style={{ justifyContent: "center", marginTop: 4 }}>
          <span className={s.note}>{t("원본 듣고 똑같이 →", "Hear the original →")}</span>
          <Replay url={original} small />
        </div>
      )}
      {judging ? (
        <p className={s.note} style={{ textAlign: "center", marginTop: 16 }}>
          {t("원본이랑 견주는 중…", "Comparing with the original…")}
        </p>
      ) : take.phase !== "done" || !result ? (
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
