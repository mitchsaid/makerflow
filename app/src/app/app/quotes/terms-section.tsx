"use client";

import { useEffect, useRef, useState } from "react";
import { AddButton } from "@/components/add-button";
import { Section, TextAreaField, TextField } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  copyForQuote,
  inLibraryOrder,
  POLICY_BODY_MAX,
  POLICY_TITLE_MAX,
  QUOTE_MAX_POLICIES,
  sortPolicies,
  termName,
  type PolicyPackContent,
  type PolicySummary,
  type QuotePolicyError,
  type QuotePolicyValues,
} from "@/lib/policies";
import { PolicyForm } from "./settings/policies/policy-form";
import { UseOnNewQuotes } from "./use-on-new-quotes";
import { setPolicyOnNewQuotes } from "./settings/policies/actions";

/**
 * The quote's terms (docs/plans/quote-form-feedback.md, slice C): the terms on this quote as compact rows, and one
 * "Add a term" that opens a sheet to pick from the business's saved terms or write a new one (create and use, as with
 * customers and products). Every term is a saved term. A term on the quote can have its wording changed for this
 * quote only (the saved term is not touched); the form is a sheet over the quote, so nothing typed on the quote is lost.
 * A term written just for one quote before this change still shows and can be edited or removed, but none is made now.
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
  const [view, setView] = useState<"pick" | "create">("pick");
  const [saving, setSaving] = useState(false);
  const addButton = useRef<HTMLButtonElement>(null);
  // Which terms have their wording open for changing (a term with a problem is always open).
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  // After Remove (its button goes with the term), focus moves to the add button, or to the section's own heading when
  // there is none (nothing left to add, or a person who cannot write terms).
  const [removed, setRemoved] = useState(0);
  const listTop = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (removed > 0) (addButton.current && !addButton.current.disabled ? addButton.current : listTop.current)?.focus();
  }, [removed]);
  // Opening a wording replaces the button that opened it: focus goes to the wording itself.
  const [focusKey, setFocusKey] = useState<string | null>(null);
  useEffect(() => {
    if (focusKey) document.getElementById(`policy-${focusKey}-body`)?.focus();
  }, [focusKey]);
  // Adding from the sheet takes the row (and its button) away: focus goes to Done, which is always there.
  const done = useRef<HTMLButtonElement>(null);

  const active = sortPolicies(library.filter((p) => !p.archived));
  const savedOf = (policyId: string) => active.find((p) => p.id === policyId);
  const full = value.length >= QUOTE_MAX_POLICIES;
  // The saved terms not on this quote yet.
  const available = active.filter((p) => !value.some((c) => c.policyId === p.id));

  function remove(key: string) {
    onChange(value.filter((c) => c.key !== key));
    setOpen((s) => {
      const next = new Set(s);
      next.delete(key);
      return next;
    });
    setRemoved((n) => n + 1);
  }
  function edit(key: string, change: Partial<Pick<QuotePolicyValues, "title" | "body">>) {
    onChange(value.map((c) => (c.key === key ? { ...c, ...change } : c)));
  }
  function add(policy: PolicySummary) {
    if (full || value.some((c) => c.policyId === policy.id)) return;
    onChange(inLibraryOrder([...value, copyForQuote(policy, newKey())], library));
    setTimeout(() => done.current?.focus(), 0);
  }
  function openSheet() {
    // With nothing saved to pick from, go straight to writing one (people who can).
    setView(available.length === 0 && canManage ? "create" : "pick");
    setSheetOpen(true);
  }
  const openWording = (key: string) => {
    setOpen((s) => new Set(s).add(key));
    setFocusKey(key);
  };

  const row = (c: QuotePolicyValues) => {
    const saved = c.policyId === "" ? undefined : savedOf(c.policyId);
    const name = termName(saved ?? c);
    const problem = errorsByKey?.[c.key];
    // A term written just for one quote (from before): its title and wording are right there.
    if (c.policyId === "") {
      const legacy = value.filter((t) => t.policyId === "");
      const label = legacy.length > 1 ? `Term just for this quote ${legacy.indexOf(c) + 1}` : "Term just for this quote";
      return (
        <li key={c.key}>
          <div role="group" aria-labelledby={`policy-${c.key}-heading`} className="space-y-3 rounded-lg border border-border p-3">
            <div className="flex min-h-11 items-center justify-between gap-3">
              <p id={`policy-${c.key}-heading`} className="text-base font-medium">
                {label}
              </p>
              <Button type="button" variant="danger" aria-label={`Remove ${label.toLowerCase()}`} onClick={() => remove(c.key)}>
                Remove
              </Button>
            </div>
            <TextField
              id={`policy-${c.key}-title`}
              label="Title (optional)"
              autoComplete="off"
              maxLength={POLICY_TITLE_MAX}
              value={c.title}
              error={problem?.title}
              onChange={(title) => edit(c.key, { title })}
            />
            <TextAreaField
              id={`policy-${c.key}-body`}
              label="Wording"
              value={c.body}
              error={problem?.body}
              onChange={(body) => edit(c.key, { body })}
              maxLength={POLICY_BODY_MAX}
              rows={4}
            />
          </div>
        </li>
      );
    }
    const changing = open.has(c.key) || !!problem;
    return (
      <li key={c.key} className="space-y-2 rounded-lg border border-border p-3" data-testid="quote-term">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-base font-medium">{name}</p>
            {!changing && (c.title.trim() !== "" || c.body.trim().includes("\n")) && (
              <p className="line-clamp-2 text-sm text-muted-foreground">{c.body}</p>
            )}
            {!saved && <p className="text-sm text-muted-foreground">No longer in your saved terms</p>}
          </div>
          <Button type="button" variant="danger" aria-label={`Remove ${name}`} onClick={() => remove(c.key)}>
            Remove
          </Button>
        </div>
        {changing ? (
          <div className="space-y-2">
            <TextAreaField
              id={`policy-${c.key}-body`}
              // Named by the saved term, so an untitled one's label does not change as its wording is typed.
              label={`Wording for this quote: ${name}`}
              value={c.body}
              error={problem?.body ?? problem?.title}
              onChange={(body) => edit(c.key, { body })}
              maxLength={POLICY_BODY_MAX}
              rows={5}
            />
            {saved && c.body !== saved.body && (
              <Button type="button" variant="outline" onClick={() => edit(c.key, { body: saved.body })}>
                Use the saved wording again
              </Button>
            )}
          </div>
        ) : (
          <Button type="button" variant="soft" aria-label={`Change the wording for this quote: ${name}`} onClick={() => openWording(c.key)}>
            Change the wording for this quote
          </Button>
        )}
        {saved && (
          <UseOnNewQuotes
            id={`policy-${c.key}-on-new-quotes`}
            label={`Add “${name}” to new quotes`}
            what="term"
            valueKey={c.key}
            canEdit={canManage}
            show
            checked={saved.includeByDefault}
            canUse={false}
            onToggle={async (on) => {
              const result = await setPolicyOnNewQuotes(saved.id, on);
              if (result.status === "ok") {
                onLibraryAdd({ ...saved, includeByDefault: on });
                return { status: "saved" as const };
              }
              return { status: "error" as const, message: result.message };
            }}
            onUse={() => {}}
          />
        )}
      </li>
    );
  };

  return (
    <Section title="Terms">
      {error && (
        <p id="policies-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div ref={listTop} tabIndex={-1} className="outline-none" />
      {value.length === 0 ? (
        <p className="text-base" data-testid="no-policies">
          {available.length > 0
            ? "No terms on this quote yet."
            : canManage
              ? "No terms yet. Write one and use it on every quote."
              : "No terms have been saved yet. Ask an owner or admin to add some."}
        </p>
      ) : (
        <ul className="space-y-3" aria-label="Terms on this quote">
          {value.map(row)}
        </ul>
      )}

      {full && (
        <p className="text-sm text-muted-foreground">
          A quote can have up to {QUOTE_MAX_POLICIES} terms. Remove one to add another.
        </p>
      )}

      {(available.length > 0 || canManage) && (
        <div>
          <AddButton ref={addButton} id="add-term" disabled={full} onClick={openSheet}>
            Add a term
          </AddButton>
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={(isOpen) => !isOpen && !saving && setSheetOpen(false)}>
        <SheetContent side="right" className="h-dvh gap-0 overflow-y-auto" finalFocus={() => addButton.current ?? true}>
          <SheetHeader className="sticky top-0 z-10 border-b border-border bg-popover pr-14">
            <SheetTitle className="text-lg">{view === "create" ? "New term" : "Add a term"}</SheetTitle>
            <SheetDescription className="text-base">
              {view === "create"
                ? full
                  ? `Saved to your terms. This quote already has ${QUOTE_MAX_POLICIES} terms, so it isn&apos;t added.`
                  : "Saved to your terms and added to this quote."
                : "Choose from your saved terms, or write a new one."}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4 pt-4 pb-6">
            {view === "pick" ? (
              <>
                {canManage && (
                  <AddButton variant="default" onClick={() => setView("create")}>
                    New term
                  </AddButton>
                )}
                {available.length === 0 ? (
                  <p className="text-base text-muted-foreground">Every saved term is already on this quote.</p>
                ) : (
                  <ul className="space-y-3" aria-label="Your saved terms">
                    {available.map((p) => (
                      <li key={p.id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
                        <div className="min-w-0">
                          <p className="text-base font-medium">{termName(p)}</p>
                          {p.title && <p className="line-clamp-2 text-sm text-muted-foreground">{p.body}</p>}
                        </div>
                        <AddButton disabled={full} aria-label={`Add ${termName(p)} to this quote`} onClick={() => add(p)}>
                          Add
                        </AddButton>
                      </li>
                    ))}
                  </ul>
                )}
                {full && <p className="text-sm text-muted-foreground">This quote has {QUOTE_MAX_POLICIES} terms, the most it can hold.</p>}
                <Button ref={done} type="button" size="lg" variant="outline" onClick={() => setSheetOpen(false)}>
                  Done
                </Button>
              </>
            ) : (
              <PolicyForm
                key={sheetOpen ? "open" : "closed"}
                initial={{ title: "", body: "", includeByDefault: false }}
                policyId={null}
                content={content}
                idPrefix="policy-sheet-"
                embedded={{
                  onPendingChange: setSaving,
                  // Back to the saved terms when there are some to pick from; otherwise out of the sheet.
                  onCancel: () => (available.length > 0 ? setView("pick") : setSheetOpen(false)),
                  onDone: (policy) => {
                    onLibraryAdd(policy);
                    if (!full) onChange(inLibraryOrder([...value, copyForQuote(policy, newKey())], [...library, policy]));
                    setSheetOpen(false);
                  },
                }}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </Section>
  );
}
