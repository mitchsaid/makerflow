import { imageUrl } from "@/lib/images";
import { cn } from "@/lib/utils";

const SIZES = { sm: "size-10", md: "size-12", lg: "size-14" } as const;

/**
 * A product's (or a choice's) photo, shown small in a list or row: the thumbnail copy, square, rounded. With no photo it
 * shows nothing, or with `keepSpace` an empty square, so rows that have a photo and rows that do not still line up.
 */
export function PhotoThumb({
  imageId,
  size = "sm",
  keepSpace = false,
  className,
}: {
  /** The picture's id, or null/undefined for none. */
  imageId: string | null | undefined;
  size?: keyof typeof SIZES;
  keepSpace?: boolean;
  className?: string;
}) {
  const box = cn(SIZES[size], "shrink-0 self-center overflow-hidden rounded-md ring-1 ring-foreground/10", className);
  if (!imageId) return keepSpace ? <span aria-hidden="true" className={cn(box, "bg-muted")} /> : null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={imageUrl(imageId, "thumb")} alt="" loading="lazy" className={cn(box, "object-cover")} />
  );
}
