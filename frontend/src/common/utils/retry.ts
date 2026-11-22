import type { AxiosError } from "axios";

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  retryableStatusCodes: number[];
  retryableErrorCodes: string[];
}

export const DEFAULT_HTTP_RETRY_CONFIG: RetryConfig = {
  maxRetries: 2,
  baseDelay: 1000,
  maxDelay: 10_000,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  retryableErrorCodes: ["ECONNABORTED", "ETIMEDOUT", "ERR_NETWORK"],
};

/** Retrying these can never create a second invoice, payment or enrolment. */
const IDEMPOTENT_METHODS = new Set(["get", "head", "options", "put", "delete"]);

export function isIdempotentMethod(method?: string): boolean {
  return IDEMPOTENT_METHODS.has((method ?? "get").toLowerCase());
}

export function isRetryableError(
  error: AxiosError,
  config: RetryConfig = DEFAULT_HTTP_RETRY_CONFIG,
): boolean {
  if (error.response)
    return config.retryableStatusCodes.includes(error.response.status);
  return error.code ? config.retryableErrorCodes.includes(error.code) : false;
}

export function calculateBackoffDelay(
  retryCount: number,
  baseDelay: number,
  maxDelay: number,
): number {
  const exponentialDelay = baseDelay * 2 ** retryCount;
  const jitter = exponentialDelay * 0.2 * (Math.random() - 0.5);
  return Math.min(exponentialDelay + jitter, maxDelay);
}

export function parseRetryAfter(retryAfter?: string): number | null {
  if (!retryAfter) return null;

  const seconds = Number.parseInt(retryAfter, 10);
  if (!Number.isNaN(seconds)) return seconds * 1000;

  const date = new Date(retryAfter);
  return Number.isNaN(date.getTime())
    ? null
    : Math.max(0, date.getTime() - Date.now());
}
