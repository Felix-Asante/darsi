"use client";

import { useTranslations } from "next-intl";
import { useHasRole } from "@/common/auth/me-context";
import { Link, usePathname } from "@/common/i18n/navigation";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

const SECTIONS = [
  { href: "/settings/school", label: "school" },
  { href: "/settings/members", label: "members" },
  { href: "/settings/academics", label: "academics" },
  { href: "/settings/timetable", label: "timetable" },
  { href: "/settings/grading", label: "grading" },
  { href: "/settings/attendance", label: "attendance" },
  { href: "/settings/planning", label: "planning" },
  { href: "/settings/reports", label: "reports" },
  { href: "/settings/curriculum", label: "curriculum" },
  { href: "/settings/imports", label: "imports" },
] as const;

export function SettingsFrame({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const t = useTranslations("settings");
  const tErrors = useTranslations("errors");
  const pathname = usePathname();
  const isAdmin = useHasRole("admin");

  if (!isAdmin) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{t("title")}</EmptyTitle>
          <EmptyDescription>{tErrors("forbidden")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
      <nav aria-label={t("title")} className="border-b">
        <ul className="-mb-px flex gap-4 overflow-x-auto">
          {SECTIONS.map((section) => {
            const active = pathname.startsWith(section.href);
            return (
              <li key={section.href}>
                <Link
                  href={section.href}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex border-b-2 px-1 pb-2 text-sm font-medium whitespace-nowrap ${
                    active
                      ? "border-primary text-foreground"
                      : "text-muted-foreground hover:text-foreground border-transparent"
                  }`}
                >
                  {t(`nav.${section.label}`)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {children}
    </div>
  );
}
