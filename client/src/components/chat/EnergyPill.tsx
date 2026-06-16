import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { cn } from "@/lib/utils";
import { Zap } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { TopupDialog } from "@/components/energy/TopupDialog";
import { useTranslation } from "react-i18next";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";

interface EnergyPillProps {
  className?: string;
  /** Approximate cost band for the next action (preview only). */
  upcomingCostMin?: number | null;
  upcomingCostMax?: number | null;
}

function formatPreviewRange(min: number, max: number): string {
  if (min === max) return `~${min}`;
  return `~${min}–${max}`;
}

/**
 * Pill that shows the user's current AI Energy state.
 */
export function EnergyPill({ className, upcomingCostMin, upcomingCostMax }: EnergyPillProps) {
  const { t } = useTranslation();
  const access = useFeatureAccess();
  const energyInfo = useQuery(api.subscriptions.getPublicEnergyInfo);
  if (!access) return null;
  if (access.energy.unlimited) return null;
  if (access.features.teaser && !access.features.buddyChat) return null;
  if (!access.features.buddyChat) return null;

  const { quotaMonthly, usedThisPeriod, topUpBalance, debtBalance, available } = access.energy;
  const ratio = quotaMonthly > 0 ? Math.max(0, quotaMonthly - usedThisPeriod) / quotaMonthly : 0;
  const hasDebt = debtBalance > 0;
  const isCritical = hasDebt || available === 0 || ratio < 0.1;
  const isLow = !isCritical && ratio < 0.25;
  const showTopUpCta = isCritical || isLow;
  const welcomeEnergyAmount = energyInfo?.welcomeEnergyAmount ?? 0;
  const showWelcomeNote = access.tier === "course_ai_pro" && welcomeEnergyAmount > 0;

  const previewLabel =
    typeof upcomingCostMin === "number" &&
    typeof upcomingCostMax === "number" &&
    upcomingCostMax > 0
      ? formatPreviewRange(upcomingCostMin, upcomingCostMax)
      : null;

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn(
                "shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold select-none cursor-default transition-colors",
                isCritical
                  ? "bg-destructive/10 text-destructive"
                  : isLow
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
              )}
              aria-label={`AI Energy available: ${available}`}
            >
              <Zap className="h-3 w-3" />
              <span className="tabular-nums">{available}</span>
              {previewLabel && (
                <span className="text-muted-foreground/80 tabular-nums">
                  {" "}{previewLabel}
                </span>
              )}
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[260px]">
            <div className="text-xs space-y-0.5">
              <p className="font-medium">{t("energy.title")}</p>
              <p>
                {t("energy.monthlyQuota")}: <span className="tabular-nums">{Math.max(0, quotaMonthly - usedThisPeriod)}</span>
                {" / "}
                <span className="tabular-nums">{quotaMonthly}</span> {t("energy.remaining")}
              </p>
              <p>{t("energy.topUpBalance")}: <span className="tabular-nums">{topUpBalance}</span></p>
              {hasDebt && (
                <p className="text-destructive">
                  {t("energy.debtOutstanding", { amount: debtBalance })}
                </p>
              )}
              {previewLabel && (
                <p className="text-muted-foreground">
                  {t("energy.previewHint", { range: previewLabel })}
                </p>
              )}
              {showWelcomeNote && (
                <p className="text-muted-foreground">
                  {t("energy.welcomeBonusShort", { amount: welcomeEnergyAmount })}
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {showTopUpCta && (
        <TopupDialog>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-1.5 text-[10px] font-semibold rounded-full"
          >
            {t("energy.topUpChatCta")}
          </Button>
        </TopupDialog>
      )}
    </span>
  );
}
