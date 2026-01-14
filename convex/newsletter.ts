import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery, internalAction, action, QueryCtx, MutationCtx, ActionCtx } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { Resend } from "resend";

// ============= HELPER FUNCTIONS =============

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
export const syncWaitlistToNewsletter = internalMutation({
  args: {
    waitlistId: v.id("waitlist"),
  },
  handler: async (ctx, args) => {
    const waitlistEntry = await ctx.db.get(args.waitlistId);
    if (!waitlistEntry || waitlistEntry.status !== "confirmed") {
      console.log("[Newsletter] Waitlist entry not confirmed, skipping sync");
      return null;
    }

    // Check if already exists
    const existing = await ctx.db
      .query("newsletterContacts")
      .withIndex("by_email", (q) => q.eq("email", waitlistEntry.email))
      .first();

    const environment = getEnvironment();

    if (existing) {
      // Always keep the contact in sync with the waitlist source, but DO NOT auto-subscribe.
      // Subscribing to marketing updates requires explicit double opt-in.
      const hasConfirmedOptIn = !!existing.optInConfirmedAt;
      await ctx.db.patch(existing._id, {
        sourceId: args.waitlistId,
        source: "waitlist",
        name: waitlistEntry.name || existing.name,
        tags: Array.from(new Set([...(existing.tags || []), "waitlist"])),
        environment,
        // Safety migration: historical data might have subscribed=true from the old implementation.
        // Only keep subscribed=true if the user has a confirmed double opt-in.
        subscribed: hasConfirmedOptIn ? existing.subscribed : false,
        subscribedAt: hasConfirmedOptIn ? existing.subscribedAt : undefined,
        updatedAt: Date.now(),
      });
      console.log(`[Newsletter] Synced existing contact from waitlist (no auto-subscribe): ${waitlistEntry.email}`);
      return existing._id;
    }

    // Create new contact
    const unsubscribeToken = crypto.randomUUID();
    const contactId = await ctx.db.insert("newsletterContacts", {
      email: waitlistEntry.email,
      name: waitlistEntry.name,
      source: "waitlist",
      sourceId: args.waitlistId,
      subscribed: false,
      subscribedAt: undefined,
      unsubscribeToken,
      tags: ["waitlist"],
      environment,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    console.log(`[Newsletter] Created new contact from waitlist: ${waitlistEntry.email}`);
    return contactId;
  },
});

/**
 * Sync User to Newsletter Contacts
 * Called automatically after user registration
 */
export const syncUserToNewsletter = internalMutation({
  args: {
    userId: v.id("users"),
    autoSubscribe: v.optional(v.boolean()), // Default: false (Opt-In required)
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || !user.email) {
      console.log("[Newsletter] User not found or no email, skipping sync");
      return null;
    }

    const existing = await ctx.db
      .query("newsletterContacts")
      .withIndex("by_email", (q) => q.eq("email", user.email!))
      .first();

    const environment = getEnvironment();
    const userTags = ["user"];
    if (user.isBetaTester) {
      userTags.push("beta-user");
    }

    if (existing) {
      // Update existing contact with user reference
      await ctx.db.patch(existing._id, {
        sourceId: args.userId,
        source: "user",
        name: user.name || existing.name,
        tags: Array.from(new Set([...(existing.tags || []), ...userTags])),
        environment,
        updatedAt: Date.now(),
      });
      console.log(`[Newsletter] Updated existing contact with user reference: ${user.email}`);
      return existing._id;
    }

    // Create contact record for the user (not subscribed by default).
    // Subscribing to marketing/community updates requires explicit double opt-in.

    const unsubscribeToken = crypto.randomUUID();
    const contactId = await ctx.db.insert("newsletterContacts", {
      email: user.email,
      name: user.name,
      source: "user",
      sourceId: args.userId,
      subscribed: args.autoSubscribe === true,
      subscribedAt: args.autoSubscribe === true ? Date.now() : undefined,
      unsubscribeToken,
      tags: userTags,
      environment,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

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

export const requestWaitlistUpdatesDoubleOptIn = internalMutation({
  args: {
    waitlistId: v.id("waitlist"),
  },
  handler: async (ctx, args) => {
    const waitlistEntry = await ctx.db.get(args.waitlistId);
    if (!waitlistEntry || waitlistEntry.status !== "confirmed") {
      console.log("[Newsletter DOI] Waitlist entry not confirmed, skipping DOI request");
      return { success: false, reason: "not_confirmed" as const };
    }
    if (!waitlistEntry.wantsWaitlistUpdates) {
      return { success: false, reason: "not_requested" as const };
    }

    // Ensure contact exists (not subscribed by default)
    const contactId =
      (await ctx.runMutation(internal.newsletter.syncWaitlistToNewsletter, { waitlistId: args.waitlistId })) ??
      null;
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

    // Ensure contact exists
    const contactId =
      (await ctx.runMutation(internal.newsletter.syncUserToNewsletter, { userId: user._id, autoSubscribe: false })) ??
      null;
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

export const confirmDoubleOptIn = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const contact = await ctx.db
      .query("newsletterContacts")
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
export const getAllContacts = query({
  args: {
    subscribed: v.optional(v.boolean()),
    source: v.optional(v.union(v.literal("waitlist"), v.literal("user"), v.literal("manual"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);
    if (!admin) throw new Error("Unauthorized - Admin access required");

    let query = ctx.db.query("newsletterContacts");

    if (args.subscribed !== undefined) {
      query = query.withIndex("by_subscribed", (q) => q.eq("subscribed", args.subscribed!));
    }

    let contacts = await query.collect();

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
 * Get contact by email
 */
export const getContactByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);
    if (!admin) throw new Error("Unauthorized - Admin access required");

    return await ctx.db
      .query("newsletterContacts")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
  },
});

/**
 * Get contact by unsubscribe token (public for unsubscribe page)
 */
export const getContactByUnsubscribeToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("newsletterContacts")
      .withIndex("by_unsubscribe_token", (q) => q.eq("unsubscribeToken", args.token))
      .first();
  },
});

/**
 * Unsubscribe contact
 */
export const unsubscribeContact = mutation({
  args: { contactId: v.id("newsletterContacts") },
  handler: async (ctx, args) => {
    const contact = await ctx.db.get(args.contactId);
    if (!contact) throw new Error("Contact not found");

    if (!contact.subscribed) {
      return { success: true, message: "Already unsubscribed" };
    }

    await ctx.db.patch(args.contactId, {
      subscribed: false,
      unsubscribedAt: Date.now(),
      updatedAt: Date.now(),
    });

    console.log(`[Newsletter] Contact unsubscribed: ${contact.email}`);
    return { success: true, message: "Successfully unsubscribed" };
  },
});

/**
 * Manually add contact (admin only)
 */
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
 * Update contact tags (admin only)
 */
export const updateContactTags = mutation({
  args: {
    contactId: v.id("newsletterContacts"),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);
    if (!admin) throw new Error("Unauthorized - Admin access required");

    await ctx.db.patch(args.contactId, {
      tags: args.tags,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Internal query to get newsletter statistics (no auth check)
 */
export const internalGetNewsletterStats = internalQuery({
  handler: async (ctx) => {
    const allContacts = await ctx.db.query("newsletterContacts").collect();
    const allCampaigns = await ctx.db.query("newsletterCampaigns").collect();

    const subscribed = allContacts.filter(c => c.subscribed).length;
    const unsubscribed = allContacts.filter(c => !c.subscribed).length;
    const fromWaitlist = allContacts.filter(c => c.source === "waitlist").length;
    const fromUsers = allContacts.filter(c => c.source === "user").length;
    const manual = allContacts.filter(c => c.source === "manual").length;

    const draftCampaigns = allCampaigns.filter(c => c.status === "draft").length;
    const sentCampaigns = allCampaigns.filter(c => c.status === "sent").length;

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
  },
});

/**
 * Get newsletter statistics (admin only, public API)
 */
export const getNewsletterStats = query({
  handler: async (ctx) => {
    const admin = await getAdminUser(ctx);
    if (!admin) throw new Error("Unauthorized - Admin access required");

    return await ctx.runQuery(internal.newsletter.internalGetNewsletterStats);
  },
});

// ============= CAMPAIGN MANAGEMENT =============

/**
 * Create new campaign (admin only)
 */
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

    const campaignId = await ctx.db.insert("newsletterCampaigns", {
      name: args.name,
      subject: args.subject,
      templateName: args.templateName,
      description: args.description,
      targetTags: args.targetTags || [],
      targetSource: args.targetSource,
      status: "draft",
      testMode: args.testMode ?? false,
      createdBy: admin._id,
      createdAt: Date.now(),
    });

    console.log(`[Newsletter] Campaign created: ${args.name} (${campaignId})`);
    return { success: true, campaignId };
  },
});

/**
 * Get all campaigns (admin only)
 */
export const getAllCampaigns = query({
  args: {
    status: v.optional(v.union(
      v.literal("draft"),
      v.literal("scheduled"),
      v.literal("sending"),
      v.literal("sent"),
      v.literal("cancelled")
    )),
  },
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);
    if (!admin) throw new Error("Unauthorized - Admin access required");

    let query = ctx.db.query("newsletterCampaigns");

    if (args.status) {
      query = query.withIndex("by_status", (q) => q.eq("status", args.status!));
    }

    return await query.order("desc").collect();
  },
});

/**
 * Get campaign by ID (admin only)
 */
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
export const updateCampaign = mutation({
  args: {
    campaignId: v.id("newsletterCampaigns"),
    name: v.optional(v.string()),
    subject: v.optional(v.string()),
    templateName: v.optional(v.string()),
    description: v.optional(v.string()),
    targetTags: v.optional(v.array(v.string())),
    targetSource: v.optional(v.union(v.literal("waitlist"), v.literal("user"), v.literal("all"))),
    testMode: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);
    if (!admin) throw new Error("Unauthorized - Admin access required");

    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) throw new Error("Campaign not found");

    if (campaign.status !== "draft") {
      throw new Error("Can only update draft campaigns");
    }

    const updates: any = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.subject !== undefined) updates.subject = args.subject;
    if (args.templateName !== undefined) updates.templateName = args.templateName;
    if (args.description !== undefined) updates.description = args.description;
    if (args.targetTags !== undefined) updates.targetTags = args.targetTags;
    if (args.targetSource !== undefined) updates.targetSource = args.targetSource;
    if (args.testMode !== undefined) updates.testMode = args.testMode;

    await ctx.db.patch(args.campaignId, updates);

    return { success: true };
  },
});

/**
 * Delete campaign (admin only)
 */
export const deleteCampaign = mutation({
  args: { campaignId: v.id("newsletterCampaigns") },
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);
    if (!admin) throw new Error("Unauthorized - Admin access required");

    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) throw new Error("Campaign not found");

    if (campaign.status === "sending") {
      throw new Error("Cannot delete campaign while sending");
    }

    await ctx.db.delete(args.campaignId);

    return { success: true };
  },
});

