"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./vote.module.css";

type Recording = { id: string; audio_url: string; user_id: string | null };

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

function Card({ label, recording, onVote }: { label: string; recording: Recording; onVote: () => void }) {
  return (
    <div className={styles.card}>
      <span className={styles.cardLabel}>{label} · 익명</span>
      <audio controls src={recording.audio_url} className={styles.audio} />
      <button onClick={onVote} className={styles.voteBtn}>
        이 목소리에 투표
      </button>
    </div>
  );
}
