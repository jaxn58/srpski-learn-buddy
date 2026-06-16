/**
 * AI Energy – Single Source of Truth for cost calculation, charging and resets.
 *
 * Billing model (Phase 1 – measured usage):
 *  - **Preview**: heuristic token band → approximate Energy range (`~min–max`).
 *  - **Actual charge**: measured LLM input/output tokens → Energy via USD formula.
 *  - **Overdraft**: one action may exceed available balance; deficit becomes
 *    `energyDebtBalance`. Further actions blocked until top-up clears debt.
 *
 * Charging order: monthly inclusive quota first, then non-expiring top-up
 * balance (see 02_TOKEN_SYSTEM.md §5).
 */
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  getModelPricing,
  usdPerEnergy,
} from "./ai/modelPricing";

// ============= Launch defaults (mirror 02_TOKEN_SYSTEM.md) =============

export const DEFAULT_ENERGY_COSTS = {
  compact: 1,
  detailed: 3,
  ragSurcharge: 1,
  visionSurcharge: 3,
  uploadBase: 5,
  /** Linear factor: Energy added per KB of attachment payload. */
  uploadPerKb: 0.02, // → 1 Energy per 50 KB
} as const;

/** Default USD target per 1 Energy (worst-case mix from 03_PREISKALKULATION.md). */
export const DEFAULT_ENERGY_USD_PER_UNIT = 0.00166;

export const DEFAULT_TIER_QUOTAS = {
  full: 750,
  buddy: 600,
  basic: 250,
  course: 0,
} as const;

/** Hard technical input cap for uploads (independent of energy balance). */
export const DEFAULT_UPLOAD_MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

// ============= Resolved energy config =============

export type EnergyConfig = {
  costs: {
    compact: number;
    detailed: number;
    ragSurcharge: number;
    visionSurcharge: number;
    uploadBase: number;
    uploadPerKb: number;
  };
  quotas: {
    full: number;
    buddy: number;
    basic: number;
  };
  uploadMaxFileBytes: number;
  /** USD cost target for converting measured LLM spend → 1 Energy unit. */
  usdPerEnergyUnit: number;
};

export async function loadEnergyConfig(ctx: QueryCtx | MutationCtx): Promise<EnergyConfig> {
  // @ts-ignore TS2589 – Convex schema depth limit (large schema)
  const cfg = await ctx.db.query("platformConfig").first();
  return {
    costs: {
      compact: cfg?.energyCostCompact ?? DEFAULT_ENERGY_COSTS.compact,
      detailed: cfg?.energyCostDetailed ?? DEFAULT_ENERGY_COSTS.detailed,
      ragSurcharge: cfg?.energyRagSurcharge ?? DEFAULT_ENERGY_COSTS.ragSurcharge,
      visionSurcharge: cfg?.energyVisionSurcharge ?? DEFAULT_ENERGY_COSTS.visionSurcharge,
      uploadBase: cfg?.energyUploadBase ?? DEFAULT_ENERGY_COSTS.uploadBase,
      uploadPerKb: cfg?.energyUploadPerKb ?? DEFAULT_ENERGY_COSTS.uploadPerKb,
    },
    quotas: {
      full: cfg?.energyQuotaFull ?? DEFAULT_TIER_QUOTAS.full,
      buddy: cfg?.energyQuotaBuddy ?? DEFAULT_TIER_QUOTAS.buddy,
      basic: cfg?.energyQuotaBasic ?? DEFAULT_TIER_QUOTAS.basic,
    },
    uploadMaxFileBytes: cfg?.uploadMaxFileBytes ?? DEFAULT_UPLOAD_MAX_FILE_BYTES,
    usdPerEnergyUnit: cfg?.energyUsdPerUnit ?? DEFAULT_ENERGY_USD_PER_UNIT,
  };
}

// ============= Token usage → Energy =============

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
};

/** Convert measured LLM tokens to Energy units (minimum 1). */
export function measuredTokensToEnergy(
  usage: TokenUsage,
  modelName: string,
  config: Pick<EnergyConfig, "usdPerEnergyUnit">
): number {
  const pricing = getModelPricing(modelName);
  const usd = usdPerEnergy(pricing, {
    input: Math.max(0, usage.inputTokens),
    output: Math.max(0, usage.outputTokens),
  });
  return Math.max(1, Math.ceil(usd / config.usdPerEnergyUnit));
}

/** Heuristic char→token estimate when the provider omits usage metadata. */
export function estimateTokensFromText(inputChars: number, outputChars: number): TokenUsage {
  return {
    inputTokens: Math.max(1, Math.ceil(inputChars / 4)),
    outputTokens: Math.max(1, Math.ceil(outputChars / 4)),
  };
}

/** Preview band for UI – not used for billing. */
export type EnergyPreviewBand = {
  costMin: number;
  costMax: number;
  /** Midpoint for legacy single-value displays. */
  costMid: number;
};

