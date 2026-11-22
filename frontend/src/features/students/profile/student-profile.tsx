"use client";

import { ArrowLeftIcon, XIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useHasRole } from "@/common/auth/me-context";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { Link } from "@/common/i18n/navigation";
import { formatCalendarDate } from "@/common/lib/format";
import { isForbiddenError, isNotFoundError } from "@/common/utils/errors";
import { FormAlert } from "@/components/form/form-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { AddGuardianDialog } from "./add-guardian-dialog";
import { WithdrawDialog } from "./withdraw-dialog";
import { useStudent } from "./use-student";

function Section({
  title,
  action,
  children,
}: Readonly<{
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}>) {
  return (
    <section className="bg-card flex flex-col gap-3 rounded-lg border p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function StudentProfile({ studentId }: Readonly<{ studentId: string }>) {
  const t = useTranslations("students");
  const tPortfolio = useTranslations("portfolio");
  const locale = useLocale();
  const errorMessage = useApiErrorMessage();
  const canManage = useHasRole("admin");
  const canBrowse = useHasRole(
    "admin",
    "coordinator",
    "teacher",
    "teaching_assistant",
  );
  const { student, addGuardian, unlinkGuardian } = useStudent(studentId);
  const date = (value: string | null) =>
    value ? formatCalendarDate(value, locale) : t("profile.notSet");

  const back = canBrowse && (
    <Link
      href="/students"
      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
    >
      <ArrowLeftIcon aria-hidden className="size-4" />
      {t("profile.back")}
    </Link>
  );

  if (student.isPending) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6" aria-busy>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (student.isError) {
    const missing =
      isNotFoundError(student.error) || isForbiddenError(student.error);
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        {back}
        {missing ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyDescription>{t("profile.notFound")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <FormAlert message={errorMessage(student.error)} />
        )}
      </div>
    );
  }

  const profile = student.data;
  const displayName = `${profile.preferredName ?? profile.firstName} ${profile.lastName}`;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      {back}
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="text-xl font-semibold tracking-tight">{displayName}</h1>
        <code className="text-muted-foreground text-sm">
          {profile.studentNumber}
        </code>
        {profile.gradeLevel && (
          <Badge variant="secondary">{profile.gradeLevel.name}</Badge>
        )}
        <Badge variant={profile.status === "active" ? "success" : "secondary"}>
          {t(`statuses.${profile.status}`)}
        </Badge>
        <Link
          href={`/portfolio/${profile.id}`}
          className="text-primary ms-auto text-sm font-medium hover:underline"
        >
          {tPortfolio("open")}
        </Link>
        {canManage && profile.status === "active" && (
          <WithdrawDialog studentId={profile.id} name={displayName} />
        )}
      </header>
      {profile.status === "withdrawn" && profile.withdrawnOn && (
        <p className="text-muted-foreground text-sm">
          {t("withdraw.left", { date: date(profile.withdrawnOn) })}
          {profile.withdrawalReason ? ` · ${profile.withdrawalReason}` : ""}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title={t("profile.details")}>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-muted-foreground">{t("form.firstName")}</dt>
            <dd>{profile.firstName}</dd>
            <dt className="text-muted-foreground">{t("form.lastName")}</dt>
            <dd>{profile.lastName}</dd>
            <dt className="text-muted-foreground">
              {t("profile.dateOfBirth")}
            </dt>
            <dd className="tabular-nums">{date(profile.dateOfBirth)}</dd>
            <dt className="text-muted-foreground">{t("profile.email")}</dt>
            <dd className="break-all">
              {profile.email ?? t("profile.notSet")}
            </dd>
            <dt className="text-muted-foreground">{t("profile.enrolledOn")}</dt>
            <dd className="tabular-nums">{date(profile.enrolledOn)}</dd>
          </dl>
        </Section>

        <Section
          title={t("guardians.title")}
          action={
            canManage && (
              <AddGuardianDialog
                hasGuardians={profile.guardians.length > 0}
                onAdd={(input) => addGuardian.mutateAsync(input)}
              />
            )
          }
        >
          {profile.guardians.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {t("guardians.empty")}
            </p>
          ) : (
            <ul className="divide-y">
              {profile.guardians.map((guardian) => {
                const name = `${guardian.firstName} ${guardian.lastName}`;
                return (
                  <li
                    key={guardian.id}
                    className="flex flex-wrap items-start gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="font-medium">
                        {name}
                        <span className="text-muted-foreground font-normal">
                          {" · "}
                          {t(
                            `guardians.relationships.${guardian.relationship}`,
                          )}
                        </span>
                      </span>
                      <span className="text-muted-foreground text-sm break-all">
                        {guardian.email}
                      </span>
                      {guardian.phone && (
                        <span className="text-muted-foreground text-sm">
                          {guardian.phone}
                        </span>
                      )}
                      <div className="flex flex-wrap gap-1">
                        {guardian.isPrimaryContact && (
                          <Badge variant="info">{t("guardians.primary")}</Badge>
                        )}
                        <Badge
                          variant={
                            guardian.hasAccount ? "success" : "secondary"
                          }
                        >
                          {guardian.hasAccount
                            ? t("guardians.hasAccount")
                            : t("guardians.noAccount")}
                        </Badge>
                      </div>
                    </div>
                    {canManage && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("guardians.removeLabel", { name })}
                        disabled={unlinkGuardian.isPending}
                        onClick={() =>
                          unlinkGuardian.mutate(guardian.id, {
                            onSuccess: () =>
                              toast.success(t("guardians.removed", { name })),
                            onError: (error) =>
                              toast.error(errorMessage(error)),
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
        </Section>

        <Section title={t("profile.classes")}>
          {profile.classes.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {t("profile.noClasses")}
            </p>
          ) : (
            <ul className="divide-y">
              {profile.classes.map((schoolClass) => (
                <li
                  key={schoolClass.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 py-2 first:pt-0 last:pb-0"
                >
                  <span>
                    {canBrowse ? (
                      <Link
                        href={`/classes/${schoolClass.id}`}
                        className="font-medium hover:underline"
                      >
                        {schoolClass.name}
                      </Link>
                    ) : (
                      <span className="font-medium">{schoolClass.name}</span>
                    )}{" "}
                    <code className="text-muted-foreground text-xs">
                      {schoolClass.code}
                    </code>
                  </span>
                  <span className="text-muted-foreground text-sm tabular-nums">
                    {t("profile.since", {
                      date: formatCalendarDate(
                        schoolClass.enrolledSince,
                        locale,
                      ),
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          title={
            profile.family
              ? `${t("profile.family")} · ${profile.family.name}`
              : t("profile.family")
          }
        >
          {!profile.family ? (
            <p className="text-muted-foreground text-sm">
              {t("profile.noFamily")}
            </p>
          ) : profile.siblings.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {t("profile.noSiblings")}
            </p>
          ) : (
            <>
              <h3 className="text-muted-foreground text-sm">
                {t("profile.siblings")}
              </h3>
              <ul className="flex flex-col gap-1">
                {profile.siblings.map((sibling) => (
                  <li
                    key={sibling.id}
                    className="flex flex-wrap items-baseline gap-2"
                  >
                    <Link
                      href={`/students/${sibling.id}`}
                      className="font-medium hover:underline"
                    >
                      {sibling.preferredName ?? sibling.firstName}{" "}
                      {sibling.lastName}
                    </Link>
                    {sibling.gradeLevel && (
                      <span className="text-muted-foreground text-sm">
                        {sibling.gradeLevel.name}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </Section>
      </div>
    </div>
  );
}
