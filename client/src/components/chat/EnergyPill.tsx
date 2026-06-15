import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { cn } from "@/lib/utils";
import { Zap } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface EnergyPillProps {
  className?: string;
  /** Optional: live cost preview for the next action, shown after the available number. */
  upcomingCost?: number | null;
}

/**
 * Pill that shows the user's current AI Energy state.
 *
 * - Hidden for staff / unlimited tiers (nothing useful to communicate).
 * - Hidden for course-tier teaser users (they have a daily Buddy counter,
 *   not Energy — see the existing chat usage pill).
 * - Color-coded: green ≥ 25 %, amber 10–25 %, red < 10 % of monthly quota.
 *
 * Use the `upcomingCost` prop to overlay a live preview of the next message's
 * cost (e.g. ", –4"). The pill stays read-only; Top-up CTAs live in the
 * dedicated upgrade / settings flow.
 */
export function EnergyPill({ className, upcomingCost }: EnergyPillProps) {
  const access = useFeatureAccess();
  if (!access) return null;
  if (access.energy.unlimited) return null;
  if (access.features.teaser && !access.features.buddyChat) return null;
  if (!access.features.buddyChat) return null;

  const { quotaMonthly, usedThisPeriod, topUpBalance, available } = access.energy;
  const ratio = quotaMonthly > 0 ? Math.max(0, quotaMonthly - usedThisPeriod) / quotaMonthly : 0;
  const isCritical = available === 0 || ratio < 0.1;
  const isLow = !isCritical && ratio < 0.25;

  return (
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
              className
            )}
            aria-label={`AI Energy available: ${available}`}
          >
            <Zap className="h-3 w-3" />
            <span className="tabular-nums">{available}</span>
            {typeof upcomingCost === "number" && upcomingCost > 0 && (
              <span className="text-muted-foreground/80 tabular-nums">
                {" "}-{upcomingCost}
              </span>
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[260px]">
          <div className="text-xs space-y-0.5">
            <p className="font-medium">AI Energy</p>
            <p>
              Monthly quota: <span className="tabular-nums">{Math.max(0, quotaMonthly - usedThisPeriod)}</span>
              {" / "}
              <span className="tabular-nums">{quotaMonthly}</span> left
            </p>
            <p>Top-up balance: <span className="tabular-nums">{topUpBalance}</span></p>
            <p className="pt-1 text-muted-foreground">
              Available is quota left + top-up. Quota resets monthly; top-up does not expire.
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
