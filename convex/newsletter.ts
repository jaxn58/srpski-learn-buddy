import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery, internalAction, action, QueryCtx, MutationCtx, ActionCtx } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { Resend } from "resend";
import { assertLearnerAccountActive } from "./authz";
import { callAiJson } from "./contentStudio/_shared";

// ============= HELPER FUNCTIONS =============

// Helper to get the current user and verify admin
type AnyCtx = QueryCtx | MutationCtx | ActionCtx;
type CtxWithDb = QueryCtx | MutationCtx;

function hasDb(ctx: AnyCtx): ctx is CtxWithDb {
  return "db" in ctx;
}

async function getAdminUser(ctx: AnyCtx): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  const user: Doc<"users"> | null = hasDb(ctx)
    ? await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
        .first()
    : ((await ctx.runQuery(internal.users.internalGetUserByClerkId, {
        clerkId: identity.subject,
      })) as Doc<"users"> | null);

  if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
    return null;
  }

  return user;
}

async function getSuperadminUser(ctx: AnyCtx): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  const user: Doc<"users"> | null = hasDb(ctx)
    ? await ctx.db
        .query("users")
        // @ts-ignore TS2589 – Convex schema depth limit
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
        .first()
    : ((await ctx.runQuery(internal.users.internalGetUserByClerkId, {
        clerkId: identity.subject,
      })) as Doc<"users"> | null);

  if (!user || user.role !== "superadmin") {
    return null;
  }

  return user;
}

const PRE_SEND_EDITABLE = new Set(["draft", "review", "ready"]);

function extractVariablesFromContent(content: string): string[] {
  const variableRegex = /\{\{(\w+)\}\}/g;
  const found = new Set<string>();
  let m;
  while ((m = variableRegex.exec(content)) !== null) {
    found.add(m[1]!);
  }
  return Array.from(found);
}

function diffNewsletterVariables(source: string[], target: string[]) {
  const s = new Set(source);
  const t = new Set(target);
  return {
    missing: source.filter((v) => !t.has(v)),
    added: target.filter((v) => !s.has(v)),
  };
}

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

// Detect environment (dev vs prod)
function getEnvironment(): "dev" | "prod" {
  return process.env.CONVEX_CLOUD_URL?.includes("fleet-labrador-324") 
    ? "prod" 
    : "dev";
}

// ============= SYNCHRONIZATION =============

