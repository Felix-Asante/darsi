"use client";

import { type Control, Controller, type FieldPath, type FieldValues } from "react-hook-form";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { useValidationMessage } from "./use-validation-message";

export interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxFieldProps<TValues extends FieldValues> {
  control: Control<TValues>;
  name: FieldPath<TValues>;
  label: string;
  options: ComboboxOption[];
  emptyText: string;
  description?: string;
}

/** A searchable single choice, for long lists such as time zones and currencies. */
export function ComboboxField<TValues extends FieldValues>({
  control,
  name,
  label,
  options,
  emptyText,
  description,
}: Readonly<ComboboxFieldProps<TValues>>) {
  const validationMessage = useValidationMessage();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const selected = options.find((option) => option.value === field.value) ?? null;
        const descriptionId = `${field.name}-description`;
        return (
          <Field data-invalid={fieldState.invalid || undefined}>
            <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
            <Combobox
              items={options}
              value={selected}
              onValueChange={(option: ComboboxOption | null) => field.onChange(option?.value ?? "")}
              itemToStringLabel={(option: ComboboxOption) => option.label}
              isItemEqualToValue={(option: ComboboxOption, value: ComboboxOption) => option.value === value.value}
            >
              <ComboboxInput
                id={field.name}
                onBlur={field.onBlur}
                aria-invalid={fieldState.invalid}
                aria-describedby={description ? descriptionId : undefined}
                className="w-full"
                triggerLabel={label}
              />
              <ComboboxContent>
                <ComboboxEmpty>{emptyText}</ComboboxEmpty>
                <ComboboxList>
                  {(option: ComboboxOption) => (
                    <ComboboxItem key={option.value} value={option}>
                      {option.label}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
            {fieldState.error ? (
              <FieldError>{validationMessage(fieldState.error.message)}</FieldError>
            ) : (
              description && <FieldDescription id={descriptionId}>{description}</FieldDescription>
            )}
          </Field>
        );
      }}
    />
  );
}