export function previewEnergyBandForChat(
  config: EnergyConfig,
  input: EnergyEstimateInput,
  modelName: string
): EnergyPreviewBand {
  const isDetailed = input.responseMode === "detailed";
  const withRag = input.ragUsed === true;

  // Token heuristics: compact vs detailed output caps + RAG inflates input.
  const inputMin = withRag ? 600 : 400;
  const inputMax = withRag ? 3500 : 1200;
  const outputMin = isDetailed ? 300 : 120;
  const outputMax = isDetailed ? 4096 : 450;

  const minEnergy = measuredTokensToEnergy(
    { inputTokens: inputMin, outputTokens: outputMin },
    modelName,
    config
  );
  const maxEnergy = measuredTokensToEnergy(
    { inputTokens: inputMax, outputTokens: outputMax },
    modelName,
    config
  );

  return {
    costMin: minEnergy,
    costMax: maxEnergy,
    costMid: Math.ceil((minEnergy + maxEnergy) / 2),
  };
}

// ============= Cost calculation (uploads + legacy flat preview helpers) =============

export type ActionType =
  | "compact"
  | "detailed"
  | "photo_scan"
  | "document_analysis";

export type EnergyEstimateInput = {
  responseMode?: "compact" | "detailed";
  ragUsed?: boolean;
  hasImageAttachment?: boolean;
  hasFileAttachment?: boolean;
  attachmentBytes?: number;
};

export type EnergyEstimate = {
  /** Total energy this action will cost (rounded up to integer). */
  cost: number;
  /** Action type for the ledger entry. */
  actionType: ActionType;
  /** Whether RAG/context surcharge was applied. */
  ragUsed: boolean;
  /** Breakdown for UI preview – not persisted. */
  breakdown: {
    base: number;
    ragSurcharge: number;
    visionSurcharge: number;
    uploadSurcharge: number;
  };
};

/**
 * Resolve the canonical action type for a request. Image attachments take
 * precedence over file attachments (vision), then non-image files
 * (document_analysis), otherwise the response-mode.
 */
function resolveActionType(input: EnergyEstimateInput): ActionType {
  if (input.hasImageAttachment) return "photo_scan";
  if (input.hasFileAttachment) return "document_analysis";
  return input.responseMode === "detailed" ? "detailed" : "compact";
}

/** Flat-rate estimate – used for upload pricing preview only (not chat billing). */
export function estimateEnergyCost(config: EnergyConfig, input: EnergyEstimateInput): EnergyEstimate {
  const isDetailed = input.responseMode === "detailed";
  const base = isDetailed ? config.costs.detailed : config.costs.compact;
  const ragUsed = input.ragUsed === true;
  const ragSurcharge = ragUsed ? config.costs.ragSurcharge : 0;
  const visionSurcharge = input.hasImageAttachment ? config.costs.visionSurcharge : 0;

  let uploadSurcharge = 0;
  if (input.hasFileAttachment && !input.hasImageAttachment) {
    const kb = (input.attachmentBytes ?? 0) / 1024;
    uploadSurcharge = config.costs.uploadBase + kb * config.costs.uploadPerKb;
  }

  const raw = base + ragSurcharge + visionSurcharge + uploadSurcharge;
  const cost = Math.max(1, Math.ceil(raw));
  return {
    cost,
    actionType: resolveActionType(input),
    ragUsed,
    breakdown: {
      base,
      ragSurcharge,
      visionSurcharge,
      uploadSurcharge: Math.ceil(uploadSurcharge),
    },
  };
}

// ============= Balance helpers =============

export type EnergyBalance = {
  unlimited: boolean;
  quotaMonthly: number;
  usedThisPeriod: number;
  topUpBalance: number;
  debtBalance: number;
  /** Effective spendable energy before a possible single overdraft. */
  available: number;
};

export function deriveEnergyBalance(
  sub: Doc<"userSubscriptions"> | null,
  fallbackQuota: number,
  unlimited: boolean
): EnergyBalance {
  if (unlimited) {
    return {
      unlimited: true,
      quotaMonthly: 0,
      usedThisPeriod: 0,
      topUpBalance: 0,
      debtBalance: 0,
      available: Number.POSITIVE_INFINITY,
    };
  }
  const quotaMonthly = sub?.energyQuotaMonthly ?? fallbackQuota;
  const usedThisPeriod = sub?.energyUsedThisPeriod ?? 0;
  const topUpBalance = sub?.energyTopUpBalance ?? 0;
  const debtBalance = sub?.energyDebtBalance ?? 0;
  const quotaRemaining = Math.max(0, quotaMonthly - usedThisPeriod);
  const available = Math.max(0, quotaRemaining + topUpBalance - debtBalance);
  return { unlimited: false, quotaMonthly, usedThisPeriod, topUpBalance, debtBalance, available };
}

// ============= Charging =============

