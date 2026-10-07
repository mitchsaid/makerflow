"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { ACCEPT_ATTRIBUTE, imageUrl, type ImageKind } from "@/lib/images";
import { uploadImage } from "@/lib/images/client";

/**
 * Choose, replace or remove a picture (a product photo or the logo). The picture is uploaded as
 * soon as it is chosen and the field holds its id; whoever uses the field attaches the id when the
 * person saves. A replaced or removed picture is only no longer pointed at: it is never deleted.
 */
export function ImageField({
  id,
  name,
  label,
  kind,
  value,
  onChange,
  alt,
  hint,
  error,
  shape = "square",
  onPendingChange,
}: {
  id: string;
  /** If given, the id is also sent with the form under this name. */
  name?: string;
  label: string;
  kind: ImageKind;
  /** The picture's id, or "" for none. */
  value: string;
  onChange: (imageId: string) => void;
  /** What the picture shows, for people who can't see it: "Photo of Wedding cake". */
  alt: string;
  hint?: string;
  error?: string;
  /** A photo is shown square; a logo keeps its own shape. */
  shape?: "square" | "free";
  /** Tells a sheet not to close while a picture is on its way. */
  onPendingChange?: (pending: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const shown = problem ?? error;

  async function chosen(file: File | undefined) {
    if (!file) return;
    setProblem(null);
    setBusy(true);
    onPendingChange?.(true);
    const result = await uploadImage(file, kind);
    setBusy(false);
    onPendingChange?.(false);
    if (result.ok) onChange(result.id);
    else setProblem(result.error);
    // The same file can be chosen again later (after a problem, say).
    if (input.current) input.current.value = "";
  }

  const describedBy = [hint ? `${id}-hint` : null, shown ? `${id}-error` : null].filter(Boolean).join(" ");

  return (
    <Field data-invalid={!!shown}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {name && <input type="hidden" name={name} value={value} />}
      <div className="flex items-center gap-4">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl(value, shape === "square" ? "thumb" : "display")}
            alt={alt}
            data-testid={`${id}-preview`}
            className={
              shape === "square"
                ? "size-24 shrink-0 rounded-lg object-cover ring-1 ring-foreground/10"
                : "max-h-20 max-w-48 shrink-0 rounded-lg object-contain ring-1 ring-foreground/10"
            }
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex size-24 shrink-0 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground"
          >
            No picture
          </div>
        )}
        <div className="flex flex-col items-start gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? "Uploading…" : value ? "Replace picture" : "Choose a picture"}
          </Button>
          {value && !busy && (
            <Button type="button" variant="ghost" onClick={() => onChange("")}>
              Remove<span className="sr-only"> picture</span>
            </Button>
          )}
        </div>
      </div>
      <input
        ref={input}
        id={id}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        className="sr-only"
        tabIndex={-1}
        aria-describedby={describedBy || undefined}
        aria-invalid={!!shown}
        onChange={(event) => void chosen(event.target.files?.[0])}
      />
      <p className="sr-only" role="status">
        {busy ? "Uploading the picture" : ""}
      </p>
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {shown && <FieldError id={`${id}-error`}>{shown}</FieldError>}
    </Field>
  );
}
