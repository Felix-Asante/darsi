"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { useValidationMessage } from "@/components/form/use-validation-message";
import { getFieldErrors } from "@/common/utils/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface InlineField {
  name: string;
  label: string;
  type?: "text" | "date" | "time";
  placeholder?: string;
  className?: string;
}

interface InlineFormProps {
  id: string;
  fields: InlineField[];
  submitLabel: string;
  onSubmit: (values: Record<string, string>) => Promise<unknown>;
}

/** A one-line form for the short records on this page: fill, add, and it clears itself. */
export function InlineForm({ id, fields, submitLabel, onSubmit }: Readonly<InlineFormProps>) {
  const tValidation = useTranslations("validation");
  const errorMessage = useApiErrorMessage();
  const validationMessage = useValidationMessage();
  const empty = Object.fromEntries(fields.map((field) => [field.name, ""]));
  const [values, setValues] = useState<Record<string, string>>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const missing = Object.fromEntries(
      fields.filter((field) => !values[field.name]?.trim()).map((field) => [field.name, tValidation("required")]),
    );
    setErrors(missing);
    setFormError(null);
    if (Object.keys(missing).length > 0) return;

    setPending(true);
    try {
      await onSubmit(Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.trim()])));
      setValues(empty);
    } catch (error) {
      const fieldErrors = Object.fromEntries(
        Object.entries(getFieldErrors(error))
          .filter(([field]) => fields.some((candidate) => candidate.name === field))
          .map(([field, codes]) => [field, validationMessage(codes[0]) ?? ""]),
      );
      setErrors(fieldErrors);
      if (Object.keys(fieldErrors).length === 0) setFormError(errorMessage(error));
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-3">
        {fields.map((field) => {
          const inputId = `${id}-${field.name}`;
          const error = errors[field.name];
          return (
            <div key={field.name} className={field.className ?? "flex min-w-40 flex-1 flex-col gap-1.5"}>
              <Label htmlFor={inputId}>{field.label}</Label>
              <Input
                id={inputId}
                type={field.type ?? "text"}
                value={values[field.name]}
                placeholder={field.placeholder}
                autoComplete="off"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? `${inputId}-error` : undefined}
                onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
              />
              {error && (
                <p id={`${inputId}-error`} className="text-destructive text-sm">
                  {error}
                </p>
              )}
            </div>
          );
        })}
        <Button type="submit" variant="secondary" disabled={pending}>
          {submitLabel}
        </Button>
      </div>
      {formError && (
        <p role="alert" className="text-destructive text-sm">
          {formError}
        </p>
      )}
    </form>
  );
}
