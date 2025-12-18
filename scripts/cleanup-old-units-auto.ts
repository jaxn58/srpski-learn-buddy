/**
 * Automatic Cleanup Script: Remove old Units 7-27 (NO CONFIRMATION)
 * 
 * This script automatically deletes Units 7-27 from both Dev and Prod.
 * Use this only if you're sure you want to delete!
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const DEV_CONVEX_URL = process.env.VITE_CONVEX_URL;
const PROD_CONVEX_URL = process.env.VITE_CONVEX_URL_PRODUCTION;

if (!DEV_CONVEX_URL || !PROD_CONVEX_URL) {
  console.error("❌ Missing environment variables");
  process.exit(1);
}

const devClient = new ConvexHttpClient(DEV_CONVEX_URL);
const prodClient = new ConvexHttpClient(PROD_CONVEX_URL);

async function cleanupAuto() {
  console.log("========================================");
  console.log("🗑️  AUTO CLEANUP: Deleting Units 7-27");
  console.log("========================================\n");

  const unitsToDelete = Array.from({ length: 21 }, (_, i) => i + 7);

  try {
    // Delete from Development
    console.log("🔄 Step 1/2: Deleting from Development...");
    const devDeleted = await devClient.mutation(api.units.batchDeleteUnits as any, {
      unitNumbers: unitsToDelete,
    });
    console.log(`  ✅ Metadata: ${devDeleted.metadata} entries`);
    console.log(`  ✅ Content: ${devDeleted.content} sections`);
    console.log(`  ✅ Tests: ${devDeleted.tests} tests`);

    const devVocabDeleted = await devClient.mutation(api.vocabulary.batchDeleteVocabularyByUnits as any, {
      unitNumbers: unitsToDelete,
    });
    console.log(`  ✅ Vocabulary: ${devVocabDeleted.deleted} items`);

    // Delete from Production
    console.log("\n🔄 Step 2/2: Deleting from Production...");
    const prodDeleted = await prodClient.mutation(api.units.batchDeleteUnits as any, {
      unitNumbers: unitsToDelete,
    });
    console.log(`  ✅ Metadata: ${prodDeleted.metadata} entries`);
    console.log(`  ✅ Content: ${prodDeleted.content} sections`);
    console.log(`  ✅ Tests: ${prodDeleted.tests} tests`);

    const prodVocabDeleted = await prodClient.mutation(api.vocabulary.batchDeleteVocabularyByUnits as any, {
      unitNumbers: unitsToDelete,
    });
    console.log(`  ✅ Vocabulary: ${prodVocabDeleted.deleted} items`);

    console.log("\n========================================");
    console.log("✅ CLEANUP COMPLETE!");
    console.log("========================================");
    console.log("\n📊 Summary:");
    console.log(`  Development: ${devDeleted.metadata + devDeleted.content + devDeleted.tests + devVocabDeleted.deleted} items deleted`);
    console.log(`  Production:  ${prodDeleted.metadata + prodDeleted.content + prodDeleted.tests + prodVocabDeleted.deleted} items deleted`);
    console.log("\n🎉 Only Units 1-6 remain in both databases!");

  } catch (error: any) {
    console.error("\n❌ Cleanup failed:", error);
    process.exit(1);
  }
}

cleanupAuto()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });




