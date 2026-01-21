import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export function AppFooter({ className }: { className?: string }) {
  const { t } = useTranslation();

  return (
    <footer
      className={cn(
        "w-full border-t bg-gradient-to-r from-red-50/50 via-white to-blue-50/50",
        className
      )}
    >
      <div className="container py-8">
        <div className="flex flex-col items-center gap-3 text-center text-sm text-muted-foreground">
          <nav
            className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2"
            aria-label="Legal links"
          >
            <a
              className="underline underline-offset-4 hover:text-foreground"
              href="/terms#terms"
            >
              Terms
            </a>
            <a
              className="underline underline-offset-4 hover:text-foreground"
              href="/terms#privacy"
            >
              Privacy Policy
            </a>
            <a
              className="underline underline-offset-4 hover:text-foreground"
              href="/terms#refunds"
            >
              Refund Policy
            </a>
          </nav>

          <p className="font-semibold">{t("home.footer.copyright")}</p>
        </div>
      </div>
    </footer>
  );
}

