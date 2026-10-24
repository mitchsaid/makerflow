"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { JobStatus } from "@/lib/jobs";
import { moveJob } from "./actions";

const OFFLINE = "Couldn't reach the server. Check your connection and try again.";

/** Moving a job to another status from a button: one tap, the page refreshed after, the reason shown if refused. */
export function useMoveJob(jobId: string) {
  const router = useRouter();
  const refresh = () => router.refresh();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  /** `then` replaces the refresh when the move works (cancelling goes back to the list instead). */
  function move(to: JobStatus, then?: () => void) {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await moveJob(jobId, to);
        if (result.status === "done") (then ?? refresh)();
        else setMessage(result.message);
      } catch {
        setMessage(OFFLINE);
      }
    });
  }

  return { move, pending, message, router };
}
