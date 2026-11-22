"use client";

import { ArrowLeftIcon, FolderIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useHasRole } from "@/common/auth/me-context";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { Link } from "@/common/i18n/navigation";
import { isForbiddenError, isNotFoundError } from "@/common/utils/errors";
import { FormAlert } from "@/components/form/form-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { ClassTimetable } from "./class-timetable";
import { EnrolDialog } from "./enrol-dialog";
import { StaffDialog } from "./staff-dialog";
import { useClass } from "./use-class";

export function ClassDetail({ classId }: Readonly<{ classId: string }>) {
  const t = useTranslations("classes");
  const tFiles = useTranslations("files.drive");
  const errorMessage = useApiErrorMessage();
  const isAdmin = useHasRole("admin");
  const canSeeStudents = useHasRole("admin", "coordinator", "teacher", "teaching_assistant");
  const { schoolClass, roster, setStaff, enrol, unenrol } = useClass(classId);

  const back = (
    <Link href="/classes" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm">
      <ArrowLeftIcon aria-hidden className="size-4" />
      {t("detail.back")}
    </Link>
  );

  if (schoolClass.isPending) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6" aria-busy>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (schoolClass.isError) {
    const missing = isNotFoundError(schoolClass.error) || isForbiddenError(schoolClass.error);
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        {back}
        {missing ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyDescription>{t("detail.notFound")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <FormAlert message={errorMessage(schoolClass.error)} />
        )}
      </div>
    );
  }

  const data = schoolClass.data;
  const students = roster.data ?? [];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      {back}
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="text-xl font-semibold tracking-tight">{data.name}</h1>
        <code className="text-muted-foreground text-sm">{data.code}</code>
        {data.subject && <Badge variant="secondary">{data.subject.name}</Badge>}
        {data.gradeLevel && <Badge variant="outline">{data.gradeLevel.name}</Badge>}
        <Button variant="outline" size="sm" className="ms-auto" nativeButton={false} render={<Link href={`/classes/${classId}/drive`} />}>
          <FolderIcon aria-hidden />
          {tFiles("open")}
        </Button>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <section className="bg-card flex flex-col gap-3 self-start rounded-lg border p-4 sm:p-5" aria-labelledby="staff-title">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="staff-title" className="text-base font-semibold tracking-tight">
              {t("detail.staff")}
            </h2>
            {isAdmin && <StaffDialog staff={data.staff} onSave={(staff) => setStaff.mutateAsync(staff)} />}
          </div>
          {data.staff.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("detail.noStaff")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.staff.map((member) => (
                <li key={member.userId} className="flex flex-col">
                  <span className="font-medium">{member.name}</span>
                  <span className="text-muted-foreground text-xs">{t(`staffRoles.${member.role}`)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {canSeeStudents && (
          <section className="bg-card flex flex-col gap-3 rounded-lg border p-4 sm:p-5" aria-labelledby="roster-title">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="roster-title" className="text-base font-semibold tracking-tight">
                {t("detail.roster")}{" "}
                <span className="text-muted-foreground font-normal tabular-nums">
                  · {t("detail.rosterCount", { count: students.length })}
                </span>
              </h2>
              {isAdmin && (
                <EnrolDialog
                  enrolledIds={students.map((student) => student.id)}
                  onEnrol={(studentIds) => enrol.mutateAsync(studentIds)}
                />
              )}
            </div>
            <FormAlert message={roster.error ? errorMessage(roster.error) : null} />
            {roster.isPending ? (
              <Skeleton className="h-24 w-full" />
            ) : students.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("detail.emptyRoster")}</p>
            ) : (
              <ul className="divide-y">
                {students.map((student) => {
                  const name = `${student.preferredName ?? student.firstName} ${student.lastName}`;
                  return (
                    <li key={student.id} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                      <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
                        <Link href={`/students/${student.id}`} className="font-medium hover:underline">
                          {student.lastName}, {student.preferredName ?? student.firstName}
                        </Link>
                        <code className="text-muted-foreground text-xs">{student.studentNumber}</code>
                      </div>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("detail.unenrolLabel", { name })}
                          disabled={unenrol.isPending}
                          onClick={() =>
                            unenrol.mutate(student.id, {
                              onSuccess: () => toast.success(t("detail.unenrolled", { name })),
                              onError: (error) => toast.error(errorMessage(error)),
                            })
                          }
                        >
                          <XIcon aria-hidden />
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
      </div>
      <ClassTimetable classId={classId} canManage={isAdmin} />
    </div>
  );
}
