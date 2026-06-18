import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type StoragePieIndicatorProps = {
  percentUsed: number | null;
  usedLabel: string;
  quotaLabel: string | null;
  className?: string;
};

function pieColor(percent: number | null): string {
  if (percent === null) return "text-muted-foreground";
  if (percent >= 80) return "text-destructive";
  if (percent >= 60) return "text-amber-500";
  return "text-emerald-600 dark:text-emerald-500";
}

function PieSvg({ percent, className }: { percent: number; className?: string }) {
  const clamped = Math.min(Math.max(percent, 0), 100);
  const radius = 7;
  const circumference = 2 * Math.PI * radius;
  const usedLength = (clamped / 100) * circumference;

  return (
    <svg
      viewBox="0 0 18 18"
      className={cn("h-4 w-4 shrink-0", className)}
      aria-hidden
    >
      <circle
        cx="9"
        cy="9"
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        className="text-muted-foreground/25"
      />
      <circle
        cx="9"
        cy="9"
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeDasharray={`${usedLength} ${circumference}`}
        strokeLinecap="round"
        transform="rotate(-90 9 9)"
        className={className}
      />
    </svg>
  );
}

export function StoragePieIndicator({
  percentUsed,
  usedLabel,
  quotaLabel,
  className,
}: StoragePieIndicatorProps) {
  const colorClass = pieColor(percentUsed);
  const percentLabel = percentUsed !== null ? `${percentUsed}%` : "—";
  const compactText =
    quotaLabel !== null ? `${usedLabel} / ${quotaLabel}` : usedLabel;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 text-[11px] tabular-nums text-muted-foreground",
            className
          )}
        >
          <PieSvg
            percent={percentUsed ?? 0}
            className={colorClass}
          />
          <span className="hidden sm:inline">{compactText}</span>
          <span className="sm:hidden">{percentLabel}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        <p>
          {quotaLabel !== null
            ? `${usedLabel} of ${quotaLabel} used (${percentLabel})`
            : `${usedLabel} used`}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

export function StoragePieInline({
  percentUsed,
  className,
}: {
  percentUsed: number | null;
  className?: string;
}) {
  return (
    <PieSvg
      percent={percentUsed ?? 0}
      className={cn(pieColor(percentUsed), className)}
    />
  );
}
