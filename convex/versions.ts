import { v } from "convex/values";
import { action, ActionCtx, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { callAiJson } from "./contentStudio/_shared";

// ============= SEMANTIC VERSIONING UTILITIES =============

const SEMVER_REGEX = /^(\d+)\.(\d+)\.(\d+)$/;

function parseVersion(version: string): { major: number; minor: number; patch: number } {
  const match = version.match(SEMVER_REGEX);
  if (!match) {
    throw new Error(`Invalid semantic version: ${version}. Expected format: MAJOR.MINOR.PATCH (e.g., 1.0.0)`);
  }
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

function incrementVersion(
  current: string,
  type: "major" | "minor" | "patch"
): string {
  const { major, minor, patch } = parseVersion(current);
  switch (type) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
  }
}

// ============= QUERIES =============

/**
 * Get the current version for a specific environment
 */
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const getCurrentVersion = query({
  args: {
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    environment: v.union(v.literal("beta"), v.literal("production"), v.literal("staging")),
  },
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx, args) => {
    const version = await ctx.db
      .query("appVersions")
      // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
      .withIndex("by_current", (q) => 
        // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
        q.eq("environment", args.environment).eq("isCurrent", true)
      )
      .first();
    
    return version;
  },
});

/**
 * Get all versions with pagination
 */
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const getAllVersions = query({
  args: {
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    limit: v.optional(v.number()),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    offset: v.optional(v.number()),
  },
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const offset = args.offset ?? 0;
    
    const versions = await ctx.db
      .query("appVersions")
      .order("desc")
      .collect();
    
    // Manual pagination
    const paginatedVersions = versions.slice(offset, offset + limit);
    
    return {
      versions: paginatedVersions,
      total: versions.length,
      hasMore: offset + limit < versions.length,
    };
  },
});

/**
 * Get a specific version with its changelog entries
 */
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const getVersionWithChangelog = query({
  args: {
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    versionId: v.id("appVersions"),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    language: v.optional(v.union(v.literal("en"), v.literal("de"))),
  },
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx, args) => {
    const version = await ctx.db.get(args.versionId);
    if (!version) {
      throw new Error("Version not found");
    }
    
    // Get all changelog entries for this version
    let entriesQuery = ctx.db
      .query("changelogEntries")
      // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
      .withIndex("by_version", (q) => q.eq("versionId", args.versionId));
    
    const allEntries = await entriesQuery.collect();
    
    // Filter by language if specified
    const entries = args.language
      // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
      ? allEntries.filter(e => e.language === args.language)
      : allEntries;
    
    // Sort by order
    entries.sort((a, b) => a.order - b.order);
    
    // Enrich with creator info
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    const enrichedEntries = await Promise.all(
      // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
      entries.map(async (entry) => {
        const creator = await ctx.db.get(entry.createdBy);
        return {
          ...entry,
          creatorName: creator?.name || creator?.email || "Unknown",
        };
      })
    );
    
    return {
      version,
      entries: enrichedEntries,
    };
  },
});

/**
 * Get changelog history grouped by version
 */
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const getChangelogHistory = query({
  args: {
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    language: v.union(v.literal("en"), v.literal("de")),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    limit: v.optional(v.number()),
  },
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;
    
    // Get all versions, sorted by release date (newest first)
    const versions = await ctx.db
      .query("appVersions")
      .order("desc")
      .take(limit);
    
    // For each version, get its changelog entries
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    const history = await Promise.all(
      // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
      versions.map(async (version) => {
        const entries = await ctx.db
          .query("changelogEntries")
          // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
          .withIndex("by_version", (q) => q.eq("versionId", version._id))
          // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
          .filter((q) => q.eq(q.field("language"), args.language))
          .collect();
        
        // Sort by order
        entries.sort((a, b) => a.order - b.order);
        
        // Group by category
        const grouped = {
          added: entries.filter(e => e.category === "added"),
          changed: entries.filter(e => e.category === "changed"),
          fixed: entries.filter(e => e.category === "fixed"),
          removed: entries.filter(e => e.category === "removed"),
        };
        
        return {
          version,
          entries: grouped,
        };
      })
    );
    
    return history;
  },
});

