// @ts-nocheck
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query, internalMutation, action, MutationCtx, ActionCtx } from "./_generated/server";
import { requireSuperadminAction, callAiJson } from "./contentStudio/_shared";

// ============= MODULE METADATA =============

function normalizeSlug(input: string): string {
  // Keep this conservative: stable, URL-friendly, ASCII-only.
  // (The UI can prefill a slug, but the backend is the source of truth.)
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function requireSuperadmin(ctx: MutationCtx): Promise<Id<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthorized");

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();

  if (!user || user.role !== "superadmin") {
    throw new Error("Unauthorized - Superadmin required");
  }

  return user._id;
}

async function createConsolidatedModule(
  ctx: MutationCtx,
  args: {
    moduleNumber: number;
    slug: string;
    titleDe: string;
    titleEn: string;
    descriptionDe: string;
    descriptionEn: string;
  }
) {
  await requireSuperadmin(ctx);

  const moduleNumber = Number(args.moduleNumber);
  if (!Number.isFinite(moduleNumber) || moduleNumber < 1) {
    throw new Error("INVALID_MODULE_NUMBER");
  }

  const slug = normalizeSlug(args.slug);
  if (!slug) {
    throw new Error("INVALID_SLUG");
  }

  const titleEn = args.titleEn.trim();
  const titleDe = args.titleDe.trim();
  const descriptionEn = args.descriptionEn.trim();
  const descriptionDe = args.descriptionDe.trim();

  if (!titleEn || !titleDe || !descriptionEn || !descriptionDe) {
    throw new Error("MISSING_REQUIRED_FIELDS");
  }

  const existingBySlug = await ctx.db
    .query("moduleMetadata")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .first();
  if (existingBySlug) {
    throw new Error("MODULE_SLUG_TAKEN");
  }

  const existingByNumber = await ctx.db
    .query("moduleMetadata")
    .filter((q) => q.eq(q.field("moduleNumber"), moduleNumber))
    .first();
  if (existingByNumber) {
    throw new Error("MODULE_NUMBER_TAKEN");
  }

  return await ctx.db.insert("moduleMetadata", {
    titleDe,
    titleEn,
    descriptionDe,
    descriptionEn,
    slug,
    moduleNumber,
  });
}

// Insert module metadata (migration tooling only).
// SECURITY: was a public mutation allowing anyone to write module metadata.
// Now internal -- run via `npx convex run`.
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const insertModuleMetadata = internalMutation({
  args: {
    moduleId: v.string(),
    language: v.string(),
    title: v.string(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("moduleMetadata")
      // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
      .withIndex("by_module_lang", (q) =>
        q.eq("moduleId", args.moduleId).eq("language", args.language)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        title: args.title,
        description: args.description,
      });
      return existing._id;
    }

    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    return await ctx.db.insert("moduleMetadata", {
      moduleId: args.moduleId,
      language: args.language,
      title: args.title,
      description: args.description,
    });
  },
});

// Get module metadata
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const getModuleMetadata = query({
  args: {
    moduleId: v.string(),
    language: v.optional(v.string()), // Default: "en"
  },
  handler: async (ctx, args) => {
    const language = args.language || "en";
    
    const metadata = await ctx.db
      .query("moduleMetadata")
      // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
      .withIndex("by_module_lang", (q) =>
        q.eq("moduleId", args.moduleId).eq("language", language)
      )
      .first();

    // Fallback
    if (!metadata && language !== "en") {
      return await ctx.db
        .query("moduleMetadata")
        // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
        .withIndex("by_module_lang", (q) =>
          q.eq("moduleId", args.moduleId).eq("language", "en")
        )
        .first();
    }

    return metadata;
  },
});

// Get all modules metadata
// DEPRECATED: Use getAllModulesConsolidated instead
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const getAllModules = query({
  args: {
    language: v.optional(v.string()), // Default: "en"
  },
  handler: async (ctx, args) => {
    const language = args.language || "en";
    
    // Fetch all
    const allMetadata = await ctx.db
      .query("moduleMetadata")
      .filter((q) => q.eq(q.field("language"), language))
      .collect();
      
    // If empty and not English, try fallback
    if (allMetadata.length === 0 && language !== "en") {
      return await ctx.db
        .query("moduleMetadata")
        // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
        .filter((q) => q.eq(q.field("language"), "en"))
        .collect();
    }

    // We can't sort here easily without module number in DB
    // For now, client will sort based on static config or we add moduleNumber to DB
    return allMetadata;
  },
});

