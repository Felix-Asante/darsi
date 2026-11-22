"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Suspense, useEffect } from "react";
import { MeProvider } from "@/common/auth/me-context";
import { getMeQueryOptions } from "@/common/integrations/tanstack-query/query-options/identity";
import { usePathname, useRouter } from "@/common/i18n/navigation";
import { isUnauthenticatedError } from "@/common/utils/errors";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { SchoolPicker } from "./school-picker";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface SessionGateProps {
  children: React.ReactNode;
  /** Sends a school's admin to onboarding until the school is set up. */
  requireOnboarding?: boolean;
}

export function SessionGate(props: Readonly<SessionGateProps>) {
  return (
    <Suspense fallback={<GateSkeleton />}>
      <Gate {...props} />
    </Suspense>
  );
}

function Gate({ children, requireOnboarding = true }: Readonly<SessionGateProps>) {
  const t = useTranslations("common");
  const errorMessage = useApiErrorMessage();
  const router = useRouter();
  const pathname = usePathname();
  const me = useQuery(getMeQueryOptions());

  const signedOut = isUnauthenticatedError(me.error);
  const school = me.data?.currentSchool;
  const needsOnboarding =
    requireOnboarding && school && !school.onboardingCompleted && school.roles.includes("admin");

  useEffect(() => {
    if (signedOut) router.replace({ pathname: "/sign-in", query: pathname === "/" ? {} : { next: pathname } });
    else if (needsOnboarding) router.replace("/onboarding");
  }, [signedOut, needsOnboarding, pathname, router]);

  if (me.isPending || signedOut || needsOnboarding) return <GateSkeleton />;

  if (me.error) {
    return (
      <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm">{errorMessage(me.error)}</p>
        <Button variant="outline" onClick={() => me.refetch()}>
          {t("retry")}
        </Button>
      </div>
    );
  }

  if (!me.data.currentSchool) return <SchoolPicker schools={me.data.schools} />;

  return <MeProvider value={{ ...me.data, currentSchool: me.data.currentSchool }}>{children}</MeProvider>;
}

function GateSkeleton() {
  return (
    <div className="flex flex-1" aria-busy="true">
      <div className="bg-sidebar hidden w-64 flex-col gap-3 border-e p-4 md:flex">
        <Skeleton className="h-6 w-32" />
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-5 w-full" />
        ))}
      </div>
      <div className="flex flex-1 flex-col gap-4 p-6">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  );
}