// ============= MUTATIONS (Admin only) =============

/**
 * Create a new version
 */
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const createVersion = mutation({
  args: {
    version: v.string(),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    environment: v.union(v.literal("beta"), v.literal("production"), v.literal("staging")),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    deploymentCommit: v.optional(v.string()),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    deploymentBranch: v.optional(v.string()),
  },
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx, args) => {
    // Check authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    
    // Get user and check admin role
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      throw new Error("Unauthorized: Admin access required");
    }
    
    // Validate semantic version
    const { major, minor, patch } = parseVersion(args.version);
    
    // Check if version already exists
    const existing = await ctx.db
      .query("appVersions")
      .withIndex("by_version", (q) => q.eq("version", args.version))
      .first();
    
    if (existing) {
      throw new Error(`Version ${args.version} already exists`);
    }
    
    // Unset current version for this environment
    const currentVersion = await ctx.db
      .query("appVersions")
      .withIndex("by_current", (q) => 
        q.eq("environment", args.environment).eq("isCurrent", true)
      )
      .first();
    
    if (currentVersion) {
      await ctx.db.patch(currentVersion._id, { isCurrent: false });
    }
    
    // Create new version
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    const versionId = await ctx.db.insert("appVersions", {
      version: args.version,
      major,
      minor,
      patch,
      environment: args.environment,
      releaseDate: Date.now(),
      isCurrent: true,
      deploymentCommit: args.deploymentCommit,
      deploymentBranch: args.deploymentBranch,
    });
    
    return versionId;
  },
});

/**
 * Add a changelog entry
 */
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const addChangelogEntry = mutation({
  args: {
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    versionId: v.id("appVersions"),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    category: v.union(
      // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
      v.literal("added"),
      // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
      v.literal("changed"),
      // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
      v.literal("fixed"),
      // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
      v.literal("removed")
    ),
    title: v.string(),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    description: v.optional(v.string()),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    language: v.union(v.literal("en"), v.literal("de")),
  },
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx, args) => {
    // Check authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    
    // Get user and check admin role
    const user = await ctx.db
      .query("users")
      // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      throw new Error("Unauthorized: Admin access required");
    }
    
    // Verify version exists
    const version = await ctx.db.get(args.versionId);
    if (!version) {
      throw new Error("Version not found");
    }
    
    // Get current max order for this version
    const existingEntries = await ctx.db
      .query("changelogEntries")
      // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
      .withIndex("by_version", (q) => q.eq("versionId", args.versionId))
      .collect();
    
    const maxOrder = existingEntries.length > 0
      // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
      ? Math.max(...existingEntries.map(e => e.order))
      : 0;
    
    // Create entry
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    const entryId = await ctx.db.insert("changelogEntries", {
      versionId: args.versionId,
      category: args.category,
      title: args.title,
      description: args.description,
      language: args.language,
      createdBy: user._id,
      createdAt: Date.now(),
      order: maxOrder + 1,
    });
    
    return entryId;
  },
});

/**
 * Update a changelog entry
 */
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const updateChangelogEntry = mutation({
  args: {
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    entryId: v.id("changelogEntries"),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    title: v.optional(v.string()),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    description: v.optional(v.string()),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    category: v.optional(v.union(
      // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
      v.literal("added"),
      // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
      v.literal("changed"),
      // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
      v.literal("fixed"),
      // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
      v.literal("removed")
    )),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    order: v.optional(v.number()),
  },
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx, args) => {
    // Check authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    
    // Get user and check admin role
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      throw new Error("Unauthorized: Admin access required");
    }
    
    // Verify entry exists
    const entry = await ctx.db.get(args.entryId);
    if (!entry) {
      throw new Error("Changelog entry not found");
    }
    
    // Build update object
    const updates: any = {};
    if (args.title !== undefined) updates.title = args.title;
    if (args.description !== undefined) updates.description = args.description;
    if (args.category !== undefined) updates.category = args.category;
    if (args.order !== undefined) updates.order = args.order;
    
    // Update entry
    await ctx.db.patch(args.entryId, updates);
    
    return args.entryId;
  },
});

