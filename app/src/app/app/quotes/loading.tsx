import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Shown instantly while Quotes loads, so a tap always responds right away. */
export default function QuotesLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading"
      data-testid="page-loading"
      className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8"
    >
      <Skeleton className="h-7 w-28" />
      {[0, 1, 2].map((i) => (
        <Card key={i} className="px-4">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-64" />
        </Card>
      ))}
    </main>
  );
}
