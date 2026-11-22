"use client";

import { useTranslations } from "next-intl";
import { useHasRole } from "@/common/auth/me-context";
import { Link, usePathname } from "@/common/i18n/navigation";
import { cn } from "@/common/lib/styles";

/** Sections of the admissions office; set-up and re-enrolment only for those who run them. */
export function AdmissionsNav() {
  const t = useTranslations("admissions.nav");
  const pathname = usePathname();
  const manages = useHasRole("admissions_officer");
  const admin = useHasRole("admin");
  const links = [
    { href: "/admissions", label: "applications" as const, show: true },
    { href: "/admissions/settings", label: "settings" as const, show: manages },
    {
      href: "/admissions/re-enrolment",
      label: "reEnrolment" as const,
      show: admin,
    },
  ].filter((link) => link.show);
  return (
    <nav
      aria-label={t("label")}
      className="-mx-1 flex flex-wrap gap-1 border-b pb-2"
    >
      {links.map((link) => {
        const active =
          link.href === "/admissions"
            ? pathname === "/admissions" ||
              pathname.startsWith("/admissions/applications")
            : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {t(link.label)}
          </Link>
        );
      })}
    </nav>
  );
}