// ============= NEW CONSOLIDATED MODULE STRUCTURE =============

// Create consolidated module metadata (one row per module with multilingual columns)
// Superadmin-only: used by admin UI (and can also be used by migration scripts if executed as superadmin).
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const createModule = mutation({
  args: {
    moduleNumber: v.number(),
    slug: v.string(),
    titleDe: v.string(),
    titleEn: v.string(),
    descriptionDe: v.string(),
    descriptionEn: v.string(),
  },
  handler: async (ctx, args) => {
    // @ts-ignore TS2345 TS2589 – Convex schema depth limit (50 tables)
    return await createConsolidatedModule(ctx, args);
  },
});

// Backward-compat alias (was used for earlier migrations)
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const insertConsolidatedModuleMetadata = mutation({
  args: {
    titleDe: v.string(),
    titleEn: v.string(),
    descriptionDe: v.string(),
    descriptionEn: v.string(),
    slug: v.string(),
    moduleNumber: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (args.moduleNumber === undefined) {
      throw new Error("INVALID_MODULE_NUMBER");
    }
    return await createConsolidatedModule(ctx, {
      moduleNumber: args.moduleNumber,
      slug: args.slug,
      titleDe: args.titleDe,
      titleEn: args.titleEn,
      descriptionDe: args.descriptionDe,
      descriptionEn: args.descriptionEn,
    });
  },
});

// Update consolidated module metadata
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const updateModuleMetadata = mutation({
  args: {
    moduleId: v.id("moduleMetadata"),
    titleDe: v.optional(v.string()),
    titleEn: v.optional(v.string()),
    descriptionDe: v.optional(v.string()),
    descriptionEn: v.optional(v.string()),
    slug: v.optional(v.string()),
    moduleNumber: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);

    const existing = await ctx.db.get(args.moduleId);
    if (!existing) {
      throw new Error("MODULE_NOT_FOUND");
    }

    const updates: Record<string, unknown> = {};

    if (args.titleEn !== undefined) {
      const v = args.titleEn.trim();
      if (!v) throw new Error("INVALID_TITLE_EN");
      updates.titleEn = v;
    }
    if (args.titleDe !== undefined) {
      const v = args.titleDe.trim();
      if (!v) throw new Error("INVALID_TITLE_DE");
      updates.titleDe = v;
    }
    if (args.descriptionEn !== undefined) {
      const v = args.descriptionEn.trim();
      if (!v) throw new Error("INVALID_DESCRIPTION_EN");
      updates.descriptionEn = v;
    }
    if (args.descriptionDe !== undefined) {
      const v = args.descriptionDe.trim();
      if (!v) throw new Error("INVALID_DESCRIPTION_DE");
      updates.descriptionDe = v;
    }

    if (args.slug !== undefined) {
      const nextSlug = normalizeSlug(args.slug);
      if (!nextSlug) throw new Error("INVALID_SLUG");
      if (nextSlug !== (existing as any).slug) {
        const other = await ctx.db
          .query("moduleMetadata")
          .withIndex("by_slug", (q) => q.eq("slug", nextSlug))
          .first();
        if (other && other._id !== args.moduleId) {
          throw new Error("MODULE_SLUG_TAKEN");
        }
      }
      updates.slug = nextSlug;
    }

    if (args.moduleNumber !== undefined) {
      const moduleNumber = Number(args.moduleNumber);
      if (!Number.isFinite(moduleNumber) || moduleNumber < 1) {
        throw new Error("INVALID_MODULE_NUMBER");
      }
      if (moduleNumber !== (existing as any).moduleNumber) {
        const allWithNumber = await ctx.db
          .query("moduleMetadata")
          .filter((q) => q.eq(q.field("moduleNumber"), moduleNumber))
          .collect();
        const collision = allWithNumber.find((m) => m._id !== args.moduleId);
        if (collision) {
          throw new Error("MODULE_NUMBER_TAKEN");
        }
      }
      updates.moduleNumber = moduleNumber;
    }

    await ctx.db.patch(args.moduleId, updates);
    return args.moduleId;
  },
});

