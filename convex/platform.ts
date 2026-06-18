/**
 * Platform-wide configuration (singleton).
 *
 * Holds global switches that are not tied to a single user. Today this is the
 * master beta-phase switch that governs whether beta testers receive course_ai-level
 * access with limited energy (see convex/featureAccess.ts). Read paths fall back
 * to sane defaults when no config row exists yet, so this is zero-migration.
 */
import { v } from "convex/values";
import { query, mutation, type QueryCtx, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { isStaffRole } from "./authz";
import {
  DEFAULT_ENERGY_COSTS,
  DEFAULT_TIER_QUOTAS,
  DEFAULT_UPLOAD_MAX_FILE_BYTES,
  loadEnergyConfig,
} from "./energy";
import {
  DEFAULT_AVG_TOKENS_PER_ENERGY,
  getModelPricing,
  usdPerEnergy,
  PRICING_LAST_VERIFIED_AT,
  PRICING_STALENESS_WARN_DAYS,
  PRICING_STALENESS_ALERT_DAYS,
  PRICING_SOURCE_URLS,
} from "./ai/modelPricing";
import { SUBSCRIPTION_PLANS, TOPUP_PACKS } from "./subscriptions";
import { DEFAULT_STORAGE_QUOTA_BYTES } from "./storageQuota";

// Default billing config values (Phase 4).
export const DEFAULT_WELCOME_ENERGY_AMOUNT = 500;  // Energy granted on first Full-tier purchase
export const DEFAULT_BETA_TESTER_DISCOUNT_PERCENT = 50; // % off for beta testers after beta ends

// Default while no config row exists: the closed beta is considered ACTIVE.
// This preserves today's behavior (beta testers keep full access) until a
// superadmin explicitly ends the beta phase.
export const DEFAULT_BETA_PHASE_ACTIVE = true;

// Beta boundaries: course_ai taste pack (Units 1–3, monthly Energy budget).
export const DEFAULT_BETA_MAX_UNITS = 3;
export const DEFAULT_BETA_ENERGY_QUOTA = 120;

// Course-tier teaser: AI Buddy preview questions per day for teaser-only users.
// Mirrors the previously hard-coded value in convex/chat.ts (TEASER_DAILY_LIMIT)
// so behavior is unchanged until a superadmin tunes it.
export const DEFAULT_TEASER_DAILY_LIMIT = 2;

/**
 * Read the global beta-phase flag from any query/mutation context.
 * Shared by featureAccess resolution so there is one definition of "is beta on".
 */
export async function loadBetaPhaseActive(ctx: QueryCtx | MutationCtx): Promise<boolean> {
  // @ts-ignore TS2589 – Convex schema depth limit (large schema)
  const config = await ctx.db.query("platformConfig").first();
  return config?.betaPhaseActive ?? DEFAULT_BETA_PHASE_ACTIVE;
}

/**
 * Max number of learning units a beta user may access. Single source of truth
 * for unit gating (see convex/subscriptions.ts and convex/units.ts).
 */
export async function loadBetaMaxUnits(ctx: QueryCtx | MutationCtx): Promise<number> {
  // @ts-ignore TS2589 – Convex schema depth limit (large schema)
  const config = await ctx.db.query("platformConfig").first();
  return config?.betaMaxUnits ?? DEFAULT_BETA_MAX_UNITS;
}

/** Monthly AI Energy quota for beta testers (admin-tunable). */
export async function loadBetaEnergyQuota(ctx: QueryCtx | MutationCtx): Promise<number> {
  // @ts-ignore TS2589 – Convex schema depth limit (large schema)
  const config = await ctx.db.query("platformConfig").first();
  return config?.betaEnergyQuotaMonthly ?? DEFAULT_BETA_ENERGY_QUOTA;
}

/**
 * Daily AI Buddy preview-question limit for course-tier (teaser-only) users.
 * Single source of truth for the teaser gate in convex/chat.ts.
 */
export async function loadTeaserDailyLimit(ctx: QueryCtx | MutationCtx): Promise<number> {
  // @ts-ignore TS2589 – Convex schema depth limit (large schema)
  const config = await ctx.db.query("platformConfig").first();
  return config?.teaserDailyLimit ?? DEFAULT_TEASER_DAILY_LIMIT;
}

/**
 * Beta-tester discount percentage (admin-tunable via platformConfig).
 * Single source of truth for the one-time beta-tester discount. A value of 0
 * disables the discount offer entirely. The actual price reduction is enforced
 * by the configured Dodo discount code; this value gates eligibility and is
 * surfaced to the UI so the displayed percentage stays in sync with the admin
 * configuration.
 */
export async function loadBetaTesterDiscountPercent(
  ctx: QueryCtx | MutationCtx,
): Promise<number> {
  // @ts-ignore TS2589 – Convex schema depth limit (large schema)
  const config = await ctx.db.query("platformConfig").first();
  return config?.betaTesterDiscountPercent ?? DEFAULT_BETA_TESTER_DISCOUNT_PERCENT;
}

/** Public beta scope for landing page copy (no auth). */
export const getPublicBetaScope = query({
  args: {},
  returns: v.object({
    betaMaxUnits: v.number(),
    betaEnergyQuotaMonthly: v.number(),
    betaPhaseActive: v.boolean(),
    betaTesterDiscountPercent: v.number(),
  }),
  handler: async (ctx) => {
    return {
      betaMaxUnits: await loadBetaMaxUnits(ctx),
      betaEnergyQuotaMonthly: await loadBetaEnergyQuota(ctx),
      betaPhaseActive: await loadBetaPhaseActive(ctx),
      betaTesterDiscountPercent: await loadBetaTesterDiscountPercent(ctx),
    };
  },
});

/**
 * Public (staff-only) read of the platform config for the admin UI.
 */
export const getPlatformConfig = query({
  args: {},
  returns: v.object({
    betaPhaseActive: v.boolean(),
    betaMaxUnits: v.number(),
    betaEnergyQuotaMonthly: v.number(),
    teaserDailyLimit: v.number(),
    // Energy config (always returned, with defaults applied)
    energyCostCompact: v.number(),
    energyCostDetailed: v.number(),
    energyRagSurcharge: v.number(),
    energyVisionSurcharge: v.number(),
    energyUploadBase: v.number(),
    energyUploadPerKb: v.number(),
    energyQuotaFull: v.number(),
    energyQuotaBuddy: v.number(),
    energyQuotaBasic: v.number(),
    uploadMaxFileBytes: v.number(),
    storageQuotaStandaloneBytes: v.number(),
    storageQuotaCourseAiProBytes: v.number(),
    storageQuotaBetaBytes: v.number(),
    // Billing config (Phase 4)
    welcomeEnergyAmount: v.number(),
    betaTesterDiscountPercent: v.number(),
    updatedAt: v.union(v.number(), v.null()),
  }),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user || !isStaffRole(user.role)) throw new Error("Unauthorized");

    // @ts-ignore TS2589 – Convex schema depth limit (large schema)
    const config = await ctx.db.query("platformConfig").first();
    return {
      betaPhaseActive: config?.betaPhaseActive ?? DEFAULT_BETA_PHASE_ACTIVE,
      betaMaxUnits: config?.betaMaxUnits ?? DEFAULT_BETA_MAX_UNITS,
      betaEnergyQuotaMonthly: config?.betaEnergyQuotaMonthly ?? DEFAULT_BETA_ENERGY_QUOTA,
      teaserDailyLimit: config?.teaserDailyLimit ?? DEFAULT_TEASER_DAILY_LIMIT,
      energyCostCompact: config?.energyCostCompact ?? DEFAULT_ENERGY_COSTS.compact,
      energyCostDetailed: config?.energyCostDetailed ?? DEFAULT_ENERGY_COSTS.detailed,
      energyRagSurcharge: config?.energyRagSurcharge ?? DEFAULT_ENERGY_COSTS.ragSurcharge,
      energyVisionSurcharge: config?.energyVisionSurcharge ?? DEFAULT_ENERGY_COSTS.visionSurcharge,
      energyUploadBase: config?.energyUploadBase ?? DEFAULT_ENERGY_COSTS.uploadBase,
      energyUploadPerKb: config?.energyUploadPerKb ?? DEFAULT_ENERGY_COSTS.uploadPerKb,
      energyQuotaFull: config?.energyQuotaFull ?? DEFAULT_TIER_QUOTAS.full,
      energyQuotaBuddy: config?.energyQuotaBuddy ?? DEFAULT_TIER_QUOTAS.buddy,
      energyQuotaBasic: config?.energyQuotaBasic ?? DEFAULT_TIER_QUOTAS.basic,
      uploadMaxFileBytes: config?.uploadMaxFileBytes ?? DEFAULT_UPLOAD_MAX_FILE_BYTES,
      storageQuotaStandaloneBytes:
        config?.storageQuotaStandaloneBytes ?? DEFAULT_STORAGE_QUOTA_BYTES.standalone,
      storageQuotaCourseAiProBytes:
        config?.storageQuotaCourseAiProBytes ?? DEFAULT_STORAGE_QUOTA_BYTES.course_ai_pro,
      storageQuotaBetaBytes:
        config?.storageQuotaBetaBytes ?? DEFAULT_STORAGE_QUOTA_BYTES.beta,
      welcomeEnergyAmount: config?.welcomeEnergyAmount ?? DEFAULT_WELCOME_ENERGY_AMOUNT,
      betaTesterDiscountPercent: config?.betaTesterDiscountPercent ?? DEFAULT_BETA_TESTER_DISCOUNT_PERCENT,
      updatedAt: config?.updatedAt ?? null,
    };
  },
});