// ============= CAMPAIGN SENDING =============

/**
 * Send campaign (admin only)
 * Creates email logs and schedules batch sending
 */
export const sendCampaign = mutation({
  args: {
    campaignId: v.id("newsletterCampaigns"),
  },
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);
    if (!admin) throw new Error("Unauthorized - Admin access required");

    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) throw new Error("Campaign not found");

    if (campaign.status !== "draft" && campaign.status !== "scheduled") {
      throw new Error(`Campaign status is "${campaign.status}", cannot send`);
    }

    // Get target contacts
    let contacts = await ctx.db
      .query("newsletterContacts")
      .withIndex("by_subscribed", (q) => q.eq("subscribed", true))
      .collect();

    const environment = getEnvironment();

    // Filter by environment (dev only sends to dev contacts)
    contacts = contacts.filter(c => c.environment === environment);

    // Filter by target tags
    if (campaign.targetTags.length > 0) {
      contacts = contacts.filter(contact =>
        campaign.targetTags.some(tag => contact.tags.includes(tag))
      );
    }

    // Filter by target source
    if (campaign.targetSource && campaign.targetSource !== "all") {
      contacts = contacts.filter(c => c.source === campaign.targetSource);
    }

    // Test mode: Filter by whitelist
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

    const template = await ctx.runQuery(api.emailTemplates.getByName, {
      name: campaign.templateName,
    });

    if (!template) {
      console.error(`[Newsletter] Template "${campaign.templateName}" not found`);
      return;
    }

    if (!process.env.RESEND_API_KEY) {
      console.error("[Newsletter] RESEND_API_KEY not configured");
      return;
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "noreply@mail.jacksenn.me";
    const baseUrl = process.env.VITE_APP_URL || "https://learn-with.me";

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

        // Render template with variables
        const variables: Record<string, string | number> = {
          USER_NAME: contact.name || "there",
          USER_EMAIL: contact.email,
          UNSUBSCRIBE_LINK: `${baseUrl}/newsletter/unsubscribe?token=${contact.unsubscribeToken}`,
        };

        let html = template.htmlContent;
        let subject = campaign.subject;

        for (const [key, value] of Object.entries(variables)) {
          const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
          html = html.replace(regex, String(value));
          subject = subject.replace(regex, String(value));
        }

        // Transform links for tracking (lazy)
        html = await transformLinksInHtml(html, args.campaignId, contact._id, emailLogId, baseUrl);

        // Send email via Resend
        const { data, error } = await resend.emails.send({
          from: `Serbian AI Tutor <${FROM_EMAIL}>`,
          to: contact.email,
          subject: subject,
          html: html,
          headers: {
            "List-Unsubscribe": `<${baseUrl}/newsletter/unsubscribe?token=${contact.unsubscribeToken}>`,
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

export const internalGetCampaign = internalQuery({
  args: { campaignId: v.id("newsletterCampaigns") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.campaignId);
  },
});

export const internalGetEmailLog = internalQuery({
  args: { emailLogId: v.id("newsletterEmailLogs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.emailLogId);
  },
});

export const internalGetContact = internalQuery({
  args: { contactId: v.id("newsletterContacts") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.contactId);
  },
});

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

export const incrementCampaignSentCount = internalMutation({
  args: { campaignId: v.id("newsletterCampaigns") },
  handler: async (ctx, args) => {
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) return;

    await ctx.db.patch(args.campaignId, {
      sentCount: (campaign.sentCount || 0) + 1,
    });
  },
});

export const checkCampaignComplete = internalMutation({
  args: { campaignId: v.id("newsletterCampaigns") },
  handler: async (ctx, args) => {
    const campaign = await ctx.db.get(args.campaignId);
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
      console.log(`[Newsletter] Campaign ${campaign.name} completed`);
    }
  },
});

// ============= LINK TRACKING =============

/**
 * Get link click by tracking token (public for redirect)
 */
export const getLinkClickByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("newsletterLinkClicks")
      .withIndex("by_tracking_token", (q) => q.eq("trackingToken", args.token))
      .first();
  },
});

