"use client";

import { DefaultAmountForm, type DefaultAmountKind } from "./default-amount-form";
import { saveDepositDefault } from "./deposit-actions";

/**
 * Quotes and invoices > Deposit: what a new quote starts with (or "I decide on each quote"). Each quote can change it or
 * switch it off; changing it here never changes a quote that exists.
 */
export function DepositDefaultForm({
  initial,
  symbol,
}: {
  initial: { kind: "none" | "percent" | "fixed" | "ask"; value: string };
  symbol: string;
}) {
  return (
    <DefaultAmountForm
      formId="deposit-default"
      title="Deposit"
      intro="Set what every new quote starts with, or choose “I decide on each quote” and a new quote opens with the deposit choice in front of you. You can change it on any quote."
      selectId="defaultDepositKind"
      options={[
        { value: "none", label: "No deposit" },
        { value: "ask", label: "I decide on each quote" },
        { value: "percent", label: "A percentage of the total" },
        { value: "fixed", label: "A fixed amount" },
      ]}
      valueId="defaultDepositValue"
      valueLabels={{ percent: "Percentage (%)", fixed: "Amount" }}
      valueErrorKey="depositValue"
      summaryLabel="Deposit"
      submitLabel="Save deposit"
      initial={initial as { kind: DefaultAmountKind; value: string }}
      symbol={symbol}
      save={(values) => saveDepositDefault({ kind: values.kind as "none" | "percent" | "fixed" | "ask", value: values.value })}
    />
  );
}
