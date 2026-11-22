import { redirect } from "@/common/i18n/navigation";
import { locale } from "next/root-params";

export default async function SettingsIndex() {
  redirect({
    href: "/settings/school",
    locale: (await locale()) as "en" | "fr",
  });
}
