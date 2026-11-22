"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2Icon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { Link, useRouter } from "@/common/i18n/navigation";
import { queryKeys } from "@/common/integrations/tanstack-query/query-keys";
import { getMyApplicationQueryOptions } from "@/common/integrations/tanstack-query/query-options/admissions";
import { formatCalendarDate } from "@/common/lib/format";
import { api } from "@/common/service/api";
import {
  type ApplicationInput,
  type FamilyApplication,
  type FormField,
  RELATIONSHIPS,
  type Relationship,
} from "@/common/types/admissions";
import { isApiError } from "@/common/utils/errors";
import { UploadButton } from "@/components/files/upload-button";
import { FormAlert } from "@/components/form/form-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { localizedLabel } from "../_shared/localized-label";
import { StageBadge } from "../_shared/stage-badge";

/** One application: filled in and submitted by the family, then followed to a decision (ADMS-4, ADMS-9). */
export function ApplicationForm({
  applicationId,
}: Readonly<{ applicationId: string }>) {
  const errorMessage = useApiErrorMessage();
  const application = useQuery(getMyApplicationQueryOptions(applicationId));
  if (application.error)
    return <FormAlert message={errorMessage(application.error)} />;
  if (!application.data) return <Skeleton className="h-96 w-full max-w-3xl" />;
  return application.data.status === "draft" ? (
    <DraftForm key={application.data.id} application={application.data} />
  ) : (
    <SubmittedView application={application.data} />
  );
}

const toInput = (application: FamilyApplication): ApplicationInput => ({
  cycleId: application.cycle.id,
  gradeLevelId: application.gradeLevel.id,
  studentFirstName: application.student.firstName ?? "",
  studentLastName: application.student.lastName ?? "",
  studentPreferredName: application.student.preferredName ?? "",
  studentDateOfBirth: application.student.dateOfBirth ?? "",
  guardianFirstName: application.guardian.firstName ?? "",
  guardianLastName: application.guardian.lastName ?? "",
  guardianPhone: application.guardian.phone ?? "",
  guardianRelationship: application.guardian.relationship,
  answers: application.answers,
});

