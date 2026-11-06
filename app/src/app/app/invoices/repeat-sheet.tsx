"use client";

import { useState, useTransition } from "react";
import { ChoiceCards } from "@/components/choice-cards";
import { FormErrorScope } from "@/components/form-errors";
import { FormSummary, type FormProblem } from "@/components/form-feedback";
import { SelectField, TextField } from "@/components/form-fields";
import { QuantityField } from "@/components/quantity-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { parseRepeatForm, type RepeatFormErrors, type RepeatFormValues } from "@/lib/recurrence";
import { describeSchedule } from "@/lib/recurrence/schedule";
import type { RepeatResult } from "./repeat-actions";

const OFFLINE = "Couldn't reach the server. Check your connection and try again.";

/** The ways to repeat that are offered. The data allows others (every 5 weeks); a repeat that has one still shows it. */
const PRESETS = ["week:1", "week:2", "month:1", "month:2", "month:3", "month:6", "year:1"] as const;
const PRESET_LABELS: Record<string, string> = {
  "week:1": "Every week",
  "week:2": "Every 2 weeks",
  "month:1": "Every month",
  "month:2": "Every 2 months",
  "month:3": "Every 3 months",
  "month:6": "Every 6 months",
  "year:1": "Every year",
};
const unit = { week: "week", month: "month", year: "year" } as const;

/**
 * "Repeat this" and "Change schedule" (docs/plans/recurring.md): how often, from which day, until when. The same sheet for
 * a new repeat and for changing one; `onSubmit` says which. Checked here first, so a problem is named where it is; the
 * server checks again.
 */