/**
 * Record link click
 */
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
    const emailLog = await ctx.db.get(linkClick.emailLogId);
    if (emailLog) {
      const clickedLinks = Array.from(new Set([...emailLog.clickedLinks, linkClick.originalUrl]));
      
      await ctx.db.patch(linkClick.emailLogId, {
        status: "clicked",
        clickedAt: emailLog.clickedAt || Date.now(),
        clickedCount: emailLog.clickedCount + 1,
        clickedLinks,
        lastClickedAt: Date.now(),
      });

      // Update campaign stats
      const campaign = await ctx.db.get(emailLog.campaignId);
      if (campaign) {
        await ctx.db.patch(emailLog.campaignId, {
          clickedCount: (campaign.clickedCount || 0) + 1,
        });
      }
    }

    console.log(`[Newsletter] Link clicked: ${linkClick.originalUrl}`);
    return { success: true };
  },
});

/**
 * Create link click entry (called during email send)
 */
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

/**
 * Get link click stats for campaign (admin only)
 */
export const getLinkClickStats = query({
  args: { campaignId: v.id("newsletterCampaigns") },
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);
    if (!admin) throw new Error("Unauthorized - Admin access required");

    const linkClicks = await ctx.db
      .query("newsletterLinkClicks")
      .withIndex("by_campaign", (q) => q.eq("campaignId", args.campaignId))
      .collect();

    // Group by original URL
    const urlStats = new Map<string, { url: string; clicks: number; uniqueContacts: Set<string> }>();

    for (const click of linkClicks) {
      if (click.clickedAt === 0) continue; // Not clicked yet

      const key = click.originalUrl;
      if (!urlStats.has(key)) {
        urlStats.set(key, {
          url: key,
          clicks: 0,
          uniqueContacts: new Set(),
        });
      }

      const stat = urlStats.get(key)!;
      stat.clicks++;
      stat.uniqueContacts.add(click.contactId);
    }

    // Convert to array and sort by clicks
    const stats = Array.from(urlStats.values())
      .map(stat => ({
        url: stat.url,
        clicks: stat.clicks,
        uniqueContacts: stat.uniqueContacts.size,
      }))
      .sort((a, b) => b.clicks - a.clicks);

    return stats;
  },
});