/**
 * Delete a changelog entry
 */
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const deleteChangelogEntry = mutation({
  args: {
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    entryId: v.id("changelogEntries"),
  },
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx, args) => {
    // Check authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    
    // Get user and check admin role
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      throw new Error("Unauthorized: Admin access required");
    }
    
    // Verify entry exists
    const entry = await ctx.db.get(args.entryId);
    if (!entry) {
      throw new Error("Changelog entry not found");
    }
    
    // Delete entry
    await ctx.db.delete(args.entryId);
    
    return { success: true };
  },
});

// ============= AI TRANSLATION =============

/**
 * Internal: returns all EN entries for a version (used by the translation action)
 */
// @ts-ignore TS2589 – Convex schema depth limit (50 tables)
export const getEnEntriesForVersion = internalQuery({
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  args: { versionId: v.id("appVersions") },
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx, args) => {
    // @ts-ignore TS2589 – Convex schema depth limit (50 tables)
    return ctx.db
      .query("changelogEntries")
      // @ts-ignore TS2589 – Convex schema depth limit (50 tables)
      .withIndex("by_version", (q: any) => q.eq("versionId", args.versionId))
      // @ts-ignore TS2589 – Convex schema depth limit (50 tables)
      .filter((q: any) => q.eq(q.field("language"), "en"))
      .collect();
  },
});

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

/**
 * Admin-only: translate all EN changelog entries for a version → DE (no DB writes).
 * Returns translated entries; admin reviews and confirms via saveTranslatedDeEntries.
 */
// @ts-ignore TS2589 – Convex schema depth limit (50 tables)
export const translateChangelogVersionEnToDe = action({
  args: {
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    versionId: v.id("appVersions"),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    preferredProvider: v.optional(v.union(v.literal("gemini"), v.literal("openai"))),
  },
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx, args) => {
    await requireAdminAction(ctx);

    // @ts-ignore TS2589 – Convex schema depth limit (50 tables)
    const enEntries: any[] = await ctx.runQuery(
      internal.versions.getEnEntriesForVersion,
      { versionId: args.versionId }
    );

    if (enEntries.length === 0) {
      throw new Error(
        "No English entries found for this version. Please create English entries first."
      );
    }

    const system = `You are a professional software changelog translation engine.
Translate changelog entries from English to German (de-DE).
Maintain technical terminology and the concise, professional style typical of software changelogs.
Return ONLY valid JSON with no additional text or markdown.
The response must follow this exact structure:
{
  "entries": [
    { "id": "string", "title": "German title", "description": "German description or null" }
  ]
}`;

    const userPrompt = `Translate the following software changelog entries to German (de-DE).
Return the entries array with translated "title" and "description" fields.
Keep each entry's "id" exactly as provided. If "description" is null, keep it as null.

${JSON.stringify({
  entries: enEntries.map((e) => ({
    id: e._id,
    title: e.title,
    description: e.description ?? null,
  })),
})}`;

    const ai = await callAiJson(ctx, {
      stage: "specialist",
      preferredProvider: args.preferredProvider ?? "gemini",
      system,
      user: userPrompt,
      maxTokens: 4000,
    });

    let parsed: { entries: Array<{ id: string; title: string; description: string | null }> };
    try {
      parsed = JSON.parse(ai.raw);
    } catch {
      throw new Error("AI returned invalid JSON. Please try again.");
    }

    if (!parsed.entries || !Array.isArray(parsed.entries)) {
      throw new Error("AI response missing 'entries' array. Please try again.");
    }

    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    const translatedMap = new Map(parsed.entries.map((e) => [e.id, e]));

    const result = enEntries.map((sourceEntry) => {
      const translated = translatedMap.get(sourceEntry._id);
      return {
        id: sourceEntry._id as string,
        category: sourceEntry.category as string,
        // @ts-ignore TS2339 TS2589 – Convex schema depth limit (50 tables)
        titleDe: translated?.title ?? sourceEntry.title,
        // @ts-ignore TS2339 TS2589 – Convex schema depth limit (50 tables)
        descriptionDe: translated?.description ?? null,
      };
    });

    const missingCount = enEntries.filter(
      (e) => !translatedMap.has(e._id)
    ).length;
    const warnings: string[] =
      missingCount > 0
        ? [`${missingCount} entries were not translated by AI; English text was used as fallback.`]
        : [];

    return {
      entries: result,
      sourceCount: enEntries.length,
      translatedCount: parsed.entries.length,
      warnings,
      meta: { provider: ai.provider, model: ai.model },
    };
  },
});

