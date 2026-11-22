import type { FieldError } from "@/common/types/api";

export interface ApiError extends Error {
  isApiError: true;
  /** Stable code from the API's problem details, or a client-side one such as `network`. */
  code: string;
  status?: number;
  errors?: FieldError[];
  requestId?: string;
}

export function createApiError(
  fields: Omit<ApiError, "isApiError" | "name" | "message"> & {
    message?: string;
  },
): ApiError {
  return Object.assign(new Error(fields.message ?? fields.code), {
    ...fields,
    name: "ApiError",
    isApiError: true as const,
  });
}

export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === "object" &&
    error !== null &&
    "isApiError" in error &&
    error.isApiError === true
  );
}

export const isNotFoundError = (error: unknown) =>
  isApiError(error) && error.status === 404;
export const isForbiddenError = (error: unknown) =>
  isApiError(error) && error.status === 403;
export const isUnauthenticatedError = (error: unknown) =>
  isApiError(error) && error.status === 401;
export const isValidationError = (error: unknown) =>
  isApiError(error) && error.code === "validation_failed";

export function getErrorCode(error: unknown): string {
  return isApiError(error) ? error.code : "unknown";
}

/** Field errors keyed by field path, ready for react-hook-form's `setError`. */
export function getFieldErrors(error: unknown): Record<string, string[]> {
  if (!isApiError(error) || !error.errors) return {};
  return Object.fromEntries(
    error.errors.map(({ field, codes }) => [field, codes]),
  );
}
