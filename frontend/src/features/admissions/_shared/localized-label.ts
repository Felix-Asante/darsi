import type { Label } from "@/common/types/admissions";

/** Schools write their own questions in English and, optionally, French. */
export const localizedLabel = (label: Label, locale: string) =>
  (locale === "fr" && label.fr) || label.en;
