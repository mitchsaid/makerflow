import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shown the moment "Continue to preview" is tapped, while the quote is prepared: the shape of the preview itself (its
 * heading, a page of the quote, and the bar), so nothing else flashes in between (the Quotes list's loading shape
 * used to, which looked like flicker).
 */
export default function QuotePreviewLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading"
      data-testid="page-loading"
      className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8"
    >
      <div className="flex items-center gap-3">
        <Skeleton className="size-11 rounded-lg" />
        <Skeleton className="h-7 w-56" />
      </div>
      <div className="space-y-3">
        <Skeleton className="aspect-[1/1.414] w-full rounded-xl" />
        <p role="status" className="text-center text-sm text-muted-foreground">
          Preparing your preview…
        </p>
      </div>
      <div className="sticky bottom-14 z-10 -mx-4 -mb-8 transform-gpu border-t border-border bg-card px-4 py-3 md:bottom-0">
        <div className="mx-auto grid max-w-2xl grid-cols-2 gap-2 sm:flex sm:items-center">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12 rounded-lg sm:w-24" />
          ))}
          <Skeleton className="h-12 rounded-lg sm:flex-1" />
        </div>
      </div>
    </main>
  );
}
