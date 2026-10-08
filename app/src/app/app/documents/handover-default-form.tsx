"use client";

import { useState, useTransition } from "react";
import { Section } from "@/components/form-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { saveHandoverDefault, type HandoverDefaultState } from "../quotes/setup-actions";

/**
 * Quotes and invoices > Delivery or collection: what a new quote starts with. Each quote can change it;
 * changing it here never changes a quote that exists.
 */
export function HandoverDefaultForm({ initial }: { initial: "none" | "collection" | "delivery" }) {
  const [value, setValue] = useState(initial);
  const [state, setState] = useState<HandoverDefaultState | null>(null);
  const [edited, setEdited] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <form
      noValidate
      id="handover-default"
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        setEdited(false);
        startTransition(async () => {
          try {
            setState(await saveHandoverDefault(value));
          } catch {
            setState({ status: "error", message: "Couldn't reach the server, so nothing was saved. Check your connection and try again." });
          }
        });
      }}
    >
      <Section title="Delivery or collection">
        <p className="text-base text-muted-foreground">
          If your customers usually collect, or you usually deliver, new quotes can start that way. You can change it
          on any quote.
        </p>
        {state?.status === "error" && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        )}
        <Field>
          <FieldLabel htmlFor="usualFulfilment">New quotes start with</FieldLabel>
          <NativeSelect
            id="usualFulfilment"
            value={value}
            onChange={(e) => {
              setEdited(true);
              setValue(e.target.value === "collection" ? "collection" : e.target.value === "delivery" ? "delivery" : "none");
            }}
          >
            <NativeSelectOption value="none">Not decided yet</NativeSelectOption>
            <NativeSelectOption value="collection">Collection (the customer collects)</NativeSelectOption>
            <NativeSelectOption value="delivery">Delivery (you deliver, with a fee)</NativeSelectOption>
          </NativeSelect>
        </Field>
      </Section>
      <div className="flex items-center gap-4">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        {state?.status === "saved" && !edited && (
          <p role="status" className="text-base">
            Saved.
          </p>
        )}
      </div>
    </form>
  );
}
