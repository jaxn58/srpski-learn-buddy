import { v } from "convex/values";
import { mutation, query, action, QueryCtx, MutationCtx, internalMutation, internalAction, internalQuery } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

// Helper to get the current user
async function getCurrentUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();
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

// Subscription plans
const SUBSCRIPTION_PLANS = [
  // NOTE: Prices are in cents (EUR).
  { id: "beta", name: "Beta Access", months: 0, price: 0, unitsPerWeek: 0 },
  { id: "intensive", name: "Intensive", months: 3, price: 6900, unitsPerWeek: 3 },
  { id: "balanced", name: "Balanced", months: 6, price: 7900, unitsPerWeek: 2 },
  { id: "standard", name: "Standard", months: 9, price: 9500, unitsPerWeek: 1.5 },
  { id: "relaxed", name: "Relaxed", months: 12, price: 11900, unitsPerWeek: 1 },
];

type PaidPlanId = "intensive" | "balanced" | "standard" | "relaxed";

// Beta phase policy: during beta, only Unit 1 is accessible for normal users.
const BETA_MAX_UNITS = 1;

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
  if (!plan || !plan.months) return 0;
  const monthlyTotal = Math.round(plan.price * 1.1);
  const rawMonthly = monthlyTotal / plan.months;
  return charmRoundUpTo99Cents(rawMonthly);
}

function getInstallmentTotalCents(planType: PaidPlanId): number {
  const plan = SUBSCRIPTION_PLANS.find((p) => p.id === planType);
  if (!plan || !plan.months) return 0;
  const monthly = getInstallmentMonthlyChargeCents(planType);
  return monthly * plan.months;
}

