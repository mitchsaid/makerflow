"use client";

import { useRef, useState } from "react";
import { AddButton } from "@/components/add-button";
import { Section } from "@/components/form-fields";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { bankPreview, type BankDetails, type BankPreview } from "@/lib/bank";
import { getLocalePack } from "@/lib/locale";
import { paymentWayView, type PaymentWayView } from "@/lib/payments";
import { AddWayToPaySheet } from "../business/add-way-to-pay-sheet";

/**
 * "How to pay" on a quote or an invoice (docs/plans/payment-methods.md): the EFT account and each other saved way to
 * pay, each with a tick to show it on this document (all on unless unticked), then the payment notes (passed as
 * children: a line for this document only). With nothing saved, the owner can add a way in a sheet over the document,
 * so nothing typed on it is lost; other members are told to ask the owner.
 */
export function PaymentWaysSection({
  document: documentName,
  bank,
  countryCode,
  canEdit,
  showBank,
  onShowBankChange,
  ways,
  hidden,
  onHiddenChange,
  onBankSaved,
  onWayAdded,
  children,
}: {
  /** "quote" or "invoice", for the ticks' words. */
  document: "quote" | "invoice";
  bank: BankPreview | null;
  countryCode: string;
  /** Only the owner can add or change ways to pay. */
  canEdit: boolean;
  showBank: boolean;
  onShowBankChange: (show: boolean) => void;
  ways: PaymentWayView[];
  /** Ids of the saved ways unticked on this document. */
  hidden: string[];
  onHiddenChange: (hidden: string[]) => void;
  onBankSaved: (bank: BankPreview) => void;
  onWayAdded: (way: PaymentWayView) => void;
  children: React.ReactNode;
}) {
  const locale = getLocalePack(countryCode);
  const bankName = locale.payment.bankTransferName;
  const [sheetOpen, setSheetOpen] = useState(false);
  const addButton = useRef<HTMLButtonElement>(null);
  const none = !bank && ways.length === 0;

  return (
    <Section title="How to pay">
      {none ? (
        <div className="space-y-2" data-testid="no-bank-details">
          <p className="text-base">
            {canEdit
              ? "No ways to pay yet. Add them once for every quote."
              : "No ways to pay yet. Ask the owner to add them."}
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {bank && (
            <Field orientation="horizontal" className="items-start py-2.5">
              <Checkbox
                id="showBankDetails"
                name="showBankDetails"
                checked={showBank}
                onCheckedChange={(checked) =>
                  onShowBankChange(checked === true)
                }
              />
              <FieldLabel
                htmlFor="showBankDetails"
                className="flex flex-col items-start text-base"
              >
                <span>
                  Show {bankName} on this {documentName}
                </span>
                <span
                  className="text-sm font-normal text-muted-foreground"
                  data-testid="bank-summary"
                >
                  {bank.summary}
                </span>
              </FieldLabel>
            </Field>
          )}
          {ways.map((way) => (
            <Field
              key={way.id}
              orientation="horizontal"
              className="items-start py-2.5"
            >
              <Checkbox
                id={`showWay-${way.id}`}
                checked={!hidden.includes(way.id)}
                onCheckedChange={(checked) =>
                  onHiddenChange(
                    checked === true
                      ? hidden.filter((id) => id !== way.id)
                      : [...hidden, way.id],
                  )
                }
              />
              <FieldLabel
                htmlFor={`showWay-${way.id}`}
                className="flex flex-col items-start text-base"
              >
                <span>
                  Show {way.name} on this {documentName}
                </span>
                <span className="text-sm font-normal text-muted-foreground">
                  {way.summary}
                </span>
              </FieldLabel>
            </Field>
          ))}
          <FieldDescription>
            {bank?.useReference
              ? `The ${documentName} number is the payment reference. `
              : ""}
            {canEdit
              ? "Change them in the Business profile."
              : "Only the owner can change the ways to pay."}
          </FieldDescription>
        </div>
      )}
      {canEdit && (
        <AddButton
          ref={addButton}
          className="w-full sm:w-auto"
          onClick={() => setSheetOpen(true)}
        >
          Add a way to pay
        </AddButton>
      )}

      {children}

      <AddWayToPaySheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        countryCode={countryCode}
        hasBank={bank !== null}
        idPrefix="sheet-"
        finalFocus={() => addButton.current ?? true}
        onBankSaved={(saved: BankDetails) => {
          onBankSaved(bankPreview(saved, locale)!);
          onShowBankChange(true);
        }}
        onMethodSaved={(saved) => {
          onWayAdded(paymentWayView(saved, locale));
          // A way added from a document is shown on it, whatever it is set to on new ones.
          onHiddenChange(hidden.filter((id) => id !== saved.id));
        }}
      />
    </Section>
  );
}
