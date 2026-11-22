import { z } from "zod";

const TIME_ZONES = new Set([...Intl.supportedValuesOf("timeZone"), "UTC"]);
const CURRENCIES = new Set(Intl.supportedValuesOf("currency"));

export const schoolSettingsSchema = z.object({
  name: z.string().trim().min(2, { error: "required" }).max(120),
  defaultLocale: z.enum(["en", "fr"]),
  timeZone: z.string().refine((value) => TIME_ZONES.has(value), { error: "isTimeZone" }),
  currency: z.string().refine((value) => CURRENCIES.has(value), { error: "isCurrencyCode" }),
});

export type SchoolSettingsValues = z.infer<typeof schoolSettingsSchema>;