/**
 * Upsert the platform-config singleton with the given partial fields.
 * Always stamps updatedAt/updatedBy. Inserts a fresh row (using current
 * defaults for unspecified fields) when none exists yet.
 */
type EnergyPatchFields = {
  energyCostCompact?: number;
  energyCostDetailed?: number;
  energyRagSurcharge?: number;
  energyVisionSurcharge?: number;
  energyUploadBase?: number;
  energyUploadPerKb?: number;
  energyQuotaFull?: number;
  energyQuotaBuddy?: number;
  energyQuotaBasic?: number;
  uploadMaxFileBytes?: number;
};

type StorageQuotaPatchFields = {
  storageQuotaStandaloneBytes?: number;
  storageQuotaCourseAiProBytes?: number;
  storageQuotaBetaBytes?: number;
};

type BillingPatchFields = {
  welcomeEnergyAmount?: number;
  betaTesterDiscountPercent?: number;
  teaserDailyLimit?: number;
};

async function upsertPlatformConfig(
  ctx: MutationCtx,
  updatedBy: Id<"users">,
  patch: {
    betaPhaseActive?: boolean;
    betaMaxUnits?: number;
    betaEnergyQuotaMonthly?: number;
    teaserDailyLimit?: number;
  } & EnergyPatchFields & StorageQuotaPatchFields & BillingPatchFields
): Promise<void> {
  // @ts-ignore TS2589 – Convex schema depth limit (large schema)
  const existing = await ctx.db.query("platformConfig").first();
  if (existing) {
    await ctx.db.patch(existing._id, { ...patch, updatedAt: Date.now(), updatedBy });
  } else {
    await ctx.db.insert("platformConfig", {
      betaPhaseActive: patch.betaPhaseActive ?? DEFAULT_BETA_PHASE_ACTIVE,
      betaMaxUnits: patch.betaMaxUnits ?? DEFAULT_BETA_MAX_UNITS,
      betaEnergyQuotaMonthly: patch.betaEnergyQuotaMonthly ?? DEFAULT_BETA_ENERGY_QUOTA,
      teaserDailyLimit: patch.teaserDailyLimit,
      energyCostCompact: patch.energyCostCompact,
      energyCostDetailed: patch.energyCostDetailed,
      energyRagSurcharge: patch.energyRagSurcharge,
      energyVisionSurcharge: patch.energyVisionSurcharge,
      energyUploadBase: patch.energyUploadBase,
      energyUploadPerKb: patch.energyUploadPerKb,
      energyQuotaFull: patch.energyQuotaFull,
      energyQuotaBuddy: patch.energyQuotaBuddy,
      energyQuotaBasic: patch.energyQuotaBasic,
      uploadMaxFileBytes: patch.uploadMaxFileBytes,
      storageQuotaStandaloneBytes: patch.storageQuotaStandaloneBytes,
      storageQuotaCourseAiProBytes: patch.storageQuotaCourseAiProBytes,
      storageQuotaBetaBytes: patch.storageQuotaBetaBytes,
      updatedAt: Date.now(),
      updatedBy,
    });
  }
}

