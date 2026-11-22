import axios from "axios";
import type {
  AxiosAdapter,
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
} from "axios";
import type { AxiosApiResponse, ProblemDetails } from "@/common/types/api";
import { type ApiError, createApiError } from "@/common/utils/errors";
import {
  DEFAULT_HTTP_RETRY_CONFIG,
  calculateBackoffDelay,
  isIdempotentMethod,
  isRetryableError,
  parseRetryAfter,
} from "@/common/utils/retry";

export interface HttpClientConfig {
  timeout?: number;
  headers?: Record<string, string>;
  /** The school of the current subdomain, sent so the API can resolve the tenant. */
  getSchoolSlug?: () => string | null;
  /** Called once when the session has ended (401), before the error reaches the caller. */
  onUnauthorized?: () => void;
  adapter?: AxiosAdapter;
}

export interface RequestConfig extends AxiosRequestConfig {
  /** Set to `true` to retry a POST or PATCH that is safe to repeat, such as one with an Idempotency-Key. */
  isRetryable?: boolean;
}

interface RetryableRequestConfig extends RequestConfig {
  __retryCount?: number;
}

const DEFAULT_TIMEOUT = 30_000;

export class HttpClient {
  private readonly instance: AxiosInstance;

  constructor(private readonly config: HttpClientConfig = {}) {
    this.instance = axios.create({
      timeout: config.timeout ?? DEFAULT_TIMEOUT,
      withCredentials: true,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...config.headers,
      },
      adapter: config.adapter,
    });
    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    this.instance.interceptors.request.use((request) => {
      const schoolSlug = this.config.getSchoolSlug?.();
      if (schoolSlug) request.headers.set("X-School-Slug", schoolSlug);
      return request;
    });

    this.instance.interceptors.response.use(undefined, (error: AxiosError) =>
      this.handleError(error),
    );
  }

  private async handleError(error: AxiosError): Promise<never> {
    if (axios.isCancel(error)) throw error;

    const request = error.config as RetryableRequestConfig | undefined;
    const retryCount = request?.__retryCount ?? 0;

    if (request && this.shouldRetry(error, request, retryCount)) {
      request.__retryCount = retryCount + 1;
      await this.wait(error, retryCount);
      return this.instance.request(request);
    }

    if (error.response?.status === 401) this.config.onUnauthorized?.();

    throw this.toApiError(error);
  }

  private shouldRetry(
    error: AxiosError,
    request: RetryableRequestConfig,
    retryCount: number,
  ): boolean {
    const allowed = request.isRetryable ?? isIdempotentMethod(request.method);
    return (
      allowed &&
      isRetryableError(error) &&
      retryCount < DEFAULT_HTTP_RETRY_CONFIG.maxRetries
    );
  }

  private wait(error: AxiosError, retryCount: number): Promise<void> {
    const retryAfter =
      error.response?.status === 429
        ? parseRetryAfter(error.response.headers["retry-after"])
        : null;
    const delay =
      retryAfter ??
      calculateBackoffDelay(
        retryCount,
        DEFAULT_HTTP_RETRY_CONFIG.baseDelay,
        DEFAULT_HTTP_RETRY_CONFIG.maxDelay,
      );
    return new Promise((resolve) => setTimeout(resolve, delay));
  }

  private toApiError(error: AxiosError): ApiError {
    if (error.response) {
      const problem = error.response.data as
        Partial<ProblemDetails> | undefined;
      return createApiError({
        code:
          typeof problem?.code === "string"
            ? problem.code.toLowerCase()
            : "unknown",
        status: error.response.status,
        message: problem?.detail ?? error.message,
        errors: problem?.errors,
        requestId: problem?.requestId,
      });
    }

    const code =
      error.code === "ECONNABORTED" || error.code === "ETIMEDOUT"
        ? "timeout"
        : "network";
    return createApiError({ code, message: error.message });
  }

  private async request<T>(
    config: RequestConfig,
  ): Promise<AxiosApiResponse<T>> {
    const { data, status, statusText } = await this.instance.request<T>(config);
    return { data, status, statusText };
  }

  get<T>(url: string, params?: object, config?: RequestConfig) {
    return this.request<T>({ ...config, method: "GET", url, params });
  }

  post<T>(url: string, data?: unknown, config?: RequestConfig) {
    return this.request<T>({ ...config, method: "POST", url, data });
  }

  put<T>(url: string, data?: unknown, config?: RequestConfig) {
    return this.request<T>({ ...config, method: "PUT", url, data });
  }

  patch<T>(url: string, data?: unknown, config?: RequestConfig) {
    return this.request<T>({ ...config, method: "PATCH", url, data });
  }

  delete<T>(url: string, config?: RequestConfig) {
    return this.request<T>({ ...config, method: "DELETE", url });
  }
}

export const createHttpClient = (config?: HttpClientConfig) =>
  new HttpClient(config);