// Get module by ID (new structure)
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const getModuleById = query({
  args: {
    moduleId: v.id("moduleMetadata"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.moduleId);
  },
});

// Get module by slug (for URL compatibility)
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const getModuleBySlug = query({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("moduleMetadata")
      // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
  },
});

// Get all modules (consolidated structure)
// Returns all modules with multilingual fields, sorted by moduleNumber
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const getAllModulesConsolidated = query({
  args: {},
  handler: async (ctx) => {
    // Fetch all modules that have the new structure (have slug field)
    // Filter to only get unique modules (by slug) - take first occurrence per slug
    const allModules = await ctx.db
      .query("moduleMetadata")
      .filter((q) => q.neq(q.field("slug"), undefined))
      .collect();
    
    // Deduplicate by slug - keep only one module per slug (prefer language-neutral or first found)
    const uniqueBySlug = new Map<string, typeof allModules[0]>();
    for (const module of allModules) {
      const slug = module.slug;
      if (slug && !uniqueBySlug.has(slug)) {
        uniqueBySlug.set(slug, module);
      }
    }
    
    // Convert back to array and sort by moduleNumber
    const uniqueModules = Array.from(uniqueBySlug.values());
    const sorted = uniqueModules.sort((a, b) => {
      const numA = a.moduleNumber ?? 999;
      const numB = b.moduleNumber ?? 999;
      return numA - numB;
    });
    
    return sorted;
  },
});

// DEBUG: Get all modules without deduplication (for debugging duplicates)
// Only returns modules with slug field (new structure)
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const getAllModulesRaw = query({
  args: {},
  handler: async (ctx) => {
    const allModules = await ctx.db
      .query("moduleMetadata")
      .filter((q) => q.neq(q.field("slug"), undefined))
      .collect();
    
    return allModules.sort((a, b) => {
      const numA = a.moduleNumber ?? 999;
      const numB = b.moduleNumber ?? 999;
      return numA - numB;
    });
  },
});

// DEBUG: Get REALLY all modules (no filters at all)
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const getAllModulesAbsolute = query({
  args: {},
  handler: async (ctx) => {
    const allModules = await ctx.db
      .query("moduleMetadata")
      .collect();
    
    return allModules.sort((a, b) => {
      const numA = a.moduleNumber ?? 999;
      const numB = b.moduleNumber ?? 999;
      return numA - numB;
    });
  },
});

// ============= TRANSLATION =============

// Translate a module's EN title + description into German (superadmin-only).
// Mirrors translateOnboardingEnToDe (convex/onboarding.ts): the caller (UI) fills
// the DE fields for review — nothing is persisted here.
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const translateModuleEnToDe = action({
  args: {
    titleEn: v.string(),
    descriptionEn: v.string(),
    preferredProvider: v.optional(v.union(v.literal("gemini"), v.literal("openai"))),
  },
  handler: async (ctx: ActionCtx, args) => {
    await requireSuperadminAction(ctx);

    const titleEn = args.titleEn.trim();
    const descriptionEn = args.descriptionEn.trim();
    if (!titleEn || !descriptionEn) {
      throw new Error("MISSING_REQUIRED_FIELDS");
    }

    const system = [
      "You are a translation engine for a Serbian-learning course platform.",
      "Translate the provided course module title and description from English to German (de-DE).",
      "Keep the tone concise and consistent with course module naming (e.g. 'Modul 1: Grundlagen').",
      "Return ONLY valid JSON with keys: titleDe, descriptionDe.",
    ].join("\n");

    const user = ["Title (EN):", titleEn, "", "Description (EN):", descriptionEn].join("\n");

    const ai = await callAiJson(ctx, {
      stage: "specialist",
      preferredProvider: args.preferredProvider ?? "gemini",
      system,
      user,
      maxTokens: 800,
    });

    let parsed: any;
    try {
      parsed = JSON.parse(ai.raw);
    } catch {
      throw new Error("AI returned invalid JSON.");
    }

    const titleDe = typeof parsed?.titleDe === "string" ? parsed.titleDe.trim() : "";
    const descriptionDe = typeof parsed?.descriptionDe === "string" ? parsed.descriptionDe.trim() : "";

    if (!titleDe || !descriptionDe) {
      throw new Error("AI returned empty translation fields.");
    }

    return { titleDe, descriptionDe };
  },
});

