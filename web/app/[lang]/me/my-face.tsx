"use client";

import { useLocalAvatar } from "@/components/use-local-avatar";
import { VoiceAvatar } from "@/components/voice-avatar";
import type { Avatar } from "@/lib/avatar";

/** 손님 캐릭터는 이 폰에 저장돼 있다 — 브라우저에서만 읽을 수 있어 여기서 그린다. */
export function MyFace({ fallback }: { fallback: Avatar }) {
  const local = useLocalAvatar();
  return <VoiceAvatar avatar={local ?? fallback} level={0} size={72} />;
}
