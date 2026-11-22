"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useApiErrorMessage } from "@/common/hooks/use-api-error-message";
import { queryKeys } from "@/common/integrations/tanstack-query/query-keys";
import {
  getFrameworksQueryOptions,
  getStandardsQueryOptions,
} from "@/common/integrations/tanstack-query/query-options/curriculum";
import { api } from "@/common/service/api";
import type { StandardNode } from "@/common/types/academics";
import { FormAlert } from "@/components/form/form-alert";
import { Skeleton } from "@/components/ui/skeleton";
import { InlineForm } from "../_shared/inline-form";

function StandardTree({ nodes }: Readonly<{ nodes: StandardNode[] }>) {
  return (
    <ul className="flex flex-col gap-1.5 border-s ps-4">
      {nodes.map((node) => (
        <li key={node.id} className="flex flex-col gap-1.5">
          <p className="text-sm">
            <code className="text-muted-foreground me-2 text-xs">{node.code}</code>
            {node.description}
          </p>
          {node.children.length > 0 && <StandardTree nodes={node.children} />}
        </li>
      ))}
    </ul>
  );
}

function FrameworkStandards({ frameworkId, name }: Readonly<{ frameworkId: string; name: string }>) {
  const t = useTranslations("curriculum");
  const errorMessage = useApiErrorMessage();
  const standards = useQuery(getStandardsQueryOptions(frameworkId));

  if (standards.isPending) return <Skeleton className="h-16 w-full" />;
  if (standards.isError) return <FormAlert message={errorMessage(standards.error)} />;
  return (
    <div aria-label={t("viewStandards", { name })} role="group">
      {standards.data.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("noStandards")}</p>
      ) : (
        <StandardTree nodes={standards.data} />
      )}
    </div>
  );
}

export function CurriculumFrameworks() {
  const t = useTranslations("curriculum");
  const errorMessage = useApiErrorMessage();
  const queryClient = useQueryClient();
  const frameworks = useQuery(getFrameworksQueryOptions());
  const [openId, setOpenId] = useState<string | null>(null);
  const createFramework = useMutation({
    mutationFn: (input: { code: string; name: string }) => api.curriculum.createFramework(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.curriculum.all() }),
  });

  return (
    <section aria-labelledby="curriculum-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="curriculum-title" className="text-lg font-semibold tracking-tight">
          {t("title")}
        </h2>
        <p className="text-muted-foreground max-w-prose text-sm">{t("description")}</p>
      </div>
      <FormAlert message={frameworks.error ? errorMessage(frameworks.error) : null} />
      {frameworks.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : frameworks.data?.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("empty")}</p>
      ) : (
        <ul className="bg-card divide-y rounded-lg border">
          {(frameworks.data ?? []).map((framework) => {
            const open = openId === framework.id;
            return (
              <li key={framework.id} className="flex flex-col gap-3 px-4 py-3">
                <button
                  type="button"
                  aria-expanded={open}
                  className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 text-start"
                  onClick={() => setOpenId(open ? null : framework.id)}
                >
                  <ChevronRightIcon
                    aria-hidden
                    className={`text-muted-foreground size-4 transition-transform ${open ? "rotate-90" : ""}`}
                  />
                  <span className="font-medium">{framework.name}</span>
                  <code className="text-muted-foreground text-xs">{framework.code}</code>
                  <span className="text-muted-foreground ms-auto text-sm tabular-nums">
                    {t("standards", { count: framework.standardCount })}
                  </span>
                </button>
                {open && <FrameworkStandards frameworkId={framework.id} name={framework.name} />}
              </li>
            );
          })}
        </ul>
      )}
      <InlineForm
        id="new-framework"
        submitLabel={t("add")}
        fields={[
          { name: "code", label: t("code"), className: "flex w-full flex-col gap-1.5 sm:w-40" },
          { name: "name", label: t("name") },
        ]}
        onSubmit={async ({ code, name }) => {
          await createFramework.mutateAsync({ code, name });
          toast.success(t("created", { name }));
        }}
      />
    </section>
  );
}
