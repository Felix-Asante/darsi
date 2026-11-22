"use client";

import { LanguagesIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Suspense, useTransition } from "react";
import { usePathname, useRouter } from "@/common/i18n/navigation";
import { type Locale, routing } from "@/common/i18n/routing";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** The menu reads the current path, which is request data on dynamic routes. */
export function LocaleSwitcher() {
  return (
    <Suspense fallback={<LocaleSwitcherPlaceholder />}>
      <LocaleSwitcherMenu />
    </Suspense>
  );
}

function LocaleSwitcherPlaceholder() {
  const locale = useLocale();
  return (
    <Button variant="ghost" size="sm" disabled>
      <LanguagesIcon aria-hidden />
      <span className="uppercase">{locale}</span>
    </Button>
  );
}

function LocaleSwitcherMenu() {
  const t = useTranslations("locale");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const changeLocale = (next: string) =>
    startTransition(() => router.replace(pathname, { locale: next as Locale }));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="sm" disabled={isPending} />}
      >
        <LanguagesIcon aria-hidden />
        <span className="sr-only">{t("label")}: </span>
        <span className="uppercase">{locale}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={locale} onValueChange={changeLocale}>
          {routing.locales.map((option) => (
            <DropdownMenuRadioItem key={option} value={option} lang={option}>
              {t(option)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
