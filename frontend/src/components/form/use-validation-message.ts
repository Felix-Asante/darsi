import { useTranslations } from "next-intl";
import type messages from "@/common/i18n/messages/en.json";

type ValidationKey = keyof (typeof messages)["validation"];

/** Zod messages and API field codes are keys of `validation`; anything else is shown as is. */
export function useValidationMessage() {
  const t = useTranslations("validation");
  return (message: string | undefined) =>
    message === undefined ? undefined : t.has(message as ValidationKey) ? t(message as ValidationKey) : message;
}
