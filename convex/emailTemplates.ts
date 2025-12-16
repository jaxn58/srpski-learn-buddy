import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx, internalMutation, action, ActionCtx } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

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
    htmlContent: v.string(),
    description: v.optional(v.string()),
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

    const existing = await ctx.db
      .query("emailTemplates")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();

    if (existing) {
      // Update
      await ctx.db.patch(existing._id, {
        subject: args.subject,
        htmlContent: args.htmlContent,
        description: args.description,
        variables: args.variables,
        category: args.category,
        isActive: args.isActive,
        updatedAt: Date.now(),
      });
      return existing._id;
    } else {
      // Create
      return await ctx.db.insert("emailTemplates", {
        name: args.name,
        subject: args.subject,
        htmlContent: args.htmlContent,
        description: args.description,
        variables: args.variables,
        category: args.category,
        isActive: args.isActive,
        createdAt: Date.now(),
        updatedAt: Date.now(),
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
    htmlContent: v.string(),
    description: v.optional(v.string()),
    variables: v.array(v.string()),
    category: v.union(
      v.literal("transactional"),
      v.literal("subscription"),
      v.literal("marketing")
    ),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("emailTemplates")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();

    if (existing) {
      // Update
      await ctx.db.patch(existing._id, {
        subject: args.subject,
        htmlContent: args.htmlContent,
        description: args.description,
        variables: args.variables,
        category: args.category,
        isActive: args.isActive,
        updatedAt: Date.now(),
      });
      return existing._id;
    } else {
      // Create
      return await ctx.db.insert("emailTemplates", {
        name: args.name,
        subject: args.subject,
        htmlContent: args.htmlContent,
        description: args.description,
        variables: args.variables,
        category: args.category,
        isActive: args.isActive,
        createdAt: Date.now(),
        updatedAt: Date.now(),
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
    htmlContent: v.string(),
    description: v.optional(v.string()),
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

// Render template with variables (for preview or sending)
export const render = query({
  args: {
    templateName: v.string(),
    variables: v.optional(v.record(v.string(), v.union(v.string(), v.number()))),
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

    let renderedHtml = template.htmlContent;
    let renderedSubject = template.subject;
    const vars = args.variables || {};

    // Replace all {{VARIABLE}} with values
    for (const [key, value] of Object.entries(vars)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
      const stringValue = String(value);
      renderedHtml = renderedHtml.replace(regex, stringValue);
      renderedSubject = renderedSubject.replace(regex, stringValue);
    }

    return {
      subject: renderedSubject,
      html: renderedHtml,
    };
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

