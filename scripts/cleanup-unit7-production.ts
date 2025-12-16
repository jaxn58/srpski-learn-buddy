/**
 * Cleanup Unit 7 from Production
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

async function cleanupUnit7() {
  console.log("========================================");
  console.log("🗑️  Cleanup Unit 7 from Production");
  console.log("========================================\n");

  try {
    // Delete content, tests, and vocabulary for Unit 7
    console.log("🔄 Deleting Unit 7 data...");
    
    const deleted = await prodClient.mutation(api.units.batchDeleteUnits as any, {
      unitNumbers: [7],
    });
    
    console.log(`  ✅ Deleted ${deleted.metadata} metadata`);
    console.log(`  ✅ Deleted ${deleted.content} content sections`);
    console.log(`  ✅ Deleted ${deleted.tests} tests`);

    const vocabDeleted = await prodClient.mutation(api.vocabulary.batchDeleteVocabularyByUnits as any, {
      unitNumbers: [7],
    });
    
    console.log(`  ✅ Deleted ${vocabDeleted.deleted} vocabulary items`);

    console.log("\n========================================");
    console.log("✅ Unit 7 Cleanup Complete!");
    console.log("========================================");
    console.log(`\nTotal deleted: ${deleted.metadata + deleted.content + deleted.tests + vocabDeleted.deleted} items`);

  } catch (error: any) {
    console.error("\n❌ Cleanup failed:", error);
    process.exit(1);
  }
}

cleanupUnit7()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
