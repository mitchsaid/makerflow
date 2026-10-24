"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupText } from "@/components/ui/input-group";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useFieldError } from "./form-errors";

/**
 * Building blocks shared by the app's forms. Each input is wired to its label and its error
 * message for screen readers (the error id is `<id>-error`, which the form summary links to).
 */

export type ExtraInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "value" | "onChange" | "id" | "name"
>;

/** A titled card holding a group of fields. */
export function Section({ title, tag, children }: { title: string; /** Beside the title, like the "Private" tag. */ tag?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent>
        <FieldSet>
          <FieldLegend className="mb-2 data-[variant=legend]:text-lg data-[variant=legend]:font-semibold">{title}
            {tag}
          </FieldLegend>
          <FieldGroup className="gap-4">{children}</FieldGroup>
        </FieldSet>
      </CardContent>
    </Card>
  );
}

export function TextField({
  id,
  name,
  label,
  error: errorProp,
  value,
  onChange,
  startText,
  hint,
  labelHidden = false,
  ...props
}: ExtraInputProps & {
  id: string;
  /** What the browser submits under. Defaults to the id. */
  name?: string;
  label: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
  /** Fixed text before the value, such as the currency symbol on a price. */
  startText?: string;
  /** Help under the label (above the field), tied to the field for screen readers. Errors go under the field. */
  hint?: string;
  /** The label is read out but not shown (for rows under shared column headings). */
  labelHidden?: boolean;
}) {
  const { error, markEdited } = useFieldError(id, errorProp);
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ");
  const input = (
    <Input
      id={id}
      name={name ?? id}
      type="text"
      value={value}
      onChange={(e) => {
        markEdited();
        onChange(e.target.value);
      }}
      aria-invalid={!!error}
      aria-describedby={describedBy || undefined}
      className={startText ? "h-full rounded-lg border-0 bg-transparent pl-2 shadow-none focus-visible:ring-0 aria-invalid:ring-0 dark:bg-transparent" : undefined}
      {...props}
    />
  );
  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={id} className={labelHidden ? "sr-only" : undefined}>
        {label}
      </FieldLabel>
      {hint && (
        <p id={`${id}-hint`} className="-mt-1 text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {startText ? (
        <InputGroup>
          <InputGroupText>{startText}</InputGroupText>
          {input}
        </InputGroup>
      ) : (
        input
      )}
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </Field>
  );
}

export function TextAreaField({
  id,
  name,
  label,
  error: errorProp,
  value,
  onChange,
  hint,
  ...props
}: Omit<React.ComponentProps<typeof Textarea>, "value" | "onChange" | "id" | "name"> & {
  id: string;
  name?: string;
  label: string;
  error?: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { error, markEdited } = useFieldError(id, errorProp);
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ");
  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {hint && (
        <p id={`${id}-hint`} className="-mt-1 text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      <Textarea
        id={id}
        name={name ?? id}
        value={value}
        onChange={(e) => {
        markEdited();
        onChange(e.target.value);
      }}
        aria-invalid={!!error}
        aria-describedby={describedBy || undefined}
        {...props}
      />
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </Field>
  );
}

/** A native picker (phones show their own, which is faster and familiar). */
export function SelectField({
  id,
  name,
  label,
  error: errorProp,
  value,
  onChange,
  placeholder,
  options,
  optionLabels,
  autoComplete,
  hint,
}: {
  id: string;
  name?: string;
  label: string;
  error?: string;
  /** Help under the label (above the field), read out with the field. */
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  /** The empty first choice ("Choose one"). Leave it out when one of the options is always chosen (minutes or hours). */
  placeholder?: string;
  options: readonly string[];
  /** What to show for an option, when it should read differently from its value. */
  optionLabels?: Record<string, string>;
  autoComplete?: string;
}) {
  const { error, markEdited } = useFieldError(id, errorProp);
  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {hint && (
        <p id={`${id}-hint`} className="-mt-1 text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      <NativeSelect
        id={id}
        name={name ?? id}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => {
        markEdited();
        onChange(e.target.value);
      }}
        aria-invalid={!!error}
        aria-describedby={[hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined}
      >
        {placeholder !== undefined && <NativeSelectOption value="">{placeholder}</NativeSelectOption>}
        {options.map((option) => (
          <NativeSelectOption key={option} value={option}>
            {optionLabels?.[option] ?? option}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </Field>
  );
}