export type ChargeResult =
  | { ok: true; charged: number; fromQuota: number; fromTopUp: number; debtCreated: number }
  | { ok: false; reason: "insufficient" | "debt"; available: number; required: number; debtBalance?: number };

/**
 * Atomically charge `amount` energy from measured usage.
 * Allows a single overdraft when `energyDebtBalance === 0` and available < amount.
 */
export async function chargeEnergy(
  ctx: MutationCtx,
  userId: Id<"users">,
  amount: number,
  meta: {
    actionType: ActionType;
    ragUsed?: boolean;
    messageId?: Id<"chatMessages">;
    inputTokens?: number;
    outputTokens?: number;
    estimatedEnergyCost?: number;
    actualEnergyCost?: number;
  }
): Promise<ChargeResult> {
  if (amount <= 0) return { ok: true, charged: 0, fromQuota: 0, fromTopUp: 0, debtCreated: 0 };

  // @ts-ignore TS2589 – Convex schema depth limit (large schema)
  const sub = await ctx.db
    .query("userSubscriptions")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .filter((q) => q.eq(q.field("status"), "active"))
    .first();

  if (!sub) {
    await ctx.db.insert("energyLedger", {
      userId,
      delta: 0,
      reason: "usage",
      actionType: meta.actionType,
      ragUsed: meta.ragUsed,
      messageId: meta.messageId,
      estInputTokens: meta.inputTokens,
      estOutputTokens: meta.outputTokens,
      estimatedEnergyCost: meta.estimatedEnergyCost,
      actualEnergyCost: meta.actualEnergyCost,
      createdAt: Date.now(),
    });
    return { ok: true, charged: 0, fromQuota: 0, fromTopUp: 0, debtCreated: 0 };
  }

  const quotaMonthly = sub.energyQuotaMonthly ?? 0;
  const usedThisPeriod = sub.energyUsedThisPeriod ?? 0;
  const topUpBalance = sub.energyTopUpBalance ?? 0;
  const debtBalance = sub.energyDebtBalance ?? 0;
  const quotaRemaining = Math.max(0, quotaMonthly - usedThisPeriod);
  const available = quotaRemaining + topUpBalance;

  if (debtBalance > 0) {
    return {
      ok: false,
      reason: "debt",
      available: 0,
      required: amount,
      debtBalance,
    };
  }

  let fromQuota = 0;
  let fromTopUp = 0;
  let debtCreated = 0;

  if (available >= amount) {
    fromQuota = Math.min(quotaRemaining, amount);
    fromTopUp = amount - fromQuota;
    await ctx.db.patch(sub._id, {
      energyUsedThisPeriod: usedThisPeriod + fromQuota,
      energyTopUpBalance: topUpBalance - fromTopUp,
    });
  } else {
    // Single overdraft: consume all available balance, remainder becomes debt.
    fromQuota = quotaRemaining;
    fromTopUp = topUpBalance;
    debtCreated = amount - available;
    await ctx.db.patch(sub._id, {
      energyUsedThisPeriod: usedThisPeriod + fromQuota,
      energyTopUpBalance: topUpBalance - fromTopUp,
      energyDebtBalance: debtCreated,
    });
  }

  await ctx.db.insert("energyLedger", {
    userId,
    delta: -amount,
    reason: "usage",
    actionType: meta.actionType,
    ragUsed: meta.ragUsed,
    messageId: meta.messageId,
    estInputTokens: meta.inputTokens,
    estOutputTokens: meta.outputTokens,
    estimatedEnergyCost: meta.estimatedEnergyCost,
    actualEnergyCost: meta.actualEnergyCost ?? amount,
    createdAt: Date.now(),
  });

  return { ok: true, charged: amount, fromQuota, fromTopUp, debtCreated };
}

/** Apply a top-up: clear debt first, remainder goes to topUpBalance. */
export function applyTopUpToSubscriptionBalances(
  sub: Pick<Doc<"userSubscriptions">, "energyTopUpBalance" | "energyDebtBalance">,
  energyAdded: number
): { energyTopUpBalance: number; energyDebtBalance: number } {
  const debt = sub.energyDebtBalance ?? 0;
  const cleared = Math.min(debt, energyAdded);
  return {
    energyDebtBalance: debt - cleared,
    energyTopUpBalance: (sub.energyTopUpBalance ?? 0) + (energyAdded - cleared),
  };
}

// ============= Monthly reset =============

/** Compute the next reset timestamp: first day of next month, 00:00 UTC. */
export function nextMonthlyResetAt(nowMs: number): number {
  const d = new Date(nowMs);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
}

/** True if the subscription's period has ended and a reset is due. */
export function isResetDue(sub: Doc<"userSubscriptions">, nowMs: number): boolean {
  const resetAt = sub.energyPeriodResetAt;
  if (resetAt === undefined) return true;
  return nowMs >= resetAt;
}
