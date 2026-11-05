"use client";

import { useEffect } from "react";
import { track, type TrackKind } from "@/lib/track";

/** 서버 화면에서 "열었다"를 한 번 남길 때 — 그리는 것은 없다. */
export function TrackMount({ kind, via }: { kind: TrackKind; via?: string }) {
  useEffect(() => {
    track(kind, via ? { via } : {});
  }, [kind, via]);
  return null;
}
