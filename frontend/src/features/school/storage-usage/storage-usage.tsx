"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { getStorageUsageQueryOptions } from "@/common/integrations/tanstack-query/query-options/files";
import { formatBytes } from "@/common/lib/format";
import { cn } from "@/common/lib/styles";

/** The school's file storage against its quota (DRV-9). */
export function StorageUsage() {
  const t = useTranslations("files.usage");
  const locale = useLocale();
  const usage = useQuery(getStorageUsageQueryOptions());
  if (!usage.data) return null;
  const { usedBytes, quotaBytes } = usage.data;
  const share = quotaBytes > 0 ? Math.min(1, usedBytes / quotaBytes) : 1;

  return (
    <section aria-labelledby="storage-title" className="bg-card flex flex-col gap-2 rounded-lg border p-4">
      <h2 id="storage-title" className="text-base font-semibold">
        {t("title")}
      </h2>
      <div
        role="meter"
        aria-label={t("title")}
        aria-valuemin={0}
        aria-valuemax={quotaBytes}
        aria-valuenow={usedBytes}
        aria-valuetext={t("used", { used: formatBytes(usedBytes, locale), quota: formatBytes(quotaBytes, locale) })}
        className="bg-muted h-2 overflow-hidden rounded-full"
      >
        <div className={cn("h-full", share > 0.9 ? "bg-destructive" : share > 0.75 ? "bg-warning" : "bg-primary")} style={{ width: `${share * 100}%` }} />
      </div>
      <p className="text-muted-foreground text-sm tabular-nums">
        {t("used", { used: formatBytes(usedBytes, locale), quota: formatBytes(quotaBytes, locale) })}
      </p>
    </section>
  );
}