/** Validate a beta limit value: must be a non-negative integer within a sane cap. */
function assertValidLimit(value: number, label: string, max: number): void {
  if (!Number.isInteger(value) || value < 0 || value > max) {
    throw new Error(`${label} must be an integer between 0 and ${max}`);
  }
}

/**
 * Toggle the global beta phase (superadmin only). Upserts the singleton row.
 */
export const setBetaPhaseActive = mutation({
  args: { betaPhaseActive: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user || user.role !== "superadmin") {
      throw new Error("Only superadmin can change the beta phase");
    }

    await upsertPlatformConfig(ctx, user._id, { betaPhaseActive: args.betaPhaseActive });
    return null;
  },
});

/** Set monthly Energy quota for beta testers (superadmin only). */
export const setBetaEnergyQuota = mutation({
  args: { betaEnergyQuotaMonthly: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user || user.role !== "superadmin") {
      throw new Error("Only superadmin can change the beta energy quota");
    }

    assertValidLimit(args.betaEnergyQuotaMonthly, "Beta energy quota", 100000);
    await upsertPlatformConfig(ctx, user._id, {
      betaEnergyQuotaMonthly: args.betaEnergyQuotaMonthly,
    });
    return null;
  },
});

/**
 * Set how many learning units a beta user may access (staff: admin/superadmin).
 * Surfaced in the content-creation area, next to unit management.
 */
export const setBetaMaxUnits = mutation({
  args: { betaMaxUnits: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user || !isStaffRole(user.role)) {
      throw new Error("Only staff can change the beta unit limit");
    }

    assertValidLimit(args.betaMaxUnits, "Beta units", 1000);
    await upsertPlatformConfig(ctx, user._id, { betaMaxUnits: args.betaMaxUnits });
    return null;
  },
});

