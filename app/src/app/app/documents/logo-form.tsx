"use client";

import { useState, useTransition } from "react";
import { ImageField } from "@/components/image-field";
import { Section } from "@/components/form-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { saveLogo, type LogoState } from "./logo-actions";

/**
 * Quotes and invoices > Your logo. It is printed at the top of your quotes. Choose a picture, then
 * save; removing it only stops using it, quotes already sent keep theirs.
 */
export function LogoForm({ initial, businessName }: { initial: string; businessName: string }) {
  const [logo, setLogo] = useState(initial);
  const [state, setState] = useState<LogoState>({ status: "idle" });
  const [editedSinceSave, setEditedSinceSave] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEditedSinceSave(false);
    startTransition(async () => {
      try {
        setState(await saveLogo(logo));
      } catch {
        setEditedSinceSave(true);
        setState({ status: "error", message: "Couldn't reach the server, so nothing was saved. Check your connection and try again." });
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate id="logo">
      <Section title="Your logo">
        <p className="text-base text-muted-foreground">
          Printed at the top of your quotes. A PNG with a see-through background looks best; a square or wide
          picture both work.
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
      </Section>
      <div className="flex items-center gap-4">
        <Button type="submit" size="lg" disabled={pending || uploading}>
          {pending ? "Saving…" : "Save logo"}
        </Button>
        {state.status === "saved" && !editedSinceSave && (
          <p role="status" className="text-base">
            Saved.
          </p>
        )}
      </div>
    </form>
  );
}
