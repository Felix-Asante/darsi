"use client";

import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMe } from "@/common/auth/me-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { useSwitchSchool } from "../_shared/use-switch-school";

export function SchoolSwitcher() {
  const t = useTranslations("schoolSwitcher");
  const { schools, currentSchool } = useMe();
  const switchSchool = useSwitchSchool();
  const initial = (
    <span aria-hidden className="bg-primary text-primary-foreground grid size-6 shrink-0 place-items-center rounded-md text-xs font-semibold">
      {currentSchool.name.charAt(0)}
    </span>
  );

  if (schools.length <= 1) {
    return (
      <div className="flex h-8 items-center gap-2 px-2">
        {initial}
        <span className="truncate font-semibold tracking-tight group-data-[collapsible=icon]:hidden">{currentSchool.name}</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<SidebarMenuButton aria-label={t("label")} />}>
        {initial}
        <span className="flex-1 truncate font-semibold tracking-tight">{currentSchool.name}</span>
        <ChevronsUpDownIcon aria-hidden className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("label")}</DropdownMenuLabel>
          {schools.map((school) => (
            <DropdownMenuItem
              key={school.id}
              disabled={switchSchool.isPending}
              onClick={() => school.id !== currentSchool.id && switchSchool.mutate(school)}
            >
              <span className="flex-1 truncate">{school.name}</span>
              {school.id === currentSchool.id && <CheckIcon aria-label={t("current")} />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
