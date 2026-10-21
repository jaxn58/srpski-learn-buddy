import { v } from "convex/values";
import {
  mutation,
  query,
  QueryCtx,
  MutationCtx,
  internalMutation,
  internalQuery,
  action,
  ActionCtx,
} from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { callAiJson } from "./contentStudio/_shared";

/** First word of a contact name, with the first letter capitalized. Empty when there is no name. */
export function firstNameFromFullName(name: string | undefined | null): string {
  const first = (name ?? "").trim().split(/\s+/)[0] ?? "";
  if (!first) return "";
  return first.charAt(0).toLocaleUpperCase() + first.slice(1);
}

/**
 * CURRENT_YEAR is always present. FIRST_NAME is derived from USER_NAME when the caller omitted it.
 * An explicit empty FIRST_NAME stays empty so the greeting can collapse to "Hi," / "Hallo,".
 */
export function withStandardEmailVariables(
  vars: Record<string, string | number | undefined>,
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(vars)) {
    if (value !== undefined) next[key] = String(value);
  }
  if (!next.CURRENT_YEAR) {
    next.CURRENT_YEAR = String(new Date().getFullYear());
  }
  if (next.FIRST_NAME === undefined) {
    next.FIRST_NAME = firstNameFromFullName(next.USER_NAME);
  }
  return next;
}

/** Replace {{VARIABLE}} placeholders. An empty FIRST_NAME drops the preceding space so "Hi {{FIRST_NAME}}," becomes "Hi,". */
export function applyTemplateVariables(
  html: string,
  subject: string,
  vars: Record<string, string>,
): { html: string; subject: string } {
  let nextHtml = html;
  let nextSubject = subject;
  if (!vars.FIRST_NAME) {
    nextHtml = nextHtml.replace(/ \{\{FIRST_NAME\}\}/g, "");
    nextSubject = nextSubject.replace(/ \{\{FIRST_NAME\}\}/g, "");
  }
  for (const [key, value] of Object.entries(vars)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    nextHtml = nextHtml.replace(regex, value);
    nextSubject = nextSubject.replace(regex, value);
  }
  return { html: nextHtml, subject: nextSubject };
}

// Helper to get the current user and verify admin
type AnyCtx = QueryCtx | MutationCtx | ActionCtx;
type CtxWithDb = QueryCtx | MutationCtx;

function hasDb(ctx: AnyCtx): ctx is CtxWithDb {
  return "db" in ctx;
}

async function getAdminUser(ctx: AnyCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  const user = hasDb(ctx)
    ? await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
        .first()
    : await ctx.runQuery(internal.users.internalGetUserByClerkId, {
        clerkId: identity.subject,
      });

  if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
    return null;
  }

  return user;
}

// Helper to get superadmin user
async function getSuperadminUser(ctx: AnyCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  const user = hasDb(ctx)
    ? await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
        .first()
    : await ctx.runQuery(internal.users.internalGetUserByClerkId, {
        clerkId: identity.subject,
      });

  if (!user || user.role !== "superadmin") {
    return null;
  }

  return user;
}

// Get all email templates (admin only)
export const getAll = query({
  handler: async (ctx) => {
    const admin = await getAdminUser(ctx);
    if (!admin) throw new Error("Unauthorized");

    return await ctx.db.query("emailTemplates").collect();
  },
});

// Get single template by name
export const getByName = query({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);
    if (!admin) throw new Error("Unauthorized");

    return await ctx.db
      .query("emailTemplates")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
  },
});

/** Used by scheduled newsletter sends (no user auth in internalAction). */
export const internalGetByName = internalQuery({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("emailTemplates")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
  },
});

// Get template by ID
export const getById = query({
  args: { id: v.id("emailTemplates") },
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);
    if (!admin) throw new Error("Unauthorized");

    return await ctx.db.get(args.id);
  },
});

