export type EnergyLevel = "full" | "good" | "warn" | "critical";

export type EnergyStatusInput = {
  available: number;
  quotaMonthly: number;
  debtBalance: number;
};

export type EnergyStatusClasses = {
  text: string;
  bg: string;
  pill: string;
};

export function getEnergyFillRatio({
  available,
  quotaMonthly,
}: Pick<EnergyStatusInput, "available" | "quotaMonthly">): number {
  if (quotaMonthly <= 0) return 0;
  return Math.min(1, Math.max(0, available / quotaMonthly));
}

export function getEnergyLevel({
  available,
  quotaMonthly,
}: Pick<EnergyStatusInput, "available" | "quotaMonthly">): EnergyLevel {
  if (available <= 0) return "critical";

  const ratio = getEnergyFillRatio({ available, quotaMonthly });
  if (ratio >= 0.75) return "full";
  if (ratio >= 0.4) return "good";
  if (ratio >= 0.15) return "warn";
  return "critical";
}

export function getEnergyStatusClasses(level: EnergyLevel): EnergyStatusClasses {
  switch (level) {
    case "full":
      return {
        text: "energy-status-text-full",
        bg: "energy-status-bg-full",
        pill: "energy-status-pill-full",
      };
    case "good":
      return {
        text: "energy-status-text-good",
        bg: "energy-status-bg-good",
        pill: "energy-status-pill-good",
      };
    case "warn":
      return {
        text: "energy-status-text-warn",
        bg: "energy-status-bg-warn",
        pill: "energy-status-pill-warn",
      };
    case "critical":
      return {
        text: "energy-status-text-critical",
        bg: "energy-status-bg-critical",
        pill: "energy-status-pill-critical",
      };
  }
}

/**
 * Trigger for the "get more energy" call-to-action.
 *
 * The CTA is derived from the effective spendable balance level. Carried debt
 * from a previous overdraft is NOT treated as a separate trigger, because the
 * next successful charge (or the monthly reset) settles the debt implicitly –
 * so a positive `available` means the user can keep working without a top-up.
 */
export function shouldShowEnergyTopUpCta(level: EnergyLevel): boolean {
  return level === "warn" || level === "critical";
}

/**
 * True when the user's spendable balance is exhausted while carrying debt.
 * Only in this case is the "outstanding debt – please top up" hint meaningful
 * – otherwise the debt is transparently absorbed by the next charge/reset.
 */
export function isEnergyBlockedByDebt(
  input: Pick<EnergyStatusInput, "available" | "debtBalance">
): boolean {
  return input.debtBalance > 0 && input.available <= 0;
}

export function getEnergyStatus(input: EnergyStatusInput) {
  const fillRatio = getEnergyFillRatio(input);
  const level = getEnergyLevel(input);
  const classes = getEnergyStatusClasses(level);
  return { fillRatio, level, classes };
}

export function resolveEnergyDisplay(
  energy:
    | Pick<EnergyStatusInput, "available" | "quotaMonthly" | "debtBalance">
    | null
    | undefined
) {
  if (!energy || energy.quotaMonthly <= 0) {
    const classes = getEnergyStatusClasses("critical");
    return { fillRatio: 0, level: "critical" as const, classes };
  }

  return getEnergyStatus({
    available: energy.available,
    quotaMonthly: energy.quotaMonthly,
    debtBalance: energy.debtBalance,
  });
}
