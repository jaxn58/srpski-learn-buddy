/**
 * Communication Tables
 *
 * Email templates, signatures, waitlist management,
 * and the full newsletter system (contacts, campaigns, logs, link tracking).
 */
import { defineTable } from "convex/server";
import { v } from "convex/values";

export const communicationTables = {
  // ============= EMAIL TEMPLATES =============
  emailTemplates: defineTable({
    name: v.string(), // e.g., "beta-registration", "user-activation", "feedback-confirmation"
    subject: v.string(), // Email subject line (can contain {{VARIABLES}})
    // Column-based multilanguage (preferred). Legacy `subject` remains as fallback.
    subjectEn: v.optional(v.string()),
    subjectDe: v.optional(v.string()),
    htmlContent: v.string(), // Full HTML template with {{VARIABLES}}
    // Column-based multilanguage (preferred). Legacy `htmlContent` remains as fallback.
    htmlContentEn: v.optional(v.string()),
    htmlContentDe: v.optional(v.string()),
    description: v.optional(v.string()), // What this template is for
    // Column-based multilanguage (preferred). Legacy `description` remains as fallback.
    descriptionEn: v.optional(v.string()),
    descriptionDe: v.optional(v.string()),
    variables: v.array(v.string()), // Available variables like ["USER_NAME", "PLAN_NAME"]
    isActive: v.boolean(), // Enable/disable template
    category: v.union(
      v.literal("transactional"), // Beta, feedback, activation
      v.literal("subscription"), // Welcome, expiration, upgrade
      v.literal("marketing") // Promotional emails
    ),
    // Staleness tracking: set independently when EN or DE content changes.
    // isDeOutdated = hasDE && enContentUpdatedAt > (deContentUpdatedAt ?? 0)
    enContentUpdatedAt: v.optional(v.number()),
    deContentUpdatedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_name", ["name"])
    .index("by_category", ["category"])
    .index("by_active", ["isActive"]),

  // ============= EMAIL SIGNATURES =============
  // One signature per category, injected via {{EMAIL_SIGNATURE}} placeholder.
  emailSignatures: defineTable({
    category: v.union(
      v.literal("transactional"),
      v.literal("subscription"),
      v.literal("marketing")
    ),
    htmlContent: v.string(),
    // Column-based multilanguage (preferred). Legacy `htmlContent` remains as fallback.
    htmlContentEn: v.optional(v.string()),
    htmlContentDe: v.optional(v.string()),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_category", ["category"])
    .index("by_active", ["isActive"]),

  // ============= WAITLIST =============
  waitlist: defineTable({
    email: v.string(),
    name: v.optional(v.string()),
    // Optional: user consent to receive interim waitlist stories/updates (double opt-in required)
    wantsWaitlistUpdates: v.optional(v.boolean()),
    // Language selected by the user on the landing page
    language: v.optional(v.union(v.literal("en"), v.literal("de"))),
    status: v.union(
      v.literal("pending"),      // Email versendet, wartet auf Bestätigung
      v.literal("confirmed"),     // User hat Opt-In bestätigt
      v.literal("notified")       // User wurde über Beta-Launch benachrichtigt
    ),
    confirmationToken: v.string(), // UUID für Bestätigungslink
    createdAt: v.number(),
    confirmedAt: v.optional(v.number()),
    notifiedAt: v.optional(v.number()),
    viewedByAdmin: v.optional(v.boolean()), // Tracking ob Admin die Einträge gesehen hat
    // Admin resend tracking (optional; used to prevent accidental spam)
    confirmationEmailLastSentAt: v.optional(v.number()),
    confirmationEmailSendCount: v.optional(v.number()),
  })
    .index("by_email", ["email"])
    .index("by_status", ["status"])
    .index("by_token", ["confirmationToken"])
    .index("by_status_viewed", ["status", "viewedByAdmin"]),

  // ============= NEWSLETTER SYSTEM =============

  // Newsletter Contacts - Zentrale Kontaktverwaltung
  newsletterContacts: defineTable({
    email: v.string(),
    name: v.optional(v.string()),

    // Source tracking
    source: v.union(
      v.literal("waitlist"),      // Von Waitlist synchronisiert
      v.literal("user"),          // Von registrierten Usern
      v.literal("manual")         // Manuell hinzugefügt
    ),
    sourceId: v.optional(v.union(
      v.id("waitlist"),
      v.id("users")
    )), // Referenz zur Quelle (optional für manuelle Einträge)

    // Subscription status
    subscribed: v.boolean(), // true = subscribed (marketing), false = not subscribed
    subscribedAt: v.optional(v.number()), // Timestamp der Anmeldung (only if subscribed)
    unsubscribedAt: v.optional(v.number()), // Timestamp der Abmeldung
    unsubscribeToken: v.string(), // UUID für Unsubscribe-Links

    // Double Opt-In (pending/confirm)
    optInToken: v.optional(v.string()),
    optInPurpose: v.optional(v.union(
      v.literal("waitlist_updates"),
      v.literal("community_updates")
    )),
    optInRequestedAt: v.optional(v.number()),
    optInConfirmedAt: v.optional(v.number()),

    // Segmentation
    tags: v.array(v.string()), // z.B. ["beta-user", "premium", "german"]

    // Environment safety
    environment: v.optional(v.union(
      v.literal("dev"),
      v.literal("prod")
    )),

    // DSGVO Compliance
    gdprConsent: v.optional(v.object({
      marketing: v.boolean(),
      tracking: v.boolean(),
      consentedAt: v.number()
    })),

    // Metadata
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_subscribed", ["subscribed"])
    .index("by_source", ["source"])
    .index("by_unsubscribe_token", ["unsubscribeToken"])
    .index("by_optin_token", ["optInToken"])
    .index("by_tags", ["tags"])
    .index("by_environment", ["environment"]),

  // Newsletter Campaigns - Campaign-Management
  newsletterCampaigns: defineTable({
    name: v.string(), // Campaign name (e.g., "Beta Launch Announcement")
    subject: v.string(), // Email subject line
    templateName: v.string(), // Reference to emailTemplates.name
    description: v.optional(v.string()),

    // Targeting
    targetTags: v.array(v.string()), // Nur Kontakte mit diesen Tags
    targetSource: v.optional(v.union(
      v.literal("waitlist"),
      v.literal("user"),
      v.literal("all")
    )),

    // Status
    status: v.union(
      v.literal("draft"),      // Entwurf
      v.literal("scheduled"),  // Geplant
      v.literal("sending"),    // Wird versendet
      v.literal("sent"),       // Versendet
      v.literal("cancelled")   // Abgebrochen
    ),

    // Test mode for DevOps safety
    testMode: v.boolean(), // Sendet nur an Whitelist

    // Scheduling
    scheduledFor: v.optional(v.number()), // Timestamp für geplante Versendung

    // Statistics (denormalized for performance)
    totalRecipients: v.optional(v.number()),
    sentCount: v.optional(v.number()),
    deliveredCount: v.optional(v.number()),
    openedCount: v.optional(v.number()),
    clickedCount: v.optional(v.number()),
    bouncedCount: v.optional(v.number()),
    unsubscribedCount: v.optional(v.number()),

    // Metadata
    createdBy: v.id("users"), // Admin who created campaign
    createdAt: v.number(),
    sentAt: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_created_by", ["createdBy"])
    .index("by_scheduled_for", ["scheduledFor"]),

  // Newsletter Email Logs - Detailliertes Email-Tracking
  newsletterEmailLogs: defineTable({
    campaignId: v.id("newsletterCampaigns"),
    contactId: v.id("newsletterContacts"),
    email: v.string(), // Denormalized for easier querying

    // Email status
    status: v.union(
      v.literal("pending"),    // In Queue
      v.literal("sent"),       // Versendet
      v.literal("delivered"),  // Zustellung bestätigt
      v.literal("opened"),     // Geöffnet
      v.literal("clicked"),    // Link geklickt
      v.literal("bounced"),    // Bounce
      v.literal("failed")      // Fehler
    ),

    // Resend API tracking
    resendMessageId: v.optional(v.string()), // Resend message ID für Webhooks

    // Retry tracking
    retryCount: v.optional(v.number()),
    lastError: v.optional(v.string()),

    // Engagement tracking
    openedAt: v.optional(v.number()), // Erste Öffnung
    openedCount: v.number(), // Anzahl Öffnungen
    clickedAt: v.optional(v.number()), // Erster Klick
    clickedCount: v.number(), // Anzahl Klicks
    clickedLinks: v.array(v.string()), // Array von geklickten URLs

    // Timestamps
    sentAt: v.optional(v.number()),
    deliveredAt: v.optional(v.number()),
    lastOpenedAt: v.optional(v.number()),
    lastClickedAt: v.optional(v.number()),
  })
    .index("by_campaign", ["campaignId"])
    .index("by_contact", ["contactId"])
    .index("by_email", ["email"])
    .index("by_status", ["status"])
    .index("by_resend_message_id", ["resendMessageId"]),

  // Newsletter Link Clicks - Link-Click-Tracking
  newsletterLinkClicks: defineTable({
    campaignId: v.id("newsletterCampaigns"),
    contactId: v.id("newsletterContacts"),
    emailLogId: v.id("newsletterEmailLogs"),

    // Link information
    originalUrl: v.string(), // Original URL die geklickt wurde
    trackingToken: v.string(), // Unique token für diesen Link-Klick
    linkLabel: v.optional(v.string()), // Optional: Label für Analytics (z.B. "CTA Button")

    // Click data
    clickedAt: v.number(), // 0 = noch nicht geklickt
    userAgent: v.optional(v.string()),
    ipAddress: v.optional(v.string()), // Nur mit DSGVO-Consent speichern
    referer: v.optional(v.string()),

    // Data retention
    dataRetentionDays: v.optional(v.number()), // Default: 90 Tage
  })
    .index("by_campaign", ["campaignId"])
    .index("by_contact", ["contactId"])
    .index("by_email_log", ["emailLogId"])
    .index("by_tracking_token", ["trackingToken"]),
};