/**
 * Set billing-related platform config (superadmin only).
 * Welcome-Energy, beta discount, beta monthly Energy quota, course teaser limit.
 */
export const setBillingConfig = mutation({
  args: {
    welcomeEnergyAmount: v.optional(v.number()),
    betaTesterDiscountPercent: v.optional(v.number()),
    betaEnergyQuotaMonthly: v.optional(v.number()),
    teaserDailyLimit: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user || user.role !== "superadmin") {
      throw new Error("Only superadmin can change the billing configuration");
    }

    if (args.welcomeEnergyAmount !== undefined) {
      assertValidLimit(args.welcomeEnergyAmount, "Welcome Energy amount", 100_000);
    }
    if (args.betaTesterDiscountPercent !== undefined) {
      assertValidLimit(args.betaTesterDiscountPercent, "Beta tester discount percent", 100);
    }
    if (args.betaEnergyQuotaMonthly !== undefined) {
      assertValidLimit(args.betaEnergyQuotaMonthly, "Beta energy quota", 100_000);
    }
    if (args.teaserDailyLimit !== undefined) {
      assertValidLimit(args.teaserDailyLimit, "Teaser daily limit", 1000);
    }

    await upsertPlatformConfig(ctx, user._id, args);
    return null;
  },
});

/** Validate a non-negative finite number (allows decimals for per-KB factor). */
function assertNonNegative(value: number, label: string, max: number): void {
  if (!Number.isFinite(value) || value < 0 || value > max) {
    throw new Error(`${label} must be a number between 0 and ${max}`);
  }
}

/**
 * Set the full AI-Energy configuration (superadmin only). Validates inputs
 * then upserts the singleton. All fields are optional – only the ones present
 * in `args` are patched; the rest keep their existing values.
 *
 * Cost table is integer-bounded (≤ 1000) to prevent typos creating runaway
 * deductions; `uploadPerKb` allows decimals because real cost is sub-integer
 * per KB. Quotas are bounded to 1,000,000 (≈ 1M Energy is far beyond any
 * realistic month).
 */
export const setEnergyConfig = mutation({
  args: {
    energyCostCompact: v.optional(v.number()),
    energyCostDetailed: v.optional(v.number()),
    energyRagSurcharge: v.optional(v.number()),
    energyVisionSurcharge: v.optional(v.number()),
    energyUploadBase: v.optional(v.number()),
    energyUploadPerKb: v.optional(v.number()),
    energyQuotaFull: v.optional(v.number()),
    energyQuotaBuddy: v.optional(v.number()),
    energyQuotaBasic: v.optional(v.number()),
    uploadMaxFileBytes: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user || user.role !== "superadmin") {
      throw new Error("Only superadmin can change the energy configuration");
    }

    if (args.energyCostCompact !== undefined)
      assertValidLimit(args.energyCostCompact, "Compact cost", 1000);
    if (args.energyCostDetailed !== undefined)
      assertValidLimit(args.energyCostDetailed, "Detailed cost", 1000);
    if (args.energyRagSurcharge !== undefined)
      assertValidLimit(args.energyRagSurcharge, "RAG surcharge", 1000);
    if (args.energyVisionSurcharge !== undefined)
      assertValidLimit(args.energyVisionSurcharge, "Vision surcharge", 1000);
    if (args.energyUploadBase !== undefined)
      assertValidLimit(args.energyUploadBase, "Upload base", 1000);
    if (args.energyUploadPerKb !== undefined)
      assertNonNegative(args.energyUploadPerKb, "Upload per KB", 100);
    if (args.energyQuotaFull !== undefined)
      assertValidLimit(args.energyQuotaFull, "Full quota", 1_000_000);
    if (args.energyQuotaBuddy !== undefined)
      assertValidLimit(args.energyQuotaBuddy, "Buddy quota", 1_000_000);
    if (args.energyQuotaBasic !== undefined)
      assertValidLimit(args.energyQuotaBasic, "Basic quota", 1_000_000);
    if (args.uploadMaxFileBytes !== undefined)
      assertValidLimit(args.uploadMaxFileBytes, "Upload max bytes", 200 * 1024 * 1024);

    // ---- Cross-field sanity checks (hard errors) ----
    // These catch obvious typos that would silently break the cost model.
    // Margin / "is this profitable?" warnings are NOT enforced here — they're
    // shown live in the admin UI as soft warnings (see EnergyConfigCard).
    //
    // Read current config so partial updates can still be validated against
    // the persisted state (e.g. patching only `detailed` must still satisfy
    // detailed >= compact).
    // @ts-ignore TS2589 — Convex schema depth limit (large schema)
    const existing = await ctx.db.query("platformConfig").first();
    const resolvedCompact =
      args.energyCostCompact ?? existing?.energyCostCompact ?? DEFAULT_ENERGY_COSTS.compact;
    const resolvedDetailed =
      args.energyCostDetailed ?? existing?.energyCostDetailed ?? DEFAULT_ENERGY_COSTS.detailed;

    if (resolvedDetailed < resolvedCompact) {
      throw new Error(
        `Detailed cost (${resolvedDetailed}) must be >= compact cost (${resolvedCompact}). ` +
          `Detailed answers consume more tokens than compact, so the cost ordering must reflect that.`
      );
    }

    // A zero quota for an active paid tier breaks the product (users can never
    // chat). Course tier intentionally has 0 (uses teaser counter, not energy).
    if (args.energyQuotaFull !== undefined && args.energyQuotaFull === 0) {
      throw new Error("Full quota (Sprachkurs + AI Pro) cannot be 0 — that disables the tier.");
    }
    if (args.energyQuotaBuddy !== undefined && args.energyQuotaBuddy === 0) {
      throw new Error("Buddy quota (AI Chat Standalone) cannot be 0 — that disables the tier.");
    }
    if (args.energyQuotaBasic !== undefined && args.energyQuotaBasic === 0) {
      throw new Error("Basic quota (Sprachkurs + AI) cannot be 0 — that disables the tier.");
    }

    await upsertPlatformConfig(ctx, user._id, args);
    return null;
  },
});

