import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Shown instantly while More loads, so a tap always responds right away. */
export default function MoreLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading"
      data-testid="page-loading"
      className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8"
    >
      <Skeleton className="h-7 w-24" />
      {[0, 1].map((i) => (
        <Card key={i} className="px-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-64" />
        </Card>
      ))}
    </main>
  );
}
