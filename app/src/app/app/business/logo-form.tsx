"use client";

import { useEffect, useState, useTransition } from "react";
import { ImageField } from "@/components/image-field";
import { Section } from "@/components/form-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SaveButton } from "@/components/save-button";
import { saveLogo, type LogoState } from "./logo-actions";

/**
 * Business profile > Your logo. It is printed at the top of your quotes. Choose a picture, then save;
 * removing it only stops using it, quotes already sent keep theirs.
 *
 * The quote preview opens the same form in a sheet while there is no logo (`embedded`, like the bank details
 * form on a quote): no card of its own, a Cancel button, and the sheet is told while a picture is uploading or
 * saving so it cannot be closed on it.
 */
export function LogoForm({
  initial,
  businessName,
  embedded,
}: {
  initial: string;
  businessName: string;
  embedded?: {
    onPendingChange: (busy: boolean) => void;
    onCancel: () => void;
    /** The logo is saved. */
    onDone: () => void;
  };
}) {
  const [logo, setLogo] = useState(initial);
  const [state, setState] = useState<LogoState>({ status: "idle" });
  const [editedSinceSave, setEditedSinceSave] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();

  const onPendingChange = embedded?.onPendingChange;
  useEffect(() => {
    onPendingChange?.(uploading || pending);
  }, [uploading, pending, onPendingChange]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // The sheet is a portal over the quote: this submit must not reach anything beneath it.
    event.stopPropagation();
    if (uploading) {
      setState({ status: "error", message: "Wait for the logo to finish uploading, then save." });
      return;
    }
    setEditedSinceSave(false);
    startTransition(async () => {
      try {
        const result = await saveLogo(logo);
        setState(result);
        if (result.status === "saved") embedded?.onDone();
      } catch {
        setEditedSinceSave(true);
        setState({ status: "error", message: "Couldn't reach the server, so nothing was saved. Try again." });
      }
    });
  }

  const fields = (
    <>
      <p className="text-base text-muted-foreground">
        Printed at the top of your quotes. A PNG with a clear background looks best.
      </p>
      {state.status === "error" && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
      <ImageField
        id="logoImage"
        label="Logo"
        kind="logo"
        shape="free"
        value={logo}
        alt={`${businessName} logo`}
        onChange={(id) => {
          setEditedSinceSave(true);
          setLogo(id);
        }}
        onPendingChange={setUploading}
      />
    </>
  );

  return (
    <form onSubmit={submit} className="space-y-4" noValidate id={embedded ? undefined : "logo"}>
      {embedded ? <div className="space-y-4">{fields}</div> : <Section title="Your logo">{fields}</Section>}
      {embedded ? (
        <div className="flex items-center gap-4">
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Saving…" : "Save logo"}
          </Button>
          <Button type="button" variant="outline" size="lg" disabled={pending} onClick={embedded.onCancel}>
            Cancel
          </Button>
        </div>
      ) : (
        <>
          {state.status === "saved" && !editedSinceSave && (
            <p role="status" className="text-base">
              Saved.
            </p>
          )}
          <SaveButton what="logo" pending={pending} />
        </>
      )}
    </form>
  );
}
