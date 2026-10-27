"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type AutoSaveResult = { ok: true } | { ok: false; message: string };
export type AutoSaveStatus = { status: "idle" } | { status: "saving" } | { status: "saved" } | { status: "error"; message: string };

const OFFLINE = "Couldn't reach the server, so this isn't saved yet. Check your connection; it tries again when you type or leave the box.";

/**
 * A free-text field that saves itself (docs/plans/ux-pass-3.md): a moment after the typing stops, when the person leaves the
 * field, and when the screen goes. There is no Save button, so there is nothing to forget. It is for ONE field with no
 * problems to show (a note); a form with several fields or checks keeps its Save button.
 *
 * One save runs at a time; what was typed while it ran is saved right after, so the last words always win. A problem
 * (too long, offline) is shown and the text is kept, and the next change tries again.
 */
export function useAutoSave({
  value,
  initial,
  save,
  delay = 800,
}: {
  /** What is in the field now. */
  value: string;
  /** What the server holds now. */
  initial: string;
  /** Saves the text; says what to show if it could not. */
  save: (value: string) => Promise<AutoSaveResult>;
  delay?: number;
}) {
  const [state, setState] = useState<AutoSaveStatus>({ status: "idle" });
  const saved = useRef(initial);
  const latest = useRef(value);
  const saveRef = useRef(save);
  const running = useRef(false);

  useEffect(() => {
    latest.current = value;
    saveRef.current = save;
  });

  const run = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      while (latest.current !== saved.current) {
        const sending = latest.current;
        setState({ status: "saving" });
        try {
          const result = await saveRef.current(sending);
          if (!result.ok) {
            setState({ status: "error", message: result.message });
            return;
          }
          saved.current = sending;
          setState({ status: "saved" });
        } catch {
          setState({ status: "error", message: OFFLINE });
          return;
        }
      }
    } finally {
      running.current = false;
    }
  }, []);

  // A moment after the typing stops.
  useEffect(() => {
    if (value === saved.current) return;
    const timer = setTimeout(() => void run(), delay);
    return () => clearTimeout(timer);
  }, [value, delay, run]);

  // When the screen goes, what is typed is saved too.
  useEffect(() => {
    return () => {
      if (latest.current !== saved.current) void run();
    };
  }, [run]);

  /** Call from the field's change handler: whatever was shown about the last save no longer describes the text. */
  const touch = useCallback(() => setState((s) => (s.status === "idle" ? s : { status: "idle" })), []);
  /** Call from the field's blur handler: save now. */
  const flush = useCallback(() => void run(), [run]);

  return { state, touch, flush };
}
