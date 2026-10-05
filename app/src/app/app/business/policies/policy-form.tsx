"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ComingSoonSection } from "@/components/coming-soon";
import { FormSummary, type FormProblem } from "@/components/form-feedback";
import { Section, SelectField, TextAreaField, TextField } from "@/components/form-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  POLICY_BODY_MAX,
  POLICY_HEADINGS,
  POLICY_KINDS,
  POLICY_PURPOSES,
  POLICY_TITLE_MAX,
  type PolicyFieldErrors,
  type PolicyFormValues,
  type PolicyKind,
  type PolicyPackContent,
  type PolicySummary,
} from "@/lib/policies";
import { addStarter } from "@/lib/quotes/terms-starters";
import { savePolicy } from "./actions";

/** Set when the form is shown in a sheet over a quote: it hands the saved policy back instead of navigating. */
export type EmbeddedPolicyForm = {
  onDone: (policy: PolicySummary) => void;
  onCancel: () => void;
  onPendingChange: (pending: boolean) => void;
};

/**
 * Add or edit a policy: the heading it goes under, a title, the wording (with starters to tap and a
 * plain "good to know"), and whether new quotes include it. Starters are prompts to edit, not
 * legal advice.
 */
export function PolicyForm({
  initial,
  policyId,
  content,
  idPrefix = "",
  embedded,
}: {
  initial: PolicyFormValues;
  policyId: string | null;
  content: PolicyPackContent;
  idPrefix?: string;
  embedded?: EmbeddedPolicyForm;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<PolicyFieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [tries, setTries] = useState(0);
  const [pending, startTransition] = useTransition();
  const fid = (key: string) => `${idPrefix}${key}`;

  useEffect(() => embedded?.onPendingChange(pending), [pending, embedded]);

  const guidance = content.kinds[values.kind];
  const set =
    <K extends keyof PolicyFormValues>(key: K) =>
    (value: PolicyFormValues[K]) =>
      setValues((v) => ({ ...v, [key]: value }));

  /** Changing the heading renames a title that still has the old heading's name. */
  function chooseKind(kind: string) {
    setValues((v) => {
      const next = kind as PolicyKind;
      const wasDefault = v.title.trim() === "" || v.title === POLICY_HEADINGS[v.kind];
      return { ...v, kind: next, title: wasDefault ? POLICY_HEADINGS[next] : v.title };
    });
  }

  const problems: FormProblem[] = (
    [
      ["policyKind", "Heading", errors.kind],
      ["policyTitle", "Title", errors.title],
      ["policyBody", "Wording", errors.body],
    ] as const
  ).flatMap(([field, label, msg]) => (msg ? [{ fieldId: fid(field), label, message: msg }] : []));

  function submit(event: React.FormEvent<HTMLFormElement>) {
    // In a sheet this form sits over the quote's own form: its submit must not reach it.
    event.preventDefault();
    event.stopPropagation();
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await savePolicy(policyId, values);
        setTries((n) => n + 1);
        if (result.status === "saved") {
          setErrors({});
          if (embedded) embedded.onDone(result.policy);
          else router.push(`/app/business/policies?saved=${result.policy.id}`);
        } else {
          setErrors(result.errors ?? {});
          setMessage(result.message ?? null);
        }
      } catch {
        setTries((n) => n + 1);
        setMessage("Couldn't reach the server. Check your connection and try again. Nothing you typed is lost.");
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <FormSummary problems={problems} trigger={tries} />
      {message && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      <Section title="The policy">
        <SelectField
          id={fid("policyKind")}
          name="kind"
          label="Heading"
          placeholder="Choose a heading"
          options={POLICY_KINDS}
          optionLabels={POLICY_HEADINGS}
          value={values.kind}
          error={errors.kind}
          onChange={chooseKind}
        />
        <p className="-mt-2 text-sm text-muted-foreground">{POLICY_PURPOSES[values.kind]}</p>
        <TextField
          id={fid("policyTitle")}
          name="title"
          label="Title"
          autoComplete="off"
          maxLength={POLICY_TITLE_MAX}
          value={values.title}
          error={errors.title}
          onChange={set("title")}
          hint="What the customer sees above the wording, like “If you cancel”."
        />
        <TextAreaField
          id={fid("policyBody")}
          name="body"
          label="Wording"
          hint="Write it in plain words, the way you'd say it to a customer."
          value={values.body}
          error={errors.body}
          onChange={set("body")}
          maxLength={POLICY_BODY_MAX}
          rows={7}
        />
        {guidance.starters.length > 0 && (
          <div className="space-y-2" data-testid="starters">
            <p className="text-sm text-muted-foreground">Start from some wording, then change it to suit you:</p>
            <div className="flex flex-wrap gap-2">
              {guidance.starters.map((s) => (
                <Button
                  key={s.key}
                  type="button"
                  variant="outline"
                  disabled={values.body.includes(s.text)}
                  onClick={() => set("body")(addStarter(values.body, s.text))}
                >
                  {s.label}
                </Button>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">{content.adviceNote}</p>
          </div>
        )}
        <div className="rounded-lg bg-muted/50 p-3" data-testid="good-to-know">
          <p className="text-sm font-medium">Good to know</p>
          <p className="text-sm text-muted-foreground">{guidance.goodToKnow}</p>
        </div>
        <Field orientation="horizontal" className="min-h-11 items-center">
          <Checkbox
            id={fid("includeByDefault")}
            name="includeByDefault"
            checked={values.includeByDefault}
            onCheckedChange={(checked) => set("includeByDefault")(checked === true)}
          />
          <FieldLabel htmlFor={fid("includeByDefault")} className="text-base">
            Include on new quotes
          </FieldLabel>
        </Field>
        <FieldDescription>
          New quotes start with this ticked. You can untick it on any quote, and change its wording there
          without changing it here.
        </FieldDescription>
      </Section>

      {values.kind === "cancellation" && (
        <ComingSoonSection
          title="Cancellation stages"
          description="A table of what the customer is charged at each stage, like deposit, materials bought and work done."
        />
      )}
      <ComingSoonSection
        title="Only on certain products"
        description="Show a policy only on quotes that include particular products or services, like “natural stones vary” on jewellery."
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Saving…" : "Save policy"}
        </Button>
        {embedded ? (
          <Button type="button" size="lg" variant="outline" disabled={pending} onClick={embedded.onCancel}>
            Cancel
          </Button>
        ) : (
          <Link href="/app/business/policies" className={buttonVariants({ variant: "outline", size: "lg" })}>
            Cancel
          </Link>
        )}
      </div>
    </form>
  );
}
