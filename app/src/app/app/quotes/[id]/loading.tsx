import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Shown while a quote opens (a draft to edit, or a sent quote): a heading and a few cards, not the Quotes list. */
export default function QuoteLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading"
      data-testid="page-loading"
      className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8"
    >
      <div className="flex items-center gap-3">
        <Skeleton className="size-11 rounded-lg" />
        <Skeleton className="h-7 w-48" />
      </div>
      <Skeleton className="h-12 w-full rounded-lg" />
      {[0, 1, 2].map((i) => (
        <Card key={i} className="px-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-11 w-full" />
        </Card>
      ))}
    </main>
  );
}
