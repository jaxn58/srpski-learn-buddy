import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export function AppFooter({ className, lng }: { className?: string; lng?: "en" | "de" }) {
  const { t } = useTranslation();
  const year = new Date().getFullYear();
  const options = lng ? { lng } : undefined;

  return (
    <footer
      className={cn(
        "w-full border-t bg-gradient-to-r from-red-50/50 via-white to-blue-50/50",
        className
      )}
    >
      <div className="container py-8">
        <div className="flex flex-col items-center gap-3 text-center text-sm text-muted-foreground">
          <p className="max-w-2xl">{t("home.guarantee.line", options)}</p>
          <nav
            className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2"
            aria-label="Legal links"
          >
            <a
              className="underline underline-offset-4 hover:text-foreground"
              href="/terms#terms"
            >
              {t("footer.terms", options)}
            </a>
            <a
              className="underline underline-offset-4 hover:text-foreground"
              href="/terms#privacy"
            >
              {t("footer.privacy", options)}
            </a>
            <a
              className="underline underline-offset-4 hover:text-foreground"
              href="/terms#refunds"
            >
              {t("footer.refunds", options)}
            </a>
          </nav>

          <p className="font-semibold">{t("home.footer.copyright", { ...options, year })}</p>
        </div>
      </div>
    </footer>
  );
}

