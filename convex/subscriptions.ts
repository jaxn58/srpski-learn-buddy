// @ts-nocheck
import { v } from "convex/values";
import { mutation, query, action, QueryCtx, MutationCtx, internalMutation, internalAction, internalQuery } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { assertLearnerAccountActive, isStaffRole } from "./authz";
import { loadBetaMaxUnits, loadBetaTesterDiscountPercent, DEFAULT_WELCOME_ENERGY_AMOUNT } from "./platform";
import { applyTopUpToSubscriptionBalances, loadEnergyConfig } from "./energy";

/** Stable error code: paid checkout/top-up blocked while beta phase is active (non-staff). */
const BETA_CHECKOUT_DISABLED = "beta_checkout_disabled";

/**
 * Hard-block Dodo checkout during the beta phase for non-staff users.
 * Staff retain access for QA. UI already locks pricing; this enforces server-side.
 */
async function assertPaidCheckoutAllowed(
  ctx: { runQuery: (query: any, args?: any) => Promise<any> },
  user: { role?: string },
): Promise<void> {
  const betaScope = await ctx.runQuery(api.platform.getPublicBetaScope, {});
  if (betaScope?.betaPhaseActive === true && !isStaffRole(user.role)) {
    throw new Error(BETA_CHECKOUT_DISABLED);
  }
}

// Helper to get the current user
async function getCurrentUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  const user = await ctx.db
    .query("users")
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();
  if (user) {
    assertLearnerAccountActive(user);
  }
  return user;
}

// Get total number of units from database
async function getTotalUnitsCount(ctx: QueryCtx | MutationCtx): Promise<number> {
  const units = await ctx.db
    .query("unitMetadata")
    .collect();
  
  // Filter by English language and get unique unit numbers
  const englishUnits = units.filter(u => u.language === "en");
  const uniqueUnits = new Set(englishUnits.map(u => u.unitNumber));
  return uniqueUnits.size;
}

// ============= SUBSCRIPTION PLANS (Phase 5: 4 Tiers × 4 Durations) =============
// Prices are in cents (EUR). Final price grid (June 2026), see
// `docs/restructure/03_PREISKALKULATION.md` for the rationale.
// Format: <tier>_<duration> – e.g. "course_ai_pro_12m" = Sprachkurs + AI Pro, 12 months.

type FeatureTierKey = "course" | "standalone" | "course_ai" | "course_ai_pro";
type DurationKey = "3m" | "6m" | "12m";
type PaidPlanId =
  // New canonical IDs (Phase 5) – three durations (3 / 6 / 12 months)
  | "course_3m"         | "course_6m"         | "course_12m"
  | "standalone_3m"     | "standalone_6m"     | "standalone_12m"
  | "course_ai_3m"      | "course_ai_6m"      | "course_ai_12m"
  | "course_ai_pro_3m"  | "course_ai_pro_6m"  | "course_ai_pro_12m"
  // Legacy IDs kept for zero-migration of existing DB records.
  // Each legacy ID maps to the canonical tier of the same shape (no production
  // data is expected outside the beta cohort; webhook handling normalizes them).
  | "buddy_3m"  | "buddy_6m"  | "buddy_12m"
  | "basic_3m"  | "basic_6m"  | "basic_12m"
  | "full_3m"   | "full_6m"   | "full_12m";

// Pre-Phase-4 legacy IDs (4 durations, single tier). Kept only for the type
// system to satisfy any historical webhook payloads – no production data exists.
type LegacyPlanId = "intensive" | "balanced" | "standard" | "relaxed";

export const SUBSCRIPTION_PLANS: Array<{
  id: PaidPlanId;
  tier: FeatureTierKey;
  durationMonths: number;
  price: number; // prepaid total in cents
  name: string;
  /** Whether this plan supports installments (false = prepaid-only). */
  allowsInstallments: boolean;
}> = [
  // ===== Course tier (Sprachkurs – learning content only) =====
  // Installments supported (same 10% uplift model as the other tiers): learners
  // can pay the fixed-term plan monthly instead of prepaid up-front.
  { id: "course_3m",  tier: "course", durationMonths: 3,  price:  3900, name: "Sprachkurs - 3 Months",  allowsInstallments: true },
  { id: "course_6m",  tier: "course", durationMonths: 6,  price:  4900, name: "Sprachkurs - 6 Months",  allowsInstallments: true },
  { id: "course_12m", tier: "course", durationMonths: 12, price:  6900, name: "Sprachkurs - 12 Months", allowsInstallments: true },

  // ===== Standalone tier (AI Chat Standalone – AI Buddy + documents, no learning) =====
  { id: "standalone_3m",  tier: "standalone", durationMonths: 3,  price: 4500, name: "AI Chat Standalone - 3 Months",  allowsInstallments: true },
  { id: "standalone_6m",  tier: "standalone", durationMonths: 6,  price: 5900, name: "AI Chat Standalone - 6 Months",  allowsInstallments: true },
  { id: "standalone_12m", tier: "standalone", durationMonths: 12, price: 8900, name: "AI Chat Standalone - 12 Months", allowsInstallments: true },

  // ===== Course + AI tier (Sprachkurs + AI – learning + entry-level AI Buddy) =====
  { id: "course_ai_3m",  tier: "course_ai", durationMonths: 3,  price: 5500, name: "Sprachkurs + AI - 3 Months",  allowsInstallments: true },
  { id: "course_ai_6m",  tier: "course_ai", durationMonths: 6,  price: 6900, name: "Sprachkurs + AI - 6 Months",  allowsInstallments: true },
  { id: "course_ai_12m", tier: "course_ai", durationMonths: 12, price: 9900, name: "Sprachkurs + AI - 12 Months", allowsInstallments: true },

  // ===== Course + AI Pro tier (Sprachkurs + AI Pro – everything) =====
  // 12M price (119 €) is the historical anchor (matches legacy "relaxed").
  { id: "course_ai_pro_3m",  tier: "course_ai_pro", durationMonths: 3,  price:  6900, name: "Sprachkurs + AI Pro - 3 Months",  allowsInstallments: true },
  { id: "course_ai_pro_6m",  tier: "course_ai_pro", durationMonths: 6,  price:  7900, name: "Sprachkurs + AI Pro - 6 Months",  allowsInstallments: true },
  { id: "course_ai_pro_12m", tier: "course_ai_pro", durationMonths: 12, price: 11900, name: "Sprachkurs + AI Pro - 12 Months", allowsInstallments: true },

  // ===== Legacy plan IDs (kept for zero-migration of existing DB records) =====
  // These map to canonical tiers but should not be offered for new purchases.
  // tierForPlanType() resolves their canonical tier via the inline mapping below.
  { id: "buddy_3m",   tier: "standalone",    durationMonths: 3,  price:  4500, name: "[Legacy] Buddy - 3 Months",  allowsInstallments: true },
  { id: "buddy_6m",   tier: "standalone",    durationMonths: 6,  price:  5900, name: "[Legacy] Buddy - 6 Months",  allowsInstallments: true },
  { id: "buddy_12m",  tier: "standalone",    durationMonths: 12, price:  8900, name: "[Legacy] Buddy - 12 Months", allowsInstallments: true },
  { id: "basic_3m",   tier: "course_ai",     durationMonths: 3,  price:  5500, name: "[Legacy] Basic - 3 Months",  allowsInstallments: true },
  { id: "basic_6m",   tier: "course_ai",     durationMonths: 6,  price:  6900, name: "[Legacy] Basic - 6 Months",  allowsInstallments: true },
  { id: "basic_12m",  tier: "course_ai",     durationMonths: 12, price:  9900, name: "[Legacy] Basic - 12 Months", allowsInstallments: true },
  { id: "full_3m",    tier: "course_ai_pro", durationMonths: 3,  price:  6900, name: "[Legacy] Full - 3 Months",   allowsInstallments: true },
  { id: "full_6m",    tier: "course_ai_pro", durationMonths: 6,  price:  8900, name: "[Legacy] Full - 6 Months",   allowsInstallments: true },
  { id: "full_12m",   tier: "course_ai_pro", durationMonths: 12, price: 11900, name: "[Legacy] Full - 12 Months",  allowsInstallments: true },
];

/**
 * Plan-ID prefixes that are kept only for zero-migration of existing DB records
 * and in-flight webhooks. They are NOT offered for new purchases and are
 * excluded from the env-var health-check in getBillingProviderConfig.
 */
const LEGACY_PLAN_ID_PREFIXES = ["buddy_", "basic_", "full_"] as const;

/**
 * Convex validator that accepts every paid plan ID (canonical + legacy).
 * Reused across createDodoCheckoutSession, internalApplyDodoPurchase and
 * internalApplyDodoUpgrade so we have exactly one place to maintain the list.
 */
const PAID_PLAN_ID_VALIDATOR = v.union(
  // Canonical (Phase 5) – three durations (3 / 6 / 12 months)
  v.literal("course_3m"),         v.literal("course_6m"),         v.literal("course_12m"),
  v.literal("standalone_3m"),     v.literal("standalone_6m"),     v.literal("standalone_12m"),
  v.literal("course_ai_3m"),      v.literal("course_ai_6m"),      v.literal("course_ai_12m"),
  v.literal("course_ai_pro_3m"),  v.literal("course_ai_pro_6m"),  v.literal("course_ai_pro_12m"),
  // Legacy (kept so in-flight webhook events from the prior plan generation still process)
  v.literal("buddy_3m"),  v.literal("buddy_6m"),  v.literal("buddy_12m"),
  v.literal("basic_3m"),  v.literal("basic_6m"),  v.literal("basic_12m"),
  v.literal("full_3m"),   v.literal("full_6m"),   v.literal("full_12m"),
);

/**
 * Map a compound plan ID to its canonical feature tier.
 * Pre-Phase-4 legacy IDs (intensive/balanced/standard/relaxed) fall back to
 * "course_ai_pro" so existing subscriptions retain full feature access.
 */
function tierForPlanType(planType: string): FeatureTierKey {
  const plan = SUBSCRIPTION_PLANS.find((p) => p.id === planType);
  if (plan) return plan.tier;
  // Pre-Phase-4 legacy fallback (intensive/balanced/standard/relaxed) → all = pro tier
  return "course_ai_pro";
}

/** Map a compound plan ID to its duration in months. Legacy IDs map by name. */
function durationMonthsForPlanType(planType: string): number {
  const plan = SUBSCRIPTION_PLANS.find((p) => p.id === planType);
  if (plan) return plan.durationMonths;
  // Pre-Phase-4 legacy fallback
  const legacy: Record<string, number> = { intensive: 3, balanced: 6, standard: 9, relaxed: 12 };
  return legacy[planType] ?? 0;
}

function charmRoundUpTo99Cents(rawMonthlyCents: number): number {
  // Round up to the next *.99 EUR boundary (e.g. 1448.33 -> 1499).
  // Ensures monthlyCharge*months is >= raw target, which keeps pay-once attractive.
  const eurosFloor = Math.floor(rawMonthlyCents / 100);
  let candidate = eurosFloor * 100 + 99;
  if (candidate < Math.ceil(rawMonthlyCents)) {
    candidate = (eurosFloor + 1) * 100 + 99;
  }
  return candidate;
}

function getInstallmentMonthlyChargeCents(planType: PaidPlanId): number {
  const plan = SUBSCRIPTION_PLANS.find((p) => p.id === planType);
  if (!plan || !plan.durationMonths) return 0;
  const monthlyTotal = Math.round(plan.price * 1.1);
  const rawMonthly = monthlyTotal / plan.durationMonths;
  return charmRoundUpTo99Cents(rawMonthly);
}

function getInstallmentTotalCents(planType: PaidPlanId): number {
  const plan = SUBSCRIPTION_PLANS.find((p) => p.id === planType);
  if (!plan || !plan.durationMonths) return 0;
  const monthly = getInstallmentMonthlyChargeCents(planType);
  return monthly * plan.durationMonths;
}