// ============= CLEANUP UTILITIES =============

/**
 * Returns every unitMetadata row associated with a module, via EITHER the
 * new foreign key (moduleMetadataId) OR the deprecated string linkage
 * (unitMetadata.moduleId matching the module's slug or legacy moduleId).
 * Shared by the delete guard (deleteModuleById) and the unit-count display
 * (getModuleUnitCounts) so both always agree on whether a module "has units".
 */
async function findUnitsForModule(
  ctx: { db: any },
  moduleDoc: { _id: Id<"moduleMetadata">; slug?: string; moduleId?: string }
) {
  const byFk = await ctx.db
    .query("unitMetadata")
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    .withIndex("by_module_metadata", (q) => q.eq("moduleMetadataId", moduleDoc._id))
    .collect();

  const legacyKeys = [
    ...new Set(
      [moduleDoc.slug, moduleDoc.moduleId].filter(
        (key): key is string => typeof key === "string" && key.length > 0
      )
    ),
  ];

  const legacyRows: any[] = [];
  for (const key of legacyKeys) {
    const rows = await ctx.db
      .query("unitMetadata")
      // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
      .withIndex("by_module", (q) => q.eq("moduleId", key))
      .collect();
    legacyRows.push(...rows);
  }

  // De-dupe in case a row matches both the FK and a legacy key.
  const byId = new Map<string, any>();
  for (const row of [...byFk, ...legacyRows]) {
    byId.set(String(row._id), row);
  }
  return Array.from(byId.values());
}

// Delete a module by ID. Superadmin-only. Blocked while units are still
// assigned to this module, whether linked via the new foreign key
// (unitMetadata.moduleMetadataId) or the deprecated string linkage
// (unitMetadata.moduleId matching slug / legacy moduleId), to avoid leaving
// orphaned foreign keys behind.
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const deleteModuleById = mutation({
  args: { id: v.id("moduleMetadata") },
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);

    const moduleDoc = await ctx.db.get(args.id);
    if (!moduleDoc) {
      throw new Error("MODULE_NOT_FOUND");
    }

    const assignedUnits = await findUnitsForModule(ctx, moduleDoc);
    if (assignedUnits.length > 0) {
      throw new Error("MODULE_HAS_UNITS");
    }

    await ctx.db.delete(args.id);
    return { success: true };
  },
});

// Returns, per module (_id as string), the number of DISTINCT unit numbers
// assigned to it (via new FK or deprecated moduleId/slug linkage). Powers
// the "Units" column and the proactive delete-guard in the Modulverwaltung
// UI - stays in sync with the deleteModuleById guard via findUnitsForModule.
export const getModuleUnitCounts = query({
  args: {},
  returns: v.record(v.string(), v.number()),
  handler: async (ctx) => {
    await requireSuperadmin(ctx);

    const modules = await ctx.db.query("moduleMetadata").collect();
    const counts: Record<string, number> = {};

    for (const moduleDoc of modules) {
      const units = await findUnitsForModule(ctx, moduleDoc);
      const distinctUnitNumbers = new Set(units.map((u: any) => u.unitNumber));
      counts[String(moduleDoc._id)] = distinctUnitNumbers.size;
    }

    return counts;
  },
});

// Remove legacy module entries with pattern "module-X" (cleanup migration - no auth required)
export const removeLegacyModuleEntries = mutation({
  handler: async (ctx) => {
    await requireSuperadmin(ctx);
    const allModules = await ctx.db.query("moduleMetadata").collect();
    let deleted = 0;
    const deletedIds: string[] = [];
    
    for (const module of allModules) {
      // Check if moduleId matches the legacy pattern "module-X" (where X is a number)
      const moduleId = module.moduleId;
      if (typeof moduleId === "string" && /^module-\d+$/.test(moduleId)) {
        deletedIds.push(`${moduleId} (${module.language})`);
        await ctx.db.delete(module._id);
        deleted++;
      }
    }
    
    return { 
      deleted, 
      total: allModules.length,
      deletedIds 
    };
  },
});
