"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { DownloadIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useCurrentSchool } from "@/common/auth/me-context";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { getGradeLevelsQueryOptions } from "@/common/integrations/tanstack-query/query-options/academics";
import {
  getCollectionsQueryOptions,
  getOutstandingQueryOptions,
} from "@/common/integrations/tanstack-query/query-options/billing";
import { addMonths, todayIn } from "@/common/lib/calendar-date";
import { api } from "@/common/service/api";
import type { AgingBucket } from "@/common/types/billing";
import { FormAlert } from "@/components/form/form-alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Choice } from "../_shared/choice";
import { PageHeader } from "../_shared/page-header";
import { saveFile } from "../_shared/save-file";
import { useMoney } from "../_shared/use-money";

const BUCKETS: AgingBucket[] = ["current", "0_30", "31_60", "61_90", "90_plus"];
const ALL = "all";

/** Outstanding balances by family and age of debt, and money collected per month (FEE-17). */
export function FinanceReports() {
  const t = useTranslations("billing.reports");
  const money = useMoney();
  const errorMessage = useApiErrorMessage();
  const grades = useQuery(getGradeLevelsQueryOptions());
  const [grade, setGrade] = useState(ALL);
  const gradeLevelId = grade === ALL ? undefined : grade;
  const report = useQuery(getOutstandingQueryOptions(gradeLevelId));
  const exportCsv = useMutation({
    mutationFn: () => api.billing.outstandingCsv(gradeLevelId),
    onSuccess: (response) => {
      saveFile(response.data, "outstanding.csv");
      toast.success(t("exported"));
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <div className="flex flex-col gap-10">
      <section
        aria-labelledby="outstanding-title"
        className="flex flex-col gap-4"
      >
        <PageHeader
          title={t("title")}
          description={t("description")}
          actions={
            <Button
              variant="outline"
              disabled={exportCsv.isPending}
              onClick={() => exportCsv.mutate()}
            >
              <DownloadIcon aria-hidden />
              {t("export")}
            </Button>
          }
        />
        <h2 id="outstanding-title" className="sr-only">
          {t("outstanding")}
        </h2>
        <Choice
          id="report-grade"
          label={t("grade")}
          value={grade}
          onChange={setGrade}
          items={[
            { value: ALL, label: t("allGrades") },
            ...(grades.data ?? []).map((entry) => ({
              value: entry.value,
              label: entry.label,
            })),
          ]}
        />
        <FormAlert message={report.error ? errorMessage(report.error) : null} />
        {report.isPending ? (
          <Skeleton className="h-48 w-full" />
        ) : report.data?.families.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("nothingOwed")}</p>
        ) : (
          report.data && (
            <div className="bg-card rounded-lg border">
              <Table label={t("outstanding")}>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("family")}</TableHead>
                    {BUCKETS.map((bucket) => (
                      <TableHead key={bucket} className="text-end">
                        {t(`buckets.${bucket}`)}
                      </TableHead>
                    ))}
                    <TableHead className="text-end">{t("total")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.data.families.map((family) => (
                    <TableRow key={family.familyId}>
                      <TableCell>{family.familyName}</TableCell>
                      {BUCKETS.map((bucket) => (
                        <TableCell
                          key={bucket}
                          className={`text-end tabular-nums ${bucket !== "current" && family.buckets[bucket] !== "0" ? "text-destructive" : ""}`}
                        >
                          {family.buckets[bucket] === "0"
                            ? "—"
                            : money(
                                family.buckets[bucket],
                                report.data.currency,
                              )}
                        </TableCell>
                      ))}
                      <TableCell className="text-end font-medium tabular-nums">
                        {money(family.total, report.data.currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell>{t("total")}</TableCell>
                    {BUCKETS.map((bucket) => (
                      <TableCell key={bucket} className="text-end tabular-nums">
                        {money(
                          report.data.totals[bucket],
                          report.data.currency,
                        )}
                      </TableCell>
                    ))}
                    <TableCell className="text-end font-semibold tabular-nums">
                      {money(report.data.totals.total, report.data.currency)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )
        )}
      </section>
      <Collections />
    </div>
  );
}

function Collections() {
  const t = useTranslations("billing.reports");
  const locale = useLocale();
  const school = useCurrentSchool();
  const money = useMoney();
  const today = todayIn(school.timeZone);
  const range = { from: `${addMonths(today, -11).slice(0, 7)}-01`, to: today };
  const collections = useQuery(getCollectionsQueryOptions(range));
  const monthLabel = (month: string) =>
    new Intl.DateTimeFormat(locale, {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${month}-01T00:00:00Z`));

  return (
    <section
      aria-labelledby="collections-title"
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1">
        <h2
          id="collections-title"
          className="text-lg font-semibold tracking-tight"
        >
          {t("collections")}
        </h2>
        <p className="text-muted-foreground max-w-prose text-sm">
          {t("collectionsDescription")}
        </p>
      </div>
      {collections.isPending ? (
        <Skeleton className="h-32 w-full" />
      ) : collections.data?.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("noCollections")}</p>
      ) : (
        <div className="bg-card rounded-lg border">
          <Table label={t("collections")}>
            <TableHeader>
              <TableRow>
                <TableHead>{t("month")}</TableHead>
                <TableHead className="text-end">{t("received")}</TableHead>
                <TableHead className="text-end">{t("refunded")}</TableHead>
                <TableHead className="text-end">{t("net")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {collections.data?.map((row) => (
                <TableRow key={row.month}>
                  <TableCell className="capitalize">
                    {monthLabel(row.month)}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {money(row.received)}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {row.refunded === "0" ? "—" : money(row.refunded)}
                  </TableCell>
                  <TableCell className="text-end font-medium tabular-nums">
                    {money(row.net)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
