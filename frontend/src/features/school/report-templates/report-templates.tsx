"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { queryKeys } from "@/common/integrations/tanstack-query/query-keys";
import { getDivisionsQueryOptions, getSubjectsQueryOptions } from "@/common/integrations/tanstack-query/query-options/academics";
import { getPortfolioSettingsQueryOptions } from "@/common/integrations/tanstack-query/query-options/portfolio";
import { getReportTemplatesQueryOptions } from "@/common/integrations/tanstack-query/query-options/reports";
import { api } from "@/common/service/api";
import type { ReportTemplate } from "@/common/types/portfolio";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SCHOOL = "";

function TemplateForm({ divisionId, template }: Readonly<{ divisionId: string; template?: ReportTemplate }>) {
  const t = useTranslations("reports.templates");
  const errorMessage = useApiErrorMessage();
  const queryClient = useQueryClient();
  const subjects = useQuery(getSubjectsQueryOptions());
  const [name, setName] = useState(template?.name ?? "");
  const [subjectIds, setSubjectIds] = useState(template?.subjectIds ?? []);
  const [includeAttendance, setIncludeAttendance] = useState(template?.includeAttendance ?? true);
  const [includeGeneralComment, setIncludeGeneralComment] = useState(template?.includeGeneralComment ?? true);
  const save = useMutation({
    mutationFn: () => api.reports.saveTemplate({ divisionId: divisionId || null, name: name.trim(), subjectIds, includeAttendance, includeGeneralComment }),
    onSuccess: async () => {
      toast.success(t("saved"));
      await queryClient.invalidateQueries({ queryKey: queryKeys.reports.templates() });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <form
      className="bg-card flex flex-col gap-4 rounded-lg border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim()) save.mutate();
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="template-name">{t("name")}</Label>
        <Input id="template-name" value={name} onChange={(event) => setName(event.target.value)} />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">{t("subjects")}</legend>
        <p className="text-muted-foreground text-sm">{t("allSubjects")}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {(subjects.data ?? []).map((subject) => (
            <label key={subject.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={subjectIds.includes(subject.id)}
                onCheckedChange={(checked) =>
                  setSubjectIds((current) => (checked === true ? [...current, subject.id] : current.filter((id) => id !== subject.id)))
                }
              />
              {subject.name}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={includeAttendance} onCheckedChange={(checked) => setIncludeAttendance(checked === true)} />
        {t("attendance")}
      </label>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={includeGeneralComment} onCheckedChange={(checked) => setIncludeGeneralComment(checked === true)} />
        {t("general")}
      </label>
      <Button type="submit" className="self-start" disabled={!name.trim() || save.isPending}>
        {t("save")}
      </Button>
    </form>
  );
}

function PortfolioApproval() {
  const t = useTranslations("portfolio.settings");
  const queryClient = useQueryClient();
  const settings = useQuery(getPortfolioSettingsQueryOptions());
  const save = useMutation({
    mutationFn: (approvalRequired: boolean) => api.portfolio.saveSettings(approvalRequired),
    onSuccess: async () => {
      toast.success(t("saved"));
      await queryClient.invalidateQueries({ queryKey: queryKeys.portfolio.settings() });
    },
  });
  if (!settings.data) return null;
  return (
    <section aria-labelledby="portfolio-settings" className="flex flex-col gap-3">
      <h2 id="portfolio-settings" className="text-lg font-semibold tracking-tight">
        {t("title")}
      </h2>
      <label className="bg-card flex items-center gap-3 rounded-lg border p-4 text-sm">
        <Checkbox checked={settings.data.approvalRequired} onCheckedChange={(checked) => save.mutate(checked === true)} />
        {t("approval")}
      </label>
    </section>
  );
}

/** Report templates per division (RPT-1), and whether portfolio work needs approval (PRT-4). */
export function ReportTemplates() {
  const t = useTranslations("reports.templates");
  const templates = useQuery(getReportTemplatesQueryOptions());
  const divisions = useQuery(getDivisionsQueryOptions());
  const [divisionId, setDivisionId] = useState(SCHOOL);
  const items = [{ value: SCHOOL, label: t("wholeSchool") }, ...(divisions.data ?? []).map((division) => ({ value: division.id, label: division.name }))];
  const template = templates.data?.find((candidate) => (candidate.divisionId ?? SCHOOL) === divisionId);

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="report-templates" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="report-templates" className="text-lg font-semibold tracking-tight">
            {t("title")}
          </h2>
          <p className="text-muted-foreground max-w-prose text-sm">{t("description")}</p>
        </div>
        <div className="flex w-full flex-col gap-1.5 sm:w-64">
          <Label htmlFor="template-division">{t("division")}</Label>
          <Select items={items} value={divisionId} onValueChange={(value) => setDivisionId(value ?? SCHOOL)}>
            <SelectTrigger id="template-division" className="w-full">
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
        {templates.isSuccess && <TemplateForm key={`${divisionId}-${template?.id ?? "new"}`} divisionId={divisionId} template={template} />}
      </section>
      <PortfolioApproval />
    </div>
  );
}
