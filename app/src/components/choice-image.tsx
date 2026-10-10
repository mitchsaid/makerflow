"use client";

import { useRef, useState } from "react";
import { ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ACCEPT_ATTRIBUTE, imageUrl } from "@/lib/images";
import { uploadImage } from "@/lib/images/client";

/**
 * A small square button for a variation choice's own picture (docs/plans/variation-images.md): the picture when
 * it has one (pressing it chooses another), an image icon when not. The picture is uploaded as soon as it is
 * chosen and the id goes to whoever uses it, who attaches it when the person saves. Removing is the user's job
 * (a "Remove picture" button beside the price), and a picture is never deleted, only no longer pointed at.
 */
export function ChoiceImage({
  id,
  label,
  value,
  onChange,
  onProblem,
  onPendingChange,
}: {
  id: string;
  /** What the picture is for, in words: "Small". */
  label: string;
  /** The picture's id, or "" for none. */
  value: string;
  onChange: (imageId: string) => void;
  /** What went wrong (or null when it is fine again), for the row to show. */
  onProblem?: (message: string | null) => void;
  /** Tells the form a picture is on its way, so saving waits for it. */
  onPendingChange?: (pending: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function chosen(file: File | undefined) {
    if (!file) return;
    onProblem?.(null);
    setBusy(true);
    onPendingChange?.(true);
    const result = await uploadImage(file, "product");
    setBusy(false);
    onPendingChange?.(false);
    if (result.ok) onChange(result.id);
    else onProblem?.(result.error);
    // The same file can be chosen again later (after a problem, say).
    if (input.current) input.current.value = "";
  }

  return (
    <>
      <Button
        id={id}
        type="button"
        variant="outline"
        size="icon"
        className="size-11 overflow-hidden p-0"
        disabled={busy}
        aria-label={busy ? `${label}: uploading the picture` : value ? `${label}: replace the picture` : `${label}: add a picture`}
        onClick={() => input.current?.click()}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl(value, "thumb")} alt="" className="size-full object-cover" />
        ) : (
          <ImageIcon aria-hidden="true" className={busy ? "animate-pulse" : undefined} />
        )}
      </Button>
      {/* The browser's file chooser, opened by the button above; nothing to reach here. */}
      <input
        ref={input}
        id={`${id}-file`}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => void chosen(event.target.files?.[0])}
      />
    </>
  );
}
