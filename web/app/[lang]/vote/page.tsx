import Link from "next/link";
import { BackHome } from "@/components/back-home";
import { signAudio } from "@/lib/audio-url";
import { DEFAULT_AVATAR, normalizeAvatar } from "@/lib/avatar";
import { createClient } from "@/lib/supabase/server";
import { VoteMatch } from "./vote-match";
import { getLang } from "@/lib/i18n-server";
import { tr } from "@/lib/i18n";
import { memeText } from "@/lib/meme-i18n";
import styles from "./vote.module.css";

/**
 * TODO(Dev A/B 공유 계약, 이슈 #17): 게스트(비로그인) 투표 허용 여부가 아직 미결정이라
 * 지금은 로그인 유저만 투표 가능하게 막아둠.
 *
 * 매칭은 get_vote_matchup() RPC가 담당한다 — 노출(투표 등장) 횟수가 적은 순으로 우선하고,
 * 응모작이 2개 이상인 밈 중에서만 고른다. 그런 밈이 하나도 없으면 빈 결과가 온다.
 */
export default async function VotePage() {
  const lang = await getLang();
  const t = tr(lang);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="shell">
      <BackHome />
        <div className={styles.empty}>
          <h1 className={styles.title}>{t("🗳️ 투표하려면 로그인이 필요해요", "🗳️ Log in to vote")}</h1>
          <Link href="/login" className={styles.loginBtn}>
            {t("로그인하러 가기", "Log in")}
          </Link>
        </div>
      </main>
    );
  }

  const { data: matchup, error } = await supabase.rpc("get_vote_matchup", {
    p_exclude_user: user.id,
  });

  if (error || !matchup || matchup.length < 2) {
    return (
      <main className="shell">
      <BackHome />
        <p className={styles.empty}>
          {t(
            "아직 투표할 녹음이 없어요. 먼저 밈을 따라 해 보고 결과 화면에서 공개해 보세요!",
            "Nothing to vote on yet. Try a meme first and make it public from the result screen!",
          )}
        </p>
      </main>
    );
  }

  const [a, b] = matchup;
  const owners = [a.user_id, b.user_id].filter((id): id is string => id !== null);
  const [{ data: meme }, { data: profiles }, urls] = await Promise.all([
    supabase.from("memes").select("id, title, emoji").eq("id", a.meme_id).single(),
    owners.length
      ? supabase.from("profiles").select("id, avatar").in("id", owners)
      : Promise.resolve({ data: [] as { id: string; avatar: unknown }[] }),
    // 매치업은 RLS 를 통과해 온 공개 녹음뿐이라 여기서 서명해도 된다.
    signAudio([a.audio_path, b.audio_path]),
  ]);

  const avatarOf = (userId: string | null) =>
    normalizeAvatar(profiles?.find((p) => p.id === userId)?.avatar ?? DEFAULT_AVATAR);
  const card = (r: typeof a) => ({
    id: r.id,
    audioUrl: urls.get(r.audio_path) ?? null,
    avatar: avatarOf(r.user_id),
  });

  return (
    <main className="shell">
      <BackHome />
      <h1 className={styles.title}>
        {meme?.emoji} {meme ? memeText({ id: meme.id, title: meme.title, source: "" }, lang).title : ""} {t("배틀", "battle")}
      </h1>
      <p className={styles.sub}>{t("웃겨도 좋고, 똑같아도 좋아요. 끌리는 쪽에 투표하세요!", "Funniest or most accurate — vote for the one you like!")}</p>
      {/*
        key로 쌍을 묶어둬야 "다음 대결"이 동작한다 — router.refresh()는 서버 트리만
        다시 그리고 VoteMatch는 마운트된 채라, key가 없으면 picked 상태가 남아서
        새 쌍이 와도 "투표 완료" 화면에서 못 빠져나온다.
      */}
      <VoteMatch
        key={`${a.id}-${b.id}`}
        memeId={a.meme_id}
        recordingA={card(a)}
        recordingB={card(b)}
      />
    </main>
  );
}
