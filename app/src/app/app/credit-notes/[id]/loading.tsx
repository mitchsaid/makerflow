import { Skeleton } from "@/components/ui/skeleton";

/** Shown instantly while a credit note loads. */
export default function CreditNoteLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading"
      data-testid="page-loading"
      className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8"
    >
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-11 w-40 rounded-lg" />
      <Skeleton className="aspect-[1/1.414] w-full rounded-md" />
    </main>
  );
}
