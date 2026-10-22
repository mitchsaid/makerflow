import { Skeleton } from "@/components/ui/skeleton";

/** Shown instantly while an invoice form loads. */
export default function NewInvoiceLoading() {
  return (
    <main aria-busy="true" aria-label="Loading" data-testid="page-loading" className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-11 w-full rounded-lg" />
      <Skeleton className="h-11 w-40 rounded-lg" />
      <Skeleton className="h-32 w-full rounded-lg" />
    </main>
  );
}
