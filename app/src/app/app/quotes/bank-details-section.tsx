"use client";

import { useRef, useState } from "react";
import { Section } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { bankPreview, type BankPreview } from "@/lib/bank";
import { getLocalePack } from "@/lib/locale";
import { emptyBankValues } from "@/lib/bank/form";
import { BankDetailsForm } from "../business/bank-details-form";

/**
 * "How to pay" on a quote: the business's saved bank details with a tick to show them on this
 * quote (on by default), then the free text for other ways to pay (passed as children). With no
 * details saved, the owner can add them in a sheet over the quote, so nothing typed on the quote is
 * lost; other members are told to ask the owner.
 */
export function BankDetailsSection({
  bank,
  countryCode,
  canEdit,
  show,
  onShowChange,
  onBankSaved,
  children,
}: {
  bank: BankPreview | null;
  countryCode: string;
  /** Only the owner can add or change bank details. */
  canEdit: boolean;
  show: boolean;
  onShowChange: (show: boolean) => void;
  onBankSaved: (bank: BankPreview) => void;
  children: React.ReactNode;
}) {
  const locale = getLocalePack(countryCode);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const addButton = useRef<HTMLButtonElement>(null);

  return (
    <Section title="How to pay">
      {bank ? (
        <>
          <Field orientation="horizontal" className="min-h-11 items-center">
            <Checkbox
              id="showBankDetails"
              name="showBankDetails"
              checked={show}
              onCheckedChange={(checked) => onShowChange(checked === true)}
            />
            <FieldLabel htmlFor="showBankDetails" className="flex flex-col items-start text-base">
              <span>Show my bank details on this quote</span>
              <span className="text-sm font-normal text-muted-foreground" data-testid="bank-summary">
                {bank.summary}
              </span>
            </FieldLabel>
          </Field>
          <FieldDescription>
            {bank.useReference ? "The quote number is shown as the payment reference. " : ""}
            {canEdit
              ? "You can change your bank details under Business profile."
              : "Only the owner can change the bank details."}
          </FieldDescription>
        </>
      ) : (
        <div className="space-y-2" data-testid="no-bank-details">
          <p className="text-base">
            {canEdit
              ? "You haven't saved your bank details yet. Add them once and they print on every quote."
              : "Your business hasn't saved its bank details yet. Ask the owner to add them."}
          </p>
          {canEdit && (
            <Button ref={addButton} type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setSheetOpen(true)}>
              Add bank details
            </Button>
          )}
        </div>
      )}

      {children}

      <Sheet open={sheetOpen} onOpenChange={(open) => !open && !saving && setSheetOpen(false)}>
        <SheetContent side="right" className="h-dvh gap-0 overflow-y-auto" finalFocus={() => addButton.current ?? true}>
          <SheetHeader className="sticky top-0 z-10 border-b border-border bg-popover pr-14">
            <SheetTitle className="text-lg">Add bank details</SheetTitle>
            <SheetDescription className="text-base">
              They are saved to your Business profile and shown on this quote. Your quote is kept as it is.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pt-4">
            <BankDetailsForm
              key={sheetOpen ? "open" : "closed"}
              initial={emptyBankValues(countryCode)}
              countryCode={countryCode}
              lastChanged={null}
              idPrefix="bank-sheet-"
              embedded={{
                onPendingChange: setSaving,
                onCancel: () => setSheetOpen(false),
                onDone: (saved) => {
                  onBankSaved(bankPreview(saved, locale)!);
                  onShowChange(true);
                  setSheetOpen(false);
                },
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </Section>
  );
}
