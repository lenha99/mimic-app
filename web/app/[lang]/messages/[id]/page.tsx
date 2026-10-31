import { notFound, redirect } from "next/navigation";
import { currentUserId, threadFor } from "@/lib/social-server";
import Chat from "./chat";

export const dynamic = "force-dynamic";

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await currentUserId();
  if (!me) redirect(`/login?next=${encodeURIComponent(`/messages/${id}`)}`);
  const th = await threadFor(me, id);
  if (!th) notFound();
  return <Chat initial={th} me={me} />;
}
