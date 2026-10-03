"use client";

import { useState, useTransition } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { reviseQuote } from "./issue-actions";
import { sharePdf, useCanSharePdf } from "./share-pdf";

const OFFLINE = "Couldn't reach the server. Check your connection and try again.";

/** Share or download the sent quote's PDF again, and revise it. */
export function SentQuoteActions({
  quoteId,
  number,
  version,
  latest,
}: {
  quoteId: string;
  number: string;
  /** The version whose PDF these buttons hand over. */
  version: number;
  /** Is this the latest sent version? Only the latest can be revised. */
  latest: boolean;
}) {
  const canShare = useCanSharePdf();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [revising, startRevising] = useTransition();

  const filename = `${number.replace(/[^A-Za-z0-9._-]/g, "_")}${version > 1 ? `-v${version}` : ""}.pdf`;

  async function share() {
    setMessage(null);
    setBusy(true);
    const outcome = await sharePdf(`/app/quotes/${quoteId}/pdf?version=${version}`, filename, `Quote ${number}`);
    setBusy(false);
    if (outcome === "failed") setMessage("Couldn't get the PDF. Check your connection and try again.");
  }

  function revise() {
    setMessage(null);
    startRevising(async () => {
      try {
        const result = await reviseQuote(quoteId);
        setMessage(result.message);
      } catch (error) {
        // Revising ends by opening the new draft: that is a redirect, not a failure.
        const digest = (error as { digest?: unknown } | null)?.digest;
        if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) throw error;
        setMessage(OFFLINE);
      }
    });
  }

  return (
    <div className="space-y-3">
      {message && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="button" size="lg" disabled={busy} onClick={share}>
          {busy ? "Getting the PDF…" : canShare ? "Share PDF" : "Download PDF"}
        </Button>
        {latest && (
          <Button type="button" size="lg" variant="outline" disabled={revising} onClick={revise}>
            {revising ? "Opening…" : "Revise this quote"}
          </Button>
        )}
      </div>
      {latest && (
        <p className="text-sm text-muted-foreground">
          Revising opens a new version to edit. It keeps the number {number}, and this version stays
          as it was sent until you send the new one.
        </p>
      )}
    </div>
  );
}
