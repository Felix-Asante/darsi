"use client";

import { useTranslations } from "next-intl";
import type { Role } from "@/common/auth/roles";
import { Link, usePathname } from "@/common/i18n/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { isActivePath, navigationFor } from "./navigation";

export function AppSidebar({
  roles,
  header,
}: Readonly<{ roles: readonly Role[]; header: React.ReactNode }>) {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" aria-label={t("label")}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>{header}</SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {navigationFor(roles).map((section, index) => (
          <SidebarGroup key={section.label ?? index}>
            {section.label && (
              <SidebarGroupLabel>
                {t(`sections.${section.label}`)}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const active = isActivePath(pathname, item.href);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={active}
                        tooltip={t(item.label)}
                        render={
                          <Link
                            href={item.href}
                            aria-current={active ? "page" : undefined}
                          />
                        }
                      >
                        <item.icon aria-hidden />
                        <span>{t(item.label)}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
