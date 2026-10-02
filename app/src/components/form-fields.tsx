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
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

/**
 * Building blocks shared by the app's forms. Each input is wired to its label and its error
 * message for screen readers (the error id is `<id>-error`, which the form summary links to).
 */

export type ExtraInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "value" | "onChange" | "id" | "name"
>;

/** A titled card holding a group of fields. */
export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent>
        <FieldSet>
          <FieldLegend>{title}</FieldLegend>
          <FieldGroup className="gap-4">{children}</FieldGroup>
        </FieldSet>
      </CardContent>
    </Card>
  );
}

export function TextField({
  id,
  label,
  error,
  value,
  onChange,
  ...props
}: ExtraInputProps & {
  id: string;
  label: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        name={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </Field>
  );
}

export function TextAreaField({
  id,
  label,
  error,
  value,
  onChange,
  hint,
  ...props
}: Omit<React.ComponentProps<typeof Textarea>, "value" | "onChange" | "id" | "name"> & {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ");
  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Textarea
        id={id}
        name={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={describedBy || undefined}
        {...props}
      />
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </Field>
  );
}

/** A native picker (phones show their own, which is faster and familiar). */
export function SelectField({
  id,
  label,
  error,
  value,
  onChange,
  placeholder,
  options,
  optionLabels,
  autoComplete,
}: {
  id: string;
  label: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: readonly string[];
  /** What to show for an option, when it should read differently from its value. */
  optionLabels?: Record<string, string>;
  autoComplete?: string;
}) {
  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <NativeSelect
        id={id}
        name={id}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
      >
        <NativeSelectOption value="">{placeholder}</NativeSelectOption>
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