// Get accessible units for current user based on subscription
export const getAccessibleUnits = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return { maxUnits: 0, isBeta: false };

    // featureTierOverride grants full unit access (admin-assigned tier).
    if (user.featureTierOverride) {
      const totalUnits = await getTotalUnitsCount(ctx);
      return { maxUnits: totalUnits, isBeta: false };
    }

    // Admins/Superadmins always have full access (e.g., for QA and content verification).
    if (user.role === "admin" || user.role === "superadmin") {
      const totalUnits = await getTotalUnitsCount(ctx);
      return { maxUnits: totalUnits, isBeta: false };
    }

    // Check for active subscription first
    const subscription = await ctx.db
      .query("userSubscriptions")
      // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();

    const pastDueSub = await ctx.db
      .query("userSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("status"), "past_due"))
      .first();

    // If a payment failed for an installment plan, we pause access completely (even for beta testers).
    if (pastDueSub) {
      return { maxUnits: 0, isBeta: false };
    }

    // Beta subscriptions are capped by the admin-tunable beta unit limit
    // (single source of truth in platformConfig), not by any stored value.
    if (subscription?.planType === "beta") {
      const betaMaxUnits = await loadBetaMaxUnits(ctx);
      return { maxUnits: betaMaxUnits, isBeta: true };
    }

    if (subscription?.maxAccessibleUnits) {
      return {
        maxUnits: subscription.maxAccessibleUnits,
        isBeta: false,
      };
    }

    // Fallback: Check Beta Tester Flag (for backwards compatibility)
    // Beta testers' unit access is governed by the beta unit limit.
    if (user.isBetaTester) {
      const betaMaxUnits = await loadBetaMaxUnits(ctx);
      return { maxUnits: betaMaxUnits, isBeta: true };
    }

    // Check if they have any paid subscription (full access to all units)
    if (subscription && subscription.planType !== "beta") {
      const totalUnits = await getTotalUnitsCount(ctx);
      return { maxUnits: totalUnits, isBeta: false };
    }

    // Default: no access
    return { maxUnits: 0, isBeta: false };
  },
});

// Get user's current subscription (alias for getUserSubscription)
export const getCurrent = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    // featureTierOverride: return a virtual subscription that mirrors the
    // overridden tier so the subscription UI shows the assigned tier (used for
    // staff QA/simulation AND admin-assigned tiers for students via support/comps).
    const overrideTier = user.featureTierOverride as string | undefined;

    if (overrideTier) {
      const plan = SUBSCRIPTION_PLANS.find(p => p.tier === overrideTier && p.durationMonths === 6);
      const totalUnits = await getTotalUnitsCount(ctx);
      return {
        planType: plan?.id ?? overrideTier,
        planName: plan?.name ?? overrideTier,
        maxAccessibleUnits: totalUnits,
        status: "active" as const,
        expiresAt: null,
        planDurationMonths: plan?.durationMonths ?? 0,
        planPrice: plan?.price ?? 0,
        autoRenew: false,
        virtual: true,
        featureTier: overrideTier,
      };
    }

    const subscription = await ctx.db
      .query("userSubscriptions")
      // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    // Virtual Beta Subscription for Beta Testers without subscription.
    // Unit access is governed by the admin-tunable beta unit limit.
    if (!subscription && user.isBetaTester) {
      const betaMaxUnits = await loadBetaMaxUnits(ctx);
      return {
        planType: "beta" as const,
        planName: "Beta Access",
        maxAccessibleUnits: betaMaxUnits,
        status: "active" as const,
        expiresAt: null,
        planDurationMonths: 0,
        planPrice: 0,
        autoRenew: false,
        virtual: true,
      };
    }

    if (!subscription) return null;

    // Add plan name for display
    const plan = SUBSCRIPTION_PLANS.find(p => p.id === subscription.planType);
    return {
      ...subscription,
      plan: subscription.planType,
      planName: plan?.name || subscription.planType,
      endsAt: subscription.expiresAt,
    };
  },
});

// Get days remaining in subscription
export const getDaysRemaining = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return 0;

    const subscription = await ctx.db
      .query("userSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!subscription || !subscription.expiresAt) return 0;

    const now = Date.now();
    const daysRemaining = Math.max(0, Math.ceil((subscription.expiresAt - now) / (1000 * 60 * 60 * 24)));
    return daysRemaining;
  },
});

// Get available plans
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const getPlans = query({
  handler: async (ctx) => {
    // Fetch dynamic product data from Dodo synchronization
    const dodoProducts = await ctx.db.query("dodoProducts").collect();
    const productMap = new Map(dodoProducts.map((p) => [p.productId, p]));

    // Helper to get dynamic price or fallback to hardcoded
    const getDynamicPrice = (envKey: string, fallbackPrice: number) => {
      const productId = (process.env[envKey] || "").trim();
      const product = productMap.get(productId);
      return product ? product.price : fallbackPrice;
    };

    return SUBSCRIPTION_PLANS
      // Legacy plan IDs (buddy/basic/full) are kept only for zero-migration of
      // existing DB records and in-flight webhooks. They must NOT be offered for
      // new purchases (their DODO_PRODUCT_* env vars are intentionally unset),
      // so we exclude them from the publicly listed/buyable plans.
      .filter((p) => !LEGACY_PLAN_ID_PREFIXES.some((pre) => p.id.startsWith(pre)))
      .map((p) => {
      const planType = p.id as PaidPlanId;
      const planKeyUpper = planType.toUpperCase().replace(/-/g, "_");

      const envKeyPrepaid = `DODO_PRODUCT_${planKeyUpper}_PREPAID`;
      const envKeyInstallments = `DODO_PRODUCT_${planKeyUpper}_INSTALLMENTS`;

      const prepaidTotal = getDynamicPrice(envKeyPrepaid, p.price);
      const installmentsMonthly = getDynamicPrice(envKeyInstallments, getInstallmentMonthlyChargeCents(planType));

      const installmentsTotal = installmentsMonthly * (p.durationMonths || 0);

      return {
        ...p,
        price: prepaidTotal,
        paymentOptions: {
          prepaidTotal,
          installmentsMonthly,
          installmentsTotal,
          installmentsUpliftPercent: 10,
        },
      };
    });
  },
});

// Beta discount status for the current user (computed server-side using BETA_END_DATE)
export const getBetaDiscountStatus = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      return { betaEnded: false, eligible: false, usedAt: null as number | null, discountPercent: 0 };
    }

    const discountPercent = await loadBetaTesterDiscountPercent(ctx);
    const betaEndTs = process.env.BETA_END_DATE ? Date.parse(process.env.BETA_END_DATE) : NaN;
    const betaEnded = Number.isFinite(betaEndTs) ? Date.now() > betaEndTs : false;
    const usedAt = user.betaDiscountUsedAt ?? null;
    const eligible =
      discountPercent > 0 && betaEnded && user.isBetaTester === true && usedAt === null;

    return { betaEnded, eligible, usedAt, discountPercent };
  },
});

// Internal query wrapper so actions (which have no ctx.db) can read the
// admin-tunable beta-tester discount percent without touching the database
// directly. loadBetaTesterDiscountPercent expects a QueryCtx/MutationCtx.
// @ts-ignore TS2589 – Convex schema depth limit (50 tables)
export const internalGetBetaTesterDiscountPercent = internalQuery({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    return await loadBetaTesterDiscountPercent(ctx);
  },
});

function getBillingProviderFromEnv(): "dodo" {
  return "dodo";
}

function getDodoEnvironmentFromEnv(): "test_mode" | "live_mode" | "dev_mode" {
  const raw = (process.env.DODO_PAYMENTS_ENVIRONMENT || "").trim().toLowerCase();
  if (raw === "live_mode" || raw === "live") return "live_mode";
  if (raw === "dev_mode" || raw === "dev") return "dev_mode";
  return "test_mode";
}

export const getBillingProviderConfig = query({
  handler: async () => {
    const provider = getBillingProviderFromEnv();

    const dodoEnv = getDodoEnvironmentFromEnv();
    const betaMode = process.env.BETA_MODE === "on" || process.env.BETA_MODE === "true";
    const dodoApiKey = (process.env.DODO_PAYMENTS_API_KEY || "").trim();
    const dodoWebhookSecret = (
      process.env.DODO_PAYMENTS_WEBHOOK_SECRET ||
      process.env.DODO_PAYMENTS_WEBHOOK_KEY ||
      ""
    ).trim();

    // Derive the required env vars from the canonical SUBSCRIPTION_PLANS so the
    // health-check stays in sync with the offered tiers automatically. Legacy
    // plan IDs (buddy/basic/full) keep their env vars active for in-flight
    // webhooks but are NOT required for a healthy config. A plan only requires
    // an INSTALLMENTS var when it has allowsInstallments=true (all canonical
    // tiers, including the course tier as of June 2026).
    const requiredProductEnvKeys = [
      ...SUBSCRIPTION_PLANS
        .filter((p) => !LEGACY_PLAN_ID_PREFIXES.some((pre) => p.id.startsWith(pre)))
        .flatMap((p) => {
          const planKeyUpper = p.id.toUpperCase().replace(/-/g, "_");
          const keys = [`DODO_PRODUCT_${planKeyUpper}_PREPAID`];
          if (p.allowsInstallments) {
            keys.push(`DODO_PRODUCT_${planKeyUpper}_INSTALLMENTS`);
          }
          return keys;
        }),
      // Top-up products
      "DODO_TOPUP_STARTER", "DODO_TOPUP_PLUS", "DODO_TOPUP_PRO",
    ];

    const missingProductEnvKeys = requiredProductEnvKeys.filter((k) => !(process.env[k] || "").trim());

    return {
      provider,
      dodo: {
        environment: dodoEnv,
        betaMode,
        // API key is server-only; expose only whether it exists.
        configured: dodoApiKey.length > 0,
        webhookConfigured: dodoWebhookSecret.length > 0,
        missingProductEnvKeys,
      },
    };
  },
});

type DodoPlanId = PaidPlanId;
type DodoPaymentMode = "prepaid" | "installments";

function addMonthsUtc(timestampMs: number, monthsToAdd: number): number {
  // Add calendar months in UTC, clamping to the last day of the target month if needed.
  // Example: Jan 31 + 1 month => Feb 28 (or 29 in leap years).
  const d = new Date(timestampMs);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  const day = d.getUTCDate();
  const hr = d.getUTCHours();
  const min = d.getUTCMinutes();
  const sec = d.getUTCSeconds();
  const ms = d.getUTCMilliseconds();

  const base = new Date(Date.UTC(year, month + monthsToAdd, 1, hr, min, sec, ms));
  const lastDay = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
  base.setUTCDate(Math.min(day, lastDay));
  return base.getTime();
}

function dodoEnvToBaseUrl(env: "test_mode" | "live_mode" | "dev_mode"): string {
  // Treat dev_mode like test_mode (same host), while keeping the enum explicit.
  return env === "live_mode" ? "https://live.dodopayments.com" : "https://test.dodopayments.com";
}

function getDodoProductId(args: { planType: DodoPlanId; paymentMode: DodoPaymentMode }): string {
  // New env-var format: DODO_PRODUCT_<TIER>_<DURATION>_<MODE>
  // planType compound form "full_12m" → env key segment "FULL_12M"
  const planKey = args.planType.toUpperCase().replace(/-/g, "_");
  const modeKey = args.paymentMode === "prepaid" ? "PREPAID" : "INSTALLMENTS";
  const envKey = `DODO_PRODUCT_${planKey}_${modeKey}`;
  const value = (process.env[envKey] || "").trim();
  if (!value) {
    throw new Error(`missing_dodo_product_id:${envKey}`);
  }
  return value;
}