/**
 * Sync Waitlist Contact to Newsletter Contacts
 * Called automatically after waitlist confirmation
 */
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const syncWaitlistToNewsletter = internalMutation({
  args: {
    waitlistId: v.id("waitlist"),
  },
  handler: async (ctx, args) => {
    const waitlistEntry = await ctx.db.get(args.waitlistId);
    // @ts-ignore TS2339 TS2589 – Convex schema depth limit (50 tables)
    if (!waitlistEntry || waitlistEntry.status !== "confirmed") {
      console.log("[Newsletter] Waitlist entry not confirmed, skipping sync");
      return null;
    }

    // Check if already exists
    const existing = await ctx.db
      .query("newsletterContacts")
      // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
      .withIndex("by_email", (q) => q.eq("email", waitlistEntry.email))
      .first();

    const environment = getEnvironment();

    if (existing) {
      // Always keep the contact in sync with the waitlist source, but DO NOT auto-subscribe.
      // Subscribing to marketing updates requires explicit double opt-in.
      const hasConfirmedOptIn = !!existing.optInConfirmedAt;
      // @ts-ignore TS2339 – waitlist language
      const wlLang = waitlistEntry.language;
      const preferredLocale =
        wlLang === "de" || wlLang === "en" ? wlLang : existing.preferredLocale;
      await ctx.db.patch(existing._id, {
        sourceId: args.waitlistId,
        source: "waitlist",
        // @ts-ignore TS2339 TS2589 – Convex schema depth limit (50 tables)
        name: waitlistEntry.name || existing.name,
        tags: Array.from(new Set([...(existing.tags || []), "waitlist"])),
        environment,
        ...(preferredLocale !== undefined ? { preferredLocale } : {}),
        // Safety migration: historical data might have subscribed=true from the old implementation.
        // Only keep subscribed=true if the user has a confirmed double opt-in.
        subscribed: hasConfirmedOptIn ? existing.subscribed : false,
        subscribedAt: hasConfirmedOptIn ? existing.subscribedAt : undefined,
        updatedAt: Date.now(),
      });
      // @ts-ignore TS2339 TS2589 – Convex schema depth limit (50 tables)
      console.log(`[Newsletter] Synced existing contact from waitlist (no auto-subscribe): ${waitlistEntry.email}`);
      return existing._id;
    }

    // Create new contact
    const unsubscribeToken = crypto.randomUUID();
    // @ts-ignore TS2339 – waitlist language
    const wlLangNew = waitlistEntry.language;
    const preferredLocaleNew =
      wlLangNew === "de" || wlLangNew === "en" ? wlLangNew : undefined;
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    const contactId = await ctx.db.insert("newsletterContacts", {
      // @ts-ignore TS2339 TS2589 – Convex schema depth limit (50 tables)
      email: waitlistEntry.email,
      // @ts-ignore TS2339 TS2589 – Convex schema depth limit (50 tables)
      name: waitlistEntry.name,
      source: "waitlist",
      sourceId: args.waitlistId,
      subscribed: false,
      subscribedAt: undefined,
      unsubscribeToken,
      tags: ["waitlist"],
      environment,
      ...(preferredLocaleNew !== undefined ? { preferredLocale: preferredLocaleNew } : {}),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // @ts-ignore TS2339 TS2589 – Convex schema depth limit (50 tables)
    console.log(`[Newsletter] Created new contact from waitlist: ${waitlistEntry.email}`);
    return contactId;
  },
});

/**
 * Sync User to Newsletter Contacts
 * Called automatically after user registration
 */
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const syncUserToNewsletter = internalMutation({
  args: {
    userId: v.id("users"),
    autoSubscribe: v.optional(v.boolean()), // Default: false (Opt-In required)
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    // @ts-ignore TS2339 TS2589 – Convex schema depth limit (50 tables)
    if (!user || !user.email) {
      console.log("[Newsletter] User not found or no email, skipping sync");
      return null;
    }

    const existing = await ctx.db
      .query("newsletterContacts")
      // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
      .withIndex("by_email", (q) => q.eq("email", user.email!))
      .first();

    const environment = getEnvironment();
    const userTags = ["user"];
    // @ts-ignore TS2339 TS2589 – Convex schema depth limit (50 tables)
    if (user.isBetaTester) {
      userTags.push("beta-user");
    }

    // Map learningLanguage → preferredLocale (newsletter only supports en/de for now)
    // @ts-ignore TS2339
    const rawLang: string | undefined = user.learningLanguage;
    const preferredLocale: "en" | "de" | undefined =
      rawLang === "de" ? "de" : rawLang === "en" ? "en" : undefined;

    if (existing) {
      // Update existing contact with user reference.
      // Only overwrite preferredLocale if derived from learningLanguage (never downgrade known locale).
      const localeUpdate =
        preferredLocale !== undefined && existing.preferredLocale !== preferredLocale
          ? { preferredLocale }
          : {};
      await ctx.db.patch(existing._id, {
        sourceId: args.userId,
        source: "user",
        // @ts-ignore TS2339 TS2589 – Convex schema depth limit (50 tables)
        name: user.name || existing.name,
        tags: Array.from(new Set([...(existing.tags || []), ...userTags])),
        environment,
        ...localeUpdate,
        updatedAt: Date.now(),
      });
      // @ts-ignore TS2339 TS2589 – Convex schema depth limit (50 tables)
      console.log(`[Newsletter] Updated existing contact with user reference: ${user.email}`);
      return existing._id;
    }

    // Create contact record for the user (not subscribed by default).
    // Subscribing to marketing/community updates requires explicit double opt-in.

    const unsubscribeToken = crypto.randomUUID();
    const contactId = await ctx.db.insert("newsletterContacts", {
      // @ts-ignore TS2339 TS2589 – Convex schema depth limit (50 tables)
      email: user.email,
      // @ts-ignore TS2339 TS2589 – Convex schema depth limit (50 tables)
      name: user.name,
      source: "user",
      sourceId: args.userId,
      subscribed: args.autoSubscribe === true,
      subscribedAt: args.autoSubscribe === true ? Date.now() : undefined,
      unsubscribeToken,
      tags: userTags,
      environment,
      ...(preferredLocale !== undefined ? { preferredLocale } : {}),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // @ts-ignore TS2339 TS2589 – Convex schema depth limit (50 tables)
    console.log(`[Newsletter] Created new contact from user: ${user.email}`);
    return contactId;
  },
});

// ============= DOUBLE OPT-IN =============

type OptInPurpose = "waitlist_updates" | "community_updates";

function getOptInTemplateName(purpose: OptInPurpose): string {
  // These templates must be created in the Email Templates admin tool.
  // English only (until multi-language is activated).
  switch (purpose) {
    case "waitlist_updates":
      return "newsletter-waitlist-updates-double-opt-in";
    case "community_updates":
      return "newsletter-community-updates-double-opt-in";
  }
}

function getOptInTag(purpose: OptInPurpose): string {
  switch (purpose) {
    case "waitlist_updates":
      return "waitlist-updates";
    case "community_updates":
      return "community";
  }
}

// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const requestWaitlistUpdatesDoubleOptIn = internalMutation({
  args: {
    waitlistId: v.id("waitlist"),
  },
  handler: async (ctx, args) => {
    const waitlistEntry = await ctx.db.get(args.waitlistId);
    // @ts-ignore TS2339 TS2589 – Convex schema depth limit (50 tables)
    if (!waitlistEntry || waitlistEntry.status !== "confirmed") {
      console.log("[Newsletter DOI] Waitlist entry not confirmed, skipping DOI request");
      return { success: false, reason: "not_confirmed" as const };
    }
    // @ts-ignore TS2339 TS2589 – Convex schema depth limit (50 tables)
    if (!waitlistEntry.wantsWaitlistUpdates) {
      return { success: false, reason: "not_requested" as const };
    }

    // Ensure contact exists (not subscribed by default)
    const contactId =
      ((await ctx.runMutation(internal.newsletter.syncWaitlistToNewsletter, {
        waitlistId: args.waitlistId,
      })) as Id<"newsletterContacts"> | null) ?? null;
    if (!contactId) {
      return { success: false, reason: "contact_missing" as const };
    }

    const contact = await ctx.db.get(contactId);
    if (!contact) return { success: false, reason: "contact_missing" as const };

    // If already subscribed, just ensure tag and exit
    if (contact.subscribed) {
      const tag = getOptInTag("waitlist_updates");
      await ctx.db.patch(contact._id, {
        tags: Array.from(new Set([...(contact.tags || []), tag])),
        updatedAt: Date.now(),
      });
      return { success: true, alreadySubscribed: true };
    }

    const token = crypto.randomUUID();
    const baseUrl = process.env.VITE_APP_URL || "https://learn-with.me";

    await ctx.db.patch(contact._id, {
      optInToken: token,
      optInPurpose: "waitlist_updates",
      optInRequestedAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Send double opt-in email
    try {
      await ctx.scheduler.runAfter(0, internal.email.sendEmail, {
        templateName: getOptInTemplateName("waitlist_updates"),
        variables: {
          USER_NAME: contact.name || "there",
          USER_EMAIL: contact.email,
          CONFIRM_LINK: `${baseUrl}/newsletter/optin/confirm?token=${token}`,
          BETA_LAUNCH_NOTE: "If you don’t opt in, you’ll only receive the beta launch email.",
        },
        to: contact.email,
      });
      return { success: true, alreadySubscribed: false };
    } catch (error) {
      console.error("[Newsletter DOI] Failed to send waitlist updates opt-in email:", error);
      return { success: false, reason: "email_failed" as const };
    }
  },
});

// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const requestCommunityUpdatesDoubleOptIn = mutation({
  args: {
    // UI checkbox: user explicitly requests marketing/community emails (double opt-in will be sent)
    requested: v.boolean(),
  },
  handler: async (ctx, args) => {
    if (!args.requested) {
      return { success: true, skipped: true };
    }

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user || !user.email) throw new Error("User not found or missing email");
    assertLearnerAccountActive(user);

    // Ensure contact exists
    const contactId =
      ((await ctx.runMutation(internal.newsletter.syncUserToNewsletter, {
        userId: user._id,
        autoSubscribe: false,
      })) as Id<"newsletterContacts"> | null) ?? null;
    if (!contactId) throw new Error("Could not create newsletter contact");

    const contact = await ctx.db.get(contactId);
    if (!contact) throw new Error("Newsletter contact not found");

    if (contact.subscribed) {
      const tag = getOptInTag("community_updates");
      await ctx.db.patch(contact._id, {
        tags: Array.from(new Set([...(contact.tags || []), tag])),
        updatedAt: Date.now(),
      });
      return { success: true, alreadySubscribed: true };
    }

    const token = crypto.randomUUID();
    const baseUrl = process.env.VITE_APP_URL || "https://learn-with.me";

    await ctx.db.patch(contact._id, {
      optInToken: token,
      optInPurpose: "community_updates",
      optInRequestedAt: Date.now(),
      updatedAt: Date.now(),
    });

    try {
      await ctx.scheduler.runAfter(0, internal.email.sendEmail, {
        templateName: getOptInTemplateName("community_updates"),
        variables: {
          USER_NAME: contact.name || "there",
          USER_EMAIL: contact.email,
          CONFIRM_LINK: `${baseUrl}/newsletter/optin/confirm?token=${token}`,
        },
        to: contact.email,
      });
      return { success: true, alreadySubscribed: false };
    } catch (error) {
      console.error("[Newsletter DOI] Failed to send community updates opt-in email:", error);
      throw new Error("Failed to send opt-in email");
    }
  },
});

/**
 * Get current user's community updates subscription status (for Profile UI).
 * - subscribed=true: already confirmed
 * - pending=true: opt-in requested but not confirmed yet
 */
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const getMyCommunityUpdatesStatus = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user || !user.email) {
      throw new Error("Not authenticated");
    }

    const contact = await ctx.db
      .query("newsletterContacts")
      // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
      .withIndex("by_email", (q) => q.eq("email", user.email!))
      .first();

    if (!contact) {
      return {
        email: user.email,
        subscribed: false,
        pending: false,
        optInRequestedAt: null as number | null,
        optInConfirmedAt: null as number | null,
      };
    }

    const pending =
      contact.subscribed !== true &&
      contact.optInPurpose === "community_updates" &&
      typeof contact.optInToken === "string" &&
      contact.optInToken.length > 0;

    return {
      email: contact.email,
      subscribed: contact.subscribed === true,
      pending,
      optInRequestedAt: contact.optInRequestedAt ?? null,
      optInConfirmedAt: contact.optInConfirmedAt ?? null,
    };
  },
});

/**
 * Unsubscribe the current user (no token required, authenticated).
 * Also clears any pending opt-in request.
 */
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const unsubscribeMyCommunityUpdates = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user || !user.email) {
      throw new Error("Not authenticated");
    }

    const contact = await ctx.db
      .query("newsletterContacts")
      // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
      .withIndex("by_email", (q) => q.eq("email", user.email!))
      .first();

    if (!contact) {
      return { success: true, alreadyUnsubscribed: true };
    }

    const nextTags = (contact.tags || []).filter((t) => t !== "community");

    await ctx.db.patch(contact._id, {
      subscribed: false,
      unsubscribedAt: Date.now(),
      // Cancel any pending DOI request
      optInToken: undefined,
      optInPurpose: undefined,
      optInRequestedAt: undefined,
      updatedAt: Date.now(),
      tags: nextTags,
    });

    return { success: true, alreadyUnsubscribed: contact.subscribed !== true };
  },
});

// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const confirmDoubleOptIn = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const contact = await ctx.db
      .query("newsletterContacts")
      // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
      .withIndex("by_optin_token", (q) => q.eq("optInToken", args.token))
      .first();

    if (!contact) {
      throw new Error("Invalid or expired opt-in token");
    }

    if (contact.subscribed) {
      return { success: true, alreadySubscribed: true, email: contact.email };
    }

    const purpose = (contact.optInPurpose ?? "community_updates") as OptInPurpose;
    const tag = getOptInTag(purpose);

    await ctx.db.patch(contact._id, {
      subscribed: true,
      subscribedAt: Date.now(),
      optInConfirmedAt: Date.now(),
      optInToken: undefined,
      optInPurpose: undefined,
      optInRequestedAt: undefined,
      tags: Array.from(new Set([...(contact.tags || []), tag])),
      gdprConsent: {
        marketing: true,
        tracking: true,
        consentedAt: Date.now(),
      },
      updatedAt: Date.now(),
    });

    return { success: true, alreadySubscribed: false, email: contact.email };
  },
});

// ============= CONTACT MANAGEMENT =============

/**
 * Get all newsletter contacts (admin only)
 */
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const getAllContacts = query({
  args: {
    subscribed: v.optional(v.boolean()),
    source: v.optional(v.union(v.literal("waitlist"), v.literal("user"), v.literal("manual"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);
    if (!admin) throw new Error("Unauthorized - Admin access required");

    let contacts =
      args.subscribed !== undefined
        ? await ctx.db
            .query("newsletterContacts")
            // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
            .withIndex("by_subscribed", (q) => q.eq("subscribed", args.subscribed!))
            .collect()
        : await ctx.db.query("newsletterContacts").collect();

    // Filter by source if provided
    if (args.source) {
      contacts = contacts.filter(c => c.source === args.source);
    }

    // Limit results
    if (args.limit) {
      contacts = contacts.slice(0, args.limit);
    }

    return contacts;
  },
});

/**
 * Get contact by unsubscribe token (public for unsubscribe page)
 */
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const getContactByUnsubscribeToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("newsletterContacts")
      // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
      .withIndex("by_unsubscribe_token", (q) => q.eq("unsubscribeToken", args.token))
      .first();
  },
});

/**
 * Unsubscribe contact
 */
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const unsubscribeContact = mutation({
  args: { contactId: v.id("newsletterContacts") },
  handler: async (ctx, args) => {
    const contact = await ctx.db.get(args.contactId);
    if (!contact) throw new Error("Contact not found");

    // @ts-ignore TS2339 TS2589 – Convex schema depth limit (50 tables)
    if (!contact.subscribed) {
      return { success: true, message: "Already unsubscribed" };
    }

    await ctx.db.patch(args.contactId, {
      subscribed: false,
      unsubscribedAt: Date.now(),
      updatedAt: Date.now(),
    });

    // @ts-ignore TS2339 TS2589 – Convex schema depth limit (50 tables)
    console.log(`[Newsletter] Contact unsubscribed: ${contact.email}`);
    return { success: true, message: "Successfully unsubscribed" };
  },
});

/**
 * Unsubscribe by token (public). This is safer than exposing contact IDs.
 * Used by the public unsubscribe UI and the one-click unsubscribe HTTP endpoint.
 */
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const unsubscribeByToken = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const contact = await ctx.db
      .query("newsletterContacts")
      .withIndex("by_unsubscribe_token", (q) => q.eq("unsubscribeToken", args.token))
      .first();

    if (!contact) {
      throw new Error("Invalid unsubscribe link");
    }

    if (!contact.subscribed) {
      return { success: true, alreadyUnsubscribed: true };
    }

    await ctx.db.patch(contact._id, {
      subscribed: false,
      unsubscribedAt: Date.now(),
      updatedAt: Date.now(),
    });

    console.log(`[Newsletter] Contact unsubscribed (token): ${contact.email}`);
    return { success: true, alreadyUnsubscribed: false };
  },
});

/**
 * Manually add contact (admin only)
 */
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const addContact = mutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    subscribed: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);
    if (!admin) throw new Error("Unauthorized - Admin access required");

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(args.email)) {
      throw new Error("Invalid email format");
    }

    // Check if already exists
    const existing = await ctx.db
      .query("newsletterContacts")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existing) {
      throw new Error("Contact already exists");
    }

    const environment = getEnvironment();
    const unsubscribeToken = crypto.randomUUID();

    const contactId = await ctx.db.insert("newsletterContacts", {
      email: args.email,
      name: args.name,
      source: "manual",
      subscribed: args.subscribed ?? true,
      subscribedAt: (args.subscribed ?? true) ? Date.now() : undefined,
      unsubscribeToken,
      tags: args.tags || [],
      environment,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    console.log(`[Newsletter] Manually added contact: ${args.email}`);
    return { success: true, contactId };
  },
});

/**
 * Internal query to get newsletter statistics (no auth check)
 */
async function computeNewsletterStats(ctx: QueryCtx) {
  const allContacts = await ctx.db.query("newsletterContacts").collect();
  const allCampaigns = await ctx.db.query("newsletterCampaigns").collect();

  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  const subscribed = allContacts.filter((c) => c.subscribed).length;
  const unsubscribed = allContacts.filter((c) => !c.subscribed).length;
  const fromWaitlist = allContacts.filter((c) => c.source === "waitlist").length;
  const fromUsers = allContacts.filter((c) => c.source === "user").length;
  const manual = allContacts.filter((c) => c.source === "manual").length;

  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  const draftCampaigns = allCampaigns.filter((c) => c.status === "draft").length;
  const sentCampaigns = allCampaigns.filter((c) => c.status === "sent").length;

  return {
    totalContacts: allContacts.length,
    subscribed,
    unsubscribed,
    sources: {
      waitlist: fromWaitlist,
      users: fromUsers,
      manual,
    },
    campaigns: {
      draft: draftCampaigns,
      sent: sentCampaigns,
      total: allCampaigns.length,
    },
  };
}

export const internalGetNewsletterStats = internalQuery({
  handler: async (ctx) => {
    return await computeNewsletterStats(ctx);
  },
});

/**
 * Get newsletter statistics (admin only, public API)
 */
export const getNewsletterStats = query({
  handler: async (ctx) => {
    const admin = await getAdminUser(ctx);
    if (!admin) throw new Error("Unauthorized - Admin access required");

    return await computeNewsletterStats(ctx);
  },
});

// ============= CAMPAIGN MANAGEMENT =============

/**
 * Create new campaign (admin only)
 */
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const createCampaign = mutation({
  args: {
    name: v.string(),
    subject: v.string(),
    templateName: v.string(),
    description: v.optional(v.string()),
    targetTags: v.optional(v.array(v.string())),
    targetSource: v.optional(v.union(v.literal("waitlist"), v.literal("user"), v.literal("all"))),
    testMode: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);
    if (!admin) throw new Error("Unauthorized - Admin access required");

    // Verify template exists
    const template = await ctx.db
      .query("emailTemplates")
      .withIndex("by_name", (q) => q.eq("name", args.templateName))
      .first();

    if (!template || !template.isActive) {
      throw new Error(`Template "${args.templateName}" not found or inactive`);
    }

    const htmlEn =
      // @ts-ignore TS2339
      template.htmlContentEn ?? template.htmlContent ?? "";
    const subjectEn = args.subject.trim();
    const now = Date.now();

    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    const campaignId = await ctx.db.insert("newsletterCampaigns", {
      name: args.name,
      subject: subjectEn,
      subjectEn: subjectEn,
      templateName: args.templateName,
      description: args.description,
      htmlBodySnapshot: htmlEn,
      htmlBodySnapshotEn: htmlEn,
      htmlSnapshotTakenAt: now,
      enContentUpdatedAt: now,
      targetTags: args.targetTags || [],
      targetSource: args.targetSource,
      status: "draft",
      testMode: args.testMode ?? false,
      createdBy: admin._id,
      createdAt: now,
    });

    console.log(`[Newsletter] Campaign created: ${args.name} (${campaignId})`);
    return { success: true, campaignId };
  },
});

/**
 * Get all campaigns (admin only)
 */
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const getAllCampaigns = query({
  args: {
    status: v.optional(v.union(
      v.literal("draft"),
      v.literal("review"),
      v.literal("ready"),
      v.literal("scheduled"),
      v.literal("sending"),
      v.literal("sent"),
      v.literal("cancelled")
    )),
  },
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);
    if (!admin) throw new Error("Unauthorized - Admin access required");

    return args.status
      ? await ctx.db
          .query("newsletterCampaigns")
          // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
          .withIndex("by_status", (q) => q.eq("status", args.status!))
          .order("desc")
          .collect()
      : await ctx.db.query("newsletterCampaigns").order("desc").collect();
  },
});

