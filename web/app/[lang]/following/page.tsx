import type { Metadata } from "next";
import { InboxTabs } from "@/components/social/inbox-tabs";
import { getT } from "@/lib/i18n-server";
import { FollowingList } from "./following-list";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("구독 중", "Following"), robots: { index: false } };
}

/** 내가 구독한 목소리 — 이번 주에 새로 올린 사람이 위로. 손님도 본다(기기로 구독). */
export default function FollowingPage() {
  return (
    <main className="shell">
      <InboxTabs active="following" />
      <FollowingList />
    </main>
  );
}
