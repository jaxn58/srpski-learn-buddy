import { v } from "convex/values";
import { action, ActionCtx, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc } from "./_generated/dataModel";
import { callAiJson } from "./contentStudio/_shared";
import { isLearnerAccountSuspended } from "./authz";

const audienceValidator = v.union(
  v.literal("all_authenticated"),
  v.literal("beta_testers_only"),
);

async function requireAdmin(ctx: { auth: { getUserIdentity: () => Promise<unknown> }; db: any }) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity || typeof identity !== "object" || !("subject" in identity)) {
    throw new Error("Unauthorized - not authenticated");
  }
  const subject = (identity as { subject: string }).subject;
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", subject))
    .first();
  if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
    throw new Error("Unauthorized - admin access required");
  }
  return user;
}

async function requireAdminAction(ctx: ActionCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthorized - not authenticated");
  const user = await ctx.runQuery(internal.users.internalGetUserByClerkId, {
    clerkId: identity.subject,
  });
  if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
    throw new Error("Unauthorized - admin access required");
  }
  return user;
}

function extractVariables(content: string): string[] {
  const variableRegex = /\{\{(\w+)\}\}/g;
  const foundVariables = new Set<string>();
  let match;
  while ((match = variableRegex.exec(content)) !== null) {
    foundVariables.add(match[1]);
  }
  return Array.from(foundVariables);
}

function diffVariables(params: { source: string[]; target: string[] }) {
  const s = new Set(params.source);
  const t = new Set(params.target);
  const missing = Array.from(s).filter((vName) => !t.has(vName));
  const added = Array.from(t).filter((vName) => !s.has(vName));
  return { missing, added };
}

function normalizeKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "_");
}

function pickLocalized(
  language: "en" | "de",
  en: string,
  de?: string,
): string {
  if (language === "de" && de !== undefined && de.trim() !== "") {
    return de;
  }
  return en;
}

// @ts-ignore TS2589 – Convex schema depth limit (51 tables)
export const listDashboardAnnouncements = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("dashboardAnnouncements").collect();
    return rows.sort((a, b) => a.key.localeCompare(b.key));
  },
});

// @ts-ignore TS2589 – Convex schema depth limit (51 tables)
export const getDashboardAnnouncementForUser = query({
  args: {
    key: v.string(),
    language: v.union(v.literal("en"), v.literal("de")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || typeof identity !== "object" || !("subject" in identity)) {
      return null;
    }
    const subject = (identity as { subject: string }).subject;
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", subject))
      .first();
    if (!user) {
      return null;
    }

    if (isLearnerAccountSuspended(user)) {
      return null;
    }

    const key = normalizeKey(args.key);
    const doc = await ctx.db
      .query("dashboardAnnouncements")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();

    if (!doc || !doc.isActive) {
      return null;
    }
    if (doc.audience === "beta_testers_only" && !user.isBetaTester) {
      return null;
    }

    const lang = args.language;
    return {
      key: doc.key,
      title: pickLocalized(lang, doc.titleEn, doc.titleDe),
      intro: pickLocalized(lang, doc.introEn, doc.introDe),
      body: pickLocalized(lang, doc.bodyEn, doc.bodyDe),
    };
  },
});

// @ts-ignore TS2589 – Convex schema depth limit (51 tables)
export const createDashboardAnnouncement = mutation({
  args: {
    key: v.string(),
    titleEn: v.string(),
    introEn: v.string(),
    bodyEn: v.string(),
    titleDe: v.optional(v.string()),
    introDe: v.optional(v.string()),
    bodyDe: v.optional(v.string()),
    isActive: v.boolean(),
    audience: audienceValidator,
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const key = normalizeKey(args.key);
    if (!key || !/^[a-z0-9_-]+$/.test(key)) {
      throw new Error(
        "Invalid key: use only lowercase letters, digits, underscores and hyphens (e.g. dashboard_beta).",
      );
    }

    const existing = await ctx.db
      .query("dashboardAnnouncements")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
    if (existing) {
      throw new Error(`An announcement with key "${key}" already exists.`);
    }

    const now = Date.now();
    const titleEn = args.titleEn.trim();
    const introEn = args.introEn.trim();
    const bodyEn = args.bodyEn.trim();
    if (!titleEn || !introEn || !bodyEn) {
      throw new Error("titleEn, introEn and bodyEn are required and cannot be empty.");
    }

    const id = await ctx.db.insert("dashboardAnnouncements", {
      key,
      titleEn,
      introEn,
      bodyEn,
      titleDe: args.titleDe?.trim() || undefined,
      introDe: args.introDe?.trim() || undefined,
      bodyDe: args.bodyDe?.trim() || undefined,
      isActive: args.isActive,
      audience: args.audience,
      createdAt: now,
      updatedAt: now,
      createdBy: admin._id,
      updatedBy: admin._id,
    });

    return id;
  },
});

