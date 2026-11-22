import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { OnboardingForm } from "@/features/school/onboarding/onboarding-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("onboarding");
  return { title: t("title") };
}

export default function OnboardingPage() {
  return <OnboardingForm />;
}
