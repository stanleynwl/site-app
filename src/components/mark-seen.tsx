"use client";

import { useEffect, useRef } from "react";
import { markProgressSeen, markStagesSeen } from "@/lib/data/actions";

// Renders nothing — on mount it tells the server the office has viewed this
// project's Progress or Stages, clearing the "New" badge on the project page.
// Used on the office View-all pages.
export function MarkSeen({
  kind,
  projectId,
}: {
  kind: "progress" | "stages";
  projectId: string;
}) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const fn = kind === "progress" ? markProgressSeen : markStagesSeen;
    void fn(projectId);
  }, [kind, projectId]);
  return null;
}