/** Max per-user storage quota admins may set (10 GB). */
const MAX_STORAGE_QUOTA_BYTES = 10 * 1024 * 1024 * 1024;

function assertValidStorageQuotaBytes(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1 || value > MAX_STORAGE_QUOTA_BYTES) {
    throw new Error(
      `${label} must be an integer between 1 byte and ${MAX_STORAGE_QUOTA_BYTES} bytes (10 GB).`
    );
  }
}

/**
 * Set per-tier file storage quotas (superadmin only).
 * Values are stored in bytes; the admin UI typically edits MB.
 */
export const setStorageQuotaConfig = mutation({
  args: {
    storageQuotaStandaloneBytes: v.optional(v.number()),
    storageQuotaCourseAiProBytes: v.optional(v.number()),
    storageQuotaBetaBytes: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user || user.role !== "superadmin") {
      throw new Error("Only superadmin can change storage quota configuration");
    }

    if (args.storageQuotaStandaloneBytes !== undefined) {
      assertValidStorageQuotaBytes(
        args.storageQuotaStandaloneBytes,
        "Standalone storage quota"
      );
    }
    if (args.storageQuotaCourseAiProBytes !== undefined) {
      assertValidStorageQuotaBytes(
        args.storageQuotaCourseAiProBytes,
        "Pro storage quota"
      );
    }
    if (args.storageQuotaBetaBytes !== undefined) {
      assertValidStorageQuotaBytes(args.storageQuotaBetaBytes, "Beta storage quota");
    }

    await upsertPlatformConfig(ctx, user._id, args);
    return null;
  },
});

// ============================================================================
//  Energy Economics — Live cost / margin / real-usage view for the Admin UI
// ============================================================================
//
// One read-only query that gives the Energy admin everything needed to make
// informed decisions instead of editing numbers blindly:
//
//   1) Active LLM model + its USD/1M-token price (from convex/ai/modelPricing.ts)
//   2) USD-per-Energy band (typical & worst-case mix, see 03_PREISKALKULATION §2.1)
//   3) Per-tier monthly economics (quota x $/Energy -> max AI cost, margin %)
//      driven dynamically by SUBSCRIPTION_PLANS so adding tiers/durations
//      auto-extends the table.
//   4) Top-Up margins (TOPUP_PACKS)
//   5) Real consumption from energyLedger over the last 30 days (action-type
//      mix, RAG share, active users) -- empty / sparse for fresh deployments,
//      which the UI labels as "Beta phase - not enough data".
//
// All numerical fields are in their natural unit:
//   - prices in cents (EUR)
//   - USD as floating-point dollars
//   - energy as integer Energy units
//   - marginPercent as 0-100 number
// ============================================================================

/** Tier keys whose quotas/margins we expose in the admin view. */
const ENERGY_TIER_KEYS = ["standalone", "course_ai", "course_ai_pro"] as const;
type EnergyTierKey = typeof ENERGY_TIER_KEYS[number];

/** Map a tier key to its inclusive monthly Energy quota. */
function quotaForTier(
  tier: EnergyTierKey,
  cfg: { quotas: { full: number; buddy: number; basic: number } }
): number {
  switch (tier) {
    case "standalone":     return cfg.quotas.buddy;     // legacy key "buddy"
    case "course_ai":      return cfg.quotas.basic;     // legacy key "basic"
    case "course_ai_pro":  return cfg.quotas.full;
  }
}

