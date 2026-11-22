import { useTranslations } from "next-intl";
import type messages from "@/common/i18n/messages/en.json";
import { getErrorCode } from "@/common/utils/errors";

type ErrorCode = keyof (typeof messages)["errors"];

/** Turns any thrown error into a sentence in the user's language, from the API's stable error code. */
export function useApiErrorMessage() {
  const t = useTranslations("errors");

  return (error: unknown): string => {
    const raw = getErrorCode(error);
    const code = raw.startsWith("you_are_not_allowed") ? "forbidden" : raw;
    return t.has(code as ErrorCode) ? t(code as ErrorCode) : t("unknown");
  };
}
