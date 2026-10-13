import { progressText, type JobProgress } from "@/lib/jobs";

/** "1 of 3 items made" with a bar under it. The bar is for the eye; the words carry the meaning. */
export function JobProgressBar({ progress }: { progress: JobProgress }) {
  const percent = progress.total === 0 ? 0 : Math.round((progress.made / progress.total) * 100);
  return (
    <div className="space-y-1.5" data-testid="job-progress">
      <p className="text-sm font-medium">{progressText(progress)}</p>
      <div
        role="progressbar"
        aria-label="Items made"
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-valuenow={progress.made}
        aria-valuetext={progressText(progress)}
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-emerald-600 transition-[width] dark:bg-emerald-500" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
