"use client";

import { type Control, Controller, type FieldPath, type FieldValues } from "react-hook-form";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useValidationMessage } from "./use-validation-message";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps<TValues extends FieldValues> {
  control: Control<TValues>;
  name: FieldPath<TValues>;
  label: string;
  options: SelectOption[];
  /** Shown for the empty value. Pass it when the field is optional. */
  placeholder?: string;
  description?: string;
}

const NONE = "";

/** A short single choice. Use `ComboboxField` for long lists. */
export function SelectField<TValues extends FieldValues>({
  control,
  name,
  label,
  options,
  placeholder,
  description,
}: Readonly<SelectFieldProps<TValues>>) {
  const validationMessage = useValidationMessage();
  const items = [...(placeholder === undefined ? [] : [{ value: NONE, label: placeholder }]), ...options];

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
            <Select
              items={items}
              value={field.value ?? NONE}
              onValueChange={(value) => field.onChange(value ?? NONE)}
            >
              <SelectTrigger
                id={field.name}
                className="w-full"
                onBlur={field.onBlur}
                aria-invalid={fieldState.invalid}
                aria-describedby={fieldState.error ? errorId : description ? descriptionId : undefined}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {items.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
