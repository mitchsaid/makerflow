"use client";

import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { sharePdf, useCanSharePdf } from "../quotes/share-pdf";

/** Share or download a document's PDF (an invoice or a credit note). Nothing here changes the document. */
export function ShareDocument({ url, number, title }: { url: string; number: string; title: string }) {
  const canShare = useCanSharePdf();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function share() {
    setMessage(null);
    setBusy(true);
    const outcome = await sharePdf(url, `${number.replace(/[^A-Za-z0-9._-]/g, "_")}.pdf`, `${title} ${number}`);
    setBusy(false);
    if (outcome === "failed") setMessage("Couldn't get the PDF. Check your connection and try again.");
  }

  return (
    <div className="space-y-3">
      {message && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      {/* An issued document's PDF: handed over again, never the next step, so outlined (one filled button per screen). */}
      <Button type="button" size="lg" variant="outline" className="w-full sm:w-auto" disabled={busy} onClick={share}>
        {busy ? "Getting the PDF…" : canShare ? "Share PDF" : "Download PDF"}
      </Button>
    </div>
  );
}

/** The invoice's own: the same, for its PDF. */
export function ShareInvoice({ invoiceId, number }: { invoiceId: string; number: string }) {
  return <ShareDocument url={`/app/invoices/${invoiceId}/pdf`} number={number} title="Invoice" />;
}
