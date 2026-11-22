import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { SignInForm } from "@/features/auth/sign-in/sign-in-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("signIn.submit") };
}

export default function Page() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
