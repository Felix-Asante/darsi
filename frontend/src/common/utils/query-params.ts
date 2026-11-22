import type { Query } from "@/common/types/api";

export function toQueryParams(query: Query = {}): string {
  const params = Object.entries(query)
    .filter(
      ([, value]) =>
        value !== undefined &&
        value !== "" &&
        !(Array.isArray(value) && value.length === 0),
    )
    .flatMap(([key, value]) =>
      (Array.isArray(value) ? value : [value]).map(
        (item) =>
          `${encodeURIComponent(key)}=${encodeURIComponent(String(item))}`,
      ),
    )
    .join("&");

  return params ? `?${params}` : "";
}