export const getEnergyEconomics = query({
  args: {
    /** Client-provided current timestamp (ms). Required because Convex queries
     *  must be deterministic - see the no-Date.now()-in-queries rule. */
    nowMs: v.number(),
  },
  returns: v.object({
    // Active LLM model -- same source of truth as the chat runtime.
    activeModel: v.object({
      provider: v.string(),
      modelName: v.string(),
      displayName: v.string(),
      inputUsdPer1M: v.number(),
      outputUsdPer1M: v.number(),
      /** True if the model name was found in MODEL_PRICING; false -> fallback used. */
      pricingVerified: v.boolean(),
    }),

    // Pricing-table freshness — surfaced as a banner in the admin UI so the
    // superadmin knows when to verify Google/OpenAI prices against the docs.
    pricingFreshness: v.object({
      lastVerifiedAt: v.string(),
      ageDays: v.number(),
      /** "fresh" < warnDays, "warn" >= warnDays, "alert" >= alertDays */
      status: v.union(v.literal("fresh"), v.literal("warn"), v.literal("alert")),
      warnDays: v.number(),
      alertDays: v.number(),
      sourceUrlForActiveProvider: v.string(),
    }),

    // Ledger storage health — the 30-day aggregation has a safety cap; if we
    // approach it the admin needs to know so a `by_createdAt` index can be
    // added before queries silently truncate.
    ledgerHealth: v.object({
      /** Hard upper bound on rows scanned in this query (matches `.take(N)` below). */
      scanCap: v.number(),
      /** Rows actually returned by the scan. */
      rowsScanned: v.number(),
      /** True when we hit the cap (= we may have missed older rows). */
      capReached: v.boolean(),
      /** True when we are >= 80% of the cap → near-future risk of capReached. */
      nearCap: v.boolean(),
    }),

    // Cost & quota config currently in effect (incl. defaults).
    config: v.object({
      costs: v.object({
        compact: v.number(),
        detailed: v.number(),
        ragSurcharge: v.number(),
        visionSurcharge: v.number(),
        uploadBase: v.number(),
        uploadPerKb: v.number(),
      }),
      quotas: v.object({
        full: v.number(),
        buddy: v.number(),
        basic: v.number(),
      }),
      uploadMaxFileBytes: v.number(),
    }),

    // USD per Energy under two assumptions (band, not point).
    usdPerEnergy: v.object({
      typical: v.number(),
      worstCase: v.number(),
      assumedTokensTypical: v.object({ input: v.number(), output: v.number() }),
      assumedTokensWorstCase: v.object({ input: v.number(), output: v.number() }),
    }),

    // Estimated chat-message counts per Energy budget -- for the "X chats / month"
    // labels under each quota field.
    chatsPerEnergy: v.object({
      /** Pure compact answer, no surcharges. 1 / compact. */
      atCompact: v.number(),
      /** Typical: detailed + RAG. 1 / (detailed + ragSurcharge). */
      atTypicalDetailedRag: v.number(),
    }),

    // Per-tier x per-duration economics (3 tiers x 3 durations = 9 rows).
    tierEconomics: v.array(v.object({
      tier: v.string(),
      tierDisplayName: v.string(),
      durationMonths: v.number(),
      planId: v.string(),
      prepaidPriceCents: v.number(),
      monthlyPriceCents: v.number(),
      quotaPerMonth: v.number(),
      estChatsAtCompactPerMonth: v.number(),
      estChatsAtTypicalPerMonth: v.number(),
      worstCaseMonthlyAiCostUsd: v.number(),
      marginPercent: v.number(),
    })),

    // Top-Up margins (Starter / Plus / Pro).
    topupEconomics: v.array(v.object({
      packId: v.string(),
      name: v.string(),
      energyTotal: v.number(),
      priceCents: v.number(),
      worstCaseAiCostUsd: v.number(),
      marginPercent: v.number(),
    })),

    // Real consumption from the last 30 days (energyLedger).
    realUsage30d: v.object({
      windowStartMs: v.number(),
      totalUsageEntries: v.number(),
      totalEnergyConsumed: v.number(),
      activeUserCount: v.number(),
      ragUsageShareOfChatActions: v.number(),
      byActionType: v.object({
        compact: v.number(),
        balanced: v.number(),
        detailed: v.number(),
        photo_scan: v.number(),
        document_analysis: v.number(),
      }),
      totalEstInputTokens: v.number(),
      totalEstOutputTokens: v.number(),
      /** True when fewer than 10 usage entries -- UI should warn that the
       *  action-type mix is statistically noisy. */
      isSparse: v.boolean(),
    }),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user || !isStaffRole(user.role)) throw new Error("Unauthorized");

    // ---- 1) Active model + pricing ----
    // @ts-ignore TS2589 - Convex schema depth limit (large schema)
    const chatCfg = await ctx.db.query("chatAiConfig").first();
    const modelName = chatCfg?.primaryModel ?? "gemini-2.5-flash";
    const provider = chatCfg?.primaryProvider ?? "google";
    const pricing = getModelPricing(modelName);
    const pricingVerified =
      pricing.displayName !== "Unknown model (using Gemini 2.5 Flash fallback)";

    // ---- 2) Energy config + USD per Energy band ----
    const energyCfg = await loadEnergyConfig(ctx);
    const usdTypical = usdPerEnergy(pricing, DEFAULT_AVG_TOKENS_PER_ENERGY.typical);
    const usdWorstCase = usdPerEnergy(pricing, DEFAULT_AVG_TOKENS_PER_ENERGY.worstCase);

    // ---- 3) Chats-per-Energy helpers (avoid div-by-zero) ----
    const compactCost = Math.max(1, energyCfg.costs.compact);
    const typicalCost = Math.max(
      1,
      energyCfg.costs.detailed + energyCfg.costs.ragSurcharge
    );

    // ---- 4) Tier x duration economics, generated from SUBSCRIPTION_PLANS ----
    const tierDisplayName: Record<EnergyTierKey, string> = {
      standalone: "AI Chat Standalone",
      course_ai: "Sprachkurs + AI",
      course_ai_pro: "Sprachkurs + AI Pro",
    };
    const tierEconomics: Array<{
      tier: string;
      tierDisplayName: string;
      durationMonths: number;
      planId: string;
      prepaidPriceCents: number;
      monthlyPriceCents: number;
      quotaPerMonth: number;
      estChatsAtCompactPerMonth: number;
      estChatsAtTypicalPerMonth: number;
      worstCaseMonthlyAiCostUsd: number;
      marginPercent: number;
    }> = [];

    for (const tier of ENERGY_TIER_KEYS) {
      const quotaPerMonth = quotaForTier(tier, energyCfg);
      const worstCaseMonthlyAiCostUsd = quotaPerMonth * usdWorstCase;

      // Filter to canonical plans only (skip legacy buddy_*/basic_*/full_* duplicates
      // which share the same tier but are kept for zero-migration).
      const plansForTier = SUBSCRIPTION_PLANS.filter(
        (p) =>
          p.tier === tier &&
          !p.id.startsWith("buddy_") &&
          !p.id.startsWith("basic_") &&
          !p.id.startsWith("full_")
      ).sort((a, b) => a.durationMonths - b.durationMonths);

      for (const plan of plansForTier) {
        const monthlyPriceCents = Math.round(plan.price / plan.durationMonths);
        // Margin computed against monthly price (USD ~ EUR assumption per
        // 03_PREISKALKULATION.md §1).
        const monthlyPriceUsd = monthlyPriceCents / 100;
        const marginPercent =
          monthlyPriceUsd > 0
            ? Math.round(
                ((monthlyPriceUsd - worstCaseMonthlyAiCostUsd) / monthlyPriceUsd) *
                  1000
              ) / 10
            : 0;

        tierEconomics.push({
          tier,
          tierDisplayName: tierDisplayName[tier],
          durationMonths: plan.durationMonths,
          planId: plan.id,
          prepaidPriceCents: plan.price,
          monthlyPriceCents,
          quotaPerMonth,
          estChatsAtCompactPerMonth: Math.floor(quotaPerMonth / compactCost),
          estChatsAtTypicalPerMonth: Math.floor(quotaPerMonth / typicalCost),
          worstCaseMonthlyAiCostUsd,
          marginPercent,
        });
      }
    }

    // ---- 5) Top-Up economics ----
    const topupEconomics = (
      Object.entries(TOPUP_PACKS) as Array<
        [string, typeof TOPUP_PACKS[keyof typeof TOPUP_PACKS]]
      >
    ).map(([packId, pack]) => {
      const energyTotal = pack.energyAmount + pack.bonusAmount;
      const worstCaseAiCostUsd = energyTotal * usdWorstCase;
      const priceUsd = pack.priceCents / 100;
      const marginPercent =
        priceUsd > 0
          ? Math.round(((priceUsd - worstCaseAiCostUsd) / priceUsd) * 1000) / 10
          : 0;
      return {
        packId,
        name: pack.name,
        energyTotal,
        priceCents: pack.priceCents,
        worstCaseAiCostUsd,
        marginPercent,
      };
    });

    // ---- 6) Real consumption (last 30 days from energyLedger) ----
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const windowStartMs = args.nowMs - THIRTY_DAYS_MS;

    // No createdAt index on energyLedger today -- we collect with a safety cap.
    // Admin queries run rarely; if the table grows past ~50k entries, we
    // should add an index by_createdAt and switch to a ranged query.
    const LEDGER_SCAN_CAP = 50_000;
    // @ts-ignore TS2589 - Convex schema depth limit
    const ledgerRows = await ctx.db.query("energyLedger").take(LEDGER_SCAN_CAP);
    const usageRows = ledgerRows.filter(
      (r) => r.reason === "usage" && r.createdAt >= windowStartMs
    );

    const byActionType = {
      compact: 0,
      balanced: 0,
      detailed: 0,
      photo_scan: 0,
      document_analysis: 0,
    };
    let totalEnergyConsumed = 0;
    let totalEstInputTokens = 0;
    let totalEstOutputTokens = 0;
    const userIds = new Set<string>();
    let chatActionsCount = 0;
    let ragActionsCount = 0;

    for (const r of usageRows) {
      totalEnergyConsumed += Math.abs(r.delta);
      totalEstInputTokens += r.estInputTokens ?? 0;
      totalEstOutputTokens += r.estOutputTokens ?? 0;
      userIds.add(r.userId);
      if (r.actionType && r.actionType in byActionType) {
        byActionType[r.actionType as keyof typeof byActionType] += 1;
      }
      if (
        r.actionType === "compact" ||
        r.actionType === "balanced" ||
        r.actionType === "detailed"
      ) {
        chatActionsCount += 1;
        if (r.ragUsed) ragActionsCount += 1;
      }
    }

    const ragUsageShareOfChatActions =
      chatActionsCount > 0 ? ragActionsCount / chatActionsCount : 0;

    // ---- 7) Pricing-table freshness ----
    // Parsed as UTC midnight; the difference is rounded down to whole days so
    // the warning thresholds line up with calendar days, not millisecond drift.
    const lastVerifiedMs = Date.parse(`${PRICING_LAST_VERIFIED_AT}T00:00:00Z`);
    const ageDays = Math.max(
      0,
      Math.floor((args.nowMs - lastVerifiedMs) / (1000 * 60 * 60 * 24))
    );
    const pricingStatus: "fresh" | "warn" | "alert" =
      ageDays >= PRICING_STALENESS_ALERT_DAYS
        ? "alert"
        : ageDays >= PRICING_STALENESS_WARN_DAYS
        ? "warn"
        : "fresh";

    // ---- 8) Ledger storage health ----
    const rowsScanned = ledgerRows.length;
    const capReached = rowsScanned >= LEDGER_SCAN_CAP;
    const nearCap = rowsScanned >= Math.floor(LEDGER_SCAN_CAP * 0.8);

    return {
      activeModel: {
        provider,
        modelName,
        displayName: pricing.displayName,
        inputUsdPer1M: pricing.inputUsdPer1M,
        outputUsdPer1M: pricing.outputUsdPer1M,
        pricingVerified,
      },
      config: {
        costs: {
          compact: energyCfg.costs.compact,
          detailed: energyCfg.costs.detailed,
          ragSurcharge: energyCfg.costs.ragSurcharge,
          visionSurcharge: energyCfg.costs.visionSurcharge,
          uploadBase: energyCfg.costs.uploadBase,
          uploadPerKb: energyCfg.costs.uploadPerKb,
        },
        quotas: {
          full: energyCfg.quotas.full,
          buddy: energyCfg.quotas.buddy,
          basic: energyCfg.quotas.basic,
        },
        uploadMaxFileBytes: energyCfg.uploadMaxFileBytes,
      },
      usdPerEnergy: {
        typical: usdTypical,
        worstCase: usdWorstCase,
        assumedTokensTypical: { ...DEFAULT_AVG_TOKENS_PER_ENERGY.typical },
        assumedTokensWorstCase: { ...DEFAULT_AVG_TOKENS_PER_ENERGY.worstCase },
      },
      chatsPerEnergy: {
        atCompact: Math.round((1 / compactCost) * 1000) / 1000,
        atTypicalDetailedRag: Math.round((1 / typicalCost) * 1000) / 1000,
      },
      tierEconomics,
      topupEconomics,
      realUsage30d: {
        windowStartMs,
        totalUsageEntries: usageRows.length,
        totalEnergyConsumed,
        activeUserCount: userIds.size,
        ragUsageShareOfChatActions,
        byActionType,
        totalEstInputTokens,
        totalEstOutputTokens,
        isSparse: usageRows.length < 10,
      },
      pricingFreshness: {
        lastVerifiedAt: PRICING_LAST_VERIFIED_AT,
        ageDays,
        status: pricingStatus,
        warnDays: PRICING_STALENESS_WARN_DAYS,
        alertDays: PRICING_STALENESS_ALERT_DAYS,
        sourceUrlForActiveProvider:
          provider === "openai"
            ? PRICING_SOURCE_URLS.openai
            : PRICING_SOURCE_URLS.google,
      },
      ledgerHealth: {
        scanCap: LEDGER_SCAN_CAP,
        rowsScanned,
        capReached,
        nearCap,
      },
    };
  },
});