// ============= WEBHOOK HELPERS =============

/**
 * Get email log by Resend message ID (for webhooks)
 */
export const getEmailLogByResendId = query({
  args: { resendMessageId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("newsletterEmailLogs")
      .withIndex("by_resend_message_id", (q) => q.eq("resendMessageId", args.resendMessageId))
      .first();
  },
});

/**
 * Update email log from webhook
 */
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
    const campaign = await ctx.db.get(emailLog.campaignId);
    if (!campaign) return;

    const campaignUpdates: any = {};

    if (updates.status === "delivered") {
      campaignUpdates.deliveredCount = (campaign.deliveredCount || 0) + 1;
    } else if (updates.status === "opened") {
      campaignUpdates.openedCount = (campaign.openedCount || 0) + 1;
    } else if (updates.status === "bounced") {
      campaignUpdates.bouncedCount = (campaign.bouncedCount || 0) + 1;
    }

    if (Object.keys(campaignUpdates).length > 0) {
      await ctx.db.patch(emailLog.campaignId, campaignUpdates);
    }
  },
});

// ============= ANALYTICS & REPORTING =============

/**
 * Get campaign statistics (admin only)
 */
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
      .withIndex("by_campaign", (q) => q.eq("campaignId", args.campaignId))
      .collect();

    const stats = {
      total: emailLogs.length,
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
        name: campaign.name,
        subject: campaign.subject,
        status: campaign.status,
        createdAt: campaign.createdAt,
        sentAt: campaign.sentAt,
      },
    };
  },
});