function DraftForm({
  application,
}: Readonly<{ application: FamilyApplication }>) {
  const t = useTranslations("admissions.form");
  const tRelationship = useTranslations("admissions.relationships");
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const errorMessage = useApiErrorMessage();
  const [values, setValues] = useState<ApplicationInput>(() =>
    toInput(application),
  );
  const [missing, setMissing] = useState<string[]>([]);
  const set = (patch: Partial<ApplicationInput>) =>
    setValues((current) => ({ ...current, ...patch }));
  const setAnswer = (key: string, value: string | boolean) =>
    setValues((current) => ({
      ...current,
      answers: { ...current.answers, [key]: value },
    }));
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.admissions.all() });
  const payload = (): ApplicationInput => ({
    ...values,
    studentDateOfBirth: values.studentDateOfBirth || null,
  });

  const save = useMutation({
    mutationFn: () =>
      api.admissions.updateApplication(application.id, payload()),
    onSuccess: async () => {
      toast.success(t("saved"));
      await refresh();
    },
  });
  const submit = useMutation({
    mutationFn: async () => {
      await api.admissions.updateApplication(application.id, payload());
      return api.admissions.submitApplication(application.id);
    },
    onSuccess: async () => {
      setMissing([]);
      toast.success(t("submitted"));
      await refresh();
    },
    onError: (error) => {
      if (
        isApiError(error) &&
        error.code === "validation_failed" &&
        error.errors
      )
        setMissing(error.errors.map((entry) => entry.field));
    },
  });
  const remove = useMutation({
    mutationFn: () => api.admissions.deleteApplication(application.id),
    onSuccess: async () => {
      await refresh();
      router.push("/applications");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const attach = useMutation({
    mutationFn: ({ key, fileId }: { key: string; fileId: string }) =>
      api.admissions.attachDocument(application.id, key, fileId),
    onSuccess: refresh,
    onError: (error) => toast.error(errorMessage(error)),
  });

  const labelFor = (field: string) => {
    if (field.startsWith("answers.")) {
      const question = application.form.fields.find(
        (entry) => entry.key === field.slice(8),
      );
      return question ? localizedLabel(question.label, locale) : field;
    }
    if (field.startsWith("documents.")) {
      const document = application.form.documents.find(
        (entry) => entry.key === field.slice(10),
      );
      return document ? localizedLabel(document.label, locale) : field;
    }
    return t.has(`fields.${field}` as "fields.studentFirstName")
      ? t(`fields.${field}` as "fields.studentFirstName")
      : field;
  };
  const invalid = (field: string) => missing.includes(field);
  const text = (
    field: keyof ApplicationInput,
    options: { type?: string; autoComplete?: string } = {},
  ) => (
    <div className="flex w-full flex-col gap-1.5 sm:w-64">
      <Label htmlFor={`application-${field}`}>
        {t(`fields.${field}` as "fields.studentFirstName")}
      </Label>
      <Input
        id={`application-${field}`}
        type={options.type ?? "text"}
        autoComplete={options.autoComplete}
        aria-invalid={invalid(field) || undefined}
        value={(values[field] as string | null) ?? ""}
        onChange={(event) => set({ [field]: event.target.value })}
      />
    </div>
  );

  return (
    <form
      className="mx-auto flex w-full max-w-3xl flex-col gap-8"
      onSubmit={(event) => {
        event.preventDefault();
        submit.mutate();
      }}
    >
      <div className="flex flex-col gap-1">
        <h1 className="flex flex-wrap items-center gap-3 text-xl font-semibold tracking-tight">
          {t("title", { grade: application.gradeLevel.name })}
          <Badge variant="info">{t("draft")}</Badge>
        </h1>
        <p className="text-muted-foreground text-sm">
          {application.cycle.name}
        </p>
      </div>
      {missing.length > 0 && (
        <div
          role="alert"
          className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-sm"
        >
          <p className="font-medium">{t("incomplete")}</p>
          <ul className="list-disc ps-5">
            {missing.map((field) => (
              <li key={field}>{labelFor(field)}</li>
            ))}
          </ul>
        </div>
      )}
      <FormAlert
        message={
          submit.error && missing.length === 0
            ? errorMessage(submit.error)
            : save.error
              ? errorMessage(save.error)
              : null
        }
      />

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-lg font-semibold tracking-tight">
          {t("student")}
        </legend>
        <div className="flex flex-wrap gap-4">
          {text("studentFirstName")}
          {text("studentLastName")}
          {text("studentPreferredName")}
          {text("studentDateOfBirth", { type: "date" })}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-lg font-semibold tracking-tight">
          {t("you")}
        </legend>
        <div className="flex flex-wrap gap-4">
          {text("guardianFirstName", { autoComplete: "given-name" })}
          {text("guardianLastName", { autoComplete: "family-name" })}
          {text("guardianPhone", { type: "tel", autoComplete: "tel" })}
          <div className="flex w-full flex-col gap-1.5 sm:w-64">
            <Label htmlFor="application-guardianRelationship">
              {t("fields.guardianRelationship")}
            </Label>
            <Select
              items={RELATIONSHIPS.map((value) => ({
                value,
                label: tRelationship(value),
              }))}
              value={values.guardianRelationship ?? null}
              onValueChange={(next) =>
                next && set({ guardianRelationship: next as Relationship })
              }
            >
              <SelectTrigger
                id="application-guardianRelationship"
                className="w-full"
                aria-invalid={invalid("guardianRelationship") || undefined}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RELATIONSHIPS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {tRelationship(value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </fieldset>

      {application.form.fields.length > 0 && (
        <fieldset className="flex flex-col gap-4">
          <legend className="mb-2 text-lg font-semibold tracking-tight">
            {t("questions")}
          </legend>
          {application.form.fields.map((field) => (
            <Question
              key={field.key}
              field={field}
              invalid={invalid(`answers.${field.key}`)}
              value={values.answers?.[field.key]}
              onChange={(value) => setAnswer(field.key, value)}
            />
          ))}
        </fieldset>
      )}

      {application.form.documents.length > 0 && (
        <section
          aria-labelledby="application-documents"
          className="flex flex-col gap-3"
        >
          <h2
            id="application-documents"
            className="text-lg font-semibold tracking-tight"
          >
            {t("documents")}
          </h2>
          <ul className="bg-card divide-y rounded-lg border">
            {application.form.documents.map((document) => {
              const attached = application.documents.find(
                (entry) => entry.key === document.key,
              );
              const label = localizedLabel(document.label, locale);
              return (
                <li
                  key={document.key}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
                >
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span
                      className={
                        invalid(`documents.${document.key}`)
                          ? "text-destructive font-medium"
                          : "font-medium"
                      }
                    >
                      {label}
                      {document.required && (
                        <span className="text-muted-foreground">
                          {" "}
                          {t("required")}
                        </span>
                      )}
                    </span>
                    {attached && (
                      <span className="text-muted-foreground flex items-center gap-1 text-xs">
                        <CheckCircle2Icon
                          aria-hidden
                          className="text-success size-3.5"
                        />
                        {attached.file.name}
                      </span>
                    )}
                  </div>
                  <UploadButton
                    variant="outline"
                    multiple={false}
                    label={
                      attached
                        ? t("replace", { document: label })
                        : t("upload", { document: label })
                    }
                    target={{
                      type: "application",
                      applicationId: application.id,
                    }}
                    onUploaded={([file]) =>
                      file &&
                      attach.mutate({ key: document.key, fileId: file.id })
                    }
                  />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={submit.isPending}>
          {t("submit")}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={save.isPending}
          onClick={() => save.mutate()}
        >
          {t("save")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={remove.isPending}
          onClick={() => remove.mutate()}
        >
          {t("delete")}
        </Button>
      </div>
      {application.cycle.applicationFee !== "0" && (
        <p className="text-muted-foreground text-sm">{t("feeNotice")}</p>
      )}
    </form>
  );
}

function Question({
  field,
  value,
  invalid,
  onChange,
}: Readonly<{
  field: FormField;
  value: string | boolean | undefined;
  invalid: boolean;
  onChange: (value: string | boolean) => void;
}>) {
  const t = useTranslations("admissions.form");
  const locale = useLocale();
  const id = `question-${field.key}`;
  const label = (
    <>
      {localizedLabel(field.label, locale)}
      {field.required && (
        <span className="text-muted-foreground"> {t("required")}</span>
      )}
    </>
  );
  if (field.type === "checkbox") {
    return (
      <div className="flex items-center gap-2">
        <Checkbox
          id={id}
          checked={value === true}
          onCheckedChange={(checked) => onChange(checked === true)}
          aria-invalid={invalid || undefined}
        />
        <Label htmlFor={id} className="font-normal">
          {label}
        </Label>
      </div>
    );
  }
  if (field.type === "select") {
    const items = (field.options ?? []).map((option) => ({
      value: option,
      label: option,
    }));
    return (
      <div className="flex w-full flex-col gap-1.5 sm:w-80">
        <Label htmlFor={id}>{label}</Label>
        <Select
          items={items}
          value={typeof value === "string" && value ? value : null}
          onValueChange={(next) => next && onChange(next)}
        >
          <SelectTrigger
            id={id}
            className="w-full"
            aria-invalid={invalid || undefined}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }
  const text = typeof value === "string" ? value : "";
  return (
    <div className="flex w-full flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {field.type === "textarea" ? (
        <Textarea
          id={id}
          value={text}
          aria-invalid={invalid || undefined}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <Input
          id={id}
          type={field.type === "date" ? "date" : "text"}
          className={field.type === "date" ? "w-44" : "sm:w-96"}
          value={text}
          aria-invalid={invalid || undefined}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </div>
  );
}

function SubmittedView({
  application,
}: Readonly<{ application: FamilyApplication }>) {
  const t = useTranslations("admissions.form");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const errorMessage = useApiErrorMessage();
  const respond = useMutation({
    mutationFn: (response: "accepted" | "declined") =>
      api.admissions.respondToOffer(application.id, response),
    onSuccess: async (_, response) => {
      toast.success(
        t(response === "accepted" ? "offerAccepted" : "offerDeclined"),
      );
      await queryClient.invalidateQueries();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const name = [application.student.firstName, application.student.lastName]
    .filter(Boolean)
    .join(" ");
  const openOffer =
    application.offer &&
    !application.offer.response &&
    application.stage?.kind === "offered";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="flex flex-wrap items-center gap-3 text-xl font-semibold tracking-tight">
          {name}
          {application.stage && <StageBadge stage={application.stage} />}
        </h1>
        <p className="text-muted-foreground text-sm">
          {application.gradeLevel.name} · {application.cycle.name}
        </p>
      </div>

      {openOffer && (
        <section
          aria-labelledby="offer-title"
          className="bg-card flex flex-col gap-3 rounded-lg border border-warning/40 p-4"
        >
          <h2 id="offer-title" className="font-semibold">
            {t("offerTitle", { student: name })}
          </h2>
          {application.offer?.expiresOn && (
            <p className="text-sm">
              {t("offerExpires", {
                date: formatCalendarDate(
                  application.offer.expiresOn,
                  locale,
                  "long",
                ),
              })}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={respond.isPending}
              onClick={() => respond.mutate("accepted")}
            >
              {t("accept")}
            </Button>
            <Button
              variant="outline"
              disabled={respond.isPending}
              onClick={() => respond.mutate("declined")}
            >
              {t("decline")}
            </Button>
          </div>
        </section>
      )}
      {application.stage?.kind === "enrolled" && (
        <p className="bg-success/10 text-success rounded-lg px-3 py-2 text-sm">
          {t("enrolled", { student: name })}
        </p>
      )}

      <dl className="bg-card grid gap-x-6 gap-y-3 rounded-lg border p-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">
            {t("fields.studentDateOfBirth")}
          </dt>
          <dd className="tabular-nums">
            {application.student.dateOfBirth
              ? formatCalendarDate(application.student.dateOfBirth, locale)
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("submittedOn")}</dt>
          <dd className="tabular-nums">
            {application.submittedAt
              ? formatCalendarDate(application.submittedAt.slice(0, 10), locale)
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("documents")}</dt>
          <dd>
            {application.documents
              .map((document) => document.file.name)
              .join(", ") || "—"}
          </dd>
        </div>
      </dl>
      {application.feeInvoiceId && (
        <p className="text-sm">
          {t("feeInvoiced")}{" "}
          <Link
            href="/billing"
            className="text-primary font-medium hover:underline"
          >
            {t("seeInvoice")}
          </Link>
        </p>
      )}
    </div>
  );
}
