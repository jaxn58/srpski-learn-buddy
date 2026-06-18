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
  const ratio = quotaMonthly > 0 ? Math.max(0, quotaMonthly - usedThisPeriod) / quotaMonthly : 0;
  const hasDebt = debtBalance > 0;
  const isCritical = hasDebt || available === 0 || ratio < 0.1;
  const isLow = !isCritical && ratio < 0.25;
  const showTopUpCta = isCritical || isLow;

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
              {hasDebt && (
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