async function dodoListProducts(args: {
  baseUrl: string;
  apiKey: string;
  page_number: number;
  page_size: number;
  recurring: boolean;
  archived: boolean;
}): Promise<any[]> {
  const url = new URL(`${args.baseUrl}/products`);
  url.searchParams.set("page_number", String(args.page_number));
  url.searchParams.set("page_size", String(args.page_size));
  url.searchParams.set("recurring", args.recurring ? "true" : "false");
  url.searchParams.set("archived", args.archived ? "true" : "false");

  const resp = await fetch(url.toString(), {
    method: "GET",
    headers: { Authorization: `Bearer ${args.apiKey}` },
  });
  if (!resp.ok) {
    const errorText = await resp.text().catch(() => "<failed_to_read_body>");
    console.warn("[Dodo] Failed to list products", { status: resp.status, errorText });
    throw new Error("dodo_list_products_failed");
  }

  const json: any = await resp.json();
  const items = Array.isArray(json?.items) ? json.items : Array.isArray(json) ? json : [];
  return items;
}

function toLowerString(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

function parseIntSafe(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number.parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : null;
}

function getProductIdFromListItem(p: any): string | null {
  const id = String(p?.product_id ?? p?.productId ?? p?.id ?? "").trim();
  return id ? id : null;
}

function isUpgradeTopupProduct(p: any, args: { from: DodoPlanId; to: DodoPlanId; chargedCents: number }): boolean {
  const meta = p?.metadata && typeof p.metadata === "object" ? p.metadata : {};
  const app = toLowerString(meta?.app);
  const kind = toLowerString(meta?.kind);
  const from = toLowerString(meta?.fromPlanType ?? meta?.from ?? meta?.upgradeFromPlanType);
  const to = toLowerString(meta?.toPlanType ?? meta?.to ?? meta?.upgradeToPlanType);
  const charged = parseIntSafe(meta?.chargedCents ?? meta?.upgradeChargedCents);

  const priceObj = p?.price && typeof p.price === "object" ? p.price : {};
  const currency = toLowerString(priceObj?.currency);
  const price = parseIntSafe(priceObj?.price);
  const type = toLowerString(priceObj?.type);

  return (
    app === "serbian-ai-tutor" &&
    kind === "upgrade_topup" &&
    from === args.from &&
    to === args.to &&
    charged === args.chargedCents &&
    currency === "eur" &&
    price === args.chargedCents &&
    type === "one_time_price"
  );
}

async function resolveOrCreateDodoUpgradeTopupProductId(args: {
  baseUrl: string;
  apiKey: string;
  fromPlanType: DodoPlanId;
  toPlanType: DodoPlanId;
  chargedCents: number;
}): Promise<string> {
  const pageSize = 100;
  for (let page = 0; page < 10; page++) {
    const items = await dodoListProducts({
      baseUrl: args.baseUrl,
      apiKey: args.apiKey,
      page_number: page,
      page_size: pageSize,
      recurring: false,
      archived: false,
    });

    for (const p of items) {
      if (!isUpgradeTopupProduct(p, { from: args.fromPlanType, to: args.toPlanType, chargedCents: args.chargedCents })) {
        continue;
      }
      const id = getProductIdFromListItem(p);
      if (id) return id;
    }

    if (items.length < pageSize) break;
  }

  const euros = (args.chargedCents / 100).toFixed(2);
  const body = {
    name: `Upgrade Top-up: ${args.fromPlanType} → ${args.toPlanType} (€${euros})`,
    description: `Top-up product for plan upgrade (${args.fromPlanType} to ${args.toPlanType}).`,
    tax_category: "edtech",
    price: {
      currency: "EUR",
      discount: 0,
      price: args.chargedCents,
      purchasing_power_parity: false,
      type: "one_time_price",
    },
    metadata: {
      app: "serbian-ai-tutor",
      kind: "upgrade_topup",
      fromPlanType: args.fromPlanType,
      toPlanType: args.toPlanType,
      chargedCents: String(args.chargedCents),
    },
  };

  const resp = await fetch(`${args.baseUrl}/products`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const errorText = await resp.text().catch(() => "<failed_to_read_body>");
    console.warn("[Dodo] Failed to create upgrade top-up product", {
      status: resp.status,
      errorText,
      from: args.fromPlanType,
      to: args.toPlanType,
      chargedCents: args.chargedCents,
    });
    throw new Error("dodo_create_upgrade_product_failed");
  }

  const json: any = await resp.json();
  const productId = String(json?.product_id ?? json?.productId ?? "").trim();
  if (!productId) throw new Error("dodo_missing_created_product_id");
  return productId;
}

// Creates the missing Dodo upgrade top-up products (one-time) in the configured Dodo environment
// and returns a mapping of `DODO_UPG_*` env var names to created product IDs.
// This is an internal admin helper to bootstrap environments without manual dashboard work.
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const internalEnsureDodoUpgradeProducts = internalAction({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  handler: async (_ctx, args): Promise<{
    environment: "test_mode" | "live_mode" | "dev_mode";
    created: Record<string, string>;
    alreadySet: string[];
    planned: Array<{ envKey: string; priceCents: number; name: string }>;
  }> => {
    const apiKey = (process.env.DODO_PAYMENTS_API_KEY || "").trim();
    if (!apiKey) throw new Error("DODO_PAYMENTS_API_KEY not configured");

    const environment = getDodoEnvironmentFromEnv();
    const baseUrl = dodoEnvToBaseUrl(environment);

    // Reuse the tax_category + brand_id from an existing prepaid product to keep setup consistent.
    const referenceProductId = (process.env.DODO_PRODUCT_FULL_12M_PREPAID || "").trim();
    if (!referenceProductId) throw new Error("DODO_PRODUCT_FULL_12M_PREPAID not configured");

    const refResp = await fetch(`${baseUrl}/products/${encodeURIComponent(referenceProductId)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!refResp.ok) {
      throw new Error(`dodo_reference_product_fetch_failed:${refResp.status}`);
    }
    const refJson: any = await refResp.json().catch(() => ({}));
    const taxCategory: string = String(refJson?.tax_category || "edtech");
    const brandIdRaw: string = String(refJson?.brand_id || "").trim();
    const currency: string = String(refJson?.price?.currency || "EUR");

    const planPrice = (id: PaidPlanId) => {
      const p = SUBSCRIPTION_PLANS.find((x) => x.id === id);
      return p?.price ?? 0;
    };
    const planName = (id: PaidPlanId) => {
      const p = SUBSCRIPTION_PLANS.find((x) => x.id === id);
      return p?.name ?? id;
    };

    // Duration upgrade paths within the same tier (most common upgrade scenario).
    // Generated from SUBSCRIPTION_PLANS so adding a new tier/duration here is
    // sufficient – no separate list to maintain. We include every (from, to)
    // pair within the same tier where to.durationMonths > from.durationMonths.
    // Legacy plans (buddy/basic/full) are excluded; users on those plans upgrade
    // to the canonical tier instead, via the cross-tier upgrade flow.
    const tiers: FeatureTierKey[] = ["course", "standalone", "course_ai", "course_ai_pro"];
    const paths: Array<{ from: PaidPlanId; to: PaidPlanId }> = [];
    for (const tier of tiers) {
      const plansInTier = SUBSCRIPTION_PLANS
        .filter((p) => p.tier === tier && !p.name.startsWith("[Legacy]"))
        .sort((a, b) => a.durationMonths - b.durationMonths);
      for (let i = 0; i < plansInTier.length; i++) {
        for (let j = i + 1; j < plansInTier.length; j++) {
          paths.push({ from: plansInTier[i].id, to: plansInTier[j].id });
        }
      }
    }

    const created: Record<string, string> = {};
    const alreadySet: string[] = [];
    const planned: Array<{ envKey: string; priceCents: number; name: string }> = [];

    for (const p of paths) {
      const fromKey = p.from.toUpperCase().replace(/-/g, "_");
      const toKey = p.to.toUpperCase().replace(/-/g, "_");
      const envKey = `DODO_UPG_${fromKey}_${toKey}`;
      const existing = (process.env[envKey] || "").trim();
      if (existing) {
        alreadySet.push(envKey);
        continue;
      }

      const priceCents = Math.max(0, planPrice(p.to) - planPrice(p.from));
      const name = `Upgrade ${planName(p.from)} → ${planName(p.to)} (Top-up)`;
      planned.push({ envKey, priceCents, name });

      if (args.dryRun) continue;

      const body = {
        name,
        description: `One-time top-up product used to charge only the price difference for upgrades (${p.from} -> ${p.to}).`,
        brand_id: brandIdRaw || undefined,
        price: {
          currency,
          discount: 0,
          price: priceCents,
          purchasing_power_parity: false,
          type: "one_time_price",
        },
        tax_category: taxCategory,
        metadata: {
          kind: "upgrade_topup",
          fromPlan: p.from.toUpperCase(),
          toPlan: p.to.toUpperCase(),
          envKey,
          environment,
        },
      };

      const resp = await fetch(`${baseUrl}/products`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        throw new Error(`dodo_create_upgrade_product_failed:${envKey}:${resp.status}`);
      }
      const json: any = await resp.json().catch(() => ({}));
      const productId = String(json?.product_id || "").trim();
      if (!productId) {
        throw new Error(`dodo_create_upgrade_product_missing_id:${envKey}`);
      }
      created[envKey] = productId;
    }

    return { environment, created, alreadySet, planned };
  },
});

// Creates the canonical subscription products (prepaid one-time + monthly
// installments) for every non-legacy plan in SUBSCRIPTION_PLANS, using the
// app's own Dodo API key + environment (so the products live in the exact same
// Dodo account/mode the app talks to). Idempotent: a product whose env var is
// already set is skipped. Returns a mapping of env var -> created product ID so
// the caller can persist them via `npx convex env set`.
//
// Run (DEV, test_mode):
//   npx convex run internal.subscriptions.internalEnsureDodoSubscriptionProducts '{"dryRun":true}'
//   npx convex run internal.subscriptions.internalEnsureDodoSubscriptionProducts
//
// NEVER run against production without an explicit go-ahead (live_mode creates
// real, chargeable live products).
// @ts-ignore TS2589 – Convex schema depth limit (50 tables)
export const internalEnsureDodoSubscriptionProducts = internalAction({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  handler: async (_ctx, args): Promise<{
    environment: "test_mode" | "live_mode" | "dev_mode";
    created: Record<string, string>;
    alreadySet: string[];
    planned: Array<{ envKey: string; mode: "prepaid" | "installments"; priceCents: number; name: string }>;
  }> => {
    const apiKey = (process.env.DODO_PAYMENTS_API_KEY || "").trim();
    if (!apiKey) throw new Error("DODO_PAYMENTS_API_KEY not configured");

    const environment = getDodoEnvironmentFromEnv();
    const baseUrl = dodoEnvToBaseUrl(environment);
    const brandId = (process.env.DODO_BRAND_ID || "").trim();
    const currency = "EUR";

    // Only canonical plans (skip legacy buddy/basic/full mappings).
    const canonicalPlans = SUBSCRIPTION_PLANS.filter(
      (p) => !LEGACY_PLAN_ID_PREFIXES.some((pre) => p.id.startsWith(pre)),
    );

    const created: Record<string, string> = {};
    const alreadySet: string[] = [];
    const planned: Array<{ envKey: string; mode: "prepaid" | "installments"; priceCents: number; name: string }> = [];

    const createProduct = async (body: Record<string, unknown>): Promise<string> => {
      const resp = await fetch(`${baseUrl}/products`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const errorText = await resp.text().catch(() => "<failed_to_read_body>");
        throw new Error(`dodo_create_product_failed:${resp.status}:${errorText}`);
      }
      const json: any = await resp.json().catch(() => ({}));
      const productId = String(json?.product_id ?? json?.productId ?? "").trim();
      if (!productId) throw new Error("dodo_missing_created_product_id");
      return productId;
    };

    for (const plan of canonicalPlans) {
      const planKey = plan.id.toUpperCase().replace(/-/g, "_");

      // ---- Prepaid (one-time) ----
      const prepaidEnvKey = `DODO_PRODUCT_${planKey}_PREPAID`;
      if ((process.env[prepaidEnvKey] || "").trim()) {
        alreadySet.push(prepaidEnvKey);
      } else {
        const priceCents = plan.price;
        planned.push({ envKey: prepaidEnvKey, mode: "prepaid", priceCents, name: `${plan.name} (Prepaid)` });
        if (!args.dryRun) {
          created[prepaidEnvKey] = await createProduct({
            name: `${plan.name} (Prepaid)`,
            description: `Prepaid one-time purchase for ${plan.name}.`,
            brand_id: brandId || undefined,
            tax_category: "edtech",
            price: {
              currency,
              discount: 0,
              price: priceCents,
              purchasing_power_parity: false,
              type: "one_time_price",
            },
            metadata: {
              app: "serbian-ai-tutor",
              kind: "subscription_plan",
              planType: plan.id,
              paymentMode: "prepaid",
              envKey: prepaidEnvKey,
              environment,
            },
          });
        }
      }

      // ---- Installments (monthly recurring, fixed term) ----
      if (plan.allowsInstallments) {
        const instEnvKey = `DODO_PRODUCT_${planKey}_INSTALLMENTS`;
        if ((process.env[instEnvKey] || "").trim()) {
          alreadySet.push(instEnvKey);
        } else {
          const monthlyCents = getInstallmentMonthlyChargeCents(plan.id);
          planned.push({ envKey: instEnvKey, mode: "installments", priceCents: monthlyCents, name: `${plan.name} (Installments)` });
          if (!args.dryRun) {
            created[instEnvKey] = await createProduct({
              name: `${plan.name} (Monthly Installments)`,
              description: `Monthly installments for ${plan.name} (${plan.durationMonths} payments, +10% vs prepaid).`,
              brand_id: brandId || undefined,
              tax_category: "edtech",
              price: {
                currency,
                discount: 0,
                price: monthlyCents,
                purchasing_power_parity: false,
                type: "recurring_price",
                payment_frequency_count: 1,
                payment_frequency_interval: "Month",
                subscription_period_count: plan.durationMonths,
                subscription_period_interval: "Month",
                trial_period_days: 0,
              },
              metadata: {
                app: "serbian-ai-tutor",
                kind: "subscription_plan",
                planType: plan.id,
                paymentMode: "installments",
                envKey: instEnvKey,
                environment,
              },
            });
          }
        }
      }
    }

    return { environment, created, alreadySet, planned };
  },
});

function getPlanDurationMonths(planType: DodoPlanId): number {
  return durationMonthsForPlanType(planType);
}

// Creates a Dodo checkout session and returns the hosted checkout URL.
// Client should only open the returned URL (never handle API keys).
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
// @ts-ignore
export const createDodoCheckoutSession = action({
  args: {
    planType: PAID_PLAN_ID_VALIDATOR,
    paymentMode: v.union(v.literal("prepaid"), v.literal("installments")),
    flow: v.union(v.literal("purchase"), v.literal("upgrade")),
    returnUrl: v.string(),
    source: v.optional(v.string()),
    beta50: v.optional(v.boolean()),
    language: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ checkoutUrl: string; provider: "dodo" }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.runQuery(api.users.me);
    if (!user) throw new Error("User not found");
    assertLearnerAccountActive(user);
    await assertPaidCheckoutAllowed(ctx, user);

    // Guardrail: Dodo checkout always creates a new subscription/payment session.
    // Avoid duplicate charges by blocking purchase for already active subscribers.
    if (args.flow === "purchase") {
      const existingActive = await ctx.runQuery(api.subscriptions.getCurrent);
      // `getCurrent` can return a virtual beta subscription for beta testers without a real subscription.
      // That should NOT block checkout.
      const isVirtual = Boolean((existingActive as any)?.virtual);
      const planType = String((existingActive as any)?.planType ?? (existingActive as any)?.plan ?? "");
      const isBeta = planType === "beta";

      if (existingActive && (existingActive as any)?.status === "active" && !isVirtual && !isBeta) {
        throw new Error("already_subscribed");
      }
    }

    // Guardrail: We only support upgrades to LONGER plans (no downgrades).
    if (args.flow === "upgrade") {
      const existing = await ctx.runQuery(api.subscriptions.getCurrent);
      const existingPlan = String((existing as any)?.planType ?? (existing as any)?.plan ?? "").trim().toLowerCase();
      const existingStatus = String((existing as any)?.status ?? "").trim().toLowerCase();
      const isVirtual = Boolean((existing as any)?.virtual);

      if (!existing || existingStatus !== "active" || isVirtual) {
        throw new Error("not_active");
      }

      const from = existingPlan as DodoPlanId;
      const to = args.planType as DodoPlanId;
      const fromMonths = getPlanDurationMonths(from);
      const toMonths = getPlanDurationMonths(to);

      if (!fromMonths || !toMonths || toMonths <= fromMonths) {
        throw new Error("downgrade_not_supported");
      }
    }

    // @ts-ignore TS2339 TS2589 – Convex schema depth limit (50 tables)
    const environment = args.environment ?? getDodoEnvironmentFromEnv();
    const baseUrl = dodoEnvToBaseUrl(environment);

    const apiKey = (process.env.DODO_PAYMENTS_API_KEY || "").trim();
    if (!apiKey) throw new Error("DODO_PAYMENTS_API_KEY not configured");

    const planType = args.planType as DodoPlanId;
    const paymentMode = args.paymentMode as DodoPaymentMode;
    const months = getPlanDurationMonths(planType);
    if (!months) throw new Error("invalid_plan_months");

    // For purchases we use the plan product; for upgrades we use a dedicated top-up product
    // that charges only the price difference (as promised in the FAQ).
    let productId: string;
    const upgradeMeta: Record<string, string> = {};
    if (args.flow === "upgrade") {
      if (paymentMode !== "prepaid") {
        throw new Error("upgrade_requires_prepaid");
      }

      const existing = await ctx.runQuery(api.subscriptions.getCurrent);
      const fromPlan = String((existing as any)?.planType ?? (existing as any)?.plan ?? "").trim().toLowerCase() as DodoPlanId;
      const fromMonths = getPlanDurationMonths(fromPlan);
      const addedMonths = months - fromMonths;

      const fromPriceCents = getPlanPriceCentsFromConfig({ planType: fromPlan, isBeta50: false });
      const toPriceCents = getPlanPriceCentsFromConfig({ planType, isBeta50: false });
      const chargedCents = Math.max(0, toPriceCents - fromPriceCents);

      if (addedMonths <= 0 || chargedCents <= 0) {
        throw new Error("downgrade_not_supported");
      }

      productId = await resolveOrCreateDodoUpgradeTopupProductId({
        baseUrl,
        apiKey,
        fromPlanType: fromPlan,
        toPlanType: planType,
        chargedCents,
      });
      upgradeMeta.upgradeFromPlanType = String(fromPlan);
      upgradeMeta.upgradeToPlanType = String(planType);
      upgradeMeta.upgradeAddedMonths = String(addedMonths);
      upgradeMeta.upgradeChargedCents = String(chargedCents);
    } else {
      productId = getDodoProductId({ planType, paymentMode });
    }

    // Server-side beta-tester discount detection.
    // The client may pass beta50=true as a hint, but server always validates.
    // The beta50 flag activates when the user is a beta tester AND has not yet
    // used their one-time discount. The beta phase must have ended (BETA_END_DATE set).
    const betaDiscountPercent = await ctx.runQuery(
      internal.subscriptions.internalGetBetaTesterDiscountPercent,
      {},
    );
    const betaEndTs = process.env.BETA_END_DATE ? Date.parse(process.env.BETA_END_DATE) : NaN;
    const betaEnded = Number.isFinite(betaEndTs) ? Date.now() > betaEndTs : false;
    const beta50Requested = (args.beta50 === true || user.isBetaTester === true) && paymentMode === "prepaid";
    const betaEligible =
      betaDiscountPercent > 0 &&
      beta50Requested && betaEnded && user.isBetaTester === true && (user.betaDiscountUsedAt ?? null) === null;

    const effectiveDiscountCode = betaEligible ? (process.env.DODO_BETA50_DISCOUNT_CODE || "BETA50OFF") : null;
    const effectiveDiscountCodeForCheckout = args.flow === "upgrade" ? null : effectiveDiscountCode;

    const body = {
      allowed_payment_method_types: ["credit", "debit"],
      product_cart: [{ product_id: productId, quantity: 1 }],
      return_url: args.returnUrl,
      discount_code: effectiveDiscountCodeForCheckout,
      customer: user.email ? { email: user.email, name: user.name ?? undefined } : undefined,
      customization: args.language ? { force_language: args.language } : undefined,
      metadata: {
        // Dodo expects metadata values to be strings.
        clerkId: String(user.clerkId),
        planType: String(planType),
        paymentMode: String(paymentMode),
        flow: String(args.flow),
        source: String(args.source ?? "app"),
        beta50: betaEligible ? "true" : "false",
        planDurationMonths: String(months),
        ...upgradeMeta,
      },
    };

    const resp = await fetch(`${baseUrl}/checkouts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errorText = await resp.text().catch(() => "<failed_to_read_body>");
      console.warn("[Dodo] Failed to create checkout session", {
        status: resp.status,
        errorText,
        environment,
      });
      throw new Error("dodo_checkout_session_failed");
    }

    const json: any = await resp.json();
    const checkoutUrl: string = String(json?.checkout_url || "");
    if (!checkoutUrl) throw new Error("dodo_missing_checkout_url");

    return { checkoutUrl, provider: "dodo" };
  },
});

// ===== Phase 4: Energy Top-up Checkout =====
// Top-up energy packs are one-time payments (no subscription).
// Packs: starter (500 energy), plus (1500 = 1000+500 bonus), pro (5000 = 3000+2000 bonus).

// Top-up packs (decision June 2026, finalized).
//
// Design rules these values satisfy (see docs/restructure/02_TOKEN_SYSTEM.md §4
// and 03_PREISKALKULATION.md §4 for the derivation):
//   1. €/Energy decreases monotonically with pack size (real bulk discount).
//   2. Pro is never beatable by 2× Plus on €/Energy (no anti-bulk anomaly).
//   3. Worst-case margin on raw AI cost ≥ 70 % for every pack.
//   4. ≥ 15 % €/Energy drop from one pack to the next (upgrade incentive).
//   5. Prices end on .99.
//
// €/Energy ladder: Starter 0.00998 € → Plus 0.00666 € (−33 %) → Pro 0.00575 € (−14 %).
// Worst-case margins (Gemini 2.5 Flash, 1 250 in + 512 out tokens per Energy):
// Starter 83 %, Plus 75 %, Pro 71 %.
export const TOPUP_PACKS = {
  starter: { energyAmount:  500, bonusAmount:    0, priceCents:  499, name: "Energy Starter" },
  plus:    { energyAmount: 1000, bonusAmount:  500, priceCents:  999, name: "Energy Plus"    },
  pro:     { energyAmount: 2500, bonusAmount: 1500, priceCents: 2299, name: "Energy Pro"     },
} as const;

type TopupPack = keyof typeof TOPUP_PACKS;

function getDodoTopupProductId(pack: TopupPack): string {
  const envKey = `DODO_TOPUP_${pack.toUpperCase()}`;
  const value = (process.env[envKey] || "").trim();
  if (!value) throw new Error(`missing_dodo_topup_product_id:${envKey}`);
  return value;
}

// Creates the Energy top-up products (one-time) from TOPUP_PACKS, using the
// app's own Dodo API key + environment. Idempotent over the DODO_TOPUP_* env
// var. Returns env var -> created product ID for persisting via
// `npx convex env set`.
//
// Run (DEV, test_mode):
//   npx convex run internal.subscriptions.internalEnsureDodoTopupProducts '{"dryRun":true}'
//   npx convex run internal.subscriptions.internalEnsureDodoTopupProducts
//
// NEVER run against production without an explicit go-ahead (live_mode).
// @ts-ignore TS2589 – Convex schema depth limit (50 tables)
export const internalEnsureDodoTopupProducts = internalAction({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  handler: async (_ctx, args): Promise<{
    environment: "test_mode" | "live_mode" | "dev_mode";
    created: Record<string, string>;
    alreadySet: string[];
    planned: Array<{ envKey: string; priceCents: number; totalEnergy: number; name: string }>;
  }> => {
    const apiKey = (process.env.DODO_PAYMENTS_API_KEY || "").trim();
    if (!apiKey) throw new Error("DODO_PAYMENTS_API_KEY not configured");

    const environment = getDodoEnvironmentFromEnv();
    const baseUrl = dodoEnvToBaseUrl(environment);
    const brandId = (process.env.DODO_BRAND_ID || "").trim();
    const currency = "EUR";

    const created: Record<string, string> = {};
    const alreadySet: string[] = [];
    const planned: Array<{ envKey: string; priceCents: number; totalEnergy: number; name: string }> = [];

    for (const [packId, pack] of Object.entries(TOPUP_PACKS) as [TopupPack, typeof TOPUP_PACKS[TopupPack]][]) {
      const envKey = `DODO_TOPUP_${packId.toUpperCase()}`;
      if ((process.env[envKey] || "").trim()) {
        alreadySet.push(envKey);
        continue;
      }

      const totalEnergy = pack.energyAmount + pack.bonusAmount;
      planned.push({ envKey, priceCents: pack.priceCents, totalEnergy, name: pack.name });
      if (args.dryRun) continue;

      const resp = await fetch(`${baseUrl}/products`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: `${pack.name} (${totalEnergy} Energy)`,
          description: `One-time Energy top-up: ${pack.energyAmount} Energy${pack.bonusAmount > 0 ? ` + ${pack.bonusAmount} bonus` : ""} (= ${totalEnergy} total).`,
          brand_id: brandId || undefined,
          tax_category: "edtech",
          price: {
            currency,
            discount: 0,
            price: pack.priceCents,
            purchasing_power_parity: false,
            type: "one_time_price",
          },
          metadata: {
            app: "serbian-ai-tutor",
            kind: "topup",
            pack: packId,
            energyAmount: String(pack.energyAmount),
            bonusAmount: String(pack.bonusAmount),
            envKey,
            environment,
          },
        }),
      });
      if (!resp.ok) {
        const errorText = await resp.text().catch(() => "<failed_to_read_body>");
        throw new Error(`dodo_create_topup_failed:${envKey}:${resp.status}:${errorText}`);
      }
      const json: any = await resp.json().catch(() => ({}));
      const productId = String(json?.product_id ?? json?.productId ?? "").trim();
      if (!productId) throw new Error(`dodo_missing_created_topup_id:${envKey}`);
      created[envKey] = productId;
    }

    return { environment, created, alreadySet, planned };
  },
});

// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const createTopupCheckoutSession = action({
  args: {
    pack: v.union(v.literal("starter"), v.literal("plus"), v.literal("pro")),
    returnUrl: v.string(),
    language: v.optional(v.string()),
  },
  returns: v.object({ checkoutUrl: v.string(), provider: v.literal("dodo") }),
  handler: async (ctx, args): Promise<{ checkoutUrl: string; provider: "dodo" }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.runQuery(api.users.me);
    if (!user) throw new Error("User not found");
    assertLearnerAccountActive(user);
    await assertPaidCheckoutAllowed(ctx, user);

    const pack = TOPUP_PACKS[args.pack];
    const productId = getDodoTopupProductId(args.pack);

    const environment = getDodoEnvironmentFromEnv();
    const baseUrl = dodoEnvToBaseUrl(environment);
    const apiKey = (process.env.DODO_PAYMENTS_API_KEY || "").trim();
    if (!apiKey) throw new Error("DODO_PAYMENTS_API_KEY not configured");

    const body = {
      allowed_payment_method_types: ["credit", "debit"],
      product_cart: [{ product_id: productId, quantity: 1 }],
      return_url: args.returnUrl,
      customer: user.email ? { email: user.email, name: user.name ?? undefined } : undefined,
      customization: args.language ? { force_language: args.language } : undefined,
      metadata: {
        clerkId: String(user.clerkId),
        kind: "topup",
        pack: String(args.pack),
        energyAmount: String(pack.energyAmount),
        bonusAmount: String(pack.bonusAmount),
        priceCents: String(pack.priceCents),
        paymentMode: "prepaid",
      },
    };

    const resp = await fetch(`${baseUrl}/checkouts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errorText = await resp.text().catch(() => "<failed_to_read_body>");
      console.warn("[Dodo] Failed to create topup checkout session", {
        status: resp.status,
        errorText,
        environment,
        pack: args.pack,
      });
      throw new Error("dodo_topup_checkout_session_failed");
    }

    const json: any = await resp.json();
    const checkoutUrl: string = String(json?.checkout_url || "");
    if (!checkoutUrl) throw new Error("dodo_missing_checkout_url");

    return { checkoutUrl, provider: "dodo" };
  },
});

// ===== Energy Top-up Pack info (public read for UI pricing) =====
export const getTopupPacks = query({
  args: {},
  returns: v.array(v.object({
    id: v.union(v.literal("starter"), v.literal("plus"), v.literal("pro")),
    energyAmount: v.number(),
    bonusAmount: v.number(),
    totalEnergy: v.number(),
    priceCents: v.number(),
    name: v.string(),
  })),
  handler: async (_ctx) => {
    // Public read: Top-up pack metadata is generic marketing info (name, energy, price)
    // and is rendered on the public landing page alongside getPlans(). No user data exposed.
    return (Object.entries(TOPUP_PACKS) as [TopupPack, typeof TOPUP_PACKS[TopupPack]][]).map(([id, pack]) => ({
      id,
      energyAmount: pack.energyAmount,
      bonusAmount: pack.bonusAmount,
      totalEnergy: pack.energyAmount + pack.bonusAmount,
      priceCents: pack.priceCents,
      name: pack.name,
    }));
  },
});

// ===== Public energy display info for landing page =====
// Returns the monthly AI Energy quota per tier plus a few cost examples,
// so the public pricing page can show realistic "what does X energy get me?"
// hints. Reads from platformConfig with fallback to DEFAULT_TIER_QUOTAS in
// convex/energy.ts (i.e. fully dynamic, no hardcoded numbers in the client).
export const getPublicEnergyInfo = query({
  args: {},
  returns: v.object({
    quotas: v.object({
      course: v.number(),
      standalone: v.number(),
      course_ai: v.number(),
      course_ai_pro: v.number(),
    }),
    costs: v.object({
      typicalChat: v.number(),
      detailedAnswer: v.number(),
      photoScan: v.number(),
    }),
    monthlyReset: v.boolean(),
    welcomeEnergyAmount: v.number(),
  }),
  handler: async (ctx) => {
    const cfg = await loadEnergyConfig(ctx);
    const platformConfig = await ctx.db.query("platformConfig").first();
    const welcomeEnergyAmount =
      platformConfig?.welcomeEnergyAmount ?? DEFAULT_WELCOME_ENERGY_AMOUNT;
    return {
      quotas: {
        course: 0,
        standalone: cfg.quotas.buddy,
        course_ai: cfg.quotas.basic,
        course_ai_pro: cfg.quotas.full,
      },
      costs: {
        // A "typical" chat question: compact answer + context-link surcharge
        typicalChat: cfg.costs.compact + cfg.costs.ragSurcharge,
        // A detailed answer with course context
        detailedAnswer: cfg.costs.detailed + cfg.costs.ragSurcharge,
        // A photo-scan (vision) + detailed answer
        photoScan: cfg.costs.detailed + cfg.costs.visionSurcharge,
      },
      monthlyReset: true,
      welcomeEnergyAmount,
    };
  },
});

// Calculate upgrade cost
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const calculateUpgradeCost = mutation({
  args: {
    currentPlan: v.string(),
    newPlan: v.string(),
  },
  handler: async (ctx, { currentPlan, newPlan }) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const currentPlanInfo = SUBSCRIPTION_PLANS.find(p => p.id === currentPlan);
    const newPlanInfo = SUBSCRIPTION_PLANS.find(p => p.id === newPlan);

    if (!currentPlanInfo || !newPlanInfo) {
      throw new Error("Invalid plan");
    }

    // No downgrades: only allow upgrades to longer plans.
    if (newPlanInfo.durationMonths <= currentPlanInfo.durationMonths) {
      throw new Error("downgrade_not_supported");
    }

    // Simple pro-rated calculation
    const cost = Math.max(0, newPlanInfo.price - currentPlanInfo.price);
    return { cost, newPlan: newPlanInfo };
  },
});

// Cancel subscription
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const cancel = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const subscription = await ctx.db
      .query("userSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!subscription) throw new Error("No subscription found");

    await ctx.db.patch(subscription._id, {
      status: "cancelled",
      cancelledAt: Date.now(),
    });

    await ctx.db.insert("subscriptionHistory", {
      userId: user._id,
      action: "cancelled",
      previousPlanType: subscription.planType,
    });

    return { success: true };
  },
});

// Get analytics (admin only)
export const getAnalytics = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      return null;
    }

    const allSubscriptions = await ctx.db.query("userSubscriptions").collect();
    const allHistory = await ctx.db.query("subscriptionHistory").collect();
    const allUsers = await ctx.db.query("users").collect();

    const activeCount = allSubscriptions.filter(s => s.status === "active").length;
    const cancelledCount = allSubscriptions.filter(s => s.status === "cancelled").length;
    // Monetary values are stored in cents.
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    const totalRevenue = allHistory
      .filter(h => h.cost)
      .reduce((sum, h) => sum + (h.cost || 0), 0);

    // Calculate MRR (Monthly Recurring Revenue) from active subscriptions
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    const mrr = allSubscriptions
      .filter(s => s.status === "active")
      .reduce((sum, s) => {
        // Monthly recurring revenue in cents.
        const monthlyPriceCents = Math.round(s.planPrice / s.planDurationMonths);
        return sum + monthlyPriceCents;
      }, 0);

    // Calculate churn rate (cancelled / total)
    const totalSubs = allSubscriptions.length;
    const churnRate = totalSubs > 0 ? (cancelledCount / totalSubs) * 100 : 0;

    // Calculate conversion rate (upgrades / total users)
    const upgradeCount = allHistory.filter(h => h.action === "upgraded" || h.action === "purchased").length;
    const totalUsers = allUsers.length;
    const conversionRate = totalUsers > 0 ? (upgradeCount / totalUsers) * 100 : 0;

    // Revenue by plan type (in cents)
    const revenueByPlan = {
      intensive: allHistory
        .filter(h => h.newPlanType === "intensive" && h.cost)
        .reduce((sum, h) => sum + (h.cost || 0), 0),
      balanced: allHistory
        .filter(h => h.newPlanType === "balanced" && h.cost)
        .reduce((sum, h) => sum + (h.cost || 0), 0),
      standard: allHistory
        .filter(h => h.newPlanType === "standard" && h.cost)
        .reduce((sum, h) => sum + (h.cost || 0), 0),
      relaxed: allHistory
        .filter(h => h.newPlanType === "relaxed" && h.cost)
        .reduce((sum, h) => sum + (h.cost || 0), 0),
    };

    // Count by plan type
    const planCounts: Record<string, number> = {};
    allSubscriptions.forEach(sub => {
      planCounts[sub.planType] = (planCounts[sub.planType] || 0) + 1;
    });

    // Count active users by plan type
    const usersByPlan = {
      intensive: allSubscriptions.filter(s => s.status === "active" && s.planType === "intensive").length,
      balanced: allSubscriptions.filter(s => s.status === "active" && s.planType === "balanced").length,
      standard: allSubscriptions.filter(s => s.status === "active" && s.planType === "standard").length,
      relaxed: allSubscriptions.filter(s => s.status === "active" && s.planType === "relaxed").length,
    };

    return {
      totalSubscriptions: allSubscriptions.length,
      activeSubscriptions: activeCount,
      cancelledSubscriptions: cancelledCount,
      totalRevenue,
      planBreakdown: planCounts,
      recentHistory: allHistory.slice(0, 20),
      // Additional fields for frontend
      mrr,
      churnRate,
      conversionRate,
      upgradeCount,
      totalUsers,
      activeUsers: allUsers.filter(u => u.isActive).length,
      revenueByPlan,
      usersByPlan,
    };
  },
});

// Create/update subscription
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
// SECURITY/LEGACY: pre-Dodo mutation that activated a subscription without any
// payment proof. It had no callers but was publicly invocable, so it was a
// paywall bypass. Converted to internalMutation. Real purchases go through the
// Dodo checkout + webhook flow (see `createCheckoutSession` / `/dodo/webhook`).
export const createSubscription = internalMutation({
  args: {
    planType: v.union(
      v.literal("intensive"),
      v.literal("balanced"),
      v.literal("standard"),
      v.literal("relaxed")
    ),
    planDurationMonths: v.number(),
    planPrice: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const expiresAt = addMonthsUtc(Date.now(), args.planDurationMonths);

    // Check if subscription exists
    const existing = await ctx.db
      .query("userSubscriptions")
      // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (existing) {
      // Record history
      await ctx.db.insert("subscriptionHistory", {
        userId: user._id,
        action: "upgraded",
        previousPlanType: existing.planType,
        newPlanType: args.planType,
        previousExpiresAt: existing.expiresAt,
        newExpiresAt: expiresAt,
        cost: args.planPrice,
      });

      // Update subscription
      await ctx.db.patch(existing._id, {
        planType: args.planType,
        planDurationMonths: args.planDurationMonths,
        planPrice: args.planPrice,
        expiresAt,
        status: "active",
      });

      return existing._id;
    }

    // Create new subscription
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    const subId = await ctx.db.insert("userSubscriptions", {
      userId: user._id,
      planType: args.planType,
      planDurationMonths: args.planDurationMonths,
      planPrice: args.planPrice,
      expiresAt,
      status: "active",
      autoRenew: false,
    });

    // Record history
    await ctx.db.insert("subscriptionHistory", {
      userId: user._id,
      action: "purchased",
      newPlanType: args.planType,
      newExpiresAt: expiresAt,
      cost: args.planPrice,
    });

    return subId;
  },
});

function getPlanPriceCentsFromConfig(args: { planType: string; isBeta50: boolean }): number {
  const plan = SUBSCRIPTION_PLANS.find((p) => p.id === args.planType);
  if (!plan) return 0;
  if (!args.isBeta50) return plan.price;
  return Math.round(plan.price / 2);
}

export const internalListDodoInstallmentsToCancel = internalQuery({
  handler: async (ctx) => {
    // Cancel Dodo subscriptions that reached their fixed term and haven't been cancelled yet.
    const subs = await ctx.db
      .query("userSubscriptions")
      // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
      .filter((q) => q.eq(q.field("billingProvider"), "dodo"))
      // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
      .filter((q) => q.eq(q.field("paymentMode"), "installments"))
      .collect();

    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    return subs
      .filter((s) => {
        if (s.providerCancelRequestedAt !== undefined) return false;
        if (s.installmentsCompletedAt === undefined) return false;
        const total = s.installmentsTotalMonths ?? s.planDurationMonths;
        const paid = s.installmentsPaidMonths ?? 0;
        return (
          total > 0 &&
          paid >= total &&
          typeof s.providerSubscriptionId === "string" &&
          s.providerSubscriptionId.length > 0
        );
      })
      .map((s) => ({ id: s._id, providerSubscriptionId: s.providerSubscriptionId as string }));
  },
});

// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const internalMarkProviderCancelRequested = internalMutation({
  args: { id: v.id("userSubscriptions") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { providerCancelRequestedAt: Date.now() });
  },
});

export const processDodoInstallmentCancellations = internalAction({
  handler: async (ctx): Promise<{ attempted: number; cancelled: number }> => {
    if (getBillingProviderFromEnv() !== "dodo") {
      return { attempted: 0, cancelled: 0 };
    }

    const apiKey = (process.env.DODO_PAYMENTS_API_KEY || "").trim();
    if (!apiKey) {
      console.warn("[Dodo] DODO_PAYMENTS_API_KEY not configured; skipping installment cancellations.");
      return { attempted: 0, cancelled: 0 };
    }

    const env = getDodoEnvironmentFromEnv();
    const baseUrl = dodoEnvToBaseUrl(env);

    const toCancel: Array<{ id: Id<"userSubscriptions">; providerSubscriptionId: string }> =
      (await ctx.runQuery(internal.subscriptions.internalListDodoInstallmentsToCancel)) as any;
    let cancelled = 0;

    for (const item of toCancel) {
      try {
        const resp = await fetch(`${baseUrl}/subscriptions/${encodeURIComponent(item.providerSubscriptionId)}`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ cancel_at_next_billing_date: true }),
        });

        if (!resp.ok) {
          const errorText = await resp.text().catch(() => "<failed_to_read_body>");
          console.warn("[Dodo] Failed to cancel subscription at next billing date", {
            providerSubscriptionId: item.providerSubscriptionId,
            status: resp.status,
            errorText,
          });
          continue;
        }

        await ctx.runMutation(internal.subscriptions.internalMarkProviderCancelRequested, { id: item.id });
        cancelled += 1;
      } catch (err) {
        console.warn("[Dodo] Failed to cancel subscription", { providerSubscriptionId: item.providerSubscriptionId, err });
      }
    }

    return { attempted: toCancel.length, cancelled };
  },
});

function safeObject(input: unknown): Record<string, any> {
  return input && typeof input === "object" ? (input as any) : {};
}

function extractDodoMetadata(evt: any): Record<string, any> {
  const data = safeObject(evt?.data);
  const meta = safeObject((data as any)?.metadata);
  return meta;
}

function parseDodoPlanType(meta: Record<string, any>): DodoPlanId | null {
  const raw = String(meta?.planType || meta?.plan || "").trim().toLowerCase();
  // Derive the set of valid IDs from SUBSCRIPTION_PLANS so we only maintain it
  // in one place. Webhook events may still reference legacy IDs (buddy/basic/full)
  // because in-flight Dodo events from the previous plan generation use them.
  const validIds = new Set<string>(SUBSCRIPTION_PLANS.map((p) => p.id));
  if (validIds.has(raw)) return raw as DodoPlanId;
  return null;
}

function parseDodoPaymentMode(meta: Record<string, any>): DodoPaymentMode | null {
  const raw = String(meta?.paymentMode || "").trim().toLowerCase();
  if (raw === "prepaid" || raw === "installments") return raw;
  return null;
}

function parseDodoBeta50(meta: Record<string, any>): boolean {
  return meta?.beta50 === true || meta?.beta50 === "true" || meta?.beta50 === 1 || meta?.beta50 === "1";
}

async function findSubscriptionByDodoSubscriptionId(ctx: MutationCtx, subscriptionId: string) {
  return await ctx.db
    .query("userSubscriptions")
    .filter((q) => q.eq(q.field("providerSubscriptionId"), subscriptionId))
    .first();
}

// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const internalCancelDodoSubscriptionAtNextBillingDate = internalAction({
  args: { subscriptionId: v.string() },
  handler: async (ctx, args): Promise<{ ok: boolean }> => {
    const apiKey = (process.env.DODO_PAYMENTS_API_KEY || "").trim();
    if (!apiKey) {
      console.warn("[Dodo] DODO_PAYMENTS_API_KEY not configured; skipping cancellation request.");
      return { ok: false };
    }

    const env = getDodoEnvironmentFromEnv();
    const baseUrl = dodoEnvToBaseUrl(env);

    try {
      const resp = await fetch(`${baseUrl}/subscriptions/${encodeURIComponent(args.subscriptionId)}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cancel_at_next_billing_date: true }),
      });

      if (!resp.ok) {
        const errorText = await resp.text().catch(() => "<failed_to_read_body>");
        console.warn("[Dodo] Failed to request cancel_at_next_billing_date", {
          subscriptionId: args.subscriptionId,
          status: resp.status,
          errorText,
        });
        return { ok: false };
      }

      return { ok: true };
    } catch (err) {
      console.warn("[Dodo] Failed to request cancel_at_next_billing_date", { subscriptionId: args.subscriptionId, err });
      return { ok: false };
    }
  },
});

