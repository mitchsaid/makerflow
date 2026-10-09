"use client";

import { useEffect, useRef, useState } from "react";
import { ComingSoonSection } from "@/components/coming-soon";
import { Section, TextAreaField, TextField } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  copyForQuote,
  inLibraryOrder,
  oneOffTerm,
  POLICY_BODY_MAX,
  POLICY_TITLE_MAX,
  QUOTE_MAX_POLICIES,
  sortPolicies,
  termName,
  type PolicyPackContent,
  type PolicySummary,
  type QuotePolicyValues,
} from "@/lib/policies";
import type { QuotePolicyError } from "@/lib/policies";
import { PolicyForm } from "../documents/policies/policy-form";

/**
 * The quote's terms (docs/plans/terms.md): the business's saved terms as ticks, and terms written
 * just for this quote. A ticked term shows its wording, which can be changed for this quote only
 * (the saved term is not touched). "Save a new term" opens the same form as the library, in a sheet
 * over the quote, so nothing typed on the quote is lost.
 */
export function TermsSection({
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
  // After "Add a term just for this quote", its first box takes focus.
  const [focusKey, setFocusKey] = useState<string | null>(null);
  useEffect(() => {
    if (focusKey) document.getElementById(`policy-${focusKey}-title`)?.focus();
  }, [focusKey]);

  const active = sortPolicies(library.filter((p) => !p.archived));
  const copyOf = (policyId: string) => value.find((c) => c.policyId !== "" && c.policyId === policyId);
  // Written just for this quote: no saved term behind it.
  const ownTerms = value.filter((c) => c.policyId === "");
  // Copies whose saved term has since been archived or isn't known: still on this quote.
  const orphans = value.filter((c) => c.policyId !== "" && !active.some((p) => p.id === c.policyId));
  const full = value.length >= QUOTE_MAX_POLICIES;

  function toggle(policy: PolicySummary, on: boolean) {
    if (on) onChange(inLibraryOrder([...value, copyForQuote(policy, newKey())], library));
    else onChange(value.filter((c) => c.policyId !== policy.id));
  }
  function edit(key: string, change: Partial<Pick<QuotePolicyValues, "title" | "body">>) {
    onChange(value.map((c) => (c.key === key ? { ...c, ...change } : c)));
  }
  function remove(key: string) {
    onChange(value.filter((c) => c.key !== key));
  }
  function addOwn() {
    const term = oneOffTerm(newKey());
    onChange([...value, term]);
    setFocusKey(term.key);
  }

  const wording = (copy: QuotePolicyValues, saved: PolicySummary | undefined) => (
    <div className="space-y-2 pl-9">
      <TextAreaField
        id={`policy-${copy.key}-body`}
        label={`Wording for this quote: ${termName(copy)}`}
        value={copy.body}
        error={errorsByKey?.[copy.key]?.body ?? errorsByKey?.[copy.key]?.title}
        onChange={(body) => edit(copy.key, { body })}
        maxLength={POLICY_BODY_MAX}
        rows={5}
      />
      {saved && copy.body !== saved.body && (
        <Button type="button" variant="outline" onClick={() => edit(copy.key, { body: saved.body })}>
          Use the saved wording again
        </Button>
      )}
    </div>
  );

  return (
    <Section title="Terms">
      <p className="text-base text-muted-foreground">
        Tick the terms this quote should include, or add one just for this quote.
      </p>
      {error && (
        <p id="policies-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {active.length === 0 && orphans.length === 0 && (
        <p className="text-base" data-testid="no-policies">
          {canManage
            ? "You haven't saved any terms yet. Save one and it's ready for every quote."
            : "No terms have been saved yet. Ask an owner or admin to add some."}
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
                  {termName(p)}
                </FieldLabel>
              </Field>
              {/* A glimpse of the wording until it is ticked (then the wording itself is shown). */}
              {copy ? wording(copy, p) : p.title && <p className="-mt-2 line-clamp-1 pl-9 text-sm text-muted-foreground">{p.body}</p>}
            </li>
          );
        })}
        {orphans.map((c) => (
          <li key={c.key} className="space-y-2">
            <div className="flex min-h-11 items-center justify-between gap-3">
              <p className="text-base">
                {termName(c)}
                <span className="block text-sm text-muted-foreground">No longer in your saved terms</span>
              </p>
              <Button type="button" variant="ghost" onClick={() => remove(c.key)}>
                Remove<span className="sr-only"> {termName(c)}</span>
              </Button>
            </div>
            {wording(c, undefined)}
          </li>
        ))}
      </ul>

      {ownTerms.length > 0 && (
        <ul className="space-y-4" aria-label="Just for this quote" data-testid="own-terms">
          {ownTerms.map((c, i) => {
            const label = ownTerms.length > 1 ? `Term just for this quote ${i + 1}` : "Term just for this quote";
            return (
              // A group, so a screen reader says which term its title and wording belong to.
              <li key={c.key} role="group" aria-labelledby={`policy-${c.key}-heading`} className="space-y-3 rounded-lg border border-border p-3">
                <div className="flex min-h-11 items-center justify-between gap-3">
                  <p id={`policy-${c.key}-heading`} className="text-base font-medium">
                    {label}
                  </p>
                  <Button type="button" variant="ghost" onClick={() => remove(c.key)}>
                    Remove<span className="sr-only"> {label.toLowerCase()}</span>
                  </Button>
                </div>
                <TextField
                  id={`policy-${c.key}-title`}
                  label="Title (optional)"
                  autoComplete="off"
                  maxLength={POLICY_TITLE_MAX}
                  value={c.title}
                  error={errorsByKey?.[c.key]?.title}
                  onChange={(title) => edit(c.key, { title })}
                  hint={i === 0 ? "Leave it empty for a short line, printed as a plain paragraph." : undefined}
                />
                <TextAreaField
                  id={`policy-${c.key}-body`}
                  label="Wording"
                  value={c.body}
                  error={errorsByKey?.[c.key]?.body}
                  onChange={(body) => edit(c.key, { body })}
                  maxLength={POLICY_BODY_MAX}
                  rows={4}
                />
              </li>
            );
          })}
        </ul>
      )}

      {full && (
        <p className="text-sm text-muted-foreground">
          A quote can have up to {QUOTE_MAX_POLICIES} terms. Untick or remove one to add another.
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="button" variant="outline" disabled={full} onClick={addOwn}>
          Add a term just for this quote
        </Button>
        {canManage && (
          <Button ref={addButton} type="button" variant="outline" onClick={() => setSheetOpen(true)}>
            Save a new term
          </Button>
        )}
      </div>

      <ComingSoonSection
        title="Customer agrees to the terms"
        description="With online quotes, your customer reads the terms and agrees to them when they accept, and you see when."
      />

      <Sheet open={sheetOpen} onOpenChange={(open) => !open && !saving && setSheetOpen(false)}>
        <SheetContent
          side="right"
          className="h-dvh gap-0 overflow-y-auto"
          finalFocus={() => addButton.current ?? true}
        >
          <SheetHeader className="sticky top-0 z-10 border-b border-border bg-popover pr-14">
            <SheetTitle className="text-lg">Save a new term</SheetTitle>
            <SheetDescription className="text-base">
              {full
                ? `It is saved to your terms. This quote already has ${QUOTE_MAX_POLICIES} terms, so it is not added to it. Your quote is kept as it is.`
                : "It is saved to your terms and added to this quote. Your quote is kept as it is."}
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
