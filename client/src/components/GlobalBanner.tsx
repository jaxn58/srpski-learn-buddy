import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { X, Info, AlertTriangle, CheckCircle, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

type BannerVariant = "info" | "warning" | "error" | "success";

const variantIcons = {
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
  success: CheckCircle,
};

export function GlobalBanner() {
  // Check if banners API exists (might not be deployed yet)
  const bannersApiExists = api.banners && api.banners.getActiveBanner;
  const activeBanner = useQuery(bannersApiExists ? api.banners.getActiveBanner : null);
  const [isDismissed, setIsDismissed] = useState(false);

  // Check localStorage for dismissed state when banner changes
  useEffect(() => {
    if (activeBanner?._id) {
      const dismissedKey = `banner-dismissed-${activeBanner._id}`;
      const dismissed = localStorage.getItem(dismissedKey) === "true";
      setIsDismissed(dismissed);
    }
  }, [activeBanner?._id]);

  const handleDismiss = () => {
    if (activeBanner?._id) {
      const dismissedKey = `banner-dismissed-${activeBanner._id}`;
      localStorage.setItem(dismissedKey, "true");
      setIsDismissed(true);
    }
  };

  // Don't render if no banner, not active, or dismissed
  if (!activeBanner || !activeBanner.isActive || isDismissed) {
    return null;
  }

  const Icon = variantIcons[activeBanner.variant as BannerVariant];

  return (
    <div className="fixed top-0 left-0 right-0 z-50 shadow-md">
      <Alert variant={activeBanner.variant as BannerVariant} className="rounded-none border-x-0 border-t-0">
        <Icon className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between gap-4 pr-8">
          <div className="flex-1 flex items-center gap-3 flex-wrap">
            <span>{activeBanner.message}</span>
            {activeBanner.link && (
              <a
                href={activeBanner.link}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4 hover:no-underline font-medium"
              >
                {activeBanner.linkText || "Mehr erfahren"}
              </a>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDismiss}
            className="absolute top-2 right-2 h-6 w-6 hover:bg-black/10 dark:hover:bg-white/10"
            aria-label="Banner schließen"
          >
            <X className="h-4 w-4" />
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}
