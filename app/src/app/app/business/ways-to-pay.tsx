"use client";

import { useRef, useState } from "react";
import { AddButton } from "@/components/add-button";
import type { BankFormValues } from "@/lib/bank";
import { sortPaymentMethods, type PaymentMethod } from "@/lib/payments";
import { AddWayToPaySheet } from "./add-way-to-pay-sheet";
import { BankDetailsForm } from "./bank-details-form";
import { PaymentMethodForm } from "./payment-method-form";

/**
 * Business profile > Ways to pay (docs/plans/payment-methods.md): the bank account (EFT) and each other way a customer
 * can pay, one card each, with "Add a way to pay" at the end. Only the owner can change them (the page shows everyone
 * else a read-only list instead).
 */
export function WaysToPay({
  countryCode,
  bankInitial,
  bankLastChanged,
  initialMethods,
}: {
  countryCode: string;
  bankInitial: BankFormValues;
  bankLastChanged: string | null;
  initialMethods: PaymentMethod[];
}) {
  const [methods, setMethods] = useState(initialMethods);
  const [adding, setAdding] = useState(false);
  const addButton = useRef<HTMLButtonElement>(null);

  return (
    <div className="space-y-4">
      {/* The one bank account: its form is always here (empty until it is saved), so the EFT is never added by sheet. */}
      <BankDetailsForm initial={bankInitial} countryCode={countryCode} lastChanged={bankLastChanged} />

      {methods.map((method) => (
        <PaymentMethodForm
          key={method.id}
          method={method}
          kind={method.kind}
          countryCode={countryCode}
          onSaved={(saved) =>
            setMethods((list) =>
              sortPaymentMethods(
                list.map((m) => (m.id === saved.id ? saved : m)),
              ),
            )
          }
          onRemoved={(id) =>
            setMethods((list) => list.filter((m) => m.id !== id))
          }
        />
      ))}

      <AddButton
        ref={addButton}
        className="w-full sm:w-auto"
        onClick={() => setAdding(true)}
      >
        Add a way to pay
      </AddButton>

      <AddWayToPaySheet
        open={adding}
        onClose={() => setAdding(false)}
        countryCode={countryCode}
        hasBank
        idPrefix="tab-"
        finalFocus={() => addButton.current ?? true}
        onBankSaved={() => {}}
        onMethodSaved={(saved) =>
          setMethods((list) => sortPaymentMethods([...list, saved]))
        }
      />
    </div>
  );
}
