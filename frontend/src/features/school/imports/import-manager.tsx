"use client";

import { UploadIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { IMPORT_KINDS, type ImportKind } from "@/common/types/people";
import { getFieldErrors } from "@/common/utils/errors";
import { FormAlert } from "@/components/form/form-alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ImportJobCard } from "./import-job-card";
import { useImports, useRefreshAfterImports } from "./use-imports";

export function ImportManager() {
  const t = useTranslations("imports");
  const errorMessage = useApiErrorMessage();
  const { jobs, columns, upload } = useImports();
  const refreshAfterImports = useRefreshAfterImports();
  const [kind, setKind] = useState<ImportKind>("students");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const active = jobs.data?.some((job) => job.status === "queued" || job.status === "running") ?? false;
  const wasActive = useRef(active);
  const kindItems = IMPORT_KINDS.map((value) => ({ value, label: t(`kinds.${value}`) }));
  const kindColumns = columns.data?.[kind];

  useEffect(() => {
    if (wasActive.current && !active) void refreshAfterImports();
    wasActive.current = active;
  }, [active, refreshAfterImports]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) return;
    setError(null);
    upload.mutate(
      { kind, file },
      {
        onSuccess: () => {
          toast.success(t("queued", { file: file.name }));
          setFile(null);
          if (fileInput.current) fileInput.current.value = "";
        },
        onError: (uploadError) => {
          const missing = Object.keys(getFieldErrors(uploadError));
          setError(missing.length > 0 ? `${errorMessage(uploadError)} ${missing.join(", ")}` : errorMessage(uploadError));
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="import-title" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="import-title" className="text-lg font-semibold tracking-tight">
            {t("title")}
          </h2>
          <p className="text-muted-foreground max-w-prose text-sm">{t("description")}</p>
        </div>

        <form onSubmit={submit} className="bg-card flex flex-col gap-5 rounded-lg border p-4 sm:p-5">
          <FormAlert message={error} />
          <div className="flex w-full flex-col gap-1.5 sm:w-72">
            <Label htmlFor="import-kind">{t("kind")}</Label>
            <Select items={kindItems} value={kind} onValueChange={(value) => value && setKind(value as ImportKind)}>
              <SelectTrigger id="import-kind" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {kindItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2 text-sm">
            <span className="font-medium">{t("columns")}</span>
            {kindColumns ? (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                <dt className="text-muted-foreground">{t("required")}</dt>
                <dd className="flex flex-wrap gap-1.5">
                  {kindColumns.required.map((column) => (
                    <code key={column} className="bg-muted rounded px-1.5 py-0.5 text-xs">
                      {column}
                    </code>
                  ))}
                </dd>
                {kindColumns.optional.length > 0 && (
                  <>
                    <dt className="text-muted-foreground">{t("optional")}</dt>
                    <dd className="flex flex-wrap gap-1.5">
                      {kindColumns.optional.map((column) => (
                        <code key={column} className="text-muted-foreground rounded border px-1.5 py-0.5 text-xs">
                          {column}
                        </code>
                      ))}
                    </dd>
                  </>
                )}
              </dl>
            ) : (
              <Skeleton className="h-10 w-full" />
            )}
            <p className="text-muted-foreground">{kind === "timetable" ? t("dayHint") : t("listHint")}</p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="flex min-w-60 flex-1 flex-col gap-1.5">
              <Label htmlFor="import-file">{t("file")}</Label>
              <Input
                ref={fileInput}
                id="import-file"
                type="file"
                accept=".csv,text/csv"
                aria-describedby="import-file-hint"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
              <p id="import-file-hint" className="text-muted-foreground text-sm">
                {t("fileHint")}
              </p>
            </div>
            <Button type="submit" disabled={!file || upload.isPending} className="mb-6">
              <UploadIcon aria-hidden />
              {t("upload")}
            </Button>
          </div>
        </form>
      </section>

      <section aria-labelledby="history-title" className="flex flex-col gap-3" aria-live="polite">
        <h2 id="history-title" className="text-lg font-semibold tracking-tight">
          {t("history")}
        </h2>
        <FormAlert message={jobs.error ? errorMessage(jobs.error) : null} />
        {jobs.isPending ? (
          <Skeleton className="h-20 w-full" />
        ) : jobs.data?.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("historyEmpty")}</p>
        ) : (
          <ul className="bg-card divide-y rounded-lg border">
            {(jobs.data ?? []).map((job) => (
              <ImportJobCard key={job.id} job={job} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