/**
 * Get campaign by ID (admin only)
 */
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const getCampaignById = query({
  args: { campaignId: v.id("newsletterCampaigns") },
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);
    if (!admin) throw new Error("Unauthorized - Admin access required");

    return await ctx.db.get(args.campaignId);
  },
});

/**
 * Update campaign (admin only)
 */
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const updateCampaign = mutation({
  args: {
    campaignId: v.id("newsletterCampaigns"),
    name: v.optional(v.string()),
    subject: v.optional(v.string()),
    subjectEn: v.optional(v.string()),
    subjectDe: v.optional(v.string()),
    templateName: v.optional(v.string()),
    description: v.optional(v.string()),
    descriptionDe: v.optional(v.string()),
    htmlBodySnapshotEn: v.optional(v.string()),
    htmlBodySnapshotDe: v.optional(v.string()),
    status: v.optional(
      v.union(v.literal("draft"), v.literal("review"), v.literal("ready"))
    ),
    targetTags: v.optional(v.array(v.string())),
    targetSource: v.optional(v.union(v.literal("waitlist"), v.literal("user"), v.literal("all"))),
    testMode: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);
    if (!admin) throw new Error("Unauthorized - Admin access required");

    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) throw new Error("Campaign not found");

    // @ts-ignore TS2339
    const st = campaign.status;
    if (!PRE_SEND_EDITABLE.has(st)) {
      throw new Error("Campaign content is read-only after send or while sending");
    }

    if (args.status !== undefined) {
      if (!PRE_SEND_EDITABLE.has(args.status)) {
        throw new Error("Invalid status transition");
      }
    }

    const now = Date.now();
    const updates: Record<string, unknown> = {};

    if (args.name !== undefined) updates.name = args.name;
    if (args.templateName !== undefined) updates.templateName = args.templateName;
    if (args.description !== undefined) updates.description = args.description;
    if (args.descriptionDe !== undefined) updates.descriptionDe = args.descriptionDe;
    if (args.targetTags !== undefined) updates.targetTags = args.targetTags;
    if (args.targetSource !== undefined) updates.targetSource = args.targetSource;
    if (args.testMode !== undefined) updates.testMode = args.testMode;
    if (args.status !== undefined) updates.status = args.status;

    if (args.subjectEn !== undefined) {
      const s = args.subjectEn.trim();
      updates.subjectEn = s;
      updates.subject = s;
    } else if (args.subject !== undefined) {
      const s = args.subject.trim();
      updates.subject = s;
      updates.subjectEn = s;
    }

    if (args.subjectDe !== undefined) {
      updates.subjectDe = args.subjectDe;
    }

    if (args.htmlBodySnapshotEn !== undefined) {
      updates.htmlBodySnapshotEn = args.htmlBodySnapshotEn;
      updates.htmlBodySnapshot = args.htmlBodySnapshotEn;
      updates.enContentUpdatedAt = now;
    }

    if (args.htmlBodySnapshotDe !== undefined) {
      updates.htmlBodySnapshotDe = args.htmlBodySnapshotDe;
      updates.deContentUpdatedAt = now;
    }

    await ctx.db.patch(args.campaignId, updates);

    return { success: true };
  },
});

/**
 * Delete campaign (admin only)
 */
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const deleteCampaign = mutation({
  args: { campaignId: v.id("newsletterCampaigns") },
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);
    if (!admin) throw new Error("Unauthorized - Admin access required");

    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) throw new Error("Campaign not found");

    // @ts-ignore TS2339 TS2589 – Convex schema depth limit (50 tables)
    if (campaign.status === "sending") {
      throw new Error("Cannot delete campaign while sending");
    }

    await ctx.db.delete(args.campaignId);

    return { success: true };
  },
});

const NEWSLETTER_TRANSLATE_LANG_NAMES: Record<string, string> = {
  de: "German (de-DE)",
};

// @ts-ignore TS2589 – Convex schema depth limit (50 tables)
export const internalSaveNewsletterDeTranslation = internalMutation({
  args: {
    campaignId: v.id("newsletterCampaigns"),
    subjectDe: v.string(),
    htmlBodySnapshotDe: v.string(),
    descriptionDe: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.campaignId, {
      subjectDe: args.subjectDe,
      htmlBodySnapshotDe: args.htmlBodySnapshotDe,
      ...(args.descriptionDe !== undefined ? { descriptionDe: args.descriptionDe } : {}),
      deContentUpdatedAt: now,
    });
  },
});

/**
 * AI translate EN → DE for a newsletter campaign (superadmin).
 */
