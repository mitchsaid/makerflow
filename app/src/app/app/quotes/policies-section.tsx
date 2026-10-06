"use client";

import { useRef, useState } from "react";
import { ComingSoonSection } from "@/components/coming-soon";
import { Section, TextAreaField } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  copyForQuote,
  inLibraryOrder,
  POLICY_BODY_MAX,
  QUOTE_MAX_POLICIES,
  sortPolicies,
  type PolicyPackContent,
  type PolicySummary,
  type QuotePolicyValues,
} from "@/lib/policies";
import type { QuotePolicyError } from "@/lib/policies";
import { PolicyForm } from "../documents/policies/policy-form";

/**
 * The quote's policies: the business's saved policies as ticks. A ticked policy shows its wording,
 * which can be changed for this quote only (the saved policy is not touched). "Add a policy" opens
 * the same form as the library, in a sheet over the quote, so nothing typed on the quote is lost.
 */
export function PoliciesSection({
  value,
  onChange,
  library,
  onLibraryAdd,
  content,
  canManage,
  error,
  errorsByKey,
  newKey,
}: {
  value: QuotePolicyValues[];
  onChange: (policies: QuotePolicyValues[]) => void;
  library: PolicySummary[];
  onLibraryAdd: (policy: PolicySummary) => void;
  content: PolicyPackContent;
  canManage: boolean;
  error?: string;
  errorsByKey?: Record<string, QuotePolicyError>;
  newKey: () => string;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const addButton = useRef<HTMLButtonElement>(null);

  const active = sortPolicies(library.filter((p) => !p.archived));
  const copyOf = (policyId: string) => value.find((c) => c.policyId === policyId);
  // Copies whose saved policy has since been archived or isn't known: still on this quote.
  const orphans = value.filter((c) => !active.some((p) => p.id === c.policyId));
  const full = value.length >= QUOTE_MAX_POLICIES;

  function toggle(policy: PolicySummary, on: boolean) {
    if (on) onChange(inLibraryOrder([...value, copyForQuote(policy, newKey())], library));
    else onChange(value.filter((c) => c.policyId !== policy.id));
  }
  function edit(key: string, body: string) {
    onChange(value.map((c) => (c.key === key ? { ...c, body } : c)));
  }

  const body = (copy: QuotePolicyValues, saved: PolicySummary | undefined) => (
    <div className="space-y-2 pl-9">
      <TextAreaField
        id={`policy-${copy.key}-body`}
        label={`Wording for this quote: ${copy.title}`}
        value={copy.body}
        error={errorsByKey?.[copy.key]?.body ?? errorsByKey?.[copy.key]?.title}
        onChange={(v) => edit(copy.key, v)}
        maxLength={POLICY_BODY_MAX}
        rows={5}
      />
      {saved && copy.body !== saved.body && (
        <Button type="button" variant="outline" onClick={() => edit(copy.key, saved.body)}>
          Use the saved wording again
        </Button>
      )}
    </div>
  );

  return (
    <Section title="Policies">
      <p className="text-base text-muted-foreground">
        Tick the policies this quote should include.
      </p>
      {error && (
        <p id="policies-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {active.length === 0 && orphans.length === 0 && (
        <p className="text-base" data-testid="no-policies">
          {canManage
            ? "You haven't saved any policies yet. Add one and it's ready for every quote."
            : "No policies have been saved yet. Ask an owner or admin to add some."}
        </p>
      )}

      <ul className="space-y-4">
        {active.map((p) => {
          const copy = copyOf(p.id);
          return (
            <li key={p.id} className="space-y-2">
              <Field orientation="horizontal" className="items-start py-2.5">
                <Checkbox
                  id={`policy-${p.id}`}
                  checked={!!copy}
                  disabled={!copy && full}
                  onCheckedChange={(checked) => toggle(p, checked === true)}
                />
                <FieldLabel htmlFor={`policy-${p.id}`} className="text-base">
                  {p.title}
                </FieldLabel>
              </Field>
              {/* A glimpse of the wording until it is ticked (then the wording itself is shown). */}
              {copy ? body(copy, p) : <p className="-mt-2 line-clamp-1 pl-9 text-sm text-muted-foreground">{p.body}</p>}
            </li>
          );
        })}
        {orphans.map((c) => (
          <li key={c.key} className="space-y-2">
            <div className="flex min-h-11 items-center justify-between gap-3">
              <p className="text-base">
                {c.title}
                <span className="block text-sm text-muted-foreground">No longer in your saved policies</span>
              </p>
              <Button type="button" variant="ghost" onClick={() => onChange(value.filter((x) => x.key !== c.key))}>
                Remove<span className="sr-only"> {c.title}</span>
              </Button>
            </div>
            {body(c, undefined)}
          </li>
        ))}
      </ul>
      {full && (
        <p className="text-sm text-muted-foreground">
          A quote can have up to {QUOTE_MAX_POLICIES} policies. Untick one to add another.
        </p>
      )}

      {canManage && (
        <Button ref={addButton} type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setSheetOpen(true)}>
          Add a policy
        </Button>
      )}

      <ComingSoonSection
        title="Customer agrees to the policies"
        description="With online quotes, your customer reads the policies and agrees to them when they accept, and you see when."
      />

      <Sheet open={sheetOpen} onOpenChange={(open) => !open && !saving && setSheetOpen(false)}>
        <SheetContent
          side="right"
          className="h-dvh gap-0 overflow-y-auto"
          finalFocus={() => addButton.current ?? true}
        >
          <SheetHeader className="sticky top-0 z-10 border-b border-border bg-popover pr-14">
            <SheetTitle className="text-lg">Add a policy</SheetTitle>
            <SheetDescription className="text-base">
              {full
                ? `It is saved to your policies. This quote already has ${QUOTE_MAX_POLICIES} policies, so it is not added to it. Your quote is kept as it is.`
                : "It is saved to your policies and added to this quote. Your quote is kept as it is."}
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pt-4">
            <PolicyForm
              key={sheetOpen ? "open" : "closed"}
              initial={{ title: "", body: "", includeByDefault: false }}
              policyId={null}
              content={content}
              idPrefix="policy-sheet-"
              embedded={{
                onPendingChange: setSaving,
                onCancel: () => setSheetOpen(false),
                onDone: (policy) => {
                  onLibraryAdd(policy);
                  if (!full) onChange(inLibraryOrder([...value, copyForQuote(policy, newKey())], [...library, policy]));
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