/**
 * Admin-only: persist translated DE changelog entries for a version.
 * Deletes all existing DE entries for that version, then inserts the provided ones.
 */
// @ts-ignore TS2589 – Convex schema depth limit (50 tables)
export const saveTranslatedDeEntries = mutation({
  args: {
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    versionId: v.id("appVersions"),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    entries: v.array(
      // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
      v.object({
        // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
        sourceEntryId: v.id("changelogEntries"),
        title: v.string(),
        // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
        description: v.optional(v.string()),
      })
    ),
  },
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      throw new Error("Unauthorized: Admin access required");
    }

    const version = await ctx.db.get(args.versionId);
    if (!version) throw new Error("Version not found");

    // Delete all existing DE entries for this version
    // @ts-ignore TS2589 – Convex schema depth limit (50 tables)
    const existingDeEntries = await ctx.db
      .query("changelogEntries")
      // @ts-ignore TS2589 – Convex schema depth limit (50 tables)
      .withIndex("by_version", (q) => q.eq("versionId", args.versionId))
      // @ts-ignore TS2589 – Convex schema depth limit (50 tables)
      .filter((q) => q.eq(q.field("language"), "de"))
      .collect();

    for (const entry of existingDeEntries) {
      await ctx.db.delete(entry._id);
    }

    // Insert translated DE entries, inheriting category and order from the source EN entry
    let insertedCount = 0;
    for (const translated of args.entries) {
      const sourceEntry = await ctx.db.get(translated.sourceEntryId);
      if (!sourceEntry) continue;

      // @ts-ignore TS2589 – Convex schema depth limit (50 tables)
      await ctx.db.insert("changelogEntries", {
        versionId: args.versionId,
        category: sourceEntry.category,
        title: translated.title,
        description: translated.description,
        language: "de",
        createdBy: user._id,
        createdAt: Date.now(),
        order: sourceEntry.order,
      });
      insertedCount++;
    }

    return { inserted: insertedCount, deleted: existingDeEntries.length };
  },
});

/**
 * Set a version as current for its environment
 */
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const setCurrentVersion = mutation({
  args: {
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    versionId: v.id("appVersions"),
  },
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx, args) => {
    // Check authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    
    // Get user and check admin role
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      throw new Error("Unauthorized: Admin access required");
    }
    
    // Get the version
    const version = await ctx.db.get(args.versionId);
    if (!version) {
      throw new Error("Version not found");
    }
    
    // Unset current version for this environment
    const currentVersion = await ctx.db
      .query("appVersions")
      .withIndex("by_current", (q) => 
        // @ts-ignore TS2339 TS2589 – Convex schema depth limit (50 tables)
        q.eq("environment", version.environment).eq("isCurrent", true)
      )
      .first();
    
    if (currentVersion && currentVersion._id !== args.versionId) {
      await ctx.db.patch(currentVersion._id, { isCurrent: false });
    }
    
    // Set new current version
    await ctx.db.patch(args.versionId, { isCurrent: true });
    
    return { success: true };
  },
});
