/**
 * The design choice is saved in the background a moment after the last tap, so the screen never waits
 * for it. Anything that reads the saved design (Send, Download) first calls waitForDesignSave() so it
 * never reads one that is a tap behind. One preview screen at a time, so one slot is enough.
 */
const scheduled = new Map<string, { timer: ReturnType<typeof setTimeout>; start: () => void }>();
let inFlight: Promise<void> = Promise.resolve();

/** Saves `run` for a quote after `delay` ms of quiet; a newer call for the same quote replaces one that has not started. */
export function scheduleDesignSave(quoteId: string, run: () => Promise<void>, delay = 300) {
  const waiting = scheduled.get(quoteId);
  if (waiting) clearTimeout(waiting.timer);
  const start = () => {
    scheduled.delete(quoteId);
    inFlight = inFlight.then(run, run);
  };
  scheduled.set(quoteId, { timer: setTimeout(start, delay), start });
}

/** Resolves when every tap so far is saved (starting the waiting saves at once). */
export async function waitForDesignSave(): Promise<void> {
  for (const waiting of [...scheduled.values()]) {
    clearTimeout(waiting.timer);
    waiting.start();
  }
  await inFlight.catch(() => undefined);
}