/**
 * Get contact engagement history (admin only)
 */
export const getContactEngagement = query({
  args: { contactId: v.id("newsletterContacts") },
  handler: async (ctx, args) => {
    const admin = await getAdminUser(ctx);
    if (!admin) throw new Error("Unauthorized - Admin access required");

    const contact = await ctx.db.get(args.contactId);
    if (!contact) throw new Error("Contact not found");

    // Get all email logs for this contact
    const emailLogs = await ctx.db
      .query("newsletterEmailLogs")
      .withIndex("by_contact", (q) => q.eq("contactId", args.contactId))
      .collect();

    const totalEmails = emailLogs.length;
    const opened = emailLogs.filter(e => e.status === "opened" || e.status === "clicked").length;
    const clicked = emailLogs.filter(e => e.status === "clicked").length;
    const bounced = emailLogs.filter(e => e.status === "bounced").length;

    const openRate = totalEmails > 0 ? ((opened / totalEmails) * 100).toFixed(2) : "0.00";
    const clickRate = totalEmails > 0 ? ((clicked / totalEmails) * 100).toFixed(2) : "0.00";

    // Get last interaction
    const lastInteraction = emailLogs
      .filter(e => e.lastOpenedAt || e.lastClickedAt)
      .sort((a, b) => {
        const aTime = Math.max(a.lastOpenedAt || 0, a.lastClickedAt || 0);
        const bTime = Math.max(b.lastOpenedAt || 0, b.lastClickedAt || 0);
        return bTime - aTime;
      })[0];

    return {
      contact: {
        email: contact.email,
        name: contact.name,
        subscribed: contact.subscribed,
        source: contact.source,
        tags: contact.tags,
      },
      stats: {
        totalEmails,
        opened,
        clicked,
        bounced,
        openRate: `${openRate}%`,
        clickRate: `${clickRate}%`,
      },
      lastInteraction: lastInteraction ? {
        campaignId: lastInteraction.campaignId,
        timestamp: Math.max(lastInteraction.lastOpenedAt || 0, lastInteraction.lastClickedAt || 0),
      } : null,
    };
  },
});

