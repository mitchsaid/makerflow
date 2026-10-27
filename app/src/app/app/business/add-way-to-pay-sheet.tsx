"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { BankDetails } from "@/lib/bank";
import { emptyBankValues } from "@/lib/bank/form";
import { getLocalePack } from "@/lib/locale";
import type { PaymentMethod } from "@/lib/payments";
import { BankDetailsForm } from "./bank-details-form";
import { PaymentMethodForm } from "./payment-method-form";

/**
 * "Add a way to pay": pick the kind first (the country's list, with the bank transfer while no account is saved), then
 * fill in its details, in a sheet so nothing typed on the quote behind it is lost (docs/plans/payment-methods.md).
 * A kind that is planned but not built is listed as coming soon and cannot be picked.
 */
export function AddWayToPaySheet({
  open,
  onClose,
  countryCode,
  hasBank,
  idPrefix,
  finalFocus,
  onBankSaved,
  onMethodSaved,
}: {
  open: boolean;
  onClose: () => void;
  countryCode: string;
  /** The business already has its one bank account: the EFT is not offered again. */
  hasBank: boolean;
  idPrefix: string;
  finalFocus?: () => HTMLElement | null | true;
  onBankSaved: (bank: BankDetails) => void;
  onMethodSaved: (method: PaymentMethod) => void;
}) {
  const locale = getLocalePack(countryCode);
  const [pick, setPick] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Closing always starts the next opening at the list of kinds.
  const close = () => {
    setPick(null);
    onClose();
  };

  const bankName = locale.payment.bankTransferName;
  const picked = locale.payment.waysToPay.find((k) => k.kind === pick);
  const title =
    pick === "eft"
      ? `Add ${bankName}`
      : picked
        ? `Add ${/^[A-Z]{2,}/.test(picked.label) ? picked.label : picked.label.toLowerCase()}`
        : "Add a way to pay";

  return (
    <Sheet open={open} onOpenChange={(next) => !next && !saving && close()}>
      <SheetContent
        side="right"
        className="h-dvh gap-0 overflow-y-auto"
        finalFocus={finalFocus}
      >
        <SheetHeader className="sticky top-0 z-10 border-b border-border bg-popover pr-14">
          <SheetTitle className="text-lg">{title}</SheetTitle>
          <SheetDescription className="text-base">
            {pick
              ? "Saved to your Business profile and shown on this quote."
              : "Pick how customers can pay you."}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-3 px-4 pt-4">
          {pick === null && (
            <ul className="space-y-3" aria-label="Ways to pay">
              {!hasBank && (
                <li>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto w-full flex-col items-start gap-0.5 py-3 text-left"
                    onClick={() => setPick("eft")}
                  >
                    <span className="text-base font-medium">{bankName}</span>
                    <span className="whitespace-normal text-sm font-normal text-muted-foreground">
                      Your bank account, for a transfer.
                    </span>
                  </Button>
                </li>
              )}
              {locale.payment.waysToPay.map((k) => (
                <li key={k.kind}>
                  {k.available ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-auto w-full flex-col items-start gap-0.5 py-3 text-left"
                      onClick={() => setPick(k.kind)}
                    >
                      <span className="text-base font-medium">{k.label}</span>
                      <span className="whitespace-normal text-sm font-normal text-muted-foreground">
                        {k.description}
                      </span>
                    </Button>
                  ) : (
                    <div
                      className="rounded-xl border border-dashed border-border p-3"
                      data-testid="coming-soon"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-base font-medium">{k.label}</span>
                        <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                          Coming soon
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {k.description}
                      </p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          {pick === "eft" && (
            <BankDetailsForm
              key="eft"
              initial={emptyBankValues(countryCode)}
              countryCode={countryCode}
              lastChanged={null}
              idPrefix={idPrefix}
              embedded={{
                onPendingChange: setSaving,
                onCancel: () => setPick(null),
                onDone: (saved) => {
                  onBankSaved(saved);
                  close();
                },
              }}
            />
          )}
          {picked && (
            <PaymentMethodForm
              key={picked.kind}
              method={null}
              kind={picked.kind}
              countryCode={countryCode}
              idPrefix={idPrefix}
              embedded={{
                onPendingChange: setSaving,
                onCancel: () => setPick(null),
                onDone: (saved) => {
                  onMethodSaved(saved);
                  close();
                },
              }}
            />
          )}
          {pick === null && (
            <Button type="button" size="lg" variant="outline" onClick={close}>
              Cancel
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
