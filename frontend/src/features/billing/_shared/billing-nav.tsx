"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/common/i18n/navigation";
import { cn } from "@/common/lib/styles";

const LINKS = [
  { href: "/billing", label: "invoices" },
  { href: "/billing/payments", label: "payments" },
  { href: "/billing/runs", label: "runs" },
  { href: "/billing/reports", label: "reports" },
  { href: "/billing/settings", label: "settings" },
] as const;

/** Sections of the finance office. */
export function BillingNav() {
  const t = useTranslations("billing.nav");
  const pathname = usePathname();
  return (
    <nav
      aria-label={t("label")}
      className="-mx-1 flex flex-wrap gap-1 border-b pb-2"
    >
      {LINKS.map((link) => {
        const active =
          link.href === "/billing"
            ? pathname === "/billing" ||
              pathname.startsWith("/billing/invoices")
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
