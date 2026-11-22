"use client";

import { type Control, Controller, type FieldPath, type FieldValues } from "react-hook-form";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useValidationMessage } from "./use-validation-message";

interface TextFieldProps<TValues extends FieldValues> {
  control: Control<TValues>;
  name: FieldPath<TValues>;
  label: string;
  description?: string;
  type?: "text" | "email" | "password" | "date" | "time";
  autoComplete?: string;
  autoFocus?: boolean;
}

export function TextField<TValues extends FieldValues>({
  control,
  name,
  label,
  description,
  type = "text",
  autoComplete,
  autoFocus,
}: Readonly<TextFieldProps<TValues>>) {
  const validationMessage = useValidationMessage();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const descriptionId = `${field.name}-description`;
        const errorId = `${field.name}-error`;
        return (
          <Field data-invalid={fieldState.invalid || undefined}>
            <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
            <Input
              {...field}
              value={field.value ?? ""}
              id={field.name}
              type={type}
              autoComplete={autoComplete}
              autoFocus={autoFocus}
              aria-invalid={fieldState.invalid}
              aria-describedby={fieldState.error ? errorId : description ? descriptionId : undefined}
            />
            {fieldState.error ? (
              <FieldError id={errorId}>{validationMessage(fieldState.error.message)}</FieldError>
            ) : (
              description && <FieldDescription id={descriptionId}>{description}</FieldDescription>
            )}
          </Field>
        );
      }}
    />
  );
}
