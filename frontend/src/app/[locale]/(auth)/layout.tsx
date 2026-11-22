import { Link } from "@/common/i18n/navigation";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";

export default function AuthLayout({ children }: LayoutProps<"/[locale]">) {
  return (
    <div className="bg-background flex min-h-svh flex-col">
      <header className="flex h-14 items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          prefetch={false}
          className="flex items-center gap-2 text-base font-semibold tracking-tight"
        >
          <span
            aria-hidden
            className="bg-primary text-primary-foreground grid size-6 place-items-center rounded-md text-xs"
          >
            D
          </span>
          Darsi
        </Link>
        <LocaleSwitcher />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pt-[8vh] pb-12 sm:items-center sm:pt-0">
        {children}
      </main>
    </div>
  );
}
