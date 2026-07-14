import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { cn } from "@/lib/utils";
import { getEnergyStatus, isEnergyBlockedByDebt, shouldShowEnergyTopUpCta } from "@/lib/energyStatus";
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

interface EnergyPillProps {
  className?: string;
}

/**
 * Pill that shows the user's current AI Energy balance.
 * Pure status indicator -- cost previews belong on the action that triggers them.
 */
export function EnergyPill({ className }: EnergyPillProps) {
  const { t } = useTranslation();
  const access = useFeatureAccess();
  if (!access) return null;
  if (access.energy.unlimited) return null;
  if (access.features.teaser && !access.features.buddyChat) return null;
  if (!access.features.buddyChat) return null;

  const { quotaMonthly, usedThisPeriod, topUpBalance, debtBalance, available } = access.energy;
  const { level, classes } = getEnergyStatus({
    available,
    quotaMonthly,
    debtBalance,
  });
  const showDebtWarning = isEnergyBlockedByDebt({ available, debtBalance });
  const showTopUpCta = shouldShowEnergyTopUpCta(level);

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn(
                "shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold select-none cursor-default transition-colors",
                classes.pill,
              )}
              aria-label={`AI Energy available: ${available}`}
            >
              <Zap className="h-3 w-3" />
              <span className="tabular-nums">{available}</span>
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[220px] px-2.5 py-1.5">
            <div className="text-[11px] leading-snug space-y-px">
              <p className="font-semibold text-[11px]">{t("energy.title")}</p>
              <p className="tabular-nums">
                <span className="font-medium">{Math.max(0, quotaMonthly - usedThisPeriod)}</span>
                <span className="opacity-60"> / {quotaMonthly}</span>
              </p>
              {topUpBalance > 0 && (
                <p className="opacity-70">+{topUpBalance} {t("energy.topUpBalance")}</p>
              )}
              {showDebtWarning && (
                <p className="text-destructive font-medium">
                  {t("energy.debtOutstanding", { amount: debtBalance })}
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
