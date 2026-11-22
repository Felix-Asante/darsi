"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { getPublicAdmissionsQueryOptions } from "@/common/integrations/tanstack-query/query-options/admissions";
import { Link } from "@/common/i18n/navigation";
import { formatCalendarDate, formatMoney } from "@/common/lib/format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/** The school's public admissions page, linkable from its own website (ADMS-3). */
export function ApplyPage() {
  const t = useTranslations("admissions.apply");
  const locale = useLocale();
  const page = useQuery(getPublicAdmissionsQueryOptions());
  const next = { next: "/apply/start" };

  if (page.isPending) return <Skeleton className="h-64 w-full max-w-xl" />;
  if (!page.data)
    return <p className="text-muted-foreground text-sm">{t("unavailable")}</p>;
  const { school, cycles } = page.data;

  return (
    <div className="flex w-full max-w-xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("title", { school: school.name })}
        </h1>
        <p className="text-muted-foreground text-sm">{t("description")}</p>
      </div>
      {cycles.length === 0 ? (
        <p className="bg-card rounded-lg border p-4 text-sm">{t("closed")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {cycles.map((cycle) => (
            <li
              key={cycle.id}
              className="bg-card flex flex-col gap-2 rounded-lg border p-4"
            >
              <h2 className="font-medium">{cycle.name}</h2>
              <p className="text-muted-foreground text-sm">
                {cycle.grades.map((grade) => grade.name).join(", ")}
              </p>
              <p className="text-sm">
                {t("closes", {
                  date: formatCalendarDate(cycle.closesOn, locale, "long"),
                })}
                {cycle.applicationFee !== "0" && (
                  <>
                    {" "}
                    ·{" "}
                    {t("fee", {
                      amount: formatMoney(
                        cycle.applicationFee,
                        school.currency,
                        locale,
                      ),
                    })}
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
      {cycles.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            nativeButton={false}
            render={<Link href={{ pathname: "/sign-up", query: next }} />}
          >
            {t("start")}
          </Button>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={{ pathname: "/sign-in", query: next }} />}
          >
            {t("haveAccount")}
          </Button>
        </div>
      )}
    </div>
  );
}