// @ts-ignore TS2589 – Convex schema depth limit (51 tables)
export const updateDashboardAnnouncement = mutation({
  args: {
    announcementId: v.id("dashboardAnnouncements"),
    key: v.optional(v.string()),
    titleEn: v.optional(v.string()),
    introEn: v.optional(v.string()),
    bodyEn: v.optional(v.string()),
    titleDe: v.optional(v.string()),
    introDe: v.optional(v.string()),
    bodyDe: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    audience: v.optional(audienceValidator),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const doc = await ctx.db.get(args.announcementId);
    if (!doc) {
      throw new Error("Announcement not found.");
    }

    const updates: Partial<Doc<"dashboardAnnouncements">> = {
      updatedAt: Date.now(),
      updatedBy: admin._id,
    };

    if (args.key !== undefined) {
      const key = normalizeKey(args.key);
      if (!key || !/^[a-z0-9_-]+$/.test(key)) {
        throw new Error(
          "Invalid key: use only lowercase letters, digits, underscores and hyphens.",
        );
      }
      if (key !== doc.key) {
        const clash = await ctx.db
          .query("dashboardAnnouncements")
          .withIndex("by_key", (q) => q.eq("key", key))
          .first();
        if (clash) {
          throw new Error(`An announcement with key "${key}" already exists.`);
        }
        updates.key = key;
      }
    }

    if (args.titleEn !== undefined) {
      const t = args.titleEn.trim();
      if (!t) throw new Error("titleEn cannot be empty.");
      updates.titleEn = t;
    }
    if (args.introEn !== undefined) {
      const t = args.introEn.trim();
      if (!t) throw new Error("introEn cannot be empty.");
      updates.introEn = t;
    }
    if (args.bodyEn !== undefined) {
      const t = args.bodyEn.trim();
      if (!t) throw new Error("bodyEn cannot be empty.");
      updates.bodyEn = t;
    }
    if (args.titleDe !== undefined) {
      updates.titleDe = args.titleDe.trim() || undefined;
    }
    if (args.introDe !== undefined) {
      updates.introDe = args.introDe.trim() || undefined;
    }
    if (args.bodyDe !== undefined) {
      updates.bodyDe = args.bodyDe.trim() || undefined;
    }
    if (args.isActive !== undefined) {
      updates.isActive = args.isActive;
    }
    if (args.audience !== undefined) {
      updates.audience = args.audience;
    }

    await ctx.db.patch(args.announcementId, updates);
    return { success: true as const };
  },
});

