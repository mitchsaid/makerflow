"use client";

import { useState, useTransition } from "react";
import { AddButton } from "@/components/add-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { BusinessType } from "@/lib/business-types";
import { priceEntryLabel, type LocalePack } from "@/lib/locale";
import type { VatSettings } from "@/lib/money";
import type { NumberStyle } from "@/lib/money/format";
import type { ProductSummary } from "@/lib/products";
import type { LineFormValues } from "@/lib/quotes";
import { vatChoicesFor } from "@/lib/quotes/vat-choices";
import { LineSheet, type LineSheetView } from "../../../quotes/line-sheet";
import { useItemSheetProducts } from "../../../quotes/use-item-sheet-products";
import { addJobItem } from "../../actions";

const OFFLINE = "Couldn't reach the server, so we can't tell whether the item was added. Check the job, then try again if it is not there.";

/**
 * Adding an item to a job that exists, with the same item sheet a quote uses (in its job mode: no prices). The sheet
 * opens at once. Saving it sends the one item and opens the job again. If that fails the item is kept here with the
 * reason, and "Try again" opens the sheet on it as it was typed.
 */
export function AddJobItemForm({
  jobId,
  products: initialProducts,
  numberStyle,
  currencyCode,
  vat,
  taxName,
  vatStatuses,
  businessTypes,
}: {
  jobId: string;
  products: ProductSummary[];
  numberStyle: NumberStyle;
  currencyCode: string;
  vat: VatSettings;
  taxName: string;
  vatStatuses: LocalePack["tax"]["statuses"];
  businessTypes: BusinessType[] | null;
}) {
  const { products, productSaved, newKey } = useItemSheetProducts(initialProducts);
  const [sheetView, setSheetView] = useState<LineSheetView | null>({ kind: "pick" });
  const [sheetOpen, setSheetOpen] = useState(true);
  const [failed, setFailed] = useState<{ line: LineFormValues; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function openSheet(view: LineSheetView) {
    setSheetView(view);
    setSheetOpen(true);
  }

  function saveLine(line: LineFormValues) {
    setFailed(null);
    setSheetOpen(false);
    startTransition(async () => {
      try {
        const result = await addJobItem(jobId, line);
        setFailed({ line, message: result.message });
      } catch (error) {
        // Adding the item ends by opening the job: that is a redirect, not a failure.
        const digest = (error as { digest?: unknown } | null)?.digest;
        if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) throw error;
        setFailed({ line, message: OFFLINE });
      }
    });
  }

  return (
    <div className="space-y-4">
      {pending && (
        <p role="status" className="text-base text-muted-foreground">
          Adding the item…
        </p>
      )}
      {failed && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            <span className="block font-medium">{failed.line.name.trim() || "The item"} was not added.</span>
            {failed.message}
          </AlertDescription>
        </Alert>
      )}
      {failed ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" id="add-item" onClick={() => openSheet({ kind: "configure", line: failed.line, isNew: true })}>
            Try again
          </Button>
        </div>
      ) : (
        !pending && (
          <AddButton id="add-item" onClick={() => openSheet({ kind: "pick" })}>
            Add an item
          </AddButton>
        )
      )}
      <LineSheet
        mode="job"
        open={sheetOpen}
        view={sheetView}
        products={products}
        numberStyle={numberStyle}
        currencyCode={currencyCode}
        priceLabel={priceEntryLabel(vat, taxName)}
        vatChoices={vatChoicesFor(vat, vatStatuses, numberStyle)}
        businessTypes={businessTypes}
        newKey={newKey}
        onView={openSheet}
        onClose={() => setSheetOpen(false)}
        onSaveLine={(line) => saveLine(line)}
        onRemoveLine={() => setSheetOpen(false)}
        onProductSaved={productSaved}
        focusOnClose={() => "add-item"}
      />
    </div>
  );
}
