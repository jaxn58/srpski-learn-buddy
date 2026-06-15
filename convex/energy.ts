/**
 * AI Energy – Single Source of Truth for cost calculation, charging and resets.
 *
 * Implements the energy model from docs/restructure/02_TOKEN_SYSTEM.md:
 *  - Cost is derived from action type (compact/detailed) + surcharges (RAG,
 *    vision, upload-size). All values are admin-tunable via `platformConfig`
 *    and fall back to the launch defaults below (zero-migration).
 *  - Charging order: monthly inclusive quota first, then non-expiring top-up
 *    balance (see 02_TOKEN_SYSTEM.md §5).
 *  - "Variant A": when the available balance is not enough for the action,
 *    the action is BLOCKED with a clear top-up/upgrade hint – never silently
 *    truncated.
 *  - Staff (admin/superadmin) and tier "full" without an explicit quota are
 *    treated as unlimited (see featureAccess.ts).
 *
 * Energy is only deducted on successful action completion. Streams that fail
 * mid-way are not charged (we deduct after `finalizeStreamedMessage`).
 */
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

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

export const DEFAULT_TIER_QUOTAS = {
  full: 750,
  // AI Chat Standalone (legacy key "buddy"): higher quota than the combo tier
  // because Standalone users have NO course content – the AI chat is their
  // only product surface, so they will use it more intensively.
  // Raised from 450 → 600 (decision: June 2026).
  buddy: 600,
  // Sprachkurs + AI (legacy key "basic"): raised from 120 → 250 (June 2026).
  // Reason: 120 was sized as a token "demo quota" – ~1-2 active questions per
  // day, which felt punitive for engaged learners and undermined the mid-tier
  // value proposition. 250 ≈ 80-125 balanced learning questions/month
  // (~3-4/day). Worst-case KI cost stays <7% of monthly revenue – economics
  // remain very healthy (see docs/restructure/03_PREISKALKULATION.md §3).
  basic: 250,
  course: 0, // course tier uses the teaser counter, not energy
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
  };
}

// ============= Cost calculation =============

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
  /** Effective remaining energy: (quota - used, floored at 0) + topUp. */
  available: number;
};

export function deriveEnergyBalance(
  sub: Doc<"userSubscriptions"> | null,
  fallbackQuota: number,
  unlimited: boolean
): EnergyBalance {
  if (unlimited) {
    return { unlimited: true, quotaMonthly: 0, usedThisPeriod: 0, topUpBalance: 0, available: Number.POSITIVE_INFINITY };
  }
  const quotaMonthly = sub?.energyQuotaMonthly ?? fallbackQuota;
  const usedThisPeriod = sub?.energyUsedThisPeriod ?? 0;
  const topUpBalance = sub?.energyTopUpBalance ?? 0;
  const available = Math.max(0, quotaMonthly - usedThisPeriod) + topUpBalance;
  return { unlimited: false, quotaMonthly, usedThisPeriod, topUpBalance, available };
}

// ============= Charging =============

export type ChargeResult =
  | { ok: true; charged: number; fromQuota: number; fromTopUp: number }
  | { ok: false; reason: "insufficient"; available: number; required: number };

/**
 * Atomically charge `amount` energy. Idempotency / race-safety is provided by
 * Convex's per-document mutation serialization; this helper still re-reads the
 * subscription to compute fresh balances. Inclusive quota is consumed first,
 * top-up balance second (see 02_TOKEN_SYSTEM.md §5).
 *
 * Writes an `energyLedger` row with `reason="usage"` on success and patches the
 * subscription's `energyUsedThisPeriod` / `energyTopUpBalance`.
 */
export async function chargeEnergy(
  ctx: MutationCtx,
  userId: Id<"users">,
  amount: number,
  meta: {
    actionType: ActionType;
    ragUsed?: boolean;
    messageId?: Id<"chatMessages">;
    estInputTokens?: number;
    estOutputTokens?: number;
  }
): Promise<ChargeResult> {
  if (amount <= 0) return { ok: true, charged: 0, fromQuota: 0, fromTopUp: 0 };

  // @ts-ignore TS2589 – Convex schema depth limit (large schema)
  const sub = await ctx.db
    .query("userSubscriptions")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .filter((q) => q.eq(q.field("status"), "active"))
    .first();

  // Without an active subscription row we have nothing to charge against –
  // staff/beta enforcement happens in featureAccess; here we just record a
  // ledger entry with zero charge to keep the audit trail truthful.
  if (!sub) {
    await ctx.db.insert("energyLedger", {
      userId,
      delta: 0,
      reason: "usage",
      actionType: meta.actionType,
      ragUsed: meta.ragUsed,
      messageId: meta.messageId,
      estInputTokens: meta.estInputTokens,
      estOutputTokens: meta.estOutputTokens,
      createdAt: Date.now(),
    });
    return { ok: true, charged: 0, fromQuota: 0, fromTopUp: 0 };
  }

  const quotaMonthly = sub.energyQuotaMonthly ?? 0;
  const usedThisPeriod = sub.energyUsedThisPeriod ?? 0;
  const topUpBalance = sub.energyTopUpBalance ?? 0;
  const quotaRemaining = Math.max(0, quotaMonthly - usedThisPeriod);
  const available = quotaRemaining + topUpBalance;

  if (available < amount) {
    return { ok: false, reason: "insufficient", available, required: amount };
  }

  const fromQuota = Math.min(quotaRemaining, amount);
  const fromTopUp = amount - fromQuota;

  await ctx.db.patch(sub._id, {
    energyUsedThisPeriod: usedThisPeriod + fromQuota,
    energyTopUpBalance: topUpBalance - fromTopUp,
  });

  await ctx.db.insert("energyLedger", {
    userId,
    delta: -amount,
    reason: "usage",
    actionType: meta.actionType,
    ragUsed: meta.ragUsed,
    messageId: meta.messageId,
    estInputTokens: meta.estInputTokens,
    estOutputTokens: meta.estOutputTokens,
    createdAt: Date.now(),
  });

  return { ok: true, charged: amount, fromQuota, fromTopUp };
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
  // If never initialized, treat as due (will be set on first reset).
  if (resetAt === undefined) return true;
  return nowMs >= resetAt;
}
