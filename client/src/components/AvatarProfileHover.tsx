import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "convex/react";
import { Zap, Trophy, TrendingUp } from "lucide-react";

import { api } from "../../../convex/_generated/api";
import { XP_PER_LEVEL } from "../../../convex/gamification";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { useIsMobile } from "@/hooks/useMobile";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";
import {
  isEnergyBlockedByDebt,
  resolveEnergyDisplay,
  type EnergyStatusClasses,
} from "@/lib/energyStatus";

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

type AvatarProfileHoverContentProps = {
  showLearning: boolean;
  currentLevel: number | null;
  totalXP: number;
  userName?: string | null;
};

export function AvatarProfileHoverContent({
  showLearning,
  currentLevel,
  totalXP,
  userName,
}: AvatarProfileHoverContentProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const featureAccess = useFeatureAccess();
  const leaderboard = useQuery(
    api.leaderboard.getLeaderboard,
    showLearning ? { period: "7d" } : "skip"
  );

  const energy = featureAccess?.energy;
  const showEnergyGauge = Boolean(
    energy &&
      !energy.unlimited &&
      featureAccess?.features.buddyChat &&
      energy.quotaMonthly > 0
  );

  const energyDisplay = useMemo(() => resolveEnergyDisplay(energy), [energy]);

  const xpIntoLevel = ((totalXP % XP_PER_LEVEL) + XP_PER_LEVEL) % XP_PER_LEVEL;

  return (
    <HoverCardContent
      align="end"
      side="bottom"
      sideOffset={8}
      className="w-[280px] rounded-xl border border-border/60 p-0 shadow-lg"
    >
      {userName && (
        <div className="border-b border-border/50 px-3.5 py-2.5">
          <p className="truncate text-sm font-semibold text-foreground">{userName}</p>
          <p className="text-[11px] text-muted-foreground">{t("avatar.hover.subtitle")}</p>
        </div>
      )}

      <div className="space-y-0 divide-y divide-border/40 px-3.5 py-1 text-xs">
        {showEnergyGauge && energy && (
          <div className="space-y-1.5 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                <Zap className={cn("h-3.5 w-3.5", energyDisplay.classes.text)} />
                {t("avatar.hover.energy")}
              </span>
              <span className="tabular-nums font-medium text-foreground">
                {energy.available}
                <span className="font-normal text-muted-foreground"> / {energy.quotaMonthly}</span>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted/80">
              <div
                className={cn("h-full rounded-full transition-all duration-500", energyDisplay.classes.bg)}
                style={{ width: `${Math.round(energyDisplay.fillRatio * 100)}%` }}
              />
            </div>
            {isEnergyBlockedByDebt(energy) && (
              <p className="text-[11px] font-medium text-destructive">
                {t("energy.debtOutstanding", { amount: energy.debtBalance })}
              </p>
            )}
          </div>
        )}

        {showLearning && currentLevel !== null && (
          <div className="flex items-center gap-2.5 py-2.5 text-foreground">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color:var(--brand-blue)]/10">
              <TrendingUp className="h-3.5 w-3.5 text-[color:var(--brand-blue)]" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold">{t("avatar.hover.level", { level: currentLevel })}</p>
              <p className="text-[11px] text-muted-foreground">
                {t("avatar.hover.xpProgress", {
                  current: xpIntoLevel,
                  target: XP_PER_LEVEL,
                  total: totalXP.toLocaleString(),
                })}
              </p>
            </div>
          </div>
        )}

        {showLearning && leaderboard?.myRank != null && (
          <div className="flex items-center gap-2.5 py-2.5 text-foreground">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
              <Trophy className="h-3.5 w-3.5 text-amber-600" />
            </div>
            <span>{t("avatar.hover.rank", { rank: leaderboard.myRank })}</span>
          </div>
        )}


        {isMobile && (
          <p className="py-2 text-[10px] text-muted-foreground">
            {t("avatar.hover.mobileHint")}
          </p>
        )}
      </div>
    </HoverCardContent>
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

export function useAvatarProfileHoverMobile() {
  const isMobile = useIsMobile();
  const [hoverOpen, setHoverOpen] = useState(false);
  const longPressTimerRef = useRef<number | null>(null);

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleTouchStart = useCallback(() => {
    if (!isMobile) return;
    clearLongPress();
    longPressTimerRef.current = window.setTimeout(() => {
      setHoverOpen(true);
    }, 400);
  }, [clearLongPress, isMobile]);

  const handleTouchEnd = useCallback(() => {
    clearLongPress();
  }, [clearLongPress]);

  return {
    isMobile,
    hoverOpen,
    setHoverOpen,
    handleTouchStart,
    handleTouchEnd,
  };
}

export function AvatarProfileHoverRoot({
  children,
  hoverOpen,
  onHoverOpenChange,
  isMobile,
}: {
  children: ReactNode;
  hoverOpen?: boolean;
  onHoverOpenChange?: (open: boolean) => void;
  isMobile: boolean;
}) {
  return (
    <HoverCard
      open={isMobile ? hoverOpen : undefined}
      onOpenChange={isMobile ? onHoverOpenChange : undefined}
      openDelay={isMobile ? 0 : 250}
      closeDelay={120}
    >
      {children}
    </HoverCard>
  );
}

export { HoverCardTrigger };
