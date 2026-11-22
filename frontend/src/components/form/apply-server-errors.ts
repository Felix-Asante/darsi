import type { FieldPath, FieldValues, UseFormSetError } from "react-hook-form";
import { getFieldErrors } from "@/common/utils/errors";

/** Puts the API's field errors on the matching inputs. Returns whether any field matched. */
export function applyServerErrors<TValues extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<TValues>,
  fields: readonly FieldPath<TValues>[],
): boolean {
  let matched = false;
  for (const [field, codes] of Object.entries(getFieldErrors(error))) {
    if (fields.includes(field as FieldPath<TValues>)) {
      setError(field as FieldPath<TValues>, { type: "server", message: codes[0] });
      matched = true;
    }
  }
  return matched;
}
