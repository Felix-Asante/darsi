import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { VerifyEmailNotice } from "@/features/auth/verify-email/verify-email-notice";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("verify.title") };
}

export default function Page() {
  return (
    <Suspense>
      <VerifyEmailNotice />
    </Suspense>
  );
}