export function RepeatSheet({
  open,
  onOpenChange,
  title,
  description,
  initial,
  today,
  formatLocale,
  keepStartsOn,
  submitLabel,
  pendingLabel,
  onSubmit,
  onDone,
  finalFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  initial: RepeatFormValues;
  /** Today in the business's time zone. */
  today: string;
  formatLocale: string;
  /** A repeat that is already running may keep its starting day even if it is in the past. */
  keepStartsOn?: string;
  submitLabel: string;
  pendingLabel: string;
  onSubmit: (values: RepeatFormValues) => Promise<RepeatResult>;
  onDone: (id: string) => void;
  finalFocus?: () => HTMLElement | null | true;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="h-dvh gap-0 overflow-y-auto" finalFocus={finalFocus}>
        {/* Mounted only while open, so every opening starts from what it was given. */}
        {open && (
          <RepeatForm
            title={title}
            description={description}
            initial={initial}
            today={today}
            formatLocale={formatLocale}
            keepStartsOn={keepStartsOn}
            submitLabel={submitLabel}
            pendingLabel={pendingLabel}
            onSubmit={onSubmit}
            onDone={onDone}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function RepeatForm({
  title,
  description,
  initial,
  today,
  formatLocale,
  keepStartsOn,
  submitLabel,
  pendingLabel,
  onSubmit,
  onDone,
  onCancel,
}: {
  title: string;
  description: string;
  initial: RepeatFormValues;
  today: string;
  formatLocale: string;
  keepStartsOn?: string;
  submitLabel: string;
  pendingLabel: string;
  onSubmit: (values: RepeatFormValues) => Promise<RepeatResult>;
  onDone: (id: string) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<RepeatFormValues>(initial);
  const [errors, setErrors] = useState<RepeatFormErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [tries, setTries] = useState(0);
  const [pending, startTransition] = useTransition();
  const update = (change: Partial<RepeatFormValues>) => setValues((v) => ({ ...v, ...change }));

  const preset = `${values.frequency}:${values.every}`;
  const options = PRESETS.includes(preset as (typeof PRESETS)[number]) ? [...PRESETS] : [...PRESETS, preset];
  const labels = { ...PRESET_LABELS, [preset]: PRESET_LABELS[preset] ?? `Every ${values.every} ${unit[values.frequency]}s` };

  // What it comes to, in words, as the choices are made.
  const checked = parseRepeatForm(values, today, { keepStartsOn });
  const spoken = checked.ok ? `${describeSchedule(checked.schedule, formatLocale)}, from ${new Intl.DateTimeFormat(formatLocale, { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(new Date(`${checked.schedule.startsOn}T00:00:00Z`))}.` : null;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    setMessage(null);
    setTries((n) => n + 1);
    const result = parseRepeatForm(values, today, { keepStartsOn });
    setErrors(result.ok ? {} : result.errors);
    if (!result.ok) return;
    startTransition(async () => {
      try {
        const saved = await onSubmit(values);
        if (saved.status === "saved") onDone(saved.id);
        else if (saved.status === "invalid") setErrors(saved.errors);
        else setMessage(saved.message);
      } catch {
        setMessage(OFFLINE);
      }
    });
  }

  const summary: FormProblem[] = [
    ...(errors.every ? [{ fieldId: "repeat-how-often", label: "How often", message: errors.every }] : []),
    ...(errors.startsOn ? [{ fieldId: "repeat-starts-on", label: "First one on", message: errors.startsOn }] : []),
    ...(errors.endsOn ? [{ fieldId: "repeat-ends-on", label: "Last day", message: errors.endsOn }] : []),
    ...(errors.maxRuns ? [{ fieldId: "repeat-max-runs", label: "Number of times", message: errors.maxRuns }] : []),
    ...(message ? [{ fieldId: "repeat-submit", label: "Repeat", message }] : []),
  ];

  return (
    <>
      <SheetHeader className="sticky top-0 z-10 border-b border-border bg-popover pr-14">
        <SheetTitle className="text-lg">{title}</SheetTitle>
        <SheetDescription className="text-base">{description}</SheetDescription>
      </SheetHeader>
      <FormErrorScope epoch={tries}>
        <form onSubmit={submit} noValidate className="space-y-4 px-4 py-4" data-testid="repeat-form">
          <FormSummary problems={summary} trigger={tries} />
          <SelectField
            id="repeat-how-often"
            label="How often"
            value={preset}
            options={options}
            optionLabels={labels}
            error={errors.every}
            onChange={(v) => {
              const [frequency, every] = v.split(":");
              update({ frequency: frequency as RepeatFormValues["frequency"], every, lastDay: frequency === "month" ? values.lastDay : false });
            }}
          />
          <TextField id="repeat-starts-on" type="date" label="First one on" hint="Weekly ones fall on this day of the week." value={values.startsOn} error={errors.startsOn} onChange={(startsOn) => update({ startsOn })} />
          {values.frequency === "month" && (
            <ChoiceCards
              legend="On which day"
              value={values.lastDay ? "last" : "same"}
              onChange={(v) => update({ lastDay: v === "last" })}
              idFor={(v) => `repeat-day-${v}`}
              choices={[
                { value: "same", title: "The same day each month", hint: "A 31st becomes the last day in a shorter month." },
                { value: "last", title: "The last day of each month" },
              ]}
            />
          )}
          <ChoiceCards
            legend="Until"
            value={values.end}
            onChange={(end) => update({ end })}
            idFor={(v) => `repeat-end-${v}`}
            choices={[
              { value: "never", title: "No end" },
              { value: "on", title: "A last day" },
              { value: "after", title: "A number of times" },
            ]}
          >
            {values.end === "on" && <TextField id="repeat-ends-on" type="date" label="Last day" value={values.endsOn} error={errors.endsOn} onChange={(endsOn) => update({ endsOn })} />}
            {values.end === "after" && <QuantityField id="repeat-max-runs" label="Number of times" unit="times" value={values.maxRuns} error={errors.maxRuns} onChange={(maxRuns) => update({ maxRuns })} />}
          </ChoiceCards>
          {spoken && (
            <p className="text-base" data-testid="repeat-spoken">
              {spoken}
            </p>
          )}
          {message && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}
          <p className="text-sm text-muted-foreground">Each time, a new invoice draft is made for you to check. Nothing is sent or numbered by itself.</p>
          <Button id="repeat-submit" type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? pendingLabel : submitLabel}
          </Button>
          <Button type="button" size="lg" variant="outline" className="w-full" disabled={pending} onClick={onCancel}>
            Cancel
          </Button>
        </form>
      </FormErrorScope>
    </>
  );
}
