import { Button } from "@/components/ui/button";
import { imageUrl } from "@/lib/images";
import { parseMoney, parseQuantity } from "@/lib/money";
import type { LineFormValues } from "@/lib/quotes";
import { optionsPerItem } from "@/lib/quotes";

/** One line on the quote as a compact row: what it is, how many at what price, its total. Tap to edit (remove is in the sheet). */
export function LineRow({
  line,
  number,
  error,
  money,
  lineTotal,
  photoId,
  vatLabel,
  onEdit,
}: {
  line: LineFormValues;
  /** The VAT treatment's name when it is not the standard one. */
  vatLabel: string | null;
  number: number;
  /** The product's photo, shown small when the quote shows photos. */
  photoId: string | null;
  error?: string;
  money: (cents: number) => string;
  lineTotal: number | null;
  onEdit: () => void;
}) {
  const quantity = parseQuantity(line.quantity);
  const price = parseMoney(line.unitPrice);
  const name = line.name.trim() || `Item ${number}`;
  return (
    <li data-testid="quote-line">
      <Button
        id={`line-${line.key}-edit`}
        type="button"
        variant="outline"
        aria-describedby={error ? `line-${line.key}-error` : undefined}
        onClick={onEdit}
        className="h-auto min-h-14 w-full justify-between gap-3 px-3 py-2 text-left font-normal"
      >
        <span className="flex min-w-0 items-center gap-3">
          {photoId && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl(photoId, "thumb")}
              alt=""
              loading="lazy"
              className="size-10 shrink-0 rounded-md object-cover ring-1 ring-foreground/10"
            />
          )}
          <span className="min-w-0">
            <span className="block truncate text-base font-medium">
              <span className="sr-only">Edit </span>
              {name}
            </span>
            <span className="block truncate text-sm text-muted-foreground">
              {quantity.ok ? (line.unit.trim() ? `${line.quantity} ${line.unit.trim()}` : line.quantity) : "?"} ×{" "}
              {price.ok ? money(price.value + optionsPerItem(line.options ?? [])) : "?"}
              {line.variationName && ` · ${line.variationName}`}
              {(line.options?.length ?? 0) > 0 && ` · ${line.options!.length} ${line.options!.length === 1 ? "option" : "options"}`}
              {line.discountKind !== "none" && " · discount"}
              {vatLabel && ` · ${vatLabel}`}
              {!line.productId && " · one-off item"}
            </span>
          </span>
        </span>
        <span className="shrink-0 text-base font-medium">{lineTotal !== null ? money(lineTotal) : "–"}</span>
      </Button>
      {error && (
        <p className="px-1 pt-1 text-sm text-destructive" id={`line-${line.key}-error`}>
          {error}
        </p>
      )}
    </li>
  );
}
