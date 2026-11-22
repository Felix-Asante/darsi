"use client";

import { useFormatter, useTranslations } from "next-intl";
import type { ImportJob } from "@/common/types/people";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const STATUS_VARIANT = { queued: "info", running: "info", completed: "success", failed: "destructive" } as const;
const MAX_REPORTED_ERRORS = 500;

export function ImportJobCard({ job }: Readonly<{ job: ImportJob }>) {
  const t = useTranslations("imports");
  const format = useFormatter();
  const rowError = (code: string) =>
    t.has(`rowErrors.${code}` as "rowErrors.unknown") ? t(`rowErrors.${code}` as "rowErrors.unknown") : t("rowErrors.unknown");

  return (
    <li className="flex flex-col gap-3 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium break-all">{job.fileName}</span>
        <span className="text-muted-foreground text-sm">{t(`kinds.${job.kind}`)}</span>
        <Badge variant={STATUS_VARIANT[job.status]}>{t(`statuses.${job.status}`)}</Badge>
        <time className="text-muted-foreground ms-auto text-sm" dateTime={job.createdAt}>
          {format.relativeTime(new Date(job.createdAt))}
        </time>
      </div>
      {job.status === "completed" && (
        <p className="text-sm tabular-nums">
          {t("summary", { imported: job.importedRows, total: job.totalRows })}
          {job.failedRows > 0 && (
            <span className="text-destructive"> · {t("failedRows", { count: job.failedRows })}</span>
          )}
        </p>
      )}
      {job.errors.length > 0 && (
        <details className="group">
          <summary className="text-primary cursor-pointer text-sm font-medium">{t("errors")}</summary>
          <div className="mt-2 max-h-80 overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">{t("row")}</TableHead>
                  <TableHead>{t("column")}</TableHead>
                  <TableHead>{t("problem")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {job.errors.map((error, index) => (
                  <TableRow key={`${error.row}-${error.field}-${index}`}>
                    <TableCell className="tabular-nums">{error.row}</TableCell>
                    <TableCell>{error.field ? <code className="text-xs">{error.field}</code> : "—"}</TableCell>
                    <TableCell className="whitespace-normal">{rowError(error.code)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {job.errors.length >= MAX_REPORTED_ERRORS && (
            <p className="text-muted-foreground mt-2 text-sm">{t("errorsTruncated")}</p>
          )}
        </details>
      )}
    </li>
  );
}
