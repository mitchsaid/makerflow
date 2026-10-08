/**
 * The design choice is saved in the background a moment after the last tap, so the screen never waits
 * for it. Anything that reads the saved design (Send, Download) first calls waitForDesignSave() so it
 * never reads one that is a tap behind. One preview screen at a time, so one slot is enough.
 */
let scheduled: { timer: ReturnType<typeof setTimeout>; run: () => Promise<void> } | null = null;
let inFlight: Promise<void> = Promise.resolve();

/** Saves `run` after `delay` ms of quiet; a newer call replaces an older one that has not started. */
export function scheduleDesignSave(run: () => Promise<void>, delay = 400) {
  if (scheduled) clearTimeout(scheduled.timer);
  const start = () => {
    scheduled = null;
    inFlight = inFlight.then(run, run);
    return inFlight;
  };
  scheduled = { timer: setTimeout(start, delay), run: start };
}

/** Resolves when every tap so far is saved (starting a waiting save at once). */
export async function waitForDesignSave(): Promise<void> {
  if (scheduled) {
    clearTimeout(scheduled.timer);
    scheduled.run();
  }
  await inFlight.catch(() => undefined);
}

/** Is a save waiting or running? (For the screen's own "saving" note.) */
export function designSavePending(): boolean {
  return scheduled !== null;
}
