"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { queryKeys } from "@/common/integrations/tanstack-query/query-keys";
import {
  getAttendanceSettingsQueryOptions,
  getAttendanceStatusesQueryOptions,
} from "@/common/integrations/tanstack-query/query-options/attendance";
import { api } from "@/common/service/api";
import { type AttendanceMode, type AttendanceSettings as Settings, COUNTS_AS, type CountsAs } from "@/common/types/daily";
import { FormAlert } from "@/components/form/form-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

function Choice<T extends string>({
  id,
  label,
  items,
  value,
  onChange,
}: Readonly<{ id: string; label: string; items: { value: T; label: string }[]; value: T; onChange: (value: T) => void }>) {
  return (
    <div className="flex w-full flex-col gap-1.5 sm:w-56">
      <Label htmlFor={id}>{label}</Label>
      <Select items={items} value={value} onValueChange={(next) => next && onChange(next as T)}>
        <SelectTrigger id={id} className="w-full">
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

function SettingsForm({ initial }: Readonly<{ initial: Settings }>) {
  const t = useTranslations("attendance.settings");
  const errorMessage = useApiErrorMessage();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<AttendanceMode>(initial.mode);
  const [minutes, setMinutes] = useState(String(initial.notifyAfterMinutes));
  const save = useMutation({
    mutationFn: () => api.attendance.saveSettings({ mode, notifyAfterMinutes: Number(minutes) || 0 }),
    onSuccess: () => {
      toast.success(t("saved"));
      return queryClient.invalidateQueries({ queryKey: queryKeys.attendance.all() });
    },
  });
  return (
    <form
      className="bg-card flex flex-col gap-4 rounded-lg border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <FormAlert message={save.error ? errorMessage(save.error) : null} />
      <div className="flex flex-wrap items-end gap-4">
        <Choice
          id="attendance-mode"
          label={t("mode")}
          value={mode}
          onChange={setMode}
          items={(["daily", "period"] as const).map((value) => ({ value, label: t(`modes.${value}`) }))}
        />
        <div className="flex w-full flex-col gap-1.5 sm:w-auto">
          <Label htmlFor="attendance-delay">{t("notifyAfter")}</Label>
          <Input
            id="attendance-delay"
            inputMode="numeric"
            className="sm:w-28"
            value={minutes}
            onChange={(event) => setMinutes(event.target.value)}
          />
        </div>
      </div>
      <Button type="submit" className="self-start" disabled={save.isPending}>
        {t("save")}
      </Button>
    </form>
  );
}

export function AttendanceSettings() {
  const t = useTranslations("attendance.settings");
  const tStatus = useTranslations("attendance.statuses");
  const errorMessage = useApiErrorMessage();
  const queryClient = useQueryClient();
  const settings = useQuery(getAttendanceSettingsQueryOptions());
  const statuses = useQuery(getAttendanceStatusesQueryOptions());
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [countsAs, setCountsAs] = useState<CountsAs>("present");
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.attendance.all() });
  const create = useMutation({
    mutationFn: () => api.attendance.createStatus({ code: code.trim().toLowerCase(), label: label.trim(), countsAs }),
    onSuccess: () => {
      setCode("");
      setLabel("");
      return refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const remove = useMutation({
    mutationFn: (statusCode: string) => api.attendance.deleteStatus(statusCode),
    onSuccess: refresh,
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="attendance-settings-title" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="attendance-settings-title" className="text-lg font-semibold tracking-tight">
            {t("title")}
          </h2>
          <p className="text-muted-foreground max-w-prose text-sm">{t("description")}</p>
        </div>
        {settings.data ? <SettingsForm initial={settings.data} /> : <Skeleton className="h-32 w-full" />}
      </section>

      <section aria-labelledby="attendance-statuses-title" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="attendance-statuses-title" className="text-lg font-semibold tracking-tight">
            {t("statusesTitle")}
          </h2>
          <p className="text-muted-foreground max-w-prose text-sm">{t("statusesDescription")}</p>
        </div>
        <ul className="bg-card divide-y rounded-lg border">
          {(statuses.data ?? []).map((status) => (
            <li key={status.code} className="flex items-center gap-3 px-4 py-2.5">
              <span className="flex-1 font-medium">{status.label ?? tStatus(status.countsAs)}</span>
              <code className="text-muted-foreground text-xs">{status.code}</code>
              <Badge variant="outline">{tStatus(status.countsAs)}</Badge>
              {status.label !== null && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("deleteStatus", { label: status.label })}
                  onClick={() => remove.mutate(status.code)}
                >
                  <Trash2Icon aria-hidden />
                </Button>
              )}
            </li>
          ))}
        </ul>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (code.trim() && label.trim()) create.mutate();
          }}
        >
          <div className="flex w-full flex-col gap-1.5 sm:w-36">
            <Label htmlFor="status-code">{t("code")}</Label>
            <Input id="status-code" value={code} placeholder="field_trip" onChange={(event) => setCode(event.target.value)} />
          </div>
          <div className="flex min-w-48 flex-1 flex-col gap-1.5">
            <Label htmlFor="status-label">{t("label")}</Label>
            <Input id="status-label" value={label} onChange={(event) => setLabel(event.target.value)} />
          </div>
          <Choice
            id="status-counts"
            label={t("countsAs")}
            value={countsAs}
            onChange={setCountsAs}
            items={COUNTS_AS.map((value) => ({ value, label: tStatus(value) }))}
          />
          <Button type="submit" variant="secondary" disabled={create.isPending}>
            {t("addStatus")}
          </Button>
        </form>
      </section>
    </div>
  );
}
