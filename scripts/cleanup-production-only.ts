/**
 * Cleanup Production Only: Remove Units 7-27 from Production
 * 
 * This script only cleans Production (Dev is already clean).
 * Uses smaller batches to avoid timeouts.
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const PROD_CONVEX_URL = process.env.VITE_CONVEX_URL_PRODUCTION;

if (!PROD_CONVEX_URL) {
  console.error("❌ Missing PROD_CONVEX_URL");
  process.exit(1);
}

const prodClient = new ConvexHttpClient(PROD_CONVEX_URL);

async function cleanupProduction() {
  console.log("========================================");
  console.log("🗑️  Cleanup Production: Units 7-27");
  console.log("========================================\n");
  console.log(`📍 Production: ${PROD_CONVEX_URL}\n`);

  // Delete in smaller batches (5 units at a time)
  const allUnits = Array.from({ length: 21 }, (_, i) => i + 7);
  const batches = [];
  for (let i = 0; i < allUnits.length; i += 5) {
    batches.push(allUnits.slice(i, i + 5));
  }

  let totalDeleted = {
    metadata: 0,
    content: 0,
    tests: 0,
    vocabulary: 0,
  };

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`🔄 Batch ${i + 1}/${batches.length}: Units ${batch[0]}-${batch[batch.length - 1]}...`);

    try {
      const deleted = await prodClient.mutation(api.units.batchDeleteUnits as any, {
        unitNumbers: batch,
      });
      
      totalDeleted.metadata += deleted.metadata;
      totalDeleted.content += deleted.content;
      totalDeleted.tests += deleted.tests;
      
      console.log(`  ✅ Deleted ${deleted.metadata} metadata, ${deleted.content} content, ${deleted.tests} tests`);

      const vocabDeleted = await prodClient.mutation(api.vocabulary.batchDeleteVocabularyByUnits as any, {
        unitNumbers: batch,
      });
      
      totalDeleted.vocabulary += vocabDeleted.deleted;
      console.log(`  ✅ Deleted ${vocabDeleted.deleted} vocabulary items`);

      // Wait a bit between batches to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error: any) {
      console.error(`  ❌ Batch ${i + 1} failed: ${error.message}`);
      console.log(`  ⚠️  Continuing with next batch...`);
    }
  }

  console.log("\n========================================");
  console.log("✅ CLEANUP COMPLETE!");
  console.log("========================================");
  console.log("\n📊 Total Deleted:");
  console.log(`  Metadata:     ${totalDeleted.metadata} entries`);
  console.log(`  Content:      ${totalDeleted.content} sections`);
  console.log(`  Tests:        ${totalDeleted.tests} tests`);
  console.log(`  Vocabulary:   ${totalDeleted.vocabulary} items`);
  console.log(`  TOTAL:        ${totalDeleted.metadata + totalDeleted.content + totalDeleted.tests + totalDeleted.vocabulary} items`);
  console.log("\n🎉 Production now only has Units 1-6!");
}

cleanupProduction()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });







