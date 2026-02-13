import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

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
    environment: v.union(v.literal("beta"), v.literal("production"), v.literal("staging")),
  },
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
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
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
    versionId: v.id("appVersions"),
    language: v.optional(v.union(v.literal("en"), v.literal("de"))),
  },
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
    language: v.union(v.literal("en"), v.literal("de")),
    limit: v.optional(v.number()),
  },
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
    environment: v.union(v.literal("beta"), v.literal("production"), v.literal("staging")),
    deploymentCommit: v.optional(v.string()),
    deploymentBranch: v.optional(v.string()),
  },
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
    versionId: v.id("appVersions"),
    category: v.union(
      v.literal("added"),
      v.literal("changed"),
      v.literal("fixed"),
      v.literal("removed")
    ),
    title: v.string(),
    description: v.optional(v.string()),
    language: v.union(v.literal("en"), v.literal("de")),
  },
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
    entryId: v.id("changelogEntries"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(v.union(
      v.literal("added"),
      v.literal("changed"),
      v.literal("fixed"),
      v.literal("removed")
    )),
    order: v.optional(v.number()),
  },
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
    entryId: v.id("changelogEntries"),
  },
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

/**
 * Set a version as current for its environment
 */
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const setCurrentVersion = mutation({
  args: {
    versionId: v.id("appVersions"),
  },
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
