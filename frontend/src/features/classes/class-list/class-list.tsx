"use client";

import { CalendarRangeIcon, GraduationCapIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useHasRole } from "@/common/auth/me-context";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { Link } from "@/common/i18n/navigation";
import { FormAlert } from "@/components/form/form-alert";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreateClassDialog } from "./create-class-dialog";
import { useClasses } from "./use-classes";

export function ClassList() {
  const t = useTranslations("classes");
  const errorMessage = useApiErrorMessage();
  const isAdmin = useHasRole("admin");
  const seesAll = useHasRole("admin", "coordinator");
  const { currentYear, classes, createClass } = useClasses();
  const error = currentYear.error ?? classes.error;
  const loading = currentYear.isPending || (Boolean(currentYear.data) && classes.isPending);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight">
            {t("title")}
            {currentYear.data && (
              <span className="text-muted-foreground font-normal"> · {currentYear.data.name}</span>
            )}
          </h1>
          <p className="text-muted-foreground max-w-prose text-sm">
            {seesAll ? t("description") : t("mineDescription")}
          </p>
        </div>
        {isAdmin && currentYear.data && (
          <CreateClassDialog academicYearId={currentYear.data.id} onCreate={(input) => createClass.mutateAsync(input)} />
        )}
      </div>

      <FormAlert message={error ? errorMessage(error) : null} />

      {currentYear.isSuccess && !currentYear.data ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarRangeIcon aria-hidden />
            </EmptyMedia>
            <EmptyTitle>{t("noYearTitle")}</EmptyTitle>
            <EmptyDescription>{t("noYearDescription")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : classes.isSuccess && classes.data.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <GraduationCapIcon aria-hidden />
            </EmptyMedia>
            <EmptyTitle>{t("emptyTitle")}</EmptyTitle>
            <EmptyDescription>{isAdmin ? t("emptyDescription") : t("mineEmptyDescription")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="bg-card overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("name")}</TableHead>
                <TableHead>{t("code")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("subject")}</TableHead>
                <TableHead className="hidden sm:table-cell">{t("grade")}</TableHead>
                <TableHead className="hidden lg:table-cell">{t("teachers")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading
                ? Array.from({ length: 4 }, (_, index) => (
                    <TableRow key={index}>
                      <TableCell colSpan={5}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                : (classes.data ?? []).map((schoolClass) => {
                    const teachers = schoolClass.staff.filter((member) => member.role === "teacher");
                    return (
                      <TableRow key={schoolClass.id}>
                        <TableCell>
                          <Link href={`/classes/${schoolClass.id}`} className="font-medium hover:underline">
                            {schoolClass.name}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <code className="text-muted-foreground text-xs">{schoolClass.code}</code>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">{schoolClass.subject?.name ?? "—"}</TableCell>
                        <TableCell className="hidden sm:table-cell">{schoolClass.gradeLevel?.name ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground hidden lg:table-cell">
                          {teachers.length > 0 ? teachers.map((teacher) => teacher.name).join(", ") : t("noTeacher")}
                        </TableCell>
                      </TableRow>
                    );
                  })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
