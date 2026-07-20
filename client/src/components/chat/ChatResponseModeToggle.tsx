import { AlignLeft, AlignJustify, Zap, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type ResponseMode = "compact" | "detailed";

interface ChatResponseModeToggleProps {
  value: ResponseMode;
  onChange: (mode: ResponseMode) => void;
  disabled?: boolean;
  className?: string;
}

type EnergyEstimate = {
  costMin: number;
  costMax: number;
  unlimited: boolean;
  teaserOnly: boolean;
};

const MODES: { mode: ResponseMode; Icon: LucideIcon; labelKey: string }[] = [
  { mode: "compact", Icon: AlignLeft, labelKey: "buddy.modeSelect.compact" },
  { mode: "detailed", Icon: AlignJustify, labelKey: "buddy.modeSelect.detailed" },
];

/**
 * Compact segmented control for the chat composer that lets the learner pick
 * between a short ("compact") and a thorough ("detailed") answer. Both options
 * stay visible so the choice is self-explanatory; the active segment is raised
 * like an iOS segmented control and each icon reveals its label plus the rough
 * Energy cost on hover, so the learner can compare both modes before sending.
 */
export function ChatResponseModeToggle({
  value,
  onChange,
  disabled,
  className,
}: ChatResponseModeToggleProps) {
  const { t } = useTranslation();

  // Baseline per-mode estimates (RAG hinted, no attachment) so the learner can
  // compare the two answer lengths. The attachment-aware cost that actually
  // gates the send button lives on the send action itself.
  const compactEstimate = useQuery(api.chat.estimateEnergyForAction, {
    responseMode: "compact",
    ragHinted: true,
  }) as EnergyEstimate | undefined;
  const detailedEstimate = useQuery(api.chat.estimateEnergyForAction, {
    responseMode: "detailed",
    ragHinted: true,
  }) as EnergyEstimate | undefined;

  const formatCost = (estimate: EnergyEstimate | undefined): string | null => {
    if (!estimate || estimate.unlimited || estimate.teaserOnly) return null;
    const amount =
      estimate.costMin === estimate.costMax
        ? `${estimate.costMin}`
        : `${estimate.costMin}\u2013${estimate.costMax}`;
    return t("buddy.modeToggle.estimate", { cost: amount });
  };

  const estimateByMode: Record<ResponseMode, EnergyEstimate | undefined> = {
    compact: compactEstimate,
    detailed: detailedEstimate,
  };

  return (
    <div
      role="radiogroup"
      aria-label={t("buddy.modeToggle.label")}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full bg-muted p-0.5 shrink-0",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
    >
      {MODES.map(({ mode, Icon, labelKey }) => {
        const active = value === mode;
        const label = t(labelKey);
        const costLabel = formatCost(estimateByMode[mode]);
        return (
          <Tooltip key={mode}>
            <TooltipTrigger asChild>
              <button
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={costLabel ? `${label} · ${costLabel}` : label}
                disabled={disabled}
                onClick={() => onChange(mode)}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full transition-all",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                  active
                    ? "bg-background text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" collisionPadding={12} className="px-2.5 py-1.5">
              <div className="text-[11px] leading-snug space-y-px">
                <div className="font-semibold">{label}</div>
                {costLabel && (
                  <div className="flex items-center gap-1 pt-0.5 tabular-nums">
                    <Zap className="h-3 w-3 shrink-0" />
                    {costLabel}
                  </div>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
