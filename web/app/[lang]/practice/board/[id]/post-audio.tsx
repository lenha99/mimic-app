"use client";

import { useRef } from "react";
import { track } from "@/lib/track";

/** 게시물 녹음 — 처음 재생할 때 한 번만 남긴다(들어주기까지 갔는지 보려고). */
export function PostAudio({ src, postId, className }: { src: string; postId: string; className?: string }) {
  const sent = useRef(false);
  return (
    <audio
      className={className}
      src={src}
      controls
      preload="metadata"
      onPlay={() => {
        if (sent.current) return;
        sent.current = true;
        track("board_play", { via: postId });
      }}
    />
  );
}
