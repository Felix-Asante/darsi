export interface AxiosApiResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
}

export type ApiResponse<T> = Promise<AxiosApiResponse<T>>;

export type Query = Record<
  string,
  string | number | boolean | string[] | undefined
>;

export interface CursorQuery extends Query {
  cursor?: string;
  limit?: number;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export interface FieldError {
  field: string;
  codes: string[];
}

/** RFC 9457 body returned by the API for every error. */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  code: string;
  detail?: string;
  instance: string;
  requestId?: string;
  errors?: FieldError[];
}
