import { useMemo } from "react";
import { Zap } from "lucide-react";

import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { resolveEnergyDisplay, type EnergyStatusClasses } from "@/lib/energyStatus";

const RING_SIZE = 48;
const RING_CENTER = RING_SIZE / 2;
const XP_RADIUS = 21;
const XP_STROKE = 4;
const AVATAR_PX = 36;
const GAUGE_HEIGHT = 36;

export type AvatarWithRingsProps = {
  avatarUrl?: string | null;
  fallbackLabel: string;
  showLearning: boolean;
  currentLevel: number | null;
  progressToNextRatio: number;
};

export type AvatarEnergyGaugeProps = {
  fillRatio: number;
  statusClasses: EnergyStatusClasses;
  available?: number;
  quota?: number;
};

/** Vertical energy meter – rendered beside the avatar, never inside the menu trigger. */
export function AvatarEnergyGauge({
  fillRatio,
  statusClasses,
  available,
  quota,
}: AvatarEnergyGaugeProps) {
  const label =
    available != null && quota != null
      ? `Energy ${available} / ${quota}`
      : `Energy ${Math.round(fillRatio * 100)}%`;

  return (
    <div
      className="relative flex flex-col items-center"
      style={{ height: GAUGE_HEIGHT }}
      aria-label={label}
    >
      <Zap className={cn("mb-0.5 h-2.5 w-2.5 shrink-0", statusClasses.text)} aria-hidden="true" />
      <div className="relative w-[6px] flex-1 overflow-hidden rounded-full bg-muted/40">
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 rounded-full transition-all duration-700 ease-out",
            statusClasses.bg
          )}
          style={{ height: `${Math.round(fillRatio * 100)}%` }}
        />
      </div>
    </div>
  );
}

export function AvatarWithRings({
  avatarUrl,
  fallbackLabel,
  showLearning,
  currentLevel,
  progressToNextRatio,
}: AvatarWithRingsProps) {
  const xpCircumference = 2 * Math.PI * XP_RADIUS;
  const xpDashOffset = xpCircumference * (1 - progressToNextRatio);
  const showXpRing = showLearning && currentLevel !== null;

  return (
    <div
      className="relative flex shrink-0 items-center justify-center"
      style={{ width: RING_SIZE, height: RING_SIZE }}
    >
      {showXpRing && (
        <svg
          className="pointer-events-none absolute inset-0"
          viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
          aria-hidden="true"
        >
          <g transform={`translate(${RING_CENTER},${RING_CENTER}) rotate(-90)`}>
            <circle
              r={XP_RADIUS}
              cx={0}
              cy={0}
              fill="none"
              stroke="currentColor"
              strokeWidth={XP_STROKE}
              className="text-muted/30"
            />
            <circle
              r={XP_RADIUS}
              cx={0}
              cy={0}
              fill="none"
              stroke="currentColor"
              strokeWidth={XP_STROKE}
              strokeLinecap="round"
              strokeDasharray={`${xpCircumference} ${xpCircumference}`}
              strokeDashoffset={xpDashOffset}
              className="text-[color:var(--brand-blue)] transition-[stroke-dashoffset] duration-700 ease-out"
            />
          </g>
        </svg>
      )}

      <Avatar
        className="relative z-10 border border-white/80 bg-white"
        style={{ width: AVATAR_PX, height: AVATAR_PX }}
      >
        {avatarUrl ? <AvatarImage src={avatarUrl} alt="Your avatar" /> : null}
        <AvatarFallback className="text-xs font-medium">{fallbackLabel}</AvatarFallback>
      </Avatar>

      {showXpRing && (
        <div className="absolute -bottom-0.5 -right-0.5 z-20 flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 border-white bg-[color:var(--brand-blue)] text-[10px] font-bold text-white">
          {currentLevel}
        </div>
      )}
    </div>
  );
}

export function useAvatarRingProps({
  avatarUrl,
  fallbackLabel,
  showLearning,
  currentLevel,
  progressToNextRatio,
}: {
  avatarUrl?: string | null;
  fallbackLabel: string;
  showLearning: boolean;
  currentLevel: number | null;
  progressToNextRatio: number;
}): {
  avatarProps: AvatarWithRingsProps;
  energyGauge: AvatarEnergyGaugeProps | null;
} {
  const featureAccess = useFeatureAccess();
  const energy = featureAccess?.energy;

  const showEnergyGauge = Boolean(
    energy &&
      !energy.unlimited &&
      featureAccess?.features.buddyChat &&
      energy.quotaMonthly > 0
  );

  const energyDisplay = useMemo(() => {
    if (!energy || energy.unlimited || energy.quotaMonthly <= 0) {
      return resolveEnergyDisplay(null);
    }
    return resolveEnergyDisplay(energy);
  }, [energy]);

  return {
    avatarProps: {
      avatarUrl,
      fallbackLabel,
      showLearning,
      currentLevel,
      progressToNextRatio,
    },
    energyGauge: showEnergyGauge
      ? {
          fillRatio: energyDisplay.fillRatio,
          statusClasses: energyDisplay.classes,
          available: energy?.available,
          quota: energy?.quotaMonthly,
        }
      : null,
  };
}