// Create or update template (superadmin only)
export const upsert = mutation({
  args: {
    name: v.string(),
    subject: v.string(),
    subjectEn: v.optional(v.string()),
    subjectDe: v.optional(v.string()),
    htmlContent: v.string(),
    htmlContentEn: v.optional(v.string()),
    htmlContentDe: v.optional(v.string()),
    description: v.optional(v.string()),
    descriptionEn: v.optional(v.string()),
    descriptionDe: v.optional(v.string()),
    variables: v.array(v.string()),
    category: v.union(
      v.literal("transactional"),
      v.literal("subscription"),
      v.literal("marketing")
    ),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const superadmin = await getSuperadminUser(ctx);
    if (!superadmin) throw new Error("Superadmin access required");

    // Keep legacy fields as EN fallback for backward compatibility.
    const subjectEn = args.subjectEn ?? args.subject;
    const htmlContentEn = args.htmlContentEn ?? args.htmlContent;
    const descriptionEn = args.descriptionEn ?? args.description;

    const existing = await ctx.db
      .query("emailTemplates")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();

    const now = Date.now();

    if (existing) {
      // Detect EN content changes to bump enContentUpdatedAt.
      const prevHtmlContentEn = existing.htmlContentEn ?? existing.htmlContent;
      const prevSubjectEn = existing.subjectEn ?? existing.subject;
      const enChanged = htmlContentEn !== prevHtmlContentEn || subjectEn !== prevSubjectEn;

      // Detect DE content changes to bump deContentUpdatedAt.
      const deChanged =
        args.htmlContentDe !== existing.htmlContentDe ||
        args.subjectDe !== existing.subjectDe;
      const deProvided = !!(args.htmlContentDe || args.subjectDe);

      await ctx.db.patch(existing._id, {
        subject: subjectEn,
        subjectEn,
        subjectDe: args.subjectDe,
        htmlContent: htmlContentEn,
        htmlContentEn,
        htmlContentDe: args.htmlContentDe,
        description: descriptionEn,
        descriptionEn,
        descriptionDe: args.descriptionDe,
        variables: args.variables,
        category: args.category,
        isActive: args.isActive,
        ...(enChanged ? { enContentUpdatedAt: now } : {}),
        ...(deChanged && deProvided ? { deContentUpdatedAt: now } : {}),
        updatedAt: now,
      });
      return existing._id;
    } else {
      // Create – always stamp EN; stamp DE only if DE content is provided.
      return await ctx.db.insert("emailTemplates", {
        name: args.name,
        subject: subjectEn,
        subjectEn,
        subjectDe: args.subjectDe,
        htmlContent: htmlContentEn,
        htmlContentEn,
        htmlContentDe: args.htmlContentDe,
        description: descriptionEn,
        descriptionEn,
        descriptionDe: args.descriptionDe,
        variables: args.variables,
        category: args.category,
        isActive: args.isActive,
        enContentUpdatedAt: now,
        ...(args.htmlContentDe || args.subjectDe ? { deContentUpdatedAt: now } : {}),
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

// Internal mutation for initial setup (called from actions)
// This bypasses auth checks for migration scripts
export const internalUpsert = internalMutation({
  args: {
    name: v.string(),
    subject: v.string(),
    subjectEn: v.optional(v.string()),
    subjectDe: v.optional(v.string()),
    htmlContent: v.string(),
    htmlContentEn: v.optional(v.string()),
    htmlContentDe: v.optional(v.string()),
    description: v.optional(v.string()),
    descriptionEn: v.optional(v.string()),
    descriptionDe: v.optional(v.string()),
    variables: v.array(v.string()),
    category: v.union(
      v.literal("transactional"),
      v.literal("subscription"),
      v.literal("marketing")
    ),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const subjectEn = args.subjectEn ?? args.subject;
    const htmlContentEn = args.htmlContentEn ?? args.htmlContent;
    const descriptionEn = args.descriptionEn ?? args.description;

    const existing = await ctx.db
      .query("emailTemplates")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();

    const now = Date.now();

    if (existing) {
      // Detect EN content changes to bump enContentUpdatedAt.
      const prevHtmlContentEn = existing.htmlContentEn ?? existing.htmlContent;
      const prevSubjectEn = existing.subjectEn ?? existing.subject;
      const enChanged = htmlContentEn !== prevHtmlContentEn || subjectEn !== prevSubjectEn;

      // Detect DE content changes to bump deContentUpdatedAt.
      const deChanged =
        args.htmlContentDe !== existing.htmlContentDe ||
        args.subjectDe !== existing.subjectDe;
      const deProvided = !!(args.htmlContentDe || args.subjectDe);

      await ctx.db.patch(existing._id, {
        subject: subjectEn,
        subjectEn,
        subjectDe: args.subjectDe,
        htmlContent: htmlContentEn,
        htmlContentEn,
        htmlContentDe: args.htmlContentDe,
        description: descriptionEn,
        descriptionEn,
        descriptionDe: args.descriptionDe,
        variables: args.variables,
        category: args.category,
        isActive: args.isActive,
        ...(enChanged ? { enContentUpdatedAt: now } : {}),
        ...(deChanged && deProvided ? { deContentUpdatedAt: now } : {}),
        updatedAt: now,
      });
      return existing._id;
    } else {
      // Create – always stamp EN; stamp DE only if DE content is provided.
      return await ctx.db.insert("emailTemplates", {
        name: args.name,
        subject: subjectEn,
        subjectEn,
        subjectDe: args.subjectDe,
        htmlContent: htmlContentEn,
        htmlContentEn,
        htmlContentDe: args.htmlContentDe,
        description: descriptionEn,
        descriptionEn,
        descriptionDe: args.descriptionDe,
        variables: args.variables,
        category: args.category,
        isActive: args.isActive,
        enContentUpdatedAt: now,
        ...(args.htmlContentDe || args.subjectDe ? { deContentUpdatedAt: now } : {}),
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

// Setup action for migration scripts (can be called without auth)
// This allows scripts to seed initial templates
export const setupTemplate = action({
  args: {
    name: v.string(),
    subject: v.string(),
    subjectEn: v.optional(v.string()),
    subjectDe: v.optional(v.string()),
    htmlContent: v.string(),
    htmlContentEn: v.optional(v.string()),
    htmlContentDe: v.optional(v.string()),
    description: v.optional(v.string()),
    descriptionEn: v.optional(v.string()),
    descriptionDe: v.optional(v.string()),
    variables: v.array(v.string()),
    category: v.union(
      v.literal("transactional"),
      v.literal("subscription"),
      v.literal("marketing")
    ),
    isActive: v.boolean(),
  },
  handler: async (ctx, args): Promise<{ id: Id<"emailTemplates"> }> => {
    const superadmin = await getSuperadminUser(ctx);
    if (!superadmin) {
      throw new Error("Superadmin access required");
    }

    const id = await ctx.runMutation(internal.emailTemplates.internalUpsert, args);
    return { id };
  },
});

// Delete template (superadmin only)
export const remove = mutation({
  args: { id: v.id("emailTemplates") },
  handler: async (ctx, args) => {
    const superadmin = await getSuperadminUser(ctx);
    if (!superadmin) throw new Error("Superadmin access required");

    await ctx.db.delete(args.id);
    return { success: true };
  },
});

const DEPRECATED_USER_ACTIVATION_TEMPLATE = "user-activation";

/**
 * Removes the legacy `user-activation` template (never used by Convex email flow).
 * Run once per deployment (per Convex backend): `npx convex run emailTemplates:cleanupDeprecatedUserActivationTemplate`
 */
export const cleanupDeprecatedUserActivationTemplate = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("emailTemplates")
      .withIndex("by_name", (q) => q.eq("name", DEPRECATED_USER_ACTIVATION_TEMPLATE))
      .collect();
    let deleted = 0;
    for (const row of rows) {
      await ctx.db.delete(row._id);
      deleted += 1;
    }
    return { deleted };
  },
});

// Render template with variables (for preview or sending)
export const render = query({
  args: {
    templateName: v.string(),
    variables: v.optional(v.record(v.string(), v.union(v.string(), v.number()))),
    language: v.optional(v.union(v.literal("en"), v.literal("de"))),
  },
  handler: async (ctx, args) => {
    const template = await ctx.db
      .query("emailTemplates")
      .withIndex("by_name", (q) => q.eq("name", args.templateName))
      .first();

    if (!template) {
      throw new Error(`Template "${args.templateName}" not found`);
    }

    if (!template.isActive) {
      throw new Error(`Template "${args.templateName}" is not active`);
    }

    const vars = args.variables || {};

    // Inject signature via placeholder (per category) before variable replacement,
    // so signature HTML can also use template variables like {{USER_EMAIL}}.
    const lang = args.language === "de" ? "de" : "en";

    const pickLocalized = (params: { legacy: string; en?: string; de?: string }) => {
      if (lang === "de") return params.de || params.en || params.legacy;
      return params.en || params.legacy;
    };

    let renderedHtml = pickLocalized({
      legacy: template.htmlContent,
      en: template.htmlContentEn,
      de: template.htmlContentDe,
    });
    if (renderedHtml.includes("{{EMAIL_SIGNATURE}}")) {
      const signature = await ctx.db
        .query("emailSignatures")
        .withIndex("by_category", (q) => q.eq("category", template.category))
        .first();
      const signatureHtml =
        signature && signature.isActive
          ? pickLocalized({
              legacy: signature.htmlContent || "",
              en: signature.htmlContentEn,
              de: signature.htmlContentDe,
            })
          : "";
      renderedHtml = renderedHtml.replace(/\{\{EMAIL_SIGNATURE\}\}/g, signatureHtml);
    }

    let renderedSubject = pickLocalized({
      legacy: template.subject,
      en: template.subjectEn,
      de: template.subjectDe,
    });

    const personalized = applyTemplateVariables(
      renderedHtml,
      renderedSubject,
      withStandardEmailVariables(vars),
    );

    return {
      subject: personalized.subject,
      html: personalized.html,
    };
  },
});

// ============= SIGNATURE MANAGEMENT (per category) =============

export const getAllSignatures = query({
  handler: async (ctx) => {
    const admin = await getAdminUser(ctx);
    if (!admin) throw new Error("Unauthorized");
    return await ctx.db.query("emailSignatures").collect();
  },
});

export const getSignatureByCategory = query({
  args: {
    category: v.union(v.literal("transactional"), v.literal("subscription"), v.literal("marketing")),
  },
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);
    if (!admin) throw new Error("Unauthorized");
    return await ctx.db
      .query("emailSignatures")
      .withIndex("by_category", (q) => q.eq("category", args.category))
      .first();
  },
});

export const upsertSignature = mutation({
  args: {
    category: v.union(v.literal("transactional"), v.literal("subscription"), v.literal("marketing")),
    htmlContent: v.string(),
    htmlContentEn: v.optional(v.string()),
    htmlContentDe: v.optional(v.string()),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const superadmin = await getSuperadminUser(ctx);
    if (!superadmin) throw new Error("Superadmin access required");

    const htmlContentEn = args.htmlContentEn ?? args.htmlContent;

    const existing = await ctx.db
      .query("emailSignatures")
      .withIndex("by_category", (q) => q.eq("category", args.category))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        htmlContent: htmlContentEn,
        htmlContentEn,
        htmlContentDe: args.htmlContentDe,
        isActive: args.isActive,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("emailSignatures", {
      category: args.category,
      htmlContent: htmlContentEn,
      htmlContentEn,
      htmlContentDe: args.htmlContentDe,
      isActive: args.isActive,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const removeSignature = mutation({
  args: {
    category: v.union(v.literal("transactional"), v.literal("subscription"), v.literal("marketing")),
  },
  handler: async (ctx, args) => {
    const superadmin = await getSuperadminUser(ctx);
    if (!superadmin) throw new Error("Superadmin access required");

    const existing = await ctx.db
      .query("emailSignatures")
      .withIndex("by_category", (q) => q.eq("category", args.category))
      .first();

    if (!existing) return { success: true, deleted: false };
    await ctx.db.delete(existing._id);
    return { success: true, deleted: true };
  },
});

// Extract variables from template content
function extractVariables(content: string): string[] {
  const variableRegex = /\{\{(\w+)\}\}/g;
  const foundVariables = new Set<string>();
  let match;
  while ((match = variableRegex.exec(content)) !== null) {
    foundVariables.add(match[1]);
  }
  return Array.from(foundVariables);
}

// Auto-detect variables from template (helper for admin UI)
export const detectVariables = query({
  args: {
    subject: v.string(),
    htmlContent: v.string(),
  },
  handler: async (ctx, args) => {
    const subjectVars = extractVariables(args.subject);
    const htmlVars = extractVariables(args.htmlContent);
    const allVars = new Set([...subjectVars, ...htmlVars]);
    return Array.from(allVars);
  },
});

function diffVariables(params: { source: string[]; target: string[] }) {
  const s = new Set(params.source);
  const t = new Set(params.target);
  const missing = Array.from(s).filter((vName) => !t.has(vName));
  const added = Array.from(t).filter((vName) => !s.has(vName));
  return { missing, added };
}

// Map short language codes to full names for prompt
const languageNames: Record<string, string> = {
  de: "German (de-DE)",
  es: "Spanish (es-ES)",
  fr: "French (fr-FR)",
};

export const translateTemplate = action({
  args: {
    subjectEn: v.string(),
    htmlContentEn: v.string(),
    descriptionEn: v.optional(v.string()),
    variables: v.optional(v.array(v.string())),
    targetLanguage: v.literal("de"), // Can be expanded to v.union(v.literal("de"), v.literal("es"), v.literal("fr")) later
    preferredProvider: v.optional(v.union(v.literal("gemini"), v.literal("openai"))),
  },
  handler: async (ctx, args) => {
    const superadmin = await getSuperadminUser(ctx);
    if (!superadmin) throw new Error("Superadmin access required");

    const sourceVars = new Set([
      ...extractVariables(args.subjectEn || ""),
      ...extractVariables(args.htmlContentEn || ""),
    ]);
    for (const vName of args.variables || []) sourceVars.add(vName);

    const langName = languageNames[args.targetLanguage] || args.targetLanguage;

    const system = [
      "You are a translation engine.",
      `Translate the provided email template from English to ${langName}.`,
      "Preserve ALL placeholder variables in double curly braces exactly (e.g. {{USER_NAME}}, {{EMAIL_SIGNATURE}}). Do not translate, rename, add, or remove placeholders.",
      "Preserve HTML tags, inline CSS, and formatting as much as possible.",
      "Return ONLY valid JSON with keys: subjectTranslation, htmlContentTranslation, descriptionTranslation.",
    ].join("\n");

    const user = [
      "Subject (EN):",
      args.subjectEn,
      "",
      "HTML (EN):",
      args.htmlContentEn,
      "",
      "Description (EN):",
      args.descriptionEn ?? "",
      "",
      `Placeholders that must remain unchanged: ${Array.from(sourceVars).sort().join(", ") || "(none)"}`,
    ].join("\n");

    const ai = await callAiJson(ctx, {
      stage: "specialist",
      preferredProvider: args.preferredProvider ?? "gemini",
      system,
      user,
      maxTokens: 3000,
    });

    let parsed: any;
    try {
      parsed = JSON.parse(ai.raw);
    } catch {
      throw new Error("AI returned invalid JSON.");
    }

    const subjectTranslation = typeof parsed?.subjectTranslation === "string" ? parsed.subjectTranslation : "";
    const htmlContentTranslation = typeof parsed?.htmlContentTranslation === "string" ? parsed.htmlContentTranslation : "";
    const descriptionTranslation = typeof parsed?.descriptionTranslation === "string" ? parsed.descriptionTranslation : "";

    if (!subjectTranslation || !htmlContentTranslation) {
      throw new Error("AI returned empty translation fields.");
    }

    const targetVars = [
      ...extractVariables(subjectTranslation),
      ...extractVariables(htmlContentTranslation),
    ];
    const { missing, added } = diffVariables({ source: Array.from(sourceVars), target: targetVars });
    const warnings: string[] = [];
    if (missing.length) warnings.push(`Missing placeholders in ${args.targetLanguage.toUpperCase()} output: ${missing.join(", ")}`);
    if (added.length) warnings.push(`New placeholders in ${args.targetLanguage.toUpperCase()} output: ${added.join(", ")}`);

    return {
      subjectTranslation,
      htmlContentTranslation,
      descriptionTranslation: descriptionTranslation || undefined,
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

export const translateSignature = action({
  args: {
    htmlContentEn: v.string(),
    targetLanguage: v.literal("de"), // Can be expanded to v.union(v.literal("de"), v.literal("es"), v.literal("fr")) later
    preferredProvider: v.optional(v.union(v.literal("gemini"), v.literal("openai"))),
  },
  handler: async (ctx, args) => {
    const superadmin = await getSuperadminUser(ctx);
    if (!superadmin) throw new Error("Superadmin access required");

    const sourceVars = extractVariables(args.htmlContentEn || "");

    const langName = languageNames[args.targetLanguage] || args.targetLanguage;

    const system = [
      "You are a translation engine.",
      `Translate the provided email signature HTML from English to ${langName}.`,
      "Preserve ALL placeholder variables in double curly braces exactly (e.g. {{USER_EMAIL}}). Do not translate, rename, add, or remove placeholders.",
      "Preserve HTML tags, inline CSS, and formatting as much as possible.",
      "Return ONLY valid JSON with key: htmlContentTranslation.",
    ].join("\n");

    const user = [
      "Signature HTML (EN):",
      args.htmlContentEn,
      "",
      `Placeholders that must remain unchanged: ${sourceVars.sort().join(", ") || "(none)"}`,
    ].join("\n");

    const ai = await callAiJson(ctx, {
      stage: "specialist",
      preferredProvider: args.preferredProvider ?? "gemini",
      system,
      user,
      maxTokens: 1500,
    });

    let parsed: any;
    try {
      parsed = JSON.parse(ai.raw);
    } catch {
      throw new Error("AI returned invalid JSON.");
    }

    const htmlContentTranslation = typeof parsed?.htmlContentTranslation === "string" ? parsed.htmlContentTranslation : "";
    if (!htmlContentTranslation) throw new Error("AI returned empty signature translation.");

    const targetVars = extractVariables(htmlContentTranslation);
    const { missing, added } = diffVariables({ source: sourceVars, target: targetVars });
    const warnings: string[] = [];
    if (missing.length) warnings.push(`Missing placeholders in ${args.targetLanguage.toUpperCase()} output: ${missing.join(", ")}`);
    if (added.length) warnings.push(`New placeholders in ${args.targetLanguage.toUpperCase()} output: ${added.join(", ")}`);

    return {
      htmlContentTranslation,
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

// Internal mutation used by translateAndSaveTemplate to persist DE content
// and bump the deContentUpdatedAt staleness timestamp.
export const internalSaveDeTranslation = internalMutation({
  args: {
    id: v.id("emailTemplates"),
    subjectDe: v.string(),
    htmlContentDe: v.string(),
    descriptionDe: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.id, {
      subjectDe: args.subjectDe,
      htmlContentDe: args.htmlContentDe,
      ...(args.descriptionDe !== undefined ? { descriptionDe: args.descriptionDe } : {}),
      deContentUpdatedAt: now,
      updatedAt: now,
    });
  },
});

type TranslateTemplateResult = {
  subjectTranslation: string;
  htmlContentTranslation: string;
  descriptionTranslation?: string;
  warnings: string[];
  meta: {
    provider: string;
    model: string;
    usage: {
      inputTokens?: number;
      outputTokens?: number;
      totalTokens?: number;
      thinkingTokens?: number;
    } | null;
    estimatedCostUsd: number | null;
  };
};

type EmailTemplateFields = {
  subject: string;
  subjectEn?: string;
  htmlContent: string;
  htmlContentEn?: string;
  description?: string;
  descriptionEn?: string;
  variables: string[];
};

// Translate EN content of an existing template and save DE directly.
// Designed for one-click "Update DE translation" from the admin overview.
export const translateAndSaveTemplate = action({
  args: {
    id: v.id("emailTemplates"),
    targetLanguage: v.literal("de"),
    preferredProvider: v.optional(v.union(v.literal("gemini"), v.literal("openai"))),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ warnings: string[]; meta: TranslateTemplateResult["meta"] }> => {
    const superadmin = await getSuperadminUser(ctx);
    if (!superadmin) throw new Error("Superadmin access required");

    // Explicit type avoids circular inference (TS7022) without pulling in Doc<>
    // (Doc<> triggers TS2589 on the large Convex DataModel).
    const template = (await ctx.runQuery(api.emailTemplates.getById, {
      id: args.id,
    })) as EmailTemplateFields | null;
    if (!template) throw new Error("Template not found");

    const subjectEn: string = template.subjectEn ?? template.subject;
    const htmlContentEn: string = template.htmlContentEn ?? template.htmlContent;
    const descriptionEn: string | undefined =
      template.descriptionEn ?? template.description;

    if (!subjectEn || !htmlContentEn) {
      throw new Error("Template has no English content to translate.");
    }

    const res = (await ctx.runAction(api.emailTemplates.translateTemplate, {
      subjectEn,
      htmlContentEn,
      descriptionEn: descriptionEn || undefined,
      variables: template.variables,
      targetLanguage: args.targetLanguage,
      preferredProvider: args.preferredProvider ?? "gemini",
    })) as TranslateTemplateResult;

    await ctx.runMutation(internal.emailTemplates.internalSaveDeTranslation, {
      id: args.id,
      subjectDe: res.subjectTranslation,
      htmlContentDe: res.htmlContentTranslation,
      descriptionDe: res.descriptionTranslation || undefined,
    });

    return {
      warnings: res.warnings,
      meta: res.meta,
    };
  },
});

export const autoTranslateMissingGerman = action({
  handler: async (ctx) => {
    const superadmin = await getSuperadminUser(ctx);
    if (!superadmin) throw new Error("Superadmin access required");

    // Fetch all templates
    const templates = await ctx.runQuery(api.emailTemplates.getAll);
    const signatures = await ctx.runQuery(api.emailTemplates.getAllSignatures);

    const log: string[] = [];
    let successCount = 0;
    let errorCount = 0;

    // Process Templates
    for (const t of templates) {
      const subjectEn = t.subjectEn || t.subject;
      const htmlContentEn = t.htmlContentEn || t.htmlContent;
      const descriptionEn = t.descriptionEn || t.description;

      if (!htmlContentEn || !subjectEn) continue;
      // if already translated, skip
      if (t.htmlContentDe && t.subjectDe) continue;

      log.push(`Translating template: ${t.name}...`);
      try {
        const res = await ctx.runAction(api.emailTemplates.translateTemplate, {
          subjectEn,
          htmlContentEn,
          descriptionEn,
          variables: t.variables,
          targetLanguage: "de"
        });

        await ctx.runMutation(internal.emailTemplates.internalUpsert, {
          name: t.name,
          subject: t.subject,
          subjectEn: subjectEn,
          subjectDe: res.subjectTranslation,
          htmlContent: t.htmlContent,
          htmlContentEn: htmlContentEn,
          htmlContentDe: res.htmlContentTranslation,
          description: t.description,
          descriptionEn: descriptionEn,
          descriptionDe: res.descriptionTranslation,
          variables: t.variables || [],
          category: t.category,
          isActive: t.isActive,
        });

        successCount++;
        if (res.warnings?.length) {
          log.push(`  Warnings for ${t.name}: ${res.warnings.join(", ")}`);
        }
      } catch (error: any) {
        log.push(`  Error for template ${t.name}: ${error.message}`);
        errorCount++;
      }
    }

    // Process Signatures
    for (const s of signatures) {
      const htmlEn = s.htmlContentEn || s.htmlContent;
      if (!htmlEn) continue;
      // if already translated, skip
      if (s.htmlContentDe) continue;

      log.push(`Translating signature category: ${s.category}...`);
      try {
        const res = await ctx.runAction(api.emailTemplates.translateSignature, {
          htmlContentEn: htmlEn,
          targetLanguage: "de"
        });

        // Use standard upsert since we already have rights
        await ctx.runMutation(api.emailTemplates.upsertSignature, {
          category: s.category,
          htmlContent: s.htmlContent,
          htmlContentEn: htmlEn,
          htmlContentDe: res.htmlContentTranslation,
          isActive: s.isActive,
        });

        successCount++;
        if (res.warnings?.length) {
          log.push(`  Warnings for signature ${s.category}: ${res.warnings.join(", ")}`);
        }
      } catch (error: any) {
        log.push(`  Error for signature ${s.category}: ${error.message}`);
        errorCount++;
      }
    }

    return {
      success: true,
      translatedCount: successCount,
      errorCount,
      log,
    };
  }
});

const MAIL_COMPANY_LINE = "JACKSENN DESIGN DOO, Čeluga bb, Bar, Montenegro";
const UNSENT_CAMPAIGN_STATUSES = new Set(["draft", "review", "ready", "scheduled"]);

/**
 * Footer and salutation copy used by newsletter and system mail.
 * Idempotent: a second run leaves documents unchanged.
 * Salutations only. A {{USER_NAME}} used as a labeled field stays as it is.
 */
export function applyMailFooterCopy(html: string, locale: "en" | "de"): string {
  let next = html;
  if (locale === "en") {
    next = next.replace(/Dear\s+\{\{USER_NAME\}\}\s*[,!]?/g, "Hi {{FIRST_NAME}},");
    next = next.replace(/Hi\s+\{\{USER_NAME\}\}\s*,/g, "Hi {{FIRST_NAME}},");
  } else {
    next = next.replace(/Hallo\s+\{\{USER_NAME\}\}\s*,/g, "Hallo {{FIRST_NAME}},");
  }
  next = next.replace(/©\s*2025/g, "©{{CURRENT_YEAR}}");
  next = next.replace(/&copy;\s*2025/g, "©{{CURRENT_YEAR}}");
  next = next.replace(/\{\{UNSUBSCRIBE_LINK\}\}/g, (match, offset: number, source: string) => {
    const before = source.slice(Math.max(0, offset - 40), offset);
    if (/href\s*=\s*["']\s*$/i.test(before)) return match;
    return "";
  });
  if (next.includes("©{{CURRENT_YEAR}}") && !next.includes(MAIL_COMPANY_LINE)) {
    next = next.replace(
      "©{{CURRENT_YEAR}}",
      `${MAIL_COMPANY_LINE}<br>\n©{{CURRENT_YEAR}}`,
    );
  }
  return next;
}

function extendTemplateVariables(variables: string[], texts: string[]): string[] {
  const blob = texts.join("\n");
  const next = [...variables];
  if (blob.includes("{{FIRST_NAME}}") && !next.includes("FIRST_NAME")) next.push("FIRST_NAME");
  if (blob.includes("{{CURRENT_YEAR}}") && !next.includes("CURRENT_YEAR")) next.push("CURRENT_YEAR");
  return next;
}

/**
 * Dev copy update for signatures, every email template footer/salutation, and campaigns
 * that have not been sent. Does not touch sent or in-flight campaigns.
 */
export const applyNewsletterAndSystemMailCopy = internalMutation({
  args: { dryRun: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun === true;
    const now = Date.now();
    const changed: { kind: string; name: string }[] = [];

    const signatures = await ctx.db.query("emailSignatures").collect();
    for (const signature of signatures) {
      const htmlContent = applyMailFooterCopy(signature.htmlContent, "en");
      const htmlContentEn = signature.htmlContentEn
        ? applyMailFooterCopy(signature.htmlContentEn, "en")
        : undefined;
      const htmlContentDe = signature.htmlContentDe
        ? applyMailFooterCopy(signature.htmlContentDe, "de")
        : undefined;
      const signatureChanged =
        htmlContent !== signature.htmlContent ||
        (htmlContentEn !== undefined && htmlContentEn !== signature.htmlContentEn) ||
        (htmlContentDe !== undefined && htmlContentDe !== signature.htmlContentDe);
      if (!signatureChanged) continue;
      changed.push({ kind: "signature", name: signature.category });
      if (!dryRun) {
        await ctx.db.patch(signature._id, {
          htmlContent,
          ...(htmlContentEn !== undefined ? { htmlContentEn } : {}),
          ...(htmlContentDe !== undefined ? { htmlContentDe } : {}),
          updatedAt: now,
        });
      }
    }

    const templates = await ctx.db.query("emailTemplates").collect();
    for (const template of templates) {
      const htmlContent = applyMailFooterCopy(template.htmlContent, "en");
      const htmlContentEn = template.htmlContentEn
        ? applyMailFooterCopy(template.htmlContentEn, "en")
        : undefined;
      const htmlContentDe = template.htmlContentDe
        ? applyMailFooterCopy(template.htmlContentDe, "de")
        : undefined;
      const variables = extendTemplateVariables(template.variables, [
        htmlContent,
        htmlContentEn ?? "",
        htmlContentDe ?? "",
      ]);
      const templateChanged =
        htmlContent !== template.htmlContent ||
        (htmlContentEn !== undefined && htmlContentEn !== template.htmlContentEn) ||
        (htmlContentDe !== undefined && htmlContentDe !== template.htmlContentDe) ||
        variables.join("|") !== template.variables.join("|");
      if (!templateChanged) continue;
      changed.push({ kind: "template", name: template.name });
      if (!dryRun) {
        await ctx.db.patch(template._id, {
          htmlContent,
          ...(htmlContentEn !== undefined ? { htmlContentEn } : {}),
          ...(htmlContentDe !== undefined ? { htmlContentDe } : {}),
          variables,
          updatedAt: now,
        });
      }
    }

    const campaigns = await ctx.db.query("newsletterCampaigns").collect();
    for (const campaign of campaigns) {
      if (!UNSENT_CAMPAIGN_STATUSES.has(campaign.status)) continue;
      const htmlBodySnapshot = campaign.htmlBodySnapshot
        ? applyMailFooterCopy(campaign.htmlBodySnapshot, "en")
        : undefined;
      const htmlBodySnapshotEn = campaign.htmlBodySnapshotEn
        ? applyMailFooterCopy(campaign.htmlBodySnapshotEn, "en")
        : undefined;
      const htmlBodySnapshotDe = campaign.htmlBodySnapshotDe
        ? applyMailFooterCopy(campaign.htmlBodySnapshotDe, "de")
        : undefined;
      const campaignChanged =
        (htmlBodySnapshot !== undefined && htmlBodySnapshot !== campaign.htmlBodySnapshot) ||
        (htmlBodySnapshotEn !== undefined && htmlBodySnapshotEn !== campaign.htmlBodySnapshotEn) ||
        (htmlBodySnapshotDe !== undefined && htmlBodySnapshotDe !== campaign.htmlBodySnapshotDe);
      if (!campaignChanged) continue;
      changed.push({ kind: "campaign", name: campaign.name });
      if (!dryRun) {
        await ctx.db.patch(campaign._id, {
          ...(htmlBodySnapshot !== undefined ? { htmlBodySnapshot } : {}),
          ...(htmlBodySnapshotEn !== undefined ? { htmlBodySnapshotEn } : {}),
          ...(htmlBodySnapshotDe !== undefined ? { htmlBodySnapshotDe } : {}),
        });
      }
    }

    return { dryRun, changed };
  },
});
