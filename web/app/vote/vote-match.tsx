"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { usePlaybackLevel } from "@/components/use-playback-level";
import { VoiceAvatar } from "@/components/voice-avatar";
import type { Avatar } from "@/lib/avatar";
import { createClient } from "@/lib/supabase/client";
import styles from "./vote.module.css";

type Recording = {
  id: string;
  /** 서버가 서명한 짧은 URL. 서명이 실패하면 null — 카드는 뜨고 재생만 안 된다. */
  audioUrl: string | null;
  avatar: Avatar;
};

export function VoteMatch({
  memeId,
  recordingA,
  recordingB,
}: {
  memeId: string;
  recordingA: Recording;
  recordingB: Recording;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [picked, setPicked] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const vote = async (winnerId: string) => {
    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error: insertError } = await supabase.from("votes").insert({
      meme_id: memeId,
      recording_a_id: recordingA.id,
      recording_b_id: recordingB.id,
      winner_id: winnerId,
      voter_id: user.id,
    });

    if (insertError) {
      setError(
        insertError.code === "23505"
          ? "이 매치업엔 이미 투표했어요."
          : "투표에 실패했어요. 다시 시도해주세요.",
      );
      return;
    }
    setPicked(winnerId);
  };

  if (picked) {
    return (
      <div className={styles.done}>
        <p className={styles.doneText}>투표 완료! 고마워요 🎉</p>
        <button onClick={() => router.refresh()} className={styles.next}>
          다음 대결 ▶
        </button>
      </div>
    );
  }

  return (
    <div className={styles.matchList}>
      {error && <p className={styles.warn}>{error}</p>}
      <Card label="챌린저 A" recording={recordingA} onVote={() => vote(recordingA.id)} />
      <Card label="챌린저 B" recording={recordingB} onVote={() => vote(recordingB.id)} />
    </div>
  );
}

/**
 * 녹음 한 장. 재생하면 그 사람 캐릭터가 그 목소리로 입을 연다.
 * 닉네임은 안 보인다 — 누구 건지 알면 친구 쪽으로 표가 쏠린다.
 */
function Card({ label, recording, onVote }: { label: string; recording: Recording; onVote: () => void }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const level = usePlaybackLevel(audio, recording.audioUrl, playing);

  return (
    <div className={styles.card}>
      <span className={styles.cardLabel}>{label} · 익명</span>
      <div className={styles.performer}>
        <VoiceAvatar avatar={recording.avatar} level={level} size={104} />
      </div>
      {recording.audioUrl ? (
        <audio
          ref={audio}
          controls
          src={recording.audioUrl}
          className={styles.audio}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
        />
      ) : (
        <p className={styles.warn}>이 녹음을 불러오지 못했어요.</p>
      )}
      <button onClick={onVote} className={styles.voteBtn}>
        이 목소리에 투표
      </button>
    </div>
  );
}