// @ts-ignore TS2589 – Convex schema depth limit (50 tables)
export const translateNewsletterCampaign = action({
  args: {
    campaignId: v.id("newsletterCampaigns"),
    preferredProvider: v.optional(v.union(v.literal("gemini"), v.literal("openai"))),
  },
  handler: async (ctx, args) => {
    const superadmin = await getSuperadminUser(ctx);
    if (!superadmin) throw new Error("Superadmin access required");

    const campaign = await ctx.runQuery(internal.newsletter.internalGetCampaign, {
      campaignId: args.campaignId,
    });
    if (!campaign) throw new Error("Campaign not found");
    // @ts-ignore TS2339
    if (!PRE_SEND_EDITABLE.has(campaign.status)) {
      throw new Error("Cannot translate a campaign that is not editable");
    }

    // @ts-ignore TS2339
    const subjectEn = (campaign.subjectEn ?? campaign.subject ?? "").trim();
    // @ts-ignore TS2339
    const htmlEn = (campaign.htmlBodySnapshotEn ?? campaign.htmlBodySnapshot ?? "").trim();
    // @ts-ignore TS2339
    const descriptionEn = campaign.description ?? "";

    if (!subjectEn || !htmlEn) {
      throw new Error("English subject and HTML body are required for translation.");
    }

    const sourceVars = new Set([
      ...extractVariablesFromContent(subjectEn),
      ...extractVariablesFromContent(htmlEn),
    ]);

    const targetLanguage = "de" as const;
    const langName = NEWSLETTER_TRANSLATE_LANG_NAMES[targetLanguage] || targetLanguage;

    const system = [
      "You are a translation engine.",
      `Translate the provided newsletter campaign from English to ${langName}.`,
      "Preserve ALL placeholder variables in double curly braces exactly (e.g. {{USER_NAME}}, {{EMAIL_SIGNATURE}}). Do not translate, rename, add, or remove placeholders.",
      "Preserve HTML tags, inline CSS, and formatting as much as possible.",
      "Return ONLY valid JSON with keys: subjectTranslation, htmlContentTranslation, descriptionTranslation.",
    ].join("\n");

    const user = [
      "Subject (EN):",
      subjectEn,
      "",
      "HTML (EN):",
      htmlEn,
      "",
      "Internal description (EN):",
      descriptionEn,
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

    let parsed: unknown;
    try {
      parsed = JSON.parse(ai.raw);
    } catch {
      throw new Error("AI returned invalid JSON.");
    }

    const p = parsed as Record<string, unknown>;
    const subjectTranslation =
      typeof p.subjectTranslation === "string" ? p.subjectTranslation : "";
    const htmlContentTranslation =
      typeof p.htmlContentTranslation === "string" ? p.htmlContentTranslation : "";
    const descriptionTranslation =
      typeof p.descriptionTranslation === "string" ? p.descriptionTranslation : "";

    if (!subjectTranslation || !htmlContentTranslation) {
      throw new Error("AI returned empty translation fields.");
    }

    const targetVars = [
      ...extractVariablesFromContent(subjectTranslation),
      ...extractVariablesFromContent(htmlContentTranslation),
    ];
    const { missing, added } = diffNewsletterVariables(
      Array.from(sourceVars),
      targetVars
    );
    const warnings: string[] = [];
    if (missing.length) {
      warnings.push(`Missing placeholders in DE output: ${missing.join(", ")}`);
    }
    if (added.length) {
      warnings.push(`New placeholders in DE output: ${added.join(", ")}`);
    }

    await ctx.runMutation(internal.newsletter.internalSaveNewsletterDeTranslation, {
      campaignId: args.campaignId,
      subjectDe: subjectTranslation,
      htmlBodySnapshotDe: htmlContentTranslation,
      descriptionDe: descriptionTranslation || undefined,
    });

    return {
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

/**
 * Send a test preview of a campaign to the calling superadmin's email.
 * Does NOT affect campaign status or create email logs.
 */
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const sendCampaignTestEmail = action({
  args: {
    campaignId: v.id("newsletterCampaigns"),
    /** "en" | "de" – which language version to send */
    locale: v.optional(v.union(v.literal("en"), v.literal("de"))),
  },
  handler: async (ctx, args): Promise<{ success: boolean; sentTo: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const adminUser = (await ctx.runQuery(internal.users.internalGetUserByClerkId, {
      clerkId: identity.subject,
    })) as Doc<"users"> | null;
    if (!adminUser || (adminUser.role !== "admin" && adminUser.role !== "superadmin")) {
      throw new Error("Unauthorized – Admin access required");
    }

    const toEmail = adminUser.email;
    if (!toEmail) throw new Error("Admin account has no email address");

    const campaign = (await ctx.runQuery(internal.newsletter.internalGetCampaign, {
      campaignId: args.campaignId,
    })) as Doc<"newsletterCampaigns"> | null;
    if (!campaign) throw new Error("Campaign not found");

    const locale = args.locale ?? "en";
    // @ts-ignore TS2339
    const hasDe = !!(campaign.htmlBodySnapshotDe && String(campaign.htmlBodySnapshotDe).trim());
    const useDe = locale === "de" && hasDe;

    // @ts-ignore TS2339
    let html: string = useDe
      ? campaign.htmlBodySnapshotDe!
      : (campaign.htmlBodySnapshotEn ?? campaign.htmlBodySnapshot ?? "");
    // @ts-ignore TS2339
    let subject: string = useDe
      ? (campaign.subjectDe ?? campaign.subjectEn ?? campaign.subject ?? "")
      : (campaign.subjectEn ?? campaign.subject ?? "");

    if (!html.trim()) throw new Error("Campaign has no HTML body. Save content before sending a test.");

    const signatureHtml = await ctx.runQuery(internal.newsletter.internalGetMarketingSignatureHtml, {
      locale: useDe ? "de" : "en",
    });
    if (signatureHtml) {
      const sigRe = /\{\{EMAIL_SIGNATURE\}\}/g;
      html = html.replace(sigRe, signatureHtml);
      subject = subject.replace(sigRe, "");
    }

    const baseUrl = process.env.VITE_APP_URL || "https://learn-with.me";
    const testVars: Record<string, string> = {
      USER_NAME: adminUser.name || "Admin",
      USER_EMAIL: toEmail,
      UNSUBSCRIBE_LINK: `${baseUrl}/newsletter/unsubscribe?token=TEST-TOKEN`,
    };
    for (const [key, value] of Object.entries(testVars)) {
      const re = new RegExp(`\\{\\{${key}\\}\\}`, "g");
      html = html.replace(re, value);
      subject = subject.replace(re, value);
    }

    if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "noreply@mail.jacksenn.me";

    const { error } = await resend.emails.send({
      from: `Serbian AI Tutor <${FROM_EMAIL}>`,
      to: toEmail,
      subject: `[TEST] ${subject}`,
      html,
    });

    if (error) throw new Error(`Resend error: ${error.message || JSON.stringify(error)}`);

    console.log(`[Newsletter] Test email sent to ${toEmail} for campaign "${campaign.name}"`);
    return { success: true, sentTo: toEmail };
  },
});

/** Admin: Convex Storage upload URL for inline newsletter images. */
// @ts-ignore TS2589 – Convex schema depth limit (50 tables)
export const generateNewsletterImageUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const admin = await getAdminUser(ctx);
    if (!admin) throw new Error("Unauthorized - Admin access required");
    return await ctx.storage.generateUploadUrl();
  },
});

// @ts-ignore TS2589 – Convex schema depth limit (50 tables)
export const getNewsletterImagePublicUrl = query({
  args: { storageId: v.string() },
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);
    if (!admin) throw new Error("Unauthorized - Admin access required");
    return await ctx.storage.getUrl(args.storageId);
  },
});

/**
 * Internal: sync preferredLocale on a newsletter contact when a user changes
 * their learningLanguage in the app (called from users.updateLearningLanguage).
 * "es" / "fr" and other unsupported languages fall back to EN.
 */
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const internalSyncUserLocale = internalMutation({
  args: {
    email: v.string(),
    learningLanguage: v.string(),
  },
  handler: async (ctx, args) => {
    const preferredLocale: "en" | "de" =
      args.learningLanguage === "de" ? "de" : "en";

    const contact = await ctx.db
      .query("newsletterContacts")
      // @ts-ignore TS2589
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!contact) return;
    if (contact.preferredLocale === preferredLocale) return;

    await ctx.db.patch(contact._id, {
      preferredLocale,
      updatedAt: Date.now(),
    });
    console.log(`[Newsletter] preferredLocale updated for ${args.email} → ${preferredLocale}`);
  },
});

/** Update contact preferred locale for newsletter language (admin). */
// @ts-ignore TS2589 – Convex schema depth limit (50 tables)
export const updateContactPreferredLocale = mutation({
  args: {
    contactId: v.id("newsletterContacts"),
    preferredLocale: v.union(v.literal("en"), v.literal("de")),
  },
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);
    if (!admin) throw new Error("Unauthorized - Admin access required");

    const contact = await ctx.db.get(args.contactId);
    if (!contact) throw new Error("Contact not found");

    await ctx.db.patch(args.contactId, {
      preferredLocale: args.preferredLocale,
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

// ============= CAMPAIGN SENDING =============

/**
 * Send campaign (admin only)
 * Creates email logs and schedules batch sending
 */
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const sendCampaign = mutation({
  args: {
    campaignId: v.id("newsletterCampaigns"),
  },
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);
    if (!admin) throw new Error("Unauthorized - Admin access required");

    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) throw new Error("Campaign not found");

    // @ts-ignore TS2339
    const cst = campaign.status;
    if (cst !== "ready" && cst !== "scheduled") {
      // @ts-ignore TS2339
      throw new Error(`Campaign must be Ready (or Scheduled) to send; current status: "${campaign.status}"`);
    }

    // @ts-ignore TS2339
    const htmlEn =
      campaign.htmlBodySnapshotEn ?? campaign.htmlBodySnapshot ?? "";
    if (!htmlEn.trim()) {
      throw new Error("Campaign has no English HTML body. Save content before sending.");
    }

    // Get target contacts
    let contacts = await ctx.db
      .query("newsletterContacts")
      // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
      .withIndex("by_subscribed", (q) => q.eq("subscribed", true))
      .collect();

    const environment = getEnvironment();

    // Filter by environment (dev only sends to dev contacts)
    contacts = contacts.filter(c => c.environment === environment);

    // Filter by target tags
    // @ts-ignore TS2339 TS2589 – Convex schema depth limit (50 tables)
    if (campaign.targetTags.length > 0) {
      contacts = contacts.filter(contact =>
        // @ts-ignore TS2339 TS2589 – Convex schema depth limit (50 tables)
        campaign.targetTags.some(tag => contact.tags.includes(tag))
      );
    }

    // Filter by target source
    // @ts-ignore TS2339 TS2589 – Convex schema depth limit (50 tables)
    if (campaign.targetSource && campaign.targetSource !== "all") {
      // @ts-ignore TS2339 TS2589 – Convex schema depth limit (50 tables)
      contacts = contacts.filter(c => c.source === campaign.targetSource);
    }

    // Test mode: Filter by whitelist
    // @ts-ignore TS2339 TS2589 – Convex schema depth limit (50 tables)
    if (campaign.testMode || process.env.NEWSLETTER_TEST_MODE === "true") {
      const whitelist = (process.env.NEWSLETTER_WHITELIST || "").split(",").map(e => e.trim());
      if (whitelist.length > 0) {
        contacts = contacts.filter(c => whitelist.includes(c.email));
        console.log(`[Newsletter] TEST MODE: Sending only to whitelist (${contacts.length} contacts)`);
      }
    }

    if (contacts.length === 0) {
      throw new Error("No contacts match the campaign criteria");
    }

    // @ts-ignore TS2339 TS2589 – Convex schema depth limit (50 tables)
    console.log(`[Newsletter] Preparing to send campaign "${campaign.name}" to ${contacts.length} contacts`);

    // Update campaign status
    await ctx.db.patch(args.campaignId, {
      status: "sending",
      totalRecipients: contacts.length,
      sentCount: 0,
    });

    // Create email logs for all recipients
    const emailLogIds: Id<"newsletterEmailLogs">[] = [];
    for (const contact of contacts) {
      const emailLogId = await ctx.db.insert("newsletterEmailLogs", {
        campaignId: args.campaignId,
        contactId: contact._id,
        email: contact.email,
        status: "pending",
        openedCount: 0,
        clickedCount: 0,
        clickedLinks: [],
        retryCount: 0,
      });
      emailLogIds.push(emailLogId);
    }

    // Schedule batch sending (max 50 emails per batch)
    const BATCH_SIZE = 50;
    for (let i = 0; i < emailLogIds.length; i += BATCH_SIZE) {
      const batch = emailLogIds.slice(i, i + BATCH_SIZE);
      // Schedule with delay to respect rate limits (100 emails/minute = ~1.7 emails/second)
      const delayMs = Math.floor(i / BATCH_SIZE) * 30000; // 30 seconds between batches
      await ctx.scheduler.runAfter(delayMs, internal.newsletter.sendEmailBatch, {
        campaignId: args.campaignId,
        emailLogIds: batch,
      });
    }

    console.log(`[Newsletter] Scheduled ${Math.ceil(emailLogIds.length / BATCH_SIZE)} batches`);

    return {
      success: true,
      totalRecipients: contacts.length,
      batches: Math.ceil(emailLogIds.length / BATCH_SIZE),
    };
  },
});

