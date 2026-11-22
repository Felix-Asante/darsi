"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useHasRole } from "@/common/auth/me-context";
import { getClassPortfolioQueryOptions } from "@/common/integrations/tanstack-query/query-options/portfolio";
import { Button } from "@/components/ui/button";
import { AddItemDialog } from "../_shared/add-item-dialog";
import { ItemCard } from "../_shared/item-card";

/** Shared work for the class, its members and its families (PRT-5). */
export function ClassPortfolio({ classId }: Readonly<{ classId: string }>) {
  const t = useTranslations("portfolio");
  const isStaff = useHasRole("admin", "coordinator", "teacher", "teaching_assistant");
  const items = useInfiniteQuery(getClassPortfolioQueryOptions(classId));
  if (items.isError) return null;
  const all = items.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <section aria-labelledby="class-portfolio-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col">
          <h2 id="class-portfolio-title" className="text-base font-semibold tracking-tight">
            {t("classTitle")}
          </h2>
          <p className="text-muted-foreground text-sm">{t("classDescription")}</p>
        </div>
        {isStaff && <AddItemDialog owner={{ classId }} showPendingNote={false} />}
      </div>
      {items.isSuccess && all.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("noItems")}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {all.map((item) => (
            <ItemCard key={item.id} item={item} isStaff={isStaff} canDiscuss={isStaff} />
          ))}
        </div>
      )}
      {items.hasNextPage && (
        <Button variant="outline" className="self-center" onClick={() => items.fetchNextPage()}>
          {t("loadMore")}
        </Button>
      )}
    </section>
  );
}
