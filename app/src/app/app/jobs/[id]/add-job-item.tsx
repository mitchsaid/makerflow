"use client";

import { useState, useTransition } from "react";
import { AddButton } from "@/components/add-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { priceEntryLabel } from "@/lib/locale";
import type { LineFormValues } from "@/lib/quotes";
import { vatChoicesFor } from "@/lib/quotes/vat-choices";
import { LineSheet, type LineSheetView } from "../../quotes/line-sheet";
import { useItemSheetProducts } from "../../quotes/use-item-sheet-products";
import { addJobItem, loadJobItemSheet, type JobItemSheetData } from "../actions";

const OFFLINE = "Couldn't reach the server, so the item may not have been added. Check the job, then try again.";
const OFFLINE_OPEN = "Couldn't open the item sheet. Check your connection, then try again.";

/**
 * "Add an item" on a job's page: the same item sheet a quote uses (in its job mode: no prices), open over the job.
 * What the sheet needs (the products, the costing) is fetched when the button is pressed, so the page itself stays
 * light. Saving sends the one item and the job refreshes under the sheet. If that fails the item is kept here with
 * the reason, and "Try again" opens the sheet on it as it was typed.
 */
export function AddJobItem({ jobId }: { jobId: string }) {
  const [data, setData] = useState<JobItemSheetData | null>(null);
  const [opening, setOpening] = useState(false);
  const [openFailed, setOpenFailed] = useState<string | null>(null);
  const [sheetView, setSheetView] = useState<LineSheetView | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [failed, setFailed] = useState<{ line: LineFormValues; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const { products, productSaved, newKey } = useItemSheetProducts(data?.products ?? []);

  function openSheet(view: LineSheetView) {
    setSheetView(view);
    setSheetOpen(true);
  }

  async function openPicker() {
    setOpenFailed(null);
    if (data) return openSheet({ kind: "pick" });
    setOpening(true);
    try {
      const result = await loadJobItemSheet();
      if (result.status === "error") return setOpenFailed(result.message);
      setData(result.data);
      openSheet({ kind: "pick" });
    } catch {
      setOpenFailed(OFFLINE_OPEN);
    } finally {
      setOpening(false);
    }
  }

  function saveLine(line: LineFormValues) {
    setFailed(null);
    setSheetOpen(false);
    startTransition(async () => {
      try {
        const result = await addJobItem(jobId, line);
        setFailed({ line, message: result.message });
      } catch (error) {
        // Adding the item ends by opening the job again: that is a redirect, not a failure.
        const digest = (error as { digest?: unknown } | null)?.digest;
        if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) throw error;
        setFailed({ line, message: OFFLINE });
      }
    });
  }

  return (
    <div className="space-y-3">
      {pending && (
        <p role="status" className="text-base text-muted-foreground">
          Adding the item…
        </p>
      )}
      {(failed || openFailed) && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            {failed ? (
              <>
                <span className="block font-medium">{failed.line.name.trim() || "The item"} was not added.</span>
                {failed.message}
              </>
            ) : (
              openFailed
            )}
          </AlertDescription>
        </Alert>
      )}
      {failed ? (
        <Button type="button" id="add-item" onClick={() => openSheet({ kind: "configure", line: failed.line, isNew: true })}>
          Try again
        </Button>
      ) : (
        !pending && (
          <AddButton id="add-item" onClick={openPicker} aria-busy={opening}>
            Add an item
          </AddButton>
        )
      )}
      {data && (
        <LineSheet
          mode="job"
          open={sheetOpen}
          view={sheetView}
          products={products}
          numberStyle={data.numberStyle}
          currencyCode={data.currencyCode}
          priceLabel={priceEntryLabel(data.vat, data.taxName)}
          vatChoices={vatChoicesFor(data.vat, data.vatStatuses, data.numberStyle)}
          businessTypes={data.businessTypes}
          costing={data.costing}
          newKey={newKey}
          onView={openSheet}
          onClose={() => setSheetOpen(false)}
          onSaveLine={(line) => saveLine(line)}
          onRemoveLine={() => setSheetOpen(false)}
          onProductSaved={productSaved}
          focusOnClose={() => "add-item"}
        />
      )}
    </div>
  );
}
