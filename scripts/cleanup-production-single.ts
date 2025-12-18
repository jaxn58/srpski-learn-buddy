/**
 * Cleanup Production: Delete Units 7-27 ONE BY ONE
 * 
 * This script deletes units individually to avoid timeouts.
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

async function cleanupProductionSingle() {
  console.log("========================================");
  console.log("🗑️  Cleanup Production: Units 7-27 (Single)");
  console.log("========================================\n");

  let totalDeleted = {
    metadata: 0,
    content: 0,
    tests: 0,
    vocabulary: 0,
  };

  for (let unitNumber = 7; unitNumber <= 27; unitNumber++) {
    console.log(`\n🔄 Unit ${unitNumber}...`);

    try {
      // Delete metadata (EN + DE)
      for (const lang of ["en", "de"]) {
        try {
          const metadata = await prodClient.query(api.units.getUnitMetadata as any, {
            unitNumber,
            language: lang,
          });
          
          if (metadata && metadata._id) {
            await prodClient.mutation(api.units.deleteUnitMetadata as any, {
              metadataId: metadata._id,
            });
            totalDeleted.metadata++;
            console.log(`  ✅ Deleted metadata (${lang})`);
          }
        } catch (e: any) {
          console.log(`  ⏭️  No metadata (${lang})`);
        }
      }

      // Delete content (EN + DE)
      for (const lang of ["en", "de"]) {
        try {
          const content = await prodClient.query(api.units.getUnitContentSections as any, {
            unitNumber,
            language: lang,
          });
          
          if (content && Object.keys(content).length > 0) {
            // We need to get the actual content IDs
            // For now, use batch delete for this unit only
            const deleted = await prodClient.mutation(api.units.batchDeleteUnits as any, {
              unitNumbers: [unitNumber],
            });
            totalDeleted.content += deleted.content;
            totalDeleted.tests += deleted.tests;
            console.log(`  ✅ Deleted ${deleted.content} content sections, ${deleted.tests} tests`);
            break; // Only do this once per unit
          }
        } catch (e: any) {
          // Skip
        }
      }

      // Delete vocabulary
      try {
        const vocabDeleted = await prodClient.mutation(api.vocabulary.batchDeleteVocabularyByUnits as any, {
          unitNumbers: [unitNumber],
        });
        if (vocabDeleted.deleted > 0) {
          totalDeleted.vocabulary += vocabDeleted.deleted;
          console.log(`  ✅ Deleted ${vocabDeleted.deleted} vocabulary items`);
        }
      } catch (e: any) {
        // Skip
      }

      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error: any) {
      console.error(`  ❌ Unit ${unitNumber} failed: ${error.message}`);
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
}

cleanupProductionSingle()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });





