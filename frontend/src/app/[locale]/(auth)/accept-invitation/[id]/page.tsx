import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AcceptInvitation } from "@/features/auth/accept-invitation/accept-invitation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("invitation.heading") };
}

export default function Page() {
  return (
    <Suspense>
      <AcceptInvitation />
    </Suspense>
  );
}