// @ts-ignore TS2589 – Convex schema depth limit (51 tables)
export const deleteDashboardAnnouncement = mutation({
  args: {
    announcementId: v.id("dashboardAnnouncements"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const doc = await ctx.db.get(args.announcementId);
    if (!doc) {
      throw new Error("Announcement not found.");
    }
    await ctx.db.delete(args.announcementId);
    return { success: true as const };
  },
});

/**
 * English copy for the legacy dashboard beta banner (must stay aligned with
 * `dashboard.betaBanner.*` in client/src/i18n.ts — English locale).
 */
export const DASHBOARD_BETA_BANNER_EN_DEFAULTS = {
  key: "dashboard_beta" as const,
  titleEn: "Beta Tester Benefits",
  introEn: "Thank you for being an early supporter! As a beta tester, you have:",
  bodyEn: `✓ Free access to Unit 1 (Foundation) during the beta phase
✓ 50% OFF discount when I launch paid plans

📅 After Launch:
You'll receive an email with your exclusive 50% discount code to unlock Modules 2-5 and continue your Serbian learning journey!`,
};

// @ts-ignore TS2589 – Convex schema depth limit (51 tables)
/**
 * Creates the `dashboard_beta` announcement with English defaults if it does not exist yet.
 */
export const seedDashboardBetaBannerEnglishDefaults = mutation({
  args: {},
  handler: async (ctx) => {
    const admin = await requireAdmin(ctx);
    const key = DASHBOARD_BETA_BANNER_EN_DEFAULTS.key;
    const existing = await ctx.db
      .query("dashboardAnnouncements")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
    if (existing) {
      return { status: "already_exists" as const, id: existing._id };
    }
    const now = Date.now();
    const id = await ctx.db.insert("dashboardAnnouncements", {
      key,
      titleEn: DASHBOARD_BETA_BANNER_EN_DEFAULTS.titleEn,
      introEn: DASHBOARD_BETA_BANNER_EN_DEFAULTS.introEn,
      bodyEn: DASHBOARD_BETA_BANNER_EN_DEFAULTS.bodyEn,
      isActive: true,
      audience: "beta_testers_only",
      createdAt: now,
      updatedAt: now,
      createdBy: admin._id,
      updatedBy: admin._id,
    });
    return { status: "created" as const, id };
  },
});

/**
 * Admin-only: translate dashboard announcement EN → DE (no DB writes).
 * Admin UI uses this to prefill German fields.
 */
// @ts-ignore TS2589 – Convex schema depth limit (51 tables)
export const translateDashboardAnnouncementEnToDe = action({
  args: {
    titleEn: v.string(),
    introEn: v.string(),
    bodyEn: v.string(),
    preferredProvider: v.optional(v.union(v.literal("gemini"), v.literal("openai"))),
  },
  handler: async (ctx, args) => {
    await requireAdminAction(ctx);

    const sourceVars = new Set([
      ...extractVariables(args.titleEn || ""),
      ...extractVariables(args.introEn || ""),
      ...extractVariables(args.bodyEn || ""),
    ]);

    const system = [
      "You are a translation engine.",
      "Translate the provided dashboard banner copy from English to German (de-DE).",
      "Preserve ALL placeholder variables in double curly braces exactly (e.g. {{USER_NAME}}). Do not translate, rename, add, or remove placeholders.",
      "Preserve line breaks, bullet/checkmark symbols, and emoji characters where appropriate.",
      "This is plain text for a UI banner (not HTML). Do not add HTML tags.",
      "Return ONLY valid JSON with keys: titleDe, introDe, bodyDe.",
    ].join("\n");

    const user = [
      "Title (EN):",
      args.titleEn,
      "",
      "Introduction (EN):",
      args.introEn,
      "",
      "Main text (EN):",
      args.bodyEn,
      "",
      `Placeholders that must remain unchanged: ${Array.from(sourceVars).sort().join(", ") || "(none)"}`,
    ].join("\n");

    const ai = await callAiJson(ctx, {
      stage: "specialist",
      preferredProvider: args.preferredProvider ?? "gemini",
      system,
      user,
      maxTokens: 2000,
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(ai.raw);
    } catch {
      throw new Error("AI returned invalid JSON.");
    }

    const p = parsed as Record<string, unknown>;
    const titleDe = typeof p?.titleDe === "string" ? p.titleDe : "";
    const introDe = typeof p?.introDe === "string" ? p.introDe : "";
    const bodyDe = typeof p?.bodyDe === "string" ? p.bodyDe : "";

    if (!titleDe || !introDe || !bodyDe) {
      throw new Error("AI returned empty translation fields.");
    }

    const targetVars = [
      ...extractVariables(titleDe),
      ...extractVariables(introDe),
      ...extractVariables(bodyDe),
    ];
    const { missing, added } = diffVariables({ source: Array.from(sourceVars), target: targetVars });
    const warnings: string[] = [];
    if (missing.length) warnings.push(`Missing placeholders in DE output: ${missing.join(", ")}`);
    if (added.length) warnings.push(`New placeholders in DE output: ${added.join(", ")}`);

    return {
      titleDe,
      introDe,
      bodyDe,
      warnings,
      meta: {
        provider: ai.provider,
        model: ai.model,
        usage: ai.usage,
        estimatedCostUsd: ai.estimatedCostUsd,
      },
    };
  },
});