/**
 * Send email batch (internal action)
 * Processes a batch of emails and sends them via Resend
 */
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const sendEmailBatch = internalAction({
  args: {
    campaignId: v.id("newsletterCampaigns"),
    emailLogIds: v.array(v.id("newsletterEmailLogs")),
  },
  handler: async (ctx, args) => {
    const campaign = await ctx.runQuery(internal.newsletter.internalGetCampaign, {
      campaignId: args.campaignId,
    });

    if (!campaign) {
      console.error(`[Newsletter] Campaign ${args.campaignId} not found`);
      return;
    }

    const template = await ctx.runQuery(internal.emailTemplates.internalGetByName, {
      name: campaign.templateName,
    });

    if (!process.env.RESEND_API_KEY) {
      console.error("[Newsletter] RESEND_API_KEY not configured");
      return;
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "noreply@mail.jacksenn.me";
    const baseUrl = process.env.VITE_APP_URL || "https://learn-with.me";
    // Convex HTTP actions are served from the `*.convex.site` domain.
    // We prefer CONVEX_SITE_URL when available, otherwise derive it from CONVEX_CLOUD_URL.
    const oneClickBaseUrl =
      (process.env.CONVEX_SITE_URL || "").trim() ||
      (process.env.CONVEX_CLOUD_URL || "").trim().replace(/\\.convex\\.cloud\\b/g, ".convex.site") ||
      baseUrl;

    let successCount = 0;
    let errorCount = 0;

    for (const emailLogId of args.emailLogIds) {
      try {
        const emailLog = await ctx.runQuery(internal.newsletter.internalGetEmailLog, {
          emailLogId,
        });

        if (!emailLog) {
          console.error(`[Newsletter] Email log ${emailLogId} not found`);
          continue;
        }

        const contact = await ctx.runQuery(internal.newsletter.internalGetContact, {
          contactId: emailLog.contactId,
        });

        if (!contact) {
          console.error(`[Newsletter] Contact ${emailLog.contactId} not found`);
          continue;
        }

        // @ts-ignore TS2339
        const prefersDe = contact.preferredLocale === "de";
        // @ts-ignore TS2339
        const hasDe =
          !!(campaign.htmlBodySnapshotDe && String(campaign.htmlBodySnapshotDe).trim()) &&
          !!(campaign.subjectDe && String(campaign.subjectDe).trim());
        const useDe = prefersDe && hasDe;
        if (prefersDe && !hasDe) {
          console.warn(
            `[Newsletter] Contact ${contact.email} prefers DE but campaign has no DE body; sending EN`
          );
        }

        // @ts-ignore TS2339
        let html =
          useDe && campaign.htmlBodySnapshotDe
            ? campaign.htmlBodySnapshotDe
            : (campaign.htmlBodySnapshotEn ?? campaign.htmlBodySnapshot ?? "");
        // @ts-ignore TS2339
        let subject = useDe
          ? (campaign.subjectDe ?? campaign.subjectEn ?? campaign.subject)
          : (campaign.subjectEn ?? campaign.subject);

        if (!html.trim() && template) {
          // @ts-ignore TS2339
          html = template.htmlContentEn ?? template.htmlContent ?? "";
        }
        if (!subject.trim()) {
          // @ts-ignore TS2339
          subject = campaign.subjectEn ?? campaign.subject;
        }

        const signatureHtml = await ctx.runQuery(internal.newsletter.internalGetMarketingSignatureHtml, {
          locale: useDe ? "de" : "en",
        });
        if (signatureHtml && (html.includes("{{EMAIL_SIGNATURE}}") || subject.includes("{{EMAIL_SIGNATURE}}"))) {
          const sigRe = /\{\{EMAIL_SIGNATURE\}\}/g;
          html = html.replace(sigRe, signatureHtml);
          subject = subject.replace(sigRe, signatureHtml);
        }

        const variables: Record<string, string | number> = {
          USER_NAME: contact.name || "there",
          USER_EMAIL: contact.email,
          UNSUBSCRIBE_LINK: `${baseUrl}/newsletter/unsubscribe?token=${contact.unsubscribeToken}`,
        };

        for (const [key, value] of Object.entries(variables)) {
          const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
          html = html.replace(regex, String(value));
          subject = subject.replace(regex, String(value));
        }

        if (!html.trim()) {
          console.error(`[Newsletter] No HTML body for ${contact.email}, skipping`);
          await ctx.runMutation(internal.newsletter.updateEmailLogStatus, {
            emailLogId,
            status: "failed",
            lastError: "Empty HTML body",
            retryCount: (emailLog.retryCount || 0) + 1,
          });
          errorCount++;
          continue;
        }

        // Transform links for tracking (lazy)
        html = await transformLinksInHtml(html, args.campaignId, contact._id, emailLogId, baseUrl);

        // Send email via Resend
        const oneClickUnsubscribeUrl = `${oneClickBaseUrl.replace(/\/$/, "")}/newsletter/unsubscribe?token=${contact.unsubscribeToken}`;
        const { data, error } = await resend.emails.send({
          from: `Serbian AI Tutor <${FROM_EMAIL}>`,
          to: contact.email,
          subject: subject,
          html: html,
          headers: {
            // One-click unsubscribe must hit a server endpoint (email clients won't execute JS).
            // Vercel rewrites all non-/api routes to the SPA, so we point this to Convex HTTP Actions.
            "List-Unsubscribe": `<${oneClickUnsubscribeUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        });

        if (error) {
          console.error(`[Newsletter] Failed to send to ${contact.email}:`, error);
          await ctx.runMutation(internal.newsletter.updateEmailLogStatus, {
            emailLogId,
            status: "failed",
            lastError: error.message || JSON.stringify(error),
            retryCount: (emailLog.retryCount || 0) + 1,
          });
          errorCount++;
          continue;
        }

        // Update email log with success
        await ctx.runMutation(internal.newsletter.updateEmailLogStatus, {
          emailLogId,
          status: "sent",
          resendMessageId: data?.id,
          sentAt: Date.now(),
        });

        // Update campaign sent count
        await ctx.runMutation(internal.newsletter.incrementCampaignSentCount, {
          campaignId: args.campaignId,
        });

        successCount++;
        console.log(`[Newsletter] ✅ Sent to ${contact.email} (${data?.id})`);

      } catch (error: any) {
        console.error(`[Newsletter] Exception sending email:`, error);
        errorCount++;
      }
    }

    console.log(`[Newsletter] Batch complete: ${successCount} sent, ${errorCount} failed`);

    // Check if campaign is complete
    await ctx.runMutation(internal.newsletter.checkCampaignComplete, {
      campaignId: args.campaignId,
    });

    return { successCount, errorCount };
  },
});

/**
 * Transform links in HTML for tracking
 */
function transformLinksInHtml(
  html: string,
  campaignId: Id<"newsletterCampaigns">,
  contactId: Id<"newsletterContacts">,
  emailLogId: Id<"newsletterEmailLogs">,
  baseUrl: string
): string {
  // Simple regex to find <a href="..."> links
  const linkRegex = /<a\s+href=["']([^"']+)["']([^>]*)>/gi;
  
  return html.replace(linkRegex, (match, url, rest) => {
    // Skip unsubscribe links and already tracked links
    if (url.includes("/newsletter/unsubscribe") || url.includes("/newsletter/track/")) {
      return match;
    }

    // Generate tracking token
    const trackingToken = crypto.randomUUID();
    const trackingUrl = `${baseUrl}/newsletter/track/${trackingToken}`;

    // Note: We'll create the link click entry when the link is actually clicked
    // This is "lazy" tracking to avoid creating thousands of unused entries

    return `<a href="${trackingUrl}" data-original-url="${url}" data-campaign="${campaignId}" data-contact="${contactId}" data-email-log="${emailLogId}"${rest}>`;
  });
}

// ============= INTERNAL QUERIES/MUTATIONS =============

// @ts-ignore TS2589 – Convex schema depth limit (50 tables)
export const internalGetMarketingSignatureHtml = internalQuery({
  args: { locale: v.union(v.literal("en"), v.literal("de")) },
  handler: async (ctx, args) => {
    const sig = await ctx.db
      .query("emailSignatures")
      .withIndex("by_category", (q) => q.eq("category", "marketing"))
      .first();
    if (!sig?.isActive) return "";
    if (args.locale === "de") {
      return sig.htmlContentDe ?? sig.htmlContentEn ?? sig.htmlContent ?? "";
    }
    return sig.htmlContentEn ?? sig.htmlContent ?? "";
  },
});

// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const internalGetCampaign = internalQuery({
  args: { campaignId: v.id("newsletterCampaigns") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.campaignId);
  },
});

// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const internalGetEmailLog = internalQuery({
  args: { emailLogId: v.id("newsletterEmailLogs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.emailLogId);
  },
});

// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const internalGetContact = internalQuery({
  args: { contactId: v.id("newsletterContacts") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.contactId);
  },
});

// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const updateEmailLogStatus = internalMutation({
  args: {
    emailLogId: v.id("newsletterEmailLogs"),
    status: v.union(
      v.literal("pending"),
      v.literal("sent"),
      v.literal("delivered"),
      v.literal("opened"),
      v.literal("clicked"),
      v.literal("bounced"),
      v.literal("failed")
    ),
    resendMessageId: v.optional(v.string()),
    sentAt: v.optional(v.number()),
    deliveredAt: v.optional(v.number()),
    openedAt: v.optional(v.number()),
    openedCount: v.optional(v.number()),
    clickedAt: v.optional(v.number()),
    clickedCount: v.optional(v.number()),
    lastError: v.optional(v.string()),
    retryCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { emailLogId, ...updates } = args;
    await ctx.db.patch(emailLogId, updates);
  },
});

// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const incrementCampaignSentCount = internalMutation({
  args: { campaignId: v.id("newsletterCampaigns") },
  handler: async (ctx, args) => {
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) return;

    await ctx.db.patch(args.campaignId, {
      // @ts-ignore TS2339 TS2589 – Convex schema depth limit (50 tables)
      sentCount: (campaign.sentCount || 0) + 1,
    });
  },
});

// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const checkCampaignComplete = internalMutation({
  args: { campaignId: v.id("newsletterCampaigns") },
  handler: async (ctx, args) => {
    const campaign = await ctx.db.get(args.campaignId);
    // @ts-ignore TS2339 TS2589 – Convex schema depth limit (50 tables)
    if (!campaign || campaign.status !== "sending") return;

    // Check if all emails have been processed
    const emailLogs = await ctx.db
      .query("newsletterEmailLogs")
      .withIndex("by_campaign", (q) => q.eq("campaignId", args.campaignId))
      .collect();

    const pending = emailLogs.filter(log => log.status === "pending").length;

    if (pending === 0) {
      // Campaign complete
      await ctx.db.patch(args.campaignId, {
        status: "sent",
        sentAt: Date.now(),
      });
      // @ts-ignore TS2339 TS2589 – Convex schema depth limit (50 tables)
      console.log(`[Newsletter] Campaign ${campaign.name} completed`);
    }
  },
});

// ============= LINK TRACKING =============

/**
 * Get link click by tracking token (public for redirect)
 */
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const getLinkClickByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("newsletterLinkClicks")
      // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
      .withIndex("by_tracking_token", (q) => q.eq("trackingToken", args.token))
      .first();
  },
});

/**
 * Record link click
 */
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const recordLinkClick = mutation({
  args: {
    linkClickId: v.id("newsletterLinkClicks"),
    userAgent: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    referer: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const linkClick = await ctx.db.get(args.linkClickId);
    if (!linkClick) throw new Error("Link click not found");

    // Update link click record
    await ctx.db.patch(args.linkClickId, {
      clickedAt: Date.now(),
      userAgent: args.userAgent,
      ipAddress: args.ipAddress,
      referer: args.referer,
    });

    // Update email log
    // @ts-ignore TS2339 TS2589 – Convex schema depth limit (50 tables)
    const emailLog = await ctx.db.get(linkClick.emailLogId);
    if (emailLog) {
      // @ts-ignore TS2339 TS2589 – Convex schema depth limit (50 tables)
      const clickedLinks = Array.from(new Set([...emailLog.clickedLinks, linkClick.originalUrl]));
      
      // @ts-ignore TS2339 TS2589 – Convex schema depth limit (50 tables)
      await ctx.db.patch(linkClick.emailLogId, {
        status: "clicked",
        // @ts-ignore TS2339 TS2589 – Convex schema depth limit (50 tables)
        clickedAt: emailLog.clickedAt || Date.now(),
        // @ts-ignore TS2339 TS2589 – Convex schema depth limit (50 tables)
        clickedCount: emailLog.clickedCount + 1,
        clickedLinks,
        lastClickedAt: Date.now(),
      });

      // Update campaign stats
      // @ts-ignore TS2339 TS2589 – Convex schema depth limit (50 tables)
      const campaign = await ctx.db.get(emailLog.campaignId);
      if (campaign) {
        // @ts-ignore TS2339 TS2589 – Convex schema depth limit (50 tables)
        await ctx.db.patch(emailLog.campaignId, {
          // @ts-ignore TS2339 TS2589 – Convex schema depth limit (50 tables)
          clickedCount: (campaign.clickedCount || 0) + 1,
        });
      }
    }

    // @ts-ignore TS2339 TS2589 – Convex schema depth limit (50 tables)
    console.log(`[Newsletter] Link clicked: ${linkClick.originalUrl}`);
    return { success: true };
  },
});

/**
 * Create link click entry (called during email send)
 */
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const createLinkClick = internalMutation({
  args: {
    campaignId: v.id("newsletterCampaigns"),
    contactId: v.id("newsletterContacts"),
    emailLogId: v.id("newsletterEmailLogs"),
    originalUrl: v.string(),
    trackingToken: v.string(),
    linkLabel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    return await ctx.db.insert("newsletterLinkClicks", {
      campaignId: args.campaignId,
      contactId: args.contactId,
      emailLogId: args.emailLogId,
      originalUrl: args.originalUrl,
      trackingToken: args.trackingToken,
      linkLabel: args.linkLabel,
      clickedAt: 0, // Not clicked yet
    });
  },
});

// ============= WEBHOOK HELPERS =============

/**
 * Get email log by Resend message ID (for webhooks)
 */
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const getEmailLogByResendId = query({
  args: { resendMessageId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("newsletterEmailLogs")
      // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
      .withIndex("by_resend_message_id", (q) => q.eq("resendMessageId", args.resendMessageId))
      .first();
  },
});

/**
 * Update email log from webhook
 */
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const updateEmailLogFromWebhook = mutation({
  args: {
    emailLogId: v.id("newsletterEmailLogs"),
    status: v.optional(v.union(
      v.literal("pending"),
      v.literal("sent"),
      v.literal("delivered"),
      v.literal("opened"),
      v.literal("clicked"),
      v.literal("bounced"),
      v.literal("failed")
    )),
    deliveredAt: v.optional(v.number()),
    openedAt: v.optional(v.number()),
    openedCount: v.optional(v.number()),
    lastOpenedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { emailLogId, ...updates } = args;
    const emailLog = await ctx.db.get(emailLogId);
    if (!emailLog) return;

    await ctx.db.patch(emailLogId, updates);

    // Update campaign stats
    // @ts-ignore TS2339 TS2589 – Convex schema depth limit (50 tables)
    const campaign = await ctx.db.get(emailLog.campaignId);
    if (!campaign) return;

    const campaignUpdates: any = {};

    if (updates.status === "delivered") {
      // @ts-ignore TS2339 TS2589 – Convex schema depth limit (50 tables)
      campaignUpdates.deliveredCount = (campaign.deliveredCount || 0) + 1;
    } else if (updates.status === "opened") {
      // @ts-ignore TS2339 TS2589 – Convex schema depth limit (50 tables)
      campaignUpdates.openedCount = (campaign.openedCount || 0) + 1;
    } else if (updates.status === "bounced") {
      // @ts-ignore TS2339 TS2589 – Convex schema depth limit (50 tables)
      campaignUpdates.bouncedCount = (campaign.bouncedCount || 0) + 1;
    }

    if (Object.keys(campaignUpdates).length > 0) {
      // @ts-ignore TS2339 TS2589 – Convex schema depth limit (50 tables)
      await ctx.db.patch(emailLog.campaignId, campaignUpdates);
    }
  },
});

// ============= ANALYTICS & REPORTING =============

/**
 * Get campaign statistics (admin only)
 */
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const getCampaignStats = query({
  args: { campaignId: v.id("newsletterCampaigns") },
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);
    if (!admin) throw new Error("Unauthorized - Admin access required");

    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) throw new Error("Campaign not found");

    // Get email logs for detailed stats
    const emailLogs = await ctx.db
      .query("newsletterEmailLogs")
      // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
      .withIndex("by_campaign", (q) => q.eq("campaignId", args.campaignId))
      .collect();

    const stats = {
      total: emailLogs.length,
      // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
      pending: emailLogs.filter(e => e.status === "pending").length,
      sent: emailLogs.filter(e => e.status === "sent" || e.status === "delivered" || e.status === "opened" || e.status === "clicked").length,
      delivered: emailLogs.filter(e => e.status === "delivered" || e.status === "opened" || e.status === "clicked").length,
      opened: emailLogs.filter(e => e.status === "opened" || e.status === "clicked").length,
      clicked: emailLogs.filter(e => e.status === "clicked").length,
      bounced: emailLogs.filter(e => e.status === "bounced").length,
      failed: emailLogs.filter(e => e.status === "failed").length,
    };

    const openRate = stats.delivered > 0 ? ((stats.opened / stats.delivered) * 100).toFixed(2) : "0.00";
    const clickRate = stats.delivered > 0 ? ((stats.clicked / stats.delivered) * 100).toFixed(2) : "0.00";
    const clickToOpenRate = stats.opened > 0 ? ((stats.clicked / stats.opened) * 100).toFixed(2) : "0.00";
    const bounceRate = stats.sent > 0 ? ((stats.bounced / stats.sent) * 100).toFixed(2) : "0.00";

    return {
      ...stats,
      openRate: `${openRate}%`,
      clickRate: `${clickRate}%`,
      clickToOpenRate: `${clickToOpenRate}%`,
      bounceRate: `${bounceRate}%`,
      campaign: {
        // @ts-ignore TS2339 TS2589 – Convex schema depth limit (50 tables)
        name: campaign.name,
        // @ts-ignore TS2339 TS2589 – Convex schema depth limit (50 tables)
        subject: campaign.subject,
        // @ts-ignore TS2339 TS2589 – Convex schema depth limit (50 tables)
        status: campaign.status,
        // @ts-ignore TS2339 TS2589 – Convex schema depth limit (50 tables)
        createdAt: campaign.createdAt,
        // @ts-ignore TS2339 TS2589 – Convex schema depth limit (50 tables)
        sentAt: campaign.sentAt,
      },
    };
  },
});

// ============= MIGRATION HELPERS =============

/**
 * Run initial migration (Admin Action)
 * Migrates all confirmed waitlist entries to newsletter contacts
 */
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const runInitialMigration = action({
  args: {
    adminSecret: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify admin access via ADMIN_SECRET
    const ADMIN_SECRET = process.env.ADMIN_SECRET;
    if (!ADMIN_SECRET || args.adminSecret !== ADMIN_SECRET) {
      throw new Error("Unauthorized - Invalid admin secret");
    }

    console.log("[Newsletter Migration] Starting initial migration...");

    // Get all waitlist entries
    const waitlistEntries = (await ctx.runQuery(internal.waitlist.internalGetAll)) as any[];
    const confirmedEntries = waitlistEntries.filter((entry: any) => entry.status === "confirmed");

    console.log(`[Newsletter Migration] Found ${confirmedEntries.length} confirmed waitlist entries`);

    let syncedCount = 0;
    let skippedCount = 0;

    for (const entry of confirmedEntries) {
      try {
        await ctx.runMutation(internal.newsletter.syncWaitlistToNewsletter, {
          waitlistId: entry._id,
        });
        syncedCount++;
      } catch (error: any) {
        console.error(`[Newsletter Migration] Failed to sync ${entry.email}:`, error.message);
        skippedCount++;
      }
    }

    // Get stats (using internal version to avoid auth check)
    const stats = (await ctx.runQuery(internal.newsletter.internalGetNewsletterStats)) as Awaited<
      ReturnType<typeof computeNewsletterStats>
    >;

    return {
      success: true,
      totalWaitlist: confirmedEntries.length,
      synced: syncedCount,
      skipped: skippedCount,
      stats,
    };
  },
});

/**
 * Admin action: backfill preferredLocale for all existing newsletterContacts
 * that have source="user" but no preferredLocale (or an outdated one).
 *
 * Looks up each contact's email in the users table and maps
 * learningLanguage → preferredLocale (de→de, everything else→en).
 *
 * Idempotent: contacts that already have the correct value are skipped.
 */
// @ts-ignore TS2589 – Convex schema depth limit
export const adminBackfillNewsletterLocales = action({
  args: {
    adminSecret: v.string(),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    total: number;
    updated: number;
    skipped: number;
    noUser: number;
  }> => {
    const expectedSecret = process.env.ADMIN_SECRET;
    if (!expectedSecret || args.adminSecret !== expectedSecret) {
      throw new Error("Unauthorized");
    }

    const result = await ctx.runMutation(
      internal.newsletter.internalBackfillLocales,
      { dryRun: args.dryRun ?? false }
    );
    return result;
  },
});

// @ts-ignore TS2589 – Convex schema depth limit
export const internalBackfillLocales = internalMutation({
  args: { dryRun: v.boolean() },
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    total: number;
    updated: number;
    skipped: number;
    noUser: number;
  }> => {
    // @ts-ignore TS2589
    const contacts = await ctx.db.query("newsletterContacts").collect();

    let updated = 0;
    let skipped = 0;
    let noUser = 0;

    for (const contact of contacts) {
      // Find the linked user by email
      // @ts-ignore TS2589
      const user = await ctx.db
        .query("users")
        .withIndex("by_email", (q: any) => q.eq("email", contact.email))
        .first();

      if (!user) {
        noUser++;
        continue;
      }

      const desired: "en" | "de" =
        (user as any).learningLanguage === "de" ? "de" : "en";

      if (contact.preferredLocale === desired) {
        skipped++;
        continue;
      }

      if (!args.dryRun) {
        await ctx.db.patch(contact._id, {
          preferredLocale: desired,
          updatedAt: Date.now(),
        });
      }

      updated++;
      console.log(
        `[Backfill] ${args.dryRun ? "[DRY-RUN] " : ""}${contact.email}: ${contact.preferredLocale ?? "unset"} → ${desired}`
      );
    }

    return {
      success: true,
      total: contacts.length,
      updated,
      skipped,
      noUser,
    };
  },
});
