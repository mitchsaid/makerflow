/**
 * A small tag beside a title for what only the maker sees (costs, margins): said once, in a word, instead of a sentence
 * on every screen. Screen readers get the fuller phrase.
 */
export function PrivateTag() {
  return (
    <span className="ml-2 inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 align-middle text-xs font-medium text-muted-foreground">
      Private<span className="sr-only"> (only you see this)</span>
    </span>
  );
}