/**
 * Get newsletter metrics overview (admin only)
 */
export const getNewsletterMetrics = query({
  handler: async (ctx) => {
    const admin = await getAdminUser(ctx);
    if (!admin) throw new Error("Unauthorized - Admin access required");

    const allContacts = await ctx.db.query("newsletterContacts").collect();
    const allCampaigns = await ctx.db.query("newsletterCampaigns").collect();
    const allEmailLogs = await ctx.db.query("newsletterEmailLogs").collect();

    // Last 30 days
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const recentEmailLogs = allEmailLogs.filter(log => (log.sentAt || 0) >= thirtyDaysAgo);

    const recentSent = recentEmailLogs.length;
    const recentOpened = recentEmailLogs.filter(e => e.status === "opened" || e.status === "clicked").length;
    const recentClicked = recentEmailLogs.filter(e => e.status === "clicked").length;
    const recentBounced = recentEmailLogs.filter(e => e.status === "bounced").length;

    const openRate = recentSent > 0 ? ((recentOpened / recentSent) * 100).toFixed(2) : "0.00";
    const clickRate = recentSent > 0 ? ((recentClicked / recentSent) * 100).toFixed(2) : "0.00";
    const bounceRate = recentSent > 0 ? ((recentBounced / recentSent) * 100).toFixed(2) : "0.00";

    return {
      contacts: {
        total: allContacts.length,
        subscribed: allContacts.filter(c => c.subscribed).length,
        unsubscribed: allContacts.filter(c => !c.subscribed).length,
      },
      campaigns: {
        total: allCampaigns.length,
        draft: allCampaigns.filter(c => c.status === "draft").length,
        sent: allCampaigns.filter(c => c.status === "sent").length,
      },
      last30Days: {
        emailsSent: recentSent,
        openRate: `${openRate}%`,
        clickRate: `${clickRate}%`,
        bounceRate: `${bounceRate}%`,
      },
    };
  },
});

// ============= MIGRATION HELPERS =============

/**
 * Run initial migration (Admin Action)
 * Migrates all confirmed waitlist entries to newsletter contacts
 */
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
    const waitlistEntries = await ctx.runQuery(internal.waitlist.internalGetAll);
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
    const stats = await ctx.runQuery(internal.newsletter.internalGetNewsletterStats);

    return {
      success: true,
      totalWaitlist: confirmedEntries.length,
      synced: syncedCount,
      skipped: skippedCount,
      stats,
    };
  },
});
