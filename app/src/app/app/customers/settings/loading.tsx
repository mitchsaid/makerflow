import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Shown instantly while Customer settings loads, so a tap always responds right away. */
export default function CustomerSettingsLoading() {
  return (
    <main aria-busy="true" aria-label="Loading" data-testid="page-loading" className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <Skeleton className="h-7 w-40" />
      <Card className="px-4">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-11 w-full rounded-lg" />
      </Card>
    </main>
  );
}
