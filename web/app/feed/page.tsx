import type { Metadata } from "next";
import { loadFeed, parseSort } from "@/lib/feed";
import { createClient } from "@/lib/supabase/server";
import { Feed } from "./feed";

export const metadata: Metadata = {
  title: "피드",
  description: "다른 사람들이 명대사를 어떻게 따라했는지 원본이랑 나란히 들어봐.",
};

type Props = { searchParams: Promise<{ tab?: string; r?: string }> };

/**
 * 따라하기 피드 — 원본 한 번, 그 사람 목소리 한 번. 위로 넘기면 다음 사람.
 *
 * 첫 페이지는 서버에서 채워서 보낸다. 링크를 누르고 빈 화면에서 로딩을 기다리게
 * 하면 대부분 닫는다. 탭(?tab=)을 바꾸면 이 페이지를 다시 그린다 — key 로 피드를
 * 새로 마운트해서 스크롤·재생 상태가 섞이지 않게 한다.
 *
 * ?r={녹음 id} 는 그 녹음을 첫 장에 고정한다 — 저장 직후 "피드에서 보기", 공유 링크.
 */
export default async function FeedPage({ searchParams }: Props) {
  const { tab, r } = await searchParams;
  const sort = parseSort(tab);
  const pin = r ?? null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const viewerId = user?.id ?? null;

  const page = await loadFeed(supabase, { sort, pin, viewerId });

  return (
    <Feed
      key={`${sort}:${pin ?? ""}`}
      initial={page}
      sort={sort}
      viewerId={viewerId}
    />
  );
}