// Receives a verified Dodo webhook payload and applies side effects idempotently.
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const internalProcessDodoWebhook = internalMutation({
  args: {
    // Accept either raw JSON string (normal path from HTTP endpoint)
    // or a structured object (useful for admin/dev testing via convex run).
    rawBody: v.union(v.string(), v.any()),
    receivedAt: v.number(),
    webhookId: v.string(),
    environment: v.optional(v.union(v.literal("test_mode"), v.literal("live_mode"), v.literal("dev_mode"))),
  },
  handler: async (ctx, args) => {
    const rawBodyString = typeof args.rawBody === "string" ? args.rawBody : JSON.stringify(args.rawBody);
    let evt: any;
    try {
      evt = JSON.parse(rawBodyString);
    } catch {
      throw new Error("invalid_json");
    }

    const eventType: string = String(evt?.type || evt?.event_type || evt?.eventType || "").trim();
    if (!eventType) {
      throw new Error("missing_event_type");
    }

    const already = await ctx.db
      .query("dodoWebhookEvents")
      .withIndex("by_webhook_id", (q) => q.eq("webhookId", args.webhookId))
      .first();
    if (already) {
      return { status: "duplicate" as const };
    }

    const data = safeObject(evt?.data);
    const meta = extractDodoMetadata(evt);

    const clerkId: string | undefined = meta?.clerkId ? String(meta.clerkId) : undefined;
    const subscriptionId: string | undefined =
      (data as any)?.subscription_id ? String((data as any).subscription_id) :
      (data as any)?.subscriptionId ? String((data as any).subscriptionId) :
      undefined;
    const paymentId: string | undefined =
      (data as any)?.payment_id ? String((data as any).payment_id) :
      (data as any)?.paymentId ? String((data as any).paymentId) :
      undefined;

    const eventDocId = await ctx.db.insert("dodoWebhookEvents", {
      webhookId: args.webhookId,
      eventType,
      receivedAt: args.receivedAt,
      processedAt: undefined,
      rawPayload: rawBodyString,
      clerkId,
      subscriptionId,
      paymentId,
      environment: args.environment,
    });

    // ===== Payment failures: pause access =====
    if (eventType === "payment.failed" || eventType === "subscription.on_hold") {
      if (subscriptionId) {
        const sub = await findSubscriptionByDodoSubscriptionId(ctx, subscriptionId);
        if (sub) {
          await ctx.db.patch(sub._id, { status: "past_due", pausedAt: Date.now() });
          await ctx.db.insert("subscriptionHistory", {
            userId: sub.userId,
            action: "payment_failed",
            previousPlanType: sub.planType,
            newPlanType: sub.planType,
            notes: `dodo_webhook:${args.webhookId} ${eventType}`,
          });
        }
      }

      await ctx.db.patch(eventDocId, { processedAt: Date.now() });
      return { status: "applied" as const };
    }

    // ===== Subscription cancelled/expired: mirror state =====
    if (eventType === "subscription.cancelled" || eventType === "subscription.expired") {
      if (subscriptionId) {
        const sub = await findSubscriptionByDodoSubscriptionId(ctx, subscriptionId);
        if (sub) {
          await ctx.db.patch(sub._id, {
            status: eventType === "subscription.cancelled" ? "cancelled" : "expired",
            cancelledAt: eventType === "subscription.cancelled" ? Date.now() : sub.cancelledAt,
          });
          await ctx.db.insert("subscriptionHistory", {
            userId: sub.userId,
            action: eventType === "subscription.cancelled" ? "cancelled" : "expired",
            previousPlanType: sub.planType,
            newPlanType: sub.planType,
            notes: `dodo_webhook:${args.webhookId} ${eventType}`,
          });
        }
      }

      await ctx.db.patch(eventDocId, { processedAt: Date.now() });
      return { status: "applied" as const };
    }

    // ===== Prepaid one-time purchase: grant access after payment succeeds =====
    if (eventType === "payment.succeeded") {
      const paymentMode = parseDodoPaymentMode(meta);
      const planType = parseDodoPlanType(meta);
      const beta50 = parseDodoBeta50(meta);
      const flow = String((meta as any)?.flow ?? "").trim().toLowerCase();

      if (paymentMode !== "prepaid") {
        // Subscription renewals are handled via subscription.renewed to avoid double-counting.
        await ctx.db.patch(eventDocId, { processedAt: Date.now() });
        return { status: "ignored" as const };
      }

      if (!clerkId || !planType) {
        await ctx.db.patch(eventDocId, { processedAt: Date.now() });
        return { status: "ignored" as const };
      }

      // Upgrades are paid via dedicated top-up products and must only extend by the missing months.
      if (flow === "upgrade") {
        const fromRaw = String((meta as any)?.upgradeFromPlanType ?? "").trim().toLowerCase();
        const validPlanIds = new Set<string>(SUBSCRIPTION_PLANS.map((p) => p.id));
        const fromPlanType = validPlanIds.has(fromRaw)
          ? (fromRaw as DodoPlanId)
          : null;

        if (!fromPlanType) {
          await ctx.db.patch(eventDocId, { processedAt: Date.now() });
          return { status: "ignored" as const };
        }

        await ctx.runMutation(internal.subscriptions.internalApplyDodoUpgrade, {
          dodoWebhookId: args.webhookId,
          clerkId,
          fromPlanType,
          toPlanType: planType,
        });
      } else {
        // Check if this is a top-up payment (kind="topup" in metadata).
        const kind = String((meta as any)?.kind ?? "").trim().toLowerCase();
        if (kind === "topup") {
          const pack = String((meta as any)?.pack ?? "").trim().toLowerCase();
          const energyAmount = parseInt(String((meta as any)?.energyAmount ?? "0"), 10);
          const bonusAmount = parseInt(String((meta as any)?.bonusAmount ?? "0"), 10);
          const totalEnergy = energyAmount + bonusAmount;

          if (!clerkId || totalEnergy <= 0) {
            await ctx.db.patch(eventDocId, { processedAt: Date.now() });
            return { status: "ignored" as const };
          }

          await ctx.runMutation(internal.subscriptions.internalApplyDodoTopup, {
            dodoWebhookId: args.webhookId,
            clerkId,
            energyAmount,
            bonusAmount,
            pack: (pack === "starter" || pack === "plus" || pack === "pro") ? pack : undefined,
            providerPaymentId: paymentId,
          });

          await ctx.db.patch(eventDocId, { processedAt: Date.now() });
          return { status: "applied" as const };
        }

        const months = getPlanDurationMonths(planType);
        const planPriceCents = getPlanPriceCentsFromConfig({ planType, isBeta50: beta50 });

        const purchaseResult = await ctx.runMutation(internal.subscriptions.internalApplyDodoPurchase, {
          dodoWebhookId: args.webhookId,
          clerkId,
          planType,
          planDurationMonths: months,
          planPriceCents,
          paymentMode: "prepaid",
          dodoSubscriptionId: undefined,
          isBeta50: beta50,
        });

        // Welcome-Energy for first-time Sprachkurs + AI Pro purchase (highest tier).
        if (tierForPlanType(planType) === "course_ai_pro") {
          await ctx.runMutation(internal.subscriptions.internalMaybeGrantWelcomeEnergy, {
            userId: purchaseResult.userId,
            dodoWebhookId: args.webhookId,
          });
        }
      }

      await ctx.db.patch(eventDocId, { processedAt: Date.now() });
      return { status: "applied" as const };
    }

    // ===== Installments (subscription): count renewals and enforce fixed-term cancellation =====
    if (eventType === "subscription.renewed") {
      if (!subscriptionId) {
        await ctx.db.patch(eventDocId, { processedAt: Date.now() });
        return { status: "ignored" as const };
      }

      const existing = await findSubscriptionByDodoSubscriptionId(ctx, subscriptionId);
      if (existing) {
        // Increment paid months only for installments.
        if (existing.paymentMode === "installments") {
          const totalMonths = (existing.installmentsTotalMonths ?? existing.planDurationMonths) || 0;
          const paidMonths = (existing.installmentsPaidMonths ?? 0) + 1;
          const monthlyPrice = existing.installmentMonthlyPrice ?? 0;

          await ctx.db.patch(existing._id, {
            status: "active",
            installmentsPaidMonths: paidMonths,
            pausedAt: undefined,
          });

          await ctx.db.insert("subscriptionHistory", {
            userId: existing.userId,
            action: "renewed",
            previousPlanType: existing.planType,
            newPlanType: existing.planType,
            previousExpiresAt: existing.expiresAt,
            newExpiresAt: existing.expiresAt,
            cost: monthlyPrice,
            notes: `dodo_webhook:${args.webhookId} installments_charge:${paidMonths}/${totalMonths}`,
          });

          // When the fixed term is fully paid, request cancellation at next billing date.
          if (totalMonths > 0 && paidMonths >= totalMonths) {
            const now = Date.now();
            const shouldRequestCancel = existing.providerCancelRequestedAt === undefined;
            await ctx.db.patch(existing._id, {
              installmentsCompletedAt: now,
              providerCancelRequestedAt: existing.providerCancelRequestedAt ?? now,
            });
            if (shouldRequestCancel) {
              await ctx.scheduler.runAfter(0, internal.subscriptions.internalCancelDodoSubscriptionAtNextBillingDate, {
                subscriptionId,
              });
            }
          }
        }

        await ctx.db.patch(eventDocId, { processedAt: Date.now() });
        return { status: "applied" as const };
      }

      // First renewal we see (some setups emit subscription.renewed even for the first month).
      // Provision the local subscription if we can.
      const planType = parseDodoPlanType(meta);
      const paymentMode = parseDodoPaymentMode(meta);
      if (!clerkId || !planType || paymentMode !== "installments") {
        await ctx.db.patch(eventDocId, { processedAt: Date.now() });
        return { status: "ignored" as const };
      }

      const months = getPlanDurationMonths(planType);
      const planPriceCents = getInstallmentTotalCents(planType);

      await ctx.runMutation(internal.subscriptions.internalApplyDodoPurchase, {
        dodoWebhookId: args.webhookId,
        clerkId,
        planType,
        planDurationMonths: months,
        planPriceCents,
        paymentMode: "installments",
        dodoSubscriptionId: subscriptionId,
        isBeta50: false,
      });

      await ctx.db.patch(eventDocId, { processedAt: Date.now() });
      return { status: "applied" as const };
    }

    await ctx.db.patch(eventDocId, { processedAt: Date.now() });
    return { status: "ignored" as const };
  },
});

// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const internalApplyDodoPurchase = internalMutation({
  args: {
    dodoWebhookId: v.string(),
    clerkId: v.string(),
    planType: PAID_PLAN_ID_VALIDATOR,
    planDurationMonths: v.number(),
    planPriceCents: v.number(),
    paymentMode: v.union(v.literal("prepaid"), v.literal("installments")),
    dodoSubscriptionId: v.optional(v.string()),
    isBeta50: v.boolean(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const user = await ctx.db
      .query("users")
      // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) {
      throw new Error(`User not found for clerkId=${args.clerkId}`);
    }

    // Enforce one-time beta discount usage (no expiry), only after beta ends.
    if (args.isBeta50) {
      const betaEndTs = process.env.BETA_END_DATE ? Date.parse(process.env.BETA_END_DATE) : NaN;
      const betaEnded = Number.isFinite(betaEndTs) ? now > betaEndTs : false;

      if (!betaEnded) throw new Error("beta_discount_not_active");
      if (user.isBetaTester !== true) throw new Error("beta_discount_not_eligible");
      if (user.betaDiscountUsedAt !== undefined) throw new Error("beta_discount_already_used");

      await ctx.db.patch(user._id, { betaDiscountUsedAt: now });
    }

    const existing = await ctx.db
      .query("userSubscriptions")
      // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    const baseStart = existing?.expiresAt && existing.expiresAt > now ? existing.expiresAt : now;
    const expiresAt = addMonthsUtc(baseStart, args.planDurationMonths);

    const maxAccessibleUnits = await getTotalUnitsCount(ctx);

    const installmentMonthlyPrice =
      args.paymentMode === "installments" ? getInstallmentMonthlyChargeCents(args.planType) : undefined;
    const installmentsTotalMonths = args.paymentMode === "installments" ? args.planDurationMonths : undefined;

    const payload = {
      planType: args.planType,
      planDurationMonths: args.planDurationMonths,
      planPrice: args.planPriceCents,
      expiresAt,
      status: "active" as const,
      autoRenew: false,
      cancelledAt: undefined as number | undefined,
      maxAccessibleUnits,
      paymentMode: args.paymentMode as "prepaid" | "installments",
      billingProvider: "dodo" as const,
      providerSubscriptionId: args.dodoSubscriptionId,
      installmentsTotalMonths,
      installmentsPaidMonths: args.paymentMode === "installments" ? 1 : undefined,
      installmentMonthlyPrice,
      pausedAt: undefined as number | undefined,
      // Derive feature tier from compound plan ID.
      featureTier: tierForPlanType(args.planType) as "course" | "standalone" | "course_ai" | "course_ai_pro",
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      await ctx.db.insert("subscriptionHistory", {
        userId: user._id,
        action: existing.planType === args.planType ? "renewed" : "upgraded",
        previousPlanType: existing.planType,
        newPlanType: args.planType,
        previousExpiresAt: existing.expiresAt,
        newExpiresAt: expiresAt,
        cost: args.paymentMode === "installments" ? installmentMonthlyPrice : args.planPriceCents,
        notes: `dodo_webhook:${args.dodoWebhookId}`,
      });
      return { subscriptionId: existing._id, userId: user._id };
    }

    const subscriptionId = await ctx.db.insert("userSubscriptions", {
      userId: user._id,
      ...payload,
    });

    await ctx.db.insert("subscriptionHistory", {
      userId: user._id,
      action: "purchased",
      newPlanType: args.planType,
      newExpiresAt: expiresAt,
      cost: args.paymentMode === "installments" ? installmentMonthlyPrice : args.planPriceCents,
      notes: `dodo_webhook:${args.dodoWebhookId}`,
    });

    return { subscriptionId, userId: user._id };
  },
});

// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const internalApplyDodoUpgrade = internalMutation({
  args: {
    dodoWebhookId: v.string(),
    clerkId: v.string(),
    fromPlanType: PAID_PLAN_ID_VALIDATOR,
    toPlanType: PAID_PLAN_ID_VALIDATOR,
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const user = await ctx.db
      .query("users")
      // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) {
      throw new Error(`User not found for clerkId=${args.clerkId}`);
    }

    const existing = await ctx.db
      .query("userSubscriptions")
      // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    if (!existing || existing.status !== "active") {
      throw new Error("not_active");
    }

    // Upgrades are only supported for prepaid (one-time) plans.
    if (existing.paymentMode !== "prepaid") {
      throw new Error("upgrade_requires_prepaid");
    }

    const fromMonths = getPlanDurationMonths(args.fromPlanType);
    const toMonths = getPlanDurationMonths(args.toPlanType);
    if (!fromMonths || !toMonths || toMonths <= fromMonths) {
      throw new Error("downgrade_not_supported");
    }

    const addedMonths = toMonths - fromMonths;
    const fromPriceCents = getPlanPriceCentsFromConfig({ planType: args.fromPlanType, isBeta50: false });
    const toPriceCents = getPlanPriceCentsFromConfig({ planType: args.toPlanType, isBeta50: false });
    const chargedCents = Math.max(0, toPriceCents - fromPriceCents);
    if (chargedCents <= 0) {
      throw new Error("downgrade_not_supported");
    }

    const baseStart = existing.expiresAt && existing.expiresAt > now ? existing.expiresAt : now;
    const expiresAt = addMonthsUtc(baseStart, addedMonths);
    const maxAccessibleUnits = await getTotalUnitsCount(ctx);

    await ctx.db.patch(existing._id, {
      planType: args.toPlanType,
      planDurationMonths: toMonths,
      planPrice: toPriceCents,
      expiresAt,
      status: "active",
      autoRenew: false,
      cancelledAt: undefined,
      maxAccessibleUnits,
      paymentMode: "prepaid",
      billingProvider: "dodo",
      pausedAt: undefined,
      featureTier: tierForPlanType(args.toPlanType) as "course" | "standalone" | "course_ai" | "course_ai_pro",
    });

    await ctx.db.insert("subscriptionHistory", {
      userId: user._id,
      action: "upgraded",
      previousPlanType: existing.planType,
      newPlanType: args.toPlanType,
      previousExpiresAt: existing.expiresAt,
      newExpiresAt: expiresAt,
      cost: chargedCents,
      notes: `dodo_webhook:${args.dodoWebhookId} upgrade:${args.fromPlanType}->${args.toPlanType}`,
    });

    return { subscriptionId: existing._id, userId: user._id };
  },
});


// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const internalUpsertDodoProduct = internalMutation({
  args: {
    productId: v.string(),
    name: v.string(),
    price: v.number(),
    currency: v.string(),
    isRecurring: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("dodoProducts")
      .withIndex("by_product_id", (q) => q.eq("productId", args.productId))
      .first();

    const payload = {
      ...args,
      lastSyncedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }

    return await ctx.db.insert("dodoProducts", payload);
  },
});

// Syncs product data from Dodo Payments for all configured product IDs.
// SECURITY: was a public action (no auth) exposing Dodo API usage and DB writes
// to anyone. No app caller exists; converted to internalAction. Run via
// `npx convex run internal.subscriptions.syncDodoProducts` or schedule it.
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const syncDodoProducts = internalAction({
  args: {},
  handler: async (ctx) => {
    const apiKey = (process.env.DODO_PAYMENTS_API_KEY || "").trim();
    if (!apiKey) throw new Error("DODO_PAYMENTS_API_KEY not configured");

    const env = getDodoEnvironmentFromEnv();
    const baseUrl = dodoEnvToBaseUrl(env);

    const productEnvKeys = [
      "DODO_PRODUCT_COURSE_3M_PREPAID", "DODO_PRODUCT_COURSE_3M_INSTALLMENTS",
      "DODO_PRODUCT_COURSE_6M_PREPAID", "DODO_PRODUCT_COURSE_6M_INSTALLMENTS",
      "DODO_PRODUCT_COURSE_12M_PREPAID", "DODO_PRODUCT_COURSE_12M_INSTALLMENTS",
      "DODO_PRODUCT_BUDDY_3M_PREPAID", "DODO_PRODUCT_BUDDY_3M_INSTALLMENTS",
      "DODO_PRODUCT_BUDDY_6M_PREPAID", "DODO_PRODUCT_BUDDY_6M_INSTALLMENTS",
      "DODO_PRODUCT_BUDDY_12M_PREPAID", "DODO_PRODUCT_BUDDY_12M_INSTALLMENTS",
      "DODO_PRODUCT_BASIC_3M_PREPAID", "DODO_PRODUCT_BASIC_3M_INSTALLMENTS",
      "DODO_PRODUCT_BASIC_6M_PREPAID", "DODO_PRODUCT_BASIC_6M_INSTALLMENTS",
      "DODO_PRODUCT_BASIC_12M_PREPAID", "DODO_PRODUCT_BASIC_12M_INSTALLMENTS",
      "DODO_PRODUCT_FULL_3M_PREPAID", "DODO_PRODUCT_FULL_3M_INSTALLMENTS",
      "DODO_PRODUCT_FULL_6M_PREPAID", "DODO_PRODUCT_FULL_6M_INSTALLMENTS",
      "DODO_PRODUCT_FULL_12M_PREPAID", "DODO_PRODUCT_FULL_12M_INSTALLMENTS",
      "DODO_TOPUP_STARTER", "DODO_TOPUP_PLUS", "DODO_TOPUP_PRO",
    ] as const;

    const results = [];
    for (const key of productEnvKeys) {
      const productId = (process.env[key] || "").trim();
      if (!productId) continue;

      try {
        const resp = await fetch(`${baseUrl}/products/${encodeURIComponent(productId)}`, {
          method: "GET",
          headers: { Authorization: `Bearer ${apiKey}` },
        });

        if (!resp.ok) {
          console.warn(`[Dodo] Failed to fetch product ${productId}`, { status: resp.status });
          continue;
        }

        const product: any = await resp.json();
        const price = product.price?.price ?? 0;
        const currency = product.price?.currency ?? "EUR";
        const name = product.name ?? "";
        const isRecurring = product.is_recurring ?? false;

        await ctx.runMutation(internal.subscriptions.internalUpsertDodoProduct, {
          productId,
          name,
          price,
          currency,
          isRecurring,
        });

        results.push({ productId, status: "synced" });
      } catch (err) {
        console.warn(`[Dodo] Error syncing product ${productId}`, err);
      }
    }

    return { synced: results.length, details: results };
  },
});

// ===== Server-side helpers for migrations =====

const serverUpsertArgs = {
  clerkId: v.string(),
  planType: v.union(
    v.literal("beta"),
    v.literal("intensive"),
    v.literal("balanced"),
    v.literal("standard"),
    v.literal("relaxed")
  ),
  planDurationMonths: v.number(),
  planPrice: v.number(),
  status: v.union(
    v.literal("active"),
    v.literal("past_due"),
    v.literal("expired"),
    v.literal("cancelled")
  ),
  expiresAt: v.number(),
  autoRenew: v.optional(v.boolean()),
  maxAccessibleUnits: v.optional(v.number()),
  cancelledAt: v.optional(v.number()),
};

// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const internalUpsertSubscriptionForServer = internalMutation({
  args: serverUpsertArgs,
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) {
      throw new Error(`User with clerkId ${args.clerkId} not found in Convex.`);
    }

    const existing = await ctx.db
      .query("userSubscriptions")
      // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    const payload = {
      planType: args.planType,
      planDurationMonths: args.planDurationMonths,
      planPrice: args.planPrice,
      status: args.status,
      expiresAt: args.expiresAt,
      autoRenew: args.autoRenew ?? existing?.autoRenew ?? false,
      maxAccessibleUnits: args.maxAccessibleUnits ?? existing?.maxAccessibleUnits,
      cancelledAt: args.cancelledAt ?? existing?.cancelledAt ?? undefined,
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }

    return await ctx.db.insert("userSubscriptions", {
      userId: user._id,
      ...payload,
    });
  },
});

const serverHistoryArgs = {
  clerkId: v.string(),
  action: v.union(
    v.literal("purchased"),
    v.literal("upgraded"),
    v.literal("downgraded"),
    v.literal("cancelled"),
    v.literal("expired"),
    v.literal("renewed")
  ),
  previousPlanType: v.optional(v.string()),
  newPlanType: v.optional(v.string()),
  previousExpiresAt: v.optional(v.number()),
  newExpiresAt: v.optional(v.number()),
  cost: v.optional(v.number()),
  notes: v.optional(v.string()),
  migrationId: v.optional(v.string()),
};

// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const internalAddSubscriptionHistoryForServer = internalMutation({
  args: serverHistoryArgs,
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) {
      throw new Error(`User with clerkId ${args.clerkId} not found in Convex.`);
    }

    await ctx.db.insert("subscriptionHistory", {
      userId: user._id,
      action: args.action,
      previousPlanType: args.previousPlanType,
      newPlanType: args.newPlanType,
      previousExpiresAt: args.previousExpiresAt ?? undefined,
      newExpiresAt: args.newExpiresAt ?? undefined,
      cost: args.cost ?? undefined,
      notes: args.notes ?? args.migrationId ?? undefined,
    });
  },
});

// ===== Phase 4: Energy Top-up + Welcome-Energy =====

/**
 * Apply a one-time energy top-up purchase (Dodo payment.succeeded, kind="topup").
 * Atomically increments energyTopUpBalance on the user's active subscription
 * and records an energyPurchase + energyLedger entry.
 */
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const internalApplyDodoTopup = internalMutation({
  args: {
    dodoWebhookId: v.string(),
    clerkId: v.string(),
    energyAmount: v.number(),
    bonusAmount: v.number(),
    pack: v.optional(v.union(v.literal("starter"), v.literal("plus"), v.literal("pro"))),
    providerPaymentId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const user = await ctx.db
      .query("users")
      // @ts-ignore TS2589 – Convex schema depth limit (50 tables)
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) throw new Error(`User not found for clerkId=${args.clerkId}`);

    const totalEnergy = args.energyAmount + args.bonusAmount;

    // Find active subscription to update energyTopUpBalance.
    const sub = await ctx.db
      .query("userSubscriptions")
      // @ts-ignore TS2589 – Convex schema depth limit (50 tables)
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();

    if (sub) {
      const balances = applyTopUpToSubscriptionBalances(sub, totalEnergy);
      await ctx.db.patch(sub._id, balances);
    }

    // Record purchase history.
    await ctx.db.insert("energyPurchases", {
      userId: user._id,
      energyAdded: totalEnergy,
      priceCents: 0, // priceCents unknown at mutation level; webhook metadata could carry it
      purchasedAt: now,
      billingProvider: "dodo",
      providerPaymentId: args.providerPaymentId,
      pack: args.pack,
    });

    // Audit ledger entry.
    await ctx.db.insert("energyLedger", {
      userId: user._id,
      delta: totalEnergy,
      reason: "topup",
      note: args.pack
        ? `Top-up pack: ${args.pack} (${args.energyAmount}+${args.bonusAmount} bonus) | webhook:${args.dodoWebhookId}`
        : `Top-up: ${totalEnergy} energy | webhook:${args.dodoWebhookId}`,
      createdAt: now,
    });

    return { userId: user._id, energyAdded: totalEnergy };
  },
});

/**
 * Grant the Welcome-Energy bonus to a user who just made their first Full-tier purchase.
 * Idempotency: checks whether any previous welcome_bonus ledger entry exists for this user.
 */
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const internalMaybeGrantWelcomeEnergy = internalMutation({
  args: {
    userId: v.id("users"),
    dodoWebhookId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Idempotency check: if user already has a welcome_bonus ledger entry, skip.
    const existing = await ctx.db
      .query("energyLedger")
      // @ts-ignore TS2589 – Convex schema depth limit (50 tables)
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("reason"), "welcome_bonus"))
      .first();
    if (existing) return { granted: false, reason: "already_granted" };

    // Load welcome energy amount from platformConfig (default 500, 0 = disabled).
    // @ts-ignore TS2589 – Convex schema depth limit (50 tables)
    const config = await ctx.db.query("platformConfig").first();
    const welcomeAmount = config?.welcomeEnergyAmount ?? DEFAULT_WELCOME_ENERGY_AMOUNT;
    if (welcomeAmount <= 0) return { granted: false, reason: "disabled" };

    // Apply to active subscription's top-up balance.
    const sub = await ctx.db
      .query("userSubscriptions")
      // @ts-ignore TS2589 – Convex schema depth limit (50 tables)
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();

    if (sub) {
      const balances = applyTopUpToSubscriptionBalances(sub, welcomeAmount);
      await ctx.db.patch(sub._id, balances);
    }

    await ctx.db.insert("energyLedger", {
      userId: args.userId,
      delta: welcomeAmount,
      reason: "welcome_bonus",
      note: `Welcome-Energy for first Full-tier purchase | webhook:${args.dodoWebhookId}`,
      createdAt: now,
    });

    return { granted: true, amount: welcomeAmount };
  },
});

