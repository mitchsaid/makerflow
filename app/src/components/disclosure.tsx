import { ChevronDownIcon } from "lucide-react";

/**
 * Something that is there when asked for and out of the way until then ("History" on a job): a native details element,
 * so it works without scripting and a screen reader says whether it is open. The summary is a full 44 px tap target.
 */
export function Disclosure({ title, children, testId }: { title: string; children: React.ReactNode; testId?: string }) {
  return (
    <details className="group space-y-4" data-testid={testId}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg text-base font-semibold marker:content-none focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDownIcon aria-hidden="true" className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-6">{children}</div>
    </details>
  );
}
