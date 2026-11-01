"use client";

import { useState, useTransition } from "react";
import Link from "@/components/app-link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { BusinessProfileForm, type FormValues } from "@/app/app/business/business-profile-form";
import { applyFound, FOUND_LIST_KEY, itemsAsList, READER_MAX_BYTES, type Reading } from "@/lib/reader";
import { cn } from "@/lib/utils";
import { readBusinessDocument } from "./actions";

const OFFLINE = "Couldn't reach the server, so nothing was read. Try again.";

/** A phone photo is often 5 to 10 MB: shrink it here (to a long side of 2000 px, as a JPEG) so it goes up quickly and fits. A PDF is sent as it is. */
async function prepare(file: File): Promise<File | string> {
  if (file.type === "application/pdf" || !file.type.startsWith("image/")) return file.size > READER_MAX_BYTES ? "That file is over 4 MB. Send a photo or screenshot of it instead." : file;
  if (file.size <= 1_500_000) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob || blob.size > READER_MAX_BYTES) return "That photo is too big to send. Try a screenshot of the quote instead.";
    return new File([blob], "document.jpg", { type: "image/jpeg" });
  } catch {
    return file.size > READER_MAX_BYTES ? "That photo is too big to send. Try a screenshot of the quote instead." : file;
  }
}

/**
 * "Coming from another tool?" (docs/plans/import-onboarding.md, slice 2): choose a recent quote or invoice, it is read,
 * and the Business profile form comes up with what was found already filled in, to check and save. Items found go on to
 * the product import's check. Nothing is saved until the maker saves it.
 */
export function StartFromDocument({
  initial,
  countryCode,
  skipHref,
  skipLabel,
}: {
  initial: FormValues;
  countryCode: string;
  /** Where "Start fresh" and "Done" go. */
  skipHref: string;
  skipLabel: string;
}) {
  const [file, setFile] = useState<File | undefined>();
  const [fileError, setFileError] = useState<string | undefined>();
  const [message, setMessage] = useState<string | null>(null);
  const [reading, setReading] = useState<Reading | null>(null);
  const [pending, startTransition] = useTransition();

  function read() {
    setMessage(null);
    if (!file) {
      setFileError("Choose a quote or invoice first: a PDF, or a photo or screenshot of it.");
      return;
    }
    startTransition(async () => {
      try {
        const ready = await prepare(file);
        if (typeof ready === "string") {
          setFileError(ready);
          return;
        }
        const body = new FormData();
        body.set("document", ready);
        const result = await readBusinessDocument(body);
        if (result.status === "error") setMessage(result.message);
        else setReading(result.reading);
      } catch {
        setMessage(OFFLINE);
      }
    });
  }

  if (reading) {
    const items = reading.items;
    const saveItems = () => {
      try {
        sessionStorage.setItem(FOUND_LIST_KEY, itemsAsList(items));
      } catch {
        // Without storage the list just isn't carried over; the import still opens.
      }
    };
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Here&apos;s what we found</h2>
          <p className="text-base text-muted-foreground">Check it, change anything that&apos;s wrong, then save. Nothing is saved until you do.</p>
          {reading.businessName && reading.businessName !== initial.name && (
            <p className="text-sm text-muted-foreground">The document says “{reading.businessName}”. Your business is called “{initial.name}”.</p>
          )}
        </div>
        <BusinessProfileForm
          initial={applyFound(initial, reading.business)}
          countryCode={countryCode}
          savedNote={
            <div className="flex flex-col gap-3">
              {items.length > 0 && (
                <Link href="/app/products/import?from=document" onClick={saveItems} className={cn(buttonVariants({ variant: "outline" }), "w-full")} data-testid="review-found-items">
                  {items.length === 1 ? "Review the 1 item we found as a product" : `Review the ${items.length} items we found as products`}
                </Link>
              )}
              <Link href={skipHref} className={cn(buttonVariants({ variant: items.length > 0 ? "ghost" : "default" }), "w-full")}>
                {skipLabel}
              </Link>
            </div>
          }
        />
        {items.length > 0 && <p className="text-sm text-muted-foreground">Found on the document: {items.length === 1 ? "1 item" : `${items.length} items`} with prices. You can add them as products after saving.</p>}
      </div>
    );
  }

  return (
    <form
      className="space-y-6"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        read();
      }}
    >
      <Field data-invalid={fileError ? true : undefined}>
        <FieldLabel htmlFor="document">A recent quote or invoice</FieldLabel>
        <FieldDescription>A PDF, or a photo or screenshot of it.</FieldDescription>
        <Input
          id="document"
          type="file"
          accept="application/pdf,image/png,image/jpeg,image/webp"
          aria-invalid={fileError ? true : undefined}
          aria-describedby={fileError ? "document-error" : undefined}
          onChange={(e) => {
            setFile(e.target.files?.[0]);
            setFileError(undefined);
            setMessage(null);
          }}
        />
        {fileError && <FieldError id="document-error">{fileError}</FieldError>}
      </Field>
      <p className="text-sm text-muted-foreground">
        It is sent to our AI provider to be read, and is not kept. Customer details on it are ignored.{" "}
        <Link href="/privacy#documents" className="underline underline-offset-2">
          How it is handled
        </Link>
      </p>
      {message && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col gap-3">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Reading… this can take up to a minute" : "Read it"}
        </Button>
        <Link href={skipHref} className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
          Start fresh
        </Link>
      </div>
    </form>
  );
}