// Get accessible units for current user based on subscription
export const getAccessibleUnits = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return { maxUnits: 0, isBeta: false };

    // Admins/Superadmins always have full access (e.g., for QA and content verification).
    if (user.role === "admin" || user.role === "superadmin") {
      const totalUnits = await getTotalUnitsCount(ctx);
      return { maxUnits: totalUnits, isBeta: false };
    }

    // Check for active subscription first
    const subscription = await ctx.db
      .query("userSubscriptions")
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

    if (subscription?.maxAccessibleUnits) {
      return {
        maxUnits: subscription.maxAccessibleUnits,
        isBeta: subscription.planType === "beta",
      };
    }

    // Fallback: Check Beta Tester Flag (for backwards compatibility)
    // Beta testers have access to Unit 1 during beta.
    if (user.isBetaTester) {
      return { maxUnits: BETA_MAX_UNITS, isBeta: true };
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

    const subscription = await ctx.db
      .query("userSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    // Virtual Beta Subscription for Beta Testers without subscription
    // Beta testers have access to Unit 1 during beta.
    if (!subscription && user.isBetaTester) {
      return {
        planType: "beta" as const,
        planName: "Beta Access",
        maxAccessibleUnits: BETA_MAX_UNITS,
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
export const getPlans = query({
  handler: async () => {
    return SUBSCRIPTION_PLANS.map((p) => {
      if (p.id === "beta") return { ...p, paymentOptions: { prepaidTotal: 0 } };
      const planType = p.id as PaidPlanId;
      const monthly = getInstallmentMonthlyChargeCents(planType);
      const total = getInstallmentTotalCents(planType);
      return {
        ...p,
        paymentOptions: {
          prepaidTotal: p.price,
          installmentsMonthly: monthly,
          installmentsTotal: total,
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
      return { betaEnded: false, eligible: false, usedAt: null as number | null };
    }

    const betaEndTs = process.env.BETA_END_DATE ? Date.parse(process.env.BETA_END_DATE) : NaN;
    const betaEnded = Number.isFinite(betaEndTs) ? Date.now() > betaEndTs : false;
    const usedAt = user.betaDiscountUsedAt ?? null;
    const eligible = betaEnded && user.isBetaTester === true && usedAt === null;

    return { betaEnded, eligible, usedAt };
  },
});

function getBillingProviderFromEnv(): "dodo" {
  // Paddle support removed; Dodo is the only billing provider.
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
    const dodoApiKey = (process.env.DODO_PAYMENTS_API_KEY || "").trim();
    const dodoWebhookSecret = (
      process.env.DODO_PAYMENTS_WEBHOOK_SECRET ||
      process.env.DODO_PAYMENTS_WEBHOOK_KEY ||
      ""
    ).trim();

    const requiredProductEnvKeys = [
      "DODO_PRODUCT_INTENSIVE_PREPAID",
      "DODO_PRODUCT_INTENSIVE_INSTALLMENTS",
      "DODO_PRODUCT_BALANCED_PREPAID",
      "DODO_PRODUCT_BALANCED_INSTALLMENTS",
      "DODO_PRODUCT_STANDARD_PREPAID",
      "DODO_PRODUCT_STANDARD_INSTALLMENTS",
      "DODO_PRODUCT_RELAXED_PREPAID",
      "DODO_PRODUCT_RELAXED_INSTALLMENTS",
    ] as const;

    const missingProductEnvKeys = requiredProductEnvKeys.filter((k) => !(process.env[k] || "").trim());

    return {
      provider,
      dodo: {
        environment: dodoEnv,
        // API key is server-only; expose only whether it exists.
        configured: dodoApiKey.length > 0,
        webhookConfigured: dodoWebhookSecret.length > 0,
        missingProductEnvKeys,
      },
    };
  },
});

type DodoPlanId = "intensive" | "balanced" | "standard" | "relaxed";
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
  const planKey = args.planType.toUpperCase();
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
    const referenceProductId = (process.env.DODO_PRODUCT_STANDARD_PREPAID || "").trim();
    if (!referenceProductId) throw new Error("DODO_PRODUCT_STANDARD_PREPAID not configured");

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

    const planPrice = (id: "intensive" | "balanced" | "standard" | "relaxed") => {
      const p = SUBSCRIPTION_PLANS.find((x) => x.id === id);
      return p?.price ?? 0;
    };
    const planName = (id: "intensive" | "balanced" | "standard" | "relaxed") => {
      const p = SUBSCRIPTION_PLANS.find((x) => x.id === id);
      return p?.name ?? id;
    };

    const paths = [
      { from: "intensive", to: "balanced" },
      { from: "intensive", to: "standard" },
      { from: "intensive", to: "relaxed" },
      { from: "balanced", to: "standard" },
      { from: "balanced", to: "relaxed" },
      { from: "standard", to: "relaxed" },
    ] as const;

    const created: Record<string, string> = {};
    const alreadySet: string[] = [];
    const planned: Array<{ envKey: string; priceCents: number; name: string }> = [];

    for (const p of paths) {
      const envKey = `DODO_UPG_${p.from.toUpperCase()}_${p.to.toUpperCase()}`;
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

function getPlanDurationMonths(planType: DodoPlanId): number {
  const plan = SUBSCRIPTION_PLANS.find((p) => p.id === planType);
  return plan?.months ?? 0;
}

// Creates a Dodo checkout session and returns the hosted checkout URL.
// Client should only open the returned URL (never handle API keys).
export const createDodoCheckoutSession = action({
  args: {
    planType: v.union(v.literal("intensive"), v.literal("balanced"), v.literal("standard"), v.literal("relaxed")),
    paymentMode: v.union(v.literal("prepaid"), v.literal("installments")),
    flow: v.union(v.literal("purchase"), v.literal("upgrade")),
    returnUrl: v.string(),
    source: v.optional(v.string()),
    beta50: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{ checkoutUrl: string; provider: "dodo" }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.runQuery(api.users.me);
    if (!user) throw new Error("User not found");

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

    const beta50Requested = args.beta50 === true && paymentMode === "prepaid";
    const discountCode =
      beta50Requested && (process.env.DODO_BETA50_DISCOUNT_CODE || "").trim()
        ? (process.env.DODO_BETA50_DISCOUNT_CODE || "").trim()
        : null;

    // Server-side eligibility: only allow beta50 after beta ends.
    const betaEndTs = process.env.BETA_END_DATE ? Date.parse(process.env.BETA_END_DATE) : NaN;
    const betaEnded = Number.isFinite(betaEndTs) ? Date.now() > betaEndTs : false;
    const betaEligible =
      beta50Requested && betaEnded && user.isBetaTester === true && (user.betaDiscountUsedAt ?? null) === null;

    const effectiveDiscountCode = betaEligible ? discountCode : null;
    const effectiveDiscountCodeForCheckout = args.flow === "upgrade" ? null : effectiveDiscountCode;

    const body = {
      allowed_payment_method_types: ["credit", "debit"],
      product_cart: [{ product_id: productId, quantity: 1 }],
      return_url: args.returnUrl,
      discount_code: effectiveDiscountCodeForCheckout,
      customer: user.email ? { email: user.email, name: user.name ?? undefined } : undefined,
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

// Calculate upgrade cost
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
    if (newPlanInfo.months <= currentPlanInfo.months) {
      throw new Error("downgrade_not_supported");
    }

    // Simple pro-rated calculation
    const cost = Math.max(0, newPlanInfo.price - currentPlanInfo.price);
    return { cost, newPlan: newPlanInfo };
  },
});

// Cancel subscription
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
    const totalRevenue = allHistory
      .filter(h => h.cost)
      .reduce((sum, h) => sum + (h.cost || 0), 0);

    // Calculate MRR (Monthly Recurring Revenue) from active subscriptions
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
export const createSubscription = mutation({
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
      .filter((q) => q.eq(q.field("billingProvider"), "dodo"))
      .filter((q) => q.eq(q.field("paymentMode"), "installments"))
      .collect();

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
  if (raw === "intensive" || raw === "balanced" || raw === "standard" || raw === "relaxed") return raw;
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
        const fromPlanType =
          fromRaw === "intensive" || fromRaw === "balanced" || fromRaw === "standard" || fromRaw === "relaxed"
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
        const months = getPlanDurationMonths(planType);
        const planPriceCents = getPlanPriceCentsFromConfig({ planType, isBeta50: beta50 });

        await ctx.runMutation(internal.subscriptions.internalApplyDodoPurchase, {
          dodoWebhookId: args.webhookId,
          clerkId,
          planType,
          planDurationMonths: months,
          planPriceCents,
          paymentMode: "prepaid",
          dodoSubscriptionId: undefined,
          isBeta50: beta50,
        });
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

export const internalApplyDodoPurchase = internalMutation({
  args: {
    dodoWebhookId: v.string(),
    clerkId: v.string(),
    planType: v.union(v.literal("intensive"), v.literal("balanced"), v.literal("standard"), v.literal("relaxed")),
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

export const internalApplyDodoUpgrade = internalMutation({
  args: {
    dodoWebhookId: v.string(),
    clerkId: v.string(),
    fromPlanType: v.union(v.literal("intensive"), v.literal("balanced"), v.literal("standard"), v.literal("relaxed")),
    toPlanType: v.union(v.literal("intensive"), v.literal("balanced"), v.literal("standard"), v.literal("relaxed")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) {
      throw new Error(`User not found for clerkId=${args.clerkId}`);
    }

    const existing = await ctx.db
      .query("userSubscriptions")
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

export const internalUpsertSubscriptionForServer = internalMutation({
  args: serverUpsertArgs,
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) {
      throw new Error(`User with clerkId ${args.clerkId} not found in Convex.`);
    }

    const existing = await ctx.db
      .query("userSubscriptions")
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

