"use client";

import { DefaultAmountForm } from "./default-amount-form";
import { saveDiscountDefault } from "./discount-actions";

/**
 * Quote settings > Discount: the discount on the whole quote that a new quote starts with, for a business that
 * usually gives one. Each quote can change it or take it off; changing it here never changes a quote that exists.
 */
export function DiscountDefaultForm({
  initial,
  symbol,
}: {
  initial: { kind: "none" | "percent" | "fixed"; value: string };
  symbol: string;
}) {
  return (
    <DefaultAmountForm
      formId="discount-default"
      title="Discount"
      intro="If you usually give a discount, new quotes start with it."
      selectId="defaultDiscountKind"
      selectLabel="Discount on a new quote"
      options={[
        { value: "none", label: "No discount" },
        { value: "percent", label: "A percentage" },
        { value: "fixed", label: "An amount" },
      ]}
      valueId="defaultDiscountValue"
      valueLabels={{ percent: "Discount (%)", fixed: "Discount amount" }}
      valueErrorKey="discountValue"
      summaryLabel="Discount"
      saveWhat="discount"
      initial={initial}
      symbol={symbol}
      save={(values) =>
        saveDiscountDefault({ kind: values.kind === "percent" || values.kind === "fixed" ? values.kind : "none", value: values.value })
      }
    />
  );
}
