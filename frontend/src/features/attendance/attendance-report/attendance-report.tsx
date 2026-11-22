"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { DownloadIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useCurrentSchool } from "@/common/auth/me-context";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { Link } from "@/common/i18n/navigation";
import { getClassesQueryOptions } from "@/common/integrations/tanstack-query/query-options/academics";
import { getAttendanceReportQueryOptions } from "@/common/integrations/tanstack-query/query-options/attendance";
import { addDays, todayIn } from "@/common/lib/calendar-date";
import { api } from "@/common/service/api";
import { FormAlert } from "@/components/form/form-alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const ALL = "";

export function AttendanceReport() {
  const t = useTranslations("attendance.reportPage");
  const tStatus = useTranslations("attendance.statuses");
  const format = useFormatter();
  const errorMessage = useApiErrorMessage();
  const school = useCurrentSchool();
  const today = todayIn(school.timeZone);
  const [from, setFrom] = useState(addDays(today, -30));
  const [to, setTo] = useState(today);
  const [classId, setClassId] = useState(ALL);
  const query = { from, to, ...(classId ? { classId } : {}) };
  const report = useQuery({ ...getAttendanceReportQueryOptions(query), enabled: Boolean(from && to && from <= to) });
  const classes = useQuery(getClassesQueryOptions());
  const classItems = [{ value: ALL, label: t("allClasses") }, ...(classes.data ?? []).map((entry) => ({ value: entry.id, label: entry.name }))];
  const exportCsv = useMutation({
    mutationFn: () => api.attendance.reportCsv(query),
    onSuccess: (response) => {
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `attendance-${from}-${to}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(t("exported"));
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground max-w-prose text-sm">{t("description")}</p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex w-full flex-col gap-1.5 sm:w-44">
          <Label htmlFor="report-from">{t("from")}</Label>
          <Input id="report-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </div>
        <div className="flex w-full flex-col gap-1.5 sm:w-44">
          <Label htmlFor="report-to">{t("to")}</Label>
          <Input id="report-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </div>
        <div className="flex w-full flex-col gap-1.5 sm:w-60">
          <Label htmlFor="report-class">{t("class")}</Label>
          <Select items={classItems} value={classId} onValueChange={(value) => setClassId(value ?? ALL)}>
            <SelectTrigger id="report-class" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {classItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" disabled={exportCsv.isPending} onClick={() => exportCsv.mutate()}>
          <DownloadIcon aria-hidden />
          {t("export")}
        </Button>
      </div>
      <FormAlert message={report.error ? errorMessage(report.error) : null} />
      {report.isPending ? (
        <Skeleton className="h-48 w-full" />
      ) : report.data?.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("empty")}</p>
      ) : (
        <div className="bg-card overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("student")}</TableHead>
                <TableHead className="text-end">{t("rate")}</TableHead>
                <TableHead className="text-end">{tStatus("present")}</TableHead>
                <TableHead className="text-end">{tStatus("late")}</TableHead>
                <TableHead className="text-end">{tStatus("absent")}</TableHead>
                <TableHead className="text-end">{tStatus("excused")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(report.data ?? []).map((line) => (
                <TableRow key={line.student.id}>
                  <TableCell>
                    <Link href={`/attendance/students/${line.student.id}`} className="font-medium hover:underline">
                      {line.student.lastName}, {line.student.preferredName ?? line.student.firstName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {line.rate === null ? "—" : format.number(line.rate, { style: "percent", maximumFractionDigits: 0 })}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">{line.present}</TableCell>
                  <TableCell className="text-end tabular-nums">{line.late}</TableCell>
                  <TableCell className="text-end tabular-nums">{line.absent}</TableCell>
                  <TableCell className="text-end tabular-nums">{line.excused}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
