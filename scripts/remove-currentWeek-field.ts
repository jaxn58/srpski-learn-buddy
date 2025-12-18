/**
 * Migration Script: Remove currentWeek field from userProgress
 * 
 * This script removes the deprecated currentWeek field from all userProgress documents
 * in the Production database before deploying the updated schema.
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

const PROD_URL = process.env.VITE_CONVEX_URL_PRODUCTION || process.env.VITE_CONVEX_URL;

if (!PROD_URL) {
  console.error("❌ Error: VITE_CONVEX_URL_PRODUCTION not found in .env.local");
  console.error("Please set VITE_CONVEX_URL_PRODUCTION to your production Convex URL");
  process.exit(1);
}

const prodClient = new ConvexHttpClient(PROD_URL);

async function removeCurrentWeekField() {
  console.log("============================================================");
  console.log("🔄 Migration: Remove currentWeek from userProgress");
  console.log("============================================================");
  console.log("");
  console.log(`📡 Connected to: ${PROD_URL}`);
  console.log("");

  try {
    // Get all userProgress documents
    console.log("📊 Fetching all userProgress documents...");
    const allProgress = await prodClient.query(api.admin.getAllUserProgressTemp);
    
    console.log(`📦 Found ${allProgress.length} userProgress documents`);
    console.log("");

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const progress of allProgress) {
      try {
        // Check if currentWeek exists
        if ('currentWeek' in progress) {
          console.log(`🔄 Removing currentWeek from userProgress for user: ${progress.userId}`);
          
          // Update the document without currentWeek
          await prodClient.mutation(api.admin.removeCurrentWeekFromProgress, {
            progressId: progress._id,
          });
          
          updated++;
          console.log(`   ✅ Updated`);
        } else {
          skipped++;
          console.log(`⏭️  Skipped userProgress for user ${progress.userId} (no currentWeek field)`);
        }
      } catch (error) {
        errors++;
        console.error(`   ❌ Error updating userProgress for user ${progress.userId}:`, error);
      }
    }

    console.log("");
    console.log("============================================================");
    console.log("📊 MIGRATION SUMMARY");
    console.log("============================================================");
    console.log(`✅ Updated: ${updated} documents`);
    console.log(`⏭️  Skipped: ${skipped} documents`);
    console.log(`❌ Errors: ${errors} documents`);
    console.log(`📦 Total: ${allProgress.length} documents`);
    console.log("============================================================");
    console.log("");

    if (errors > 0) {
      console.log("⚠️  Some documents had errors. Please check the logs above.");
      process.exit(1);
    }

    console.log("✨ Migration completed successfully!");
    console.log("");
    console.log("📋 Next steps:");
    console.log("1. Deploy the updated schema to Production: npx convex deploy --yes");
    console.log("2. Verify the deployment in Convex Dashboard");
    console.log("");

  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

removeCurrentWeekField();
