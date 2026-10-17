/**
 * The note beside an amount that is added to a price (docs/ux-inputs.md, "An amount added to a price"): in smaller
 * text, the price it makes. Nothing is shown until there is something to say.
 */
export function AddedPrice({ note, beside = false }: { note: string | null; beside?: boolean }) {
  if (!note) return null;
  return (
    <p className={beside ? "flex min-h-11 min-w-0 items-center text-sm text-muted-foreground" : "text-sm text-muted-foreground"} data-testid="added-price">
      {note}
    </p>
  );
}
