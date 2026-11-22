"use client";

import { useQuery } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { Link } from "@/common/i18n/navigation";
import { getInvoicesQueryOptions } from "@/common/integrations/tanstack-query/query-options/billing";
import { formatCalendarDate } from "@/common/lib/format";
import { FormAlert } from "@/components/form/form-alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Choice } from "../_shared/choice";
import { InvoiceStateBadge } from "../_shared/invoice-state-badge";
import { PageHeader } from "../_shared/page-header";
import { useMoney } from "../_shared/use-money";

type Filter = "all" | "draft" | "issued";

/** Every invoice in the school for the finance office (FEE-6, FEE-7). */
export function InvoicesList() {
  const t = useTranslations("billing.invoices");
  const tBilling = useTranslations("billing");
  const locale = useLocale();
  const money = useMoney();
  const errorMessage = useApiErrorMessage();
  const [filter, setFilter] = useState<Filter>("all");
  const invoices = useQuery(
    getInvoicesQueryOptions(filter === "all" ? {} : { status: filter }),
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Button
            nativeButton={false}
            render={<Link href="/billing/invoices/new" />}
          >
            <PlusIcon aria-hidden />
            {t("new")}
          </Button>
        }
      />
      <Choice
        id="invoice-filter"
        label={t("show")}
        value={filter}
        onChange={setFilter}
        items={(["all", "draft", "issued"] as const).map((value) => ({
          value,
          label: t(`filters.${value}`),
        }))}
      />
      <FormAlert
        message={invoices.error ? errorMessage(invoices.error) : null}
      />
      {invoices.isPending ? (
        <Skeleton className="h-48 w-full" />
      ) : invoices.data?.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("none")}</p>
      ) : (
        <div className="bg-card rounded-lg border">
          <Table label={t("title")}>
            <TableHeader>
              <TableRow>
                <TableHead>{t("number")}</TableHead>
                <TableHead>{tBilling("family")}</TableHead>
                <TableHead>{t("due")}</TableHead>
                <TableHead className="text-end">{t("total")}</TableHead>
                <TableHead className="text-end">{t("balance")}</TableHead>
                <TableHead>{t("state")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.data?.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell>
                    <Link
                      href={`/billing/invoices/${invoice.id}`}
                      className="font-mono text-sm hover:underline"
                    >
                      {invoice.number ?? t("draft")}
                    </Link>
                  </TableCell>
                  <TableCell>{invoice.familyName}</TableCell>
                  <TableCell className="tabular-nums">
                    {invoice.dueDate
                      ? formatCalendarDate(invoice.dueDate, locale)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {money(invoice.total, invoice.currency)}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {money(invoice.balance, invoice.currency)}
                  </TableCell>
                  <TableCell>
                    <InvoiceStateBadge state={invoice.state} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
