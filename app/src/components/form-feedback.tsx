"use client";

import { useEffect, useRef } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * The summary half of the product's error standard (docs/adr/0005-form-errors.md): after a
 * failed submit, one place that says how many things need fixing and links to each one. The
 * field-level messages (FieldError under each input) stay where they are; this does not
 * replace them.
 */

export type FormProblem = {
  /** The id of the input the problem is about. The link focuses it. */
  fieldId: string;
  /** What the field is called on screen: "Phone", "VAT number". */
  label: string;
  /** How to fix it, in plain words. */
  message: string;
};

function focusField(fieldId: string) {
  const el = document.getElementById(fieldId);
  if (!el) return;
  el.scrollIntoView({ block: "center" });
  el.focus({ preventScroll: true });
}

/**
 * `trigger` should change every time a submit comes back (for example the action state), so
 * the summary scrolls into view and takes focus each time, even if the same problems remain.
 */
export function FormSummary({ problems, trigger }: { problems: FormProblem[]; trigger: unknown }) {
  const ref = useRef<HTMLDivElement>(null);
  const count = problems.length;

  useEffect(() => {
    if (count === 0) return;
    ref.current?.scrollIntoView({ block: "center" });
    ref.current?.focus({ preventScroll: true });
  }, [trigger, count]);

  if (count === 0) return null;

  return (
    <Alert
      ref={ref}
      tabIndex={-1}
      variant="destructive"
      data-testid="form-summary"
      className="outline-none focus-visible:ring-3 focus-visible:ring-destructive/40"
    >
      <AlertTitle>{count === 1 ? "1 thing needs fixing" : `${count} things need fixing`}</AlertTitle>
      <AlertDescription>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          {problems.map((p) => (
            <li key={p.fieldId}>
              <a
                href={`#${p.fieldId}`}
                className="font-medium underline underline-offset-2"
                onClick={(event) => {
                  event.preventDefault();
                  focusField(p.fieldId);
                }}
              >
                {p.label}
              </a>
              : {p.message}
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
