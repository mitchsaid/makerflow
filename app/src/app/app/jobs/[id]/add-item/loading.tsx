import { Skeleton } from "@/components/ui/skeleton";

/** Shown instantly while the add-an-item page loads, so a tap always responds right away. */
export default function AddJobItemLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading"
      data-testid="page-loading"
      className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8"
    >
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-7 w-64" />
      <Skeleton className="h-11 w-32 rounded-lg" />
    </main>
  );
}
