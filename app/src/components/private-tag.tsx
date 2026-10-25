/**
 * A small tag beside a title or a label for what never reaches the customer (costs, margins, private notes): said once,
 * in a word, instead of a sentence on every screen (docs/ux-review-2026-10-25.md, N5). Screen readers get the fuller
 * phrase. Team members see these too, so the tag does not say "only you".
 */
export function PrivateTag({ id }: { id?: string }) {
  return (
    <span id={id} className="ml-2 inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 align-middle text-xs font-medium text-muted-foreground">
      Private<span className="sr-only"> (never shown to your customer)</span>
    </span>
  );
}
