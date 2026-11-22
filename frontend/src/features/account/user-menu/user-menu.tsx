"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BellIcon, LogOutIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useMe } from "@/common/auth/me-context";
import { useRouter } from "@/common/i18n/navigation";
import { api } from "@/common/service/api";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

export function UserMenu() {
  const t = useTranslations("userMenu");
  const tCommon = useTranslations("common");
  const { user } = useMe();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const signOut = useMutation({
    mutationFn: () => api.auth.signOut(),
    onSettled: () => {
      queryClient.clear();
      router.replace("/sign-in");
    },
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" />}>
        <span className="sr-only">
          {t("label")}: {user.name}
        </span>
        <Avatar aria-hidden className="size-7">
          <AvatarFallback className="text-xs">{initials(user.name)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col">
            <span className="text-foreground truncate font-medium">{user.name}</span>
            <span className="text-muted-foreground truncate text-xs font-normal">{user.email}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("theme")}</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
            <DropdownMenuRadioItem value="light">{t("light")}</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark">{t("dark")}</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="system">{t("system")}</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/notifications")}>
          <BellIcon aria-hidden />
          {t("notificationSettings")}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={signOut.isPending} onClick={() => signOut.mutate()}>
          <LogOutIcon aria-hidden />
          {tCommon("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
