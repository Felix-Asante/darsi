"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  getFrameworksQueryOptions,
  getStandardsQueryOptions,
} from "@/common/integrations/tanstack-query/query-options/curriculum";
import type { StandardNode } from "@/common/types/academics";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

const flatten = (nodes: StandardNode[]): StandardNode[] => nodes.flatMap((node) => [node, ...flatten(node.children)]);

export function StandardsPicker({ value, onChange }: Readonly<{ value: string[]; onChange: (ids: string[]) => void }>) {
  const t = useTranslations("assessment.form");
  const [search, setSearch] = useState("");
  const frameworks = useQuery(getFrameworksQueryOptions());
  const trees = useQueries({
    queries: (frameworks.data ?? []).map((framework) => getStandardsQueryOptions(framework.id)),
  });
  const standards = trees.flatMap((tree) => flatten(tree.data ?? []));
  const term = search.trim().toLowerCase();
  const shown = standards.filter(
    (standard) => !term || standard.code.toLowerCase().includes(term) || standard.description.toLowerCase().includes(term),
  );

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">{t("standards")}</legend>
      {frameworks.isSuccess && standards.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("noStandards")}</p>
      ) : (
        <>
          <Input
            type="search"
            aria-label={t("standardsSearch")}
            placeholder={t("standardsSearch")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <ul className="max-h-40 overflow-y-auto rounded-md border">
            {shown.slice(0, 100).map((standard) => {
              const id = `standard-${standard.id}`;
              return (
                <li key={standard.id} className="flex items-start gap-2 px-3 py-1.5">
                  <Checkbox
                    id={id}
                    checked={value.includes(standard.id)}
                    onCheckedChange={(checked) =>
                      onChange(checked === true ? [...value, standard.id] : value.filter((existing) => existing !== standard.id))
                    }
                  />
                  <label htmlFor={id} className="text-sm leading-tight">
                    <code className="text-muted-foreground me-1.5 text-xs">{standard.code}</code>
                    {standard.description}
                  </label>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </fieldset>
  );
}
