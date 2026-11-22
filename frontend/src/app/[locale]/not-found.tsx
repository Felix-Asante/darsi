import { useTranslations } from "next-intl";
import { Link } from "@/common/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  const t = useTranslations("notFound");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-muted-foreground font-mono text-sm">404</p>
      <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="text-muted-foreground max-w-sm text-sm">
        {t("description")}
      </p>
      <Link
        href="/"
        className={buttonVariants({ variant: "outline", className: "mt-2" })}
      >
        {t("back")}
      </Link>
    </main>
  );
}
