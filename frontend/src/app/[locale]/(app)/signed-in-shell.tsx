"use client";

import { useCurrentSchool } from "@/common/auth/me-context";
import { AppShell } from "@/components/layout/app-shell";
import { SchoolSwitcher } from "@/features/account/school-switcher/school-switcher";
import { UserMenu } from "@/features/account/user-menu/user-menu";
import { NotificationBell } from "@/features/notifications/inbox/notification-bell";

export function SignedInShell({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { roles } = useCurrentSchool();

  return (
    <AppShell
      roles={roles}
      sidebarHeader={<SchoolSwitcher />}
      actions={
        <>
          <NotificationBell />
          <UserMenu />
        </>
      }
    >
      {children}
    </AppShell>
  );
}
