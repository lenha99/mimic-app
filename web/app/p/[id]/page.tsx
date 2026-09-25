import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { signAudio } from "@/lib/audio-url";
import { DEFAULT_AVATAR, normalizeAvatar } from "@/lib/avatar";
import { extraLine, getMemes } from "@/lib/memes";
import { createServiceClient } from "@/lib/supabase/service";
import { SharePlayer } from "./player";
import styles from "./share.module.css";

type Props = { params: Promise<{ id: string }> };

/**
 * 공유 링크 — 친구가 내 녹음을 내 캐릭터로 듣는 화면.
 *
 * 이 앱에서 제일 웃긴 건 점수가 아니라 "내 캐릭터가 내 목소리로 외치는 장면"이다.
 * 도전장이 숫자만 들고 가면 받은 사람은 그걸 못 본다. 여기서 보여주고, 바로 아래에
 * "나도 해보기"를 둔다 — 듣고 웃은 그 순간이 따라하고 싶은 순간이다.
 *
 * 조회는 service_role 로 id 하나만 한다. RLS 로 shared 를 열면 anon 이 목록으로
 * 긁어갈 수 있어서다. 링크(추측 불가 uuid)를 가진 사람만 들어온다.
 */
async function load(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const service = createServiceClient();
  const { data: rec } = await service
    .from("recordings")
    .select("id, user_id, meme_id, audio_path, score, grade, avatar, shared, is_public, hidden")
    .eq("id", id)
    .maybeSingle();
  if (!rec || rec.hidden || !(rec.shared || rec.is_public)) return null;

  const [{ memes }, profile, urls] = await Promise.all([
    getMemes({ includeDraft: true }),
    rec.user_id
      ? service.from("profiles").select("nickname, avatar").eq("id", rec.user_id).maybeSingle()
      : Promise.resolve({ data: null }),
    signAudio([rec.audio_path]),
  ]);
  const meme = memes.find((m) => m.id === rec.meme_id);
  if (!meme) return null;

  const avatarSource = rec.avatar ?? profile.data?.avatar ?? null;
  return {
    id: rec.id,
    meme,
    score: rec.score ?? 0,
    grade: rec.grade ?? "",
    nickname: profile.data?.nickname ?? null,
    avatar: avatarSource ? normalizeAvatar(avatarSource) : DEFAULT_AVATAR,
    audioUrl: urls.get(rec.audio_path) ?? null,
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const found = await load((await params).id);
  if (!found) return { title: "없는 녹음" };
  const { meme, score, nickname } = found;
  const who = nickname ?? "친구";
  const title = `${who}의 ${meme.title} ${score}점 — 들어봐`;
  const description = `${who}가 ${meme.title} 따라했어. 캐릭터가 목소리로 외치는 거 들어보고, 넘을 수 있으면 넘어봐.`;
  const card = new URLSearchParams({
    title: meme.title,
    source: meme.source ?? "",
    emoji: meme.emoji ?? "🎙",
    ...(extraLine(meme) ? { line: extraLine(meme)! } : {}),
    s: String(score),
  });
  const images = [{ url: `/api/og?${card}`, width: 1200, height: 630 }];
  return {
    title,
    description,
    openGraph: { title, description, type: "website", images },
    twitter: { card: "summary_large_image", title, description, images },
  };
}

export default async function SharePage({ params }: Props) {
  const found = await load((await params).id);
  if (!found) notFound();
  const { meme, score, grade, nickname, avatar, audioUrl } = found;

  return (
    <main className={`shell ${styles.page}`}>
      <SharePlayer
        memeId={meme.id}
        title={meme.title}
        line={meme.line ?? meme.title}
        emoji={meme.emoji ?? "🎙"}
        score={score}
        grade={grade}
        who={nickname}
        avatar={avatar}
        audioUrl={audioUrl}
      />
    </main>
  );
}
