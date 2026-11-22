"use client";

import { useTranslations } from "next-intl";
import type { Role } from "@/common/auth/roles";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { LocaleSwitcher } from "./locale-switcher";

interface AppShellProps {
  roles: readonly Role[];
  /** Top of the sidebar: the current school, or a switcher between schools. */
  sidebarHeader: React.ReactNode;
  /** End of the top bar: notifications and the account menu. */
  actions: React.ReactNode;
  children: React.ReactNode;
}

export function AppShell({
  roles,
  sidebarHeader,
  actions,
  children,
}: Readonly<AppShellProps>) {
  const t = useTranslations("nav");

  return (
    <SidebarProvider>
      <AppSidebar roles={roles} header={sidebarHeader} />
      <SidebarInset>
        <header className="bg-background/95 sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b px-4 backdrop-blur">
          <SidebarTrigger className="-ms-1" aria-label={t("toggleSidebar")} />
          <div className="ms-auto flex items-center gap-1">
            <LocaleSwitcher />
            {actions}
          </div>
        </header>
        <div className="flex-1 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
