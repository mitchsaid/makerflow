"use client";

import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { sharePdf, useCanSharePdf } from "../quotes/share-pdf";

/** Share or download the invoice's PDF. Nothing here changes the invoice. */
export function ShareInvoice({ invoiceId, number }: { invoiceId: string; number: string }) {
  const canShare = useCanSharePdf();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function share() {
    setMessage(null);
    setBusy(true);
    const outcome = await sharePdf(`/app/invoices/${invoiceId}/pdf`, `${number.replace(/[^A-Za-z0-9._-]/g, "_")}.pdf`, `Invoice ${number}`);
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
      <Button type="button" size="lg" disabled={busy} onClick={share}>
        {busy ? "Getting the PDF…" : canShare ? "Share PDF" : "Download PDF"}
      </Button>
    </div>
  );
}
