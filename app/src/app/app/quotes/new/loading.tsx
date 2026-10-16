import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Shown while a new quote's form opens: its heading and the first sections. */
export default function NewQuoteLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading"
      data-testid="page-loading"
      className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8"
    >
      <Skeleton className="h-7 w-36" />
      {[0, 1, 2].map((i) => (
        <Card key={i} className="px-4">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-11 w-full" />
        </Card>
      ))}
    </main>
  );
}
