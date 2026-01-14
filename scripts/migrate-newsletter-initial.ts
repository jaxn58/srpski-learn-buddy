/**
 * Initial Newsletter Migration Script
 * 
 * Migrates existing waitlist entries and users to newsletterContacts table
 * 
 * Usage:
 *   # Dev
 *   tsx scripts/migrate-newsletter-initial.ts
 * 
 *   # Production
 *   VITE_CONVEX_URL=<prod-url> tsx scripts/migrate-newsletter-initial.ts
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

const CONVEX_URL = process.env.VITE_CONVEX_URL || process.env.VITE_CONVEX_URL_PRODUCTION;
const ADMIN_SECRET = process.env.ADMIN_SECRET;

if (!CONVEX_URL) {
  console.error("❌ Error: VITE_CONVEX_URL not found in environment");
  console.error("Please set VITE_CONVEX_URL in .env.local or pass VITE_CONVEX_URL as environment variable");
  process.exit(1);
}

if (!ADMIN_SECRET) {
  console.error("❌ Error: ADMIN_SECRET not found in environment");
  console.error("Please set ADMIN_SECRET in .env.local");
  process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);

const newsletterDoubleOptInTemplates = [
  {
    name: "newsletter-waitlist-updates-double-opt-in",
    subject: "Confirm Your Behind-the-Scenes Updates",
    description: "Double opt-in confirmation for waitlist behind-the-scenes updates (idea, story, progress).",
    category: "transactional" as const,
    htmlContent: `
<h1>Serbian AI Tutor</h1>
<h2>Confirm Your Updates Subscription</h2>

<p>Hi {{USER_NAME}},</p>

<p>Thanks for joining the waitlist! You asked to receive behind-the-scenes updates: the idea, the story, and progress toward the beta.</p>

<p><strong>Please confirm your subscription to these updates:</strong></p>

<p><a href="{{CONFIRM_LINK}}" style="display: inline-block; background-color: #C41E3A; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Confirm Updates</a></p>

<p>Or copy and paste this link into your browser:<br>
{{CONFIRM_LINK}}</p>

<p><small>{{BETA_LAUNCH_NOTE}}</small></p>

<p>You can unsubscribe anytime from any update email.</p>

<p>Best regards,<br>
<strong>The Serbian AI Tutor Team</strong></p>

<hr>
<p style="font-size: 12px; color: #666;">
© 2025 Serbian AI Tutor by jacksenn.me<br>
This email was sent to {{USER_EMAIL}}
</p>
`,
    variables: ["USER_NAME", "USER_EMAIL", "CONFIRM_LINK", "BETA_LAUNCH_NOTE"],
    isActive: true,
  },
  {
    name: "newsletter-community-updates-double-opt-in",
    subject: "Confirm Your Community Updates",
    description: "Double opt-in confirmation for product updates, community news, and learning tips.",
    category: "transactional" as const,
    htmlContent: `
<h1>Serbian AI Tutor</h1>
<h2>Confirm Your Subscription</h2>

<p>Hi {{USER_NAME}},</p>

<p>You requested product updates, community news, and learning tips.</p>

<p><strong>Please confirm your subscription:</strong></p>

<p><a href="{{CONFIRM_LINK}}" style="display: inline-block; background-color: #C41E3A; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Confirm Subscription</a></p>

<p>Or copy and paste this link into your browser:<br>
{{CONFIRM_LINK}}</p>

<p>You can unsubscribe anytime from any newsletter email.</p>

<p>Best regards,<br>
<strong>The Serbian AI Tutor Team</strong></p>

<hr>
<p style="font-size: 12px; color: #666;">
© 2025 Serbian AI Tutor by jacksenn.me<br>
This email was sent to {{USER_EMAIL}}
</p>
`,
    variables: ["USER_NAME", "USER_EMAIL", "CONFIRM_LINK"],
    isActive: true,
  },
] as const;

const defaultEmailSignatures = [
  {
    category: "transactional",
    htmlContent: `
<p style="font-size: 12px; color: #666;">
© 2026 Serbian AI Tutor by jacksenn.me<br>
This email was sent to {{USER_EMAIL}}
</p>
`,
    isActive: true,
  },
  {
    category: "subscription",
    htmlContent: `
<p style="font-size: 12px; color: #666;">
© 2026 Serbian AI Tutor by jacksenn.me<br>
This email was sent to {{USER_EMAIL}}
</p>
`,
    isActive: true,
  },
  {
    category: "marketing",
    htmlContent: `
<p style="font-size: 12px; color: #666;">
© 2026 Serbian AI Tutor by jacksenn.me<br>
This email was sent to {{USER_EMAIL}}.
</p>
`,
    isActive: true,
  },
] as const;

async function migrateNewsletterInitial() {
  console.log("🚀 Starting Newsletter Initial Migration");
  console.log(`📍 Target: ${CONVEX_URL}`);
  console.log("");

  try {
    // Run migration via Action (requires ADMIN_SECRET)
    console.log("📋 Running migration...");
    
    const result = await client.action(api.newsletter.runInitialMigration, {
      adminSecret: ADMIN_SECRET,
    });

    // Seed newsletter DOI templates (idempotent upsert)
    console.log("\n📋 Seeding newsletter double opt-in templates...");
    for (const tpl of newsletterDoubleOptInTemplates) {
      await client.mutation(api.admin.adminUpsertEmailTemplate, {
        adminSecret: ADMIN_SECRET,
        name: tpl.name,
        subject: tpl.subject,
        htmlContent: tpl.htmlContent.trim(),
        description: tpl.description,
        variables: [...tpl.variables],
        category: tpl.category,
        isActive: tpl.isActive,
      });
      console.log(`   ✅ Upserted template: ${tpl.name}`);
    }

    // Seed default email signatures (per category)
    console.log("\n📋 Seeding default email signatures...");
    for (const sig of defaultEmailSignatures) {
      await client.mutation(api.admin.adminUpsertEmailSignature, {
        adminSecret: ADMIN_SECRET,
        category: sig.category,
        htmlContent: sig.htmlContent.trim(),
        isActive: sig.isActive,
      });
      console.log(`   ✅ Upserted signature: ${sig.category}`);
    }
    
    console.log(`\n   ✅ Waitlist migration complete:`);
    console.log(`      Total confirmed: ${result.totalWaitlist}`);
    console.log(`      Synced: ${result.synced}`);
    console.log(`      Skipped: ${result.skipped}`);
    console.log("");

    // Step 2: User migration info
    console.log("📋 User Migration:");
    console.log("   ℹ️  User migration will happen automatically on next login");
    console.log("   ℹ️  Users need to opt-in to newsletter manually");
    console.log("");

    // Step 3: Show newsletter stats
    console.log("📊 Newsletter Statistics:");
    console.log(`   Total Contacts: ${result.stats.totalContacts}`);
    console.log(`   Subscribed: ${result.stats.subscribed}`);
    console.log(`   Unsubscribed: ${result.stats.unsubscribed}`);
    console.log(`   From Waitlist: ${result.stats.sources.waitlist}`);
    console.log(`   From Users: ${result.stats.sources.users}`);
    console.log(`   Manual: ${result.stats.sources.manual}`);
    console.log("");

    console.log("✅ Newsletter Initial Migration Complete!");
    console.log("");
    console.log("Next steps:");
    console.log("1. Verify contacts in Convex Dashboard");
    console.log("2. Create newsletter email templates");
    console.log("3. Create first campaign");
    
  } catch (error: any) {
    console.error("\n❌ Migration failed:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run migration
migrateNewsletterInitial()
  .then(() => {
    console.log("\n🎉 Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  });
