/**
 * Sync Email Signatures to Production using ADMIN_SECRET
 * 
 * This script syncs email signatures from Development to Production.
 * Email signatures are category-based (transactional, subscription, marketing).
 * 
 * Usage: 
 *   pnpm exec tsx scripts/sync-email-signatures-prod.ts
 *   pnpm exec tsx scripts/sync-email-signatures-prod.ts --dry-run
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
  process.exit(1);
}

if (!PROD_URL) {
  console.error("❌ VITE_CONVEX_URL_PRODUCTION not found in .env.local");
  process.exit(1);
}

if (!ADMIN_SECRET) {
  console.error("❌ ADMIN_SECRET not found in .env.local");
  process.exit(1);
}

// Create Convex clients
const devClient = new ConvexHttpClient(DEV_URL);
const prodClient = new ConvexHttpClient(PROD_URL);

interface Signature {
  _id: string;
  _creationTime: number;
  category: "transactional" | "subscription" | "marketing";
  htmlContent: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

async function syncSignatures() {
  console.log("🚀 Email Signature Synchronization");
  console.log("=" .repeat(60));
  
  if (isDryRun) {
    console.log("🔍 DRY RUN MODE - No changes will be made");
    console.log("=" .repeat(60));
  }
  
  console.log(`\n📡 Development: ${DEV_URL}`);
  console.log(`📡 Production:  ${PROD_URL}`);
  console.log(`🔑 Admin Secret: ${ADMIN_SECRET.substring(0, 4)}... (${ADMIN_SECRET.length} chars)\n`);

  try {
    // Step 1: Fetch signatures from Development
    console.log("📥 Fetching signatures from Development...");
    
    const devSignatures = await devClient.query(api.admin.adminGetAllEmailSignatures, {
      adminSecret: ADMIN_SECRET,
    }) as Signature[];
    
    console.log(`   ✅ Found ${devSignatures.length} signatures in Development\n`);

    if (devSignatures.length === 0) {
      console.log("⚠️  No signatures found in Development. Nothing to sync.");
      console.log("\n💡 Email signatures are optional. Templates have built-in signatures.");
      return;
    }

    // Display signatures
    console.log("📋 Signatures to sync:");
    devSignatures.forEach((s, i) => {
      console.log(`   ${i + 1}. ${s.category} (${s.isActive ? "active" : "inactive"})`);
    });
    console.log("");

    if (isDryRun) {
      console.log("🔍 DRY RUN completed. No changes were made.");
      return;
    }

    // Step 2: Sync signatures to Production
    console.log("🔄 Synchronizing signatures to Production...\n");

    let successCount = 0;
    let errorCount = 0;

    for (const signature of devSignatures) {
      try {
        console.log(`   📝 Syncing: ${signature.category}...`);

        await prodClient.mutation(api.admin.adminUpsertEmailSignature, {
          adminSecret: ADMIN_SECRET,
          category: signature.category,
          htmlContent: signature.htmlContent,
          isActive: signature.isActive,
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
      console.log("\n⚠️  Some signatures failed to sync.");
      process.exit(1);
    }

  } catch (error: any) {
    console.error("\n❌ Synchronization failed:", error.message);
    
    if (error.message.includes("Unauthorized") || error.message.includes("Invalid admin secret")) {
      console.error("\n💡 Make sure ADMIN_SECRET is correct in your .env.local file.");
    }
    
    if (error.message.includes("not found") || error.message.includes("Query")) {
      console.error("\n💡 The adminGetAllEmailSignatures function might not exist yet.");
      console.error("   This is normal if signatures aren't used in your system.");
    }
    
    process.exit(1);
  }
}

// Run synchronization
syncSignatures().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
