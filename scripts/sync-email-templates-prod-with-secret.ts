/**
 * Sync Email Templates to Production using ADMIN_SECRET
 * 
 * This script syncs email templates from Development to Production
 * using ADMIN_SECRET for authentication (no browser auth required).
 * 
 * Usage: 
 *   tsx scripts/sync-email-templates-prod-with-secret.ts
 *   tsx scripts/sync-email-templates-prod-with-secret.ts --dry-run
 * 
 * Required Environment Variables (.env.local):
 *   VITE_CONVEX_URL             - Development Convex deployment URL
 *   VITE_CONVEX_URL_PRODUCTION  - Production Convex deployment URL
 *   ADMIN_SECRET                - Admin secret for authentication
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { config } from "dotenv";

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");

// Load environment variables from .env.local
config({ path: ".env.local" });

const DEV_URL = process.env.VITE_CONVEX_URL;
const PROD_URL = process.env.VITE_CONVEX_URL_PRODUCTION || "https://fleet-labrador-324.convex.cloud";
const ADMIN_SECRET = process.env.ADMIN_SECRET;

// Validate environment variables
if (!DEV_URL) {
  console.error("❌ VITE_CONVEX_URL not found in .env.local");
  console.error("This should be your Development Convex URL");
  process.exit(1);
}

if (!PROD_URL) {
  console.error("❌ VITE_CONVEX_URL_PRODUCTION not found in .env.local");
  console.error("Please add your Production Convex URL to .env.local:");
  console.error("  VITE_CONVEX_URL_PRODUCTION=https://fleet-labrador-324.convex.cloud");
  process.exit(1);
}

if (!ADMIN_SECRET) {
  console.error("❌ ADMIN_SECRET not found in .env.local");
  console.error("Please set ADMIN_SECRET in your .env.local file");
  console.error("See docs/ADMIN_SECRET_SETUP.md for instructions");
  process.exit(1);
}

// Create Convex clients
const devClient = new ConvexHttpClient(DEV_URL);
const prodClient = new ConvexHttpClient(PROD_URL);

interface Template {
  _id: string;
  _creationTime: number;
  name: string;
  subject: string;
  htmlContent: string;
  description?: string;
  variables: string[];
  category: "transactional" | "subscription" | "marketing";
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

async function syncTemplates() {
  console.log("🚀 Email Template Synchronization (with ADMIN_SECRET)");
  console.log("=" .repeat(60));
  
  if (isDryRun) {
    console.log("🔍 DRY RUN MODE - No changes will be made");
    console.log("=" .repeat(60));
  }
  
  console.log(`\n📡 Development: ${DEV_URL}`);
  console.log(`📡 Production:  ${PROD_URL}`);
  console.log(`🔑 Admin Secret: ${ADMIN_SECRET.substring(0, 4)}... (${ADMIN_SECRET.length} chars)\n`);

  try {
    // Step 1: Fetch templates from Development
    console.log("📥 Fetching templates from Development...");
    
    // Use adminGetAllEmailTemplates which doesn't require browser auth
    const devTemplates = await devClient.query(api.admin.adminGetAllEmailTemplates, {
      adminSecret: ADMIN_SECRET,
    }) as Template[];
    
    console.log(`   ✅ Found ${devTemplates.length} templates in Development\n`);

    if (devTemplates.length === 0) {
      console.log("⚠️  No templates found in Development. Nothing to sync.");
      return;
    }

    // Display templates
    console.log("📋 Templates to sync:");
    devTemplates.forEach((t, i) => {
      console.log(`   ${i + 1}. ${t.name} (${t.category})`);
    });
    console.log("");

    if (isDryRun) {
      console.log("🔍 DRY RUN completed. No changes were made.");
      return;
    }

    // Step 2: Sync templates to Production
    console.log("🔄 Synchronizing templates to Production...\n");

    let successCount = 0;
    let errorCount = 0;

    for (const template of devTemplates) {
      try {
        console.log(`   📝 Syncing: ${template.name}...`);

        await prodClient.mutation(api.admin.adminUpsertEmailTemplate, {
          adminSecret: ADMIN_SECRET,
          name: template.name,
          subject: template.subject,
          htmlContent: template.htmlContent,
          description: template.description,
          variables: template.variables,
          category: template.category,
          isActive: template.isActive,
        });

        console.log(`      ✅ Success`);
        successCount++;
      } catch (error: any) {
        console.error(`      ❌ Failed: ${error.message}`);
        errorCount++;
      }
    }

    // Final summary
    console.log("\n" + "=" .repeat(60));
    console.log("✅ SYNCHRONIZATION COMPLETE");
    console.log("=" .repeat(60));
    console.log(`   Success: ${successCount}`);
    console.log(`   Errors:  ${errorCount}`);
    console.log("=" .repeat(60));

    if (errorCount > 0) {
      console.log("\n⚠️  Some templates failed to sync. Please check the errors above.");
      process.exit(1);
    }

  } catch (error: any) {
    console.error("\n❌ Synchronization failed:", error.message);
    
    if (error.message.includes("Unauthorized") || error.message.includes("Invalid admin secret")) {
      console.error("\n💡 Make sure ADMIN_SECRET is correct in your .env.local file.");
      console.error("   The secret must match the one set in Convex environment variables.");
    }
    
    process.exit(1);
  }
}

// Run synchronization
syncTemplates().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
