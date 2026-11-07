import type { Metadata } from "next";
import { getT } from "@/lib/i18n-server";
import { bestOfWeek, liveScenes, premieredScenes, publicView } from "@/lib/relay-server";
import RelayHub from "./hub";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  const title = t("릴레이 더빙", "Relay Dubbing");
  const description = t(
    "한 줄만 녹음하면 여러 사람의 목소리로 장면이 완성돼요. 모험·애니·면접·뉴스·영화 장면을 같이 더빙해요.",
    "Record one line and a scene comes together in many voices.",
  );
  return { title, description, openGraph: { title, description } };
}

export default async function RelayPage() {
  const [live, done, best] = await Promise.all([
    liveScenes(null).catch(() => []),
    premieredScenes(12).catch(() => []),
    bestOfWeek().catch(() => null),
  ]);
  return (
    <RelayHub
      live={live.map(publicView)}
      premiered={done.map((s) => ({ id: s.id, title: s.title, hall: s.hall, genre: s.genre, premiereAt: s.premiere_at, listens: s.listens, director: s.director_name }))}
      best={best ? { id: best.id, title: best.title, listens: best.listens, logline: best.logline } : null}
    />
  );
}
