/**
 * Cleanup Script: Remove old Units 7-27 from Development and Production
 * 
 * This script removes all data for Units 7-27:
 * - unitMetadata (EN + DE)
 * - unitContent (all sections)
 * - unitInteractiveTests
 * - courseVocabulary
 * 
 * Only Units 1-6 (new content from learn-with.me) will remain.
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import * as dotenv from "dotenv";

// Load .env.local
dotenv.config({ path: ".env.local" });

const DEV_CONVEX_URL = process.env.VITE_CONVEX_URL;
const PROD_CONVEX_URL = process.env.VITE_CONVEX_URL_PRODUCTION;
const LOG_PATH = "d:\\DEVELOPMENT\\Cursor\\srpski-tutor-en\\.cursor\\debug.log";
const SERVER_ENDPOINT = "http://127.0.0.1:7243/ingest/e54bf5a1-a12e-470b-9800-914f012d5363";

// #region agent log
function log(location: string, message: string, data: any = {}) {
  fetch(SERVER_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location,
      message,
      data,
      timestamp: Date.now(),
      sessionId: 'debug-session',
      runId: 'cleanup-old-units',
      hypothesisId: 'remove-units-7-27'
    })
  }).catch(() => {});
}
// #endregion

if (!DEV_CONVEX_URL || !PROD_CONVEX_URL) {
  console.error("❌ Missing environment variables");
  process.exit(1);
}

const devClient = new ConvexHttpClient(DEV_CONVEX_URL);
const prodClient = new ConvexHttpClient(PROD_CONVEX_URL);

interface CleanupStats {
  dev: {
    unitMetadata: number;
    unitContent: number;
    unitInteractiveTests: number;
    courseVocabulary: number;
  };
  prod: {
    unitMetadata: number;
    unitContent: number;
    unitInteractiveTests: number;
    courseVocabulary: number;
  };
}

async function cleanupOldUnits() {
  console.log("========================================");
  console.log("🧹 Cleanup: Removing Units 7-27");
  console.log("========================================");
  console.log("");
  console.log("⚠️  WARNING: This will permanently delete Units 7-27");
  console.log("   Only Units 1-6 will remain");
  console.log("");
  console.log(`📍 Development:  ${DEV_CONVEX_URL}`);
  console.log(`📍 Production:   ${PROD_CONVEX_URL}`);
  console.log("");

  // #region agent log
  log('cleanup-old-units-7-27.ts:start', 'Starting cleanup', {
    devUrl: DEV_CONVEX_URL,
    prodUrl: PROD_CONVEX_URL
  });
  // #endregion

  const stats: CleanupStats = {
    dev: {
      unitMetadata: 0,
      unitContent: 0,
      unitInteractiveTests: 0,
      courseVocabulary: 0,
    },
    prod: {
      unitMetadata: 0,
      unitContent: 0,
      unitInteractiveTests: 0,
      courseVocabulary: 0,
    },
  };

  // Units to delete: 7-27
  const unitsToDelete = Array.from({ length: 21 }, (_, i) => i + 7); // [7, 8, 9, ..., 27]

  console.log("🔄 Step 1/2: Cleaning Development Database...\n");

  // #region agent log
  log('cleanup-old-units-7-27.ts:dev-cleanup', 'Cleaning development database', {});
  // #endregion

  for (const unitNumber of unitsToDelete) {
    try {
      // 1. Delete unitMetadata (EN + DE)
      for (const lang of ["en", "de"]) {
        try {
          const metadata = await devClient.query(api.units.getUnitMetadata as any, {
            unitNumber,
            language: lang,
          });
          
          if (metadata && metadata._id) {
            // Note: We need a delete mutation in units.ts
            // For now, we'll log what needs to be deleted
            console.log(`  📝 Unit ${unitNumber} (${lang}): Metadata found (ID: ${metadata._id})`);
            stats.dev.unitMetadata++;
            
            // #region agent log
            log('cleanup-old-units-7-27.ts:dev-metadata', 'Found metadata to delete', {
              unitNumber,
              language: lang,
              id: metadata._id
            });
            // #endregion
          }
        } catch (e: any) {
          // Unit might not exist, skip
        }
      }

      // 2. Delete unitContent
      for (const lang of ["en", "de"]) {
        try {
          const content = await devClient.query(api.units.getUnitContentSections as any, {
            unitNumber,
            language: lang,
          });
          
          if (content && Object.keys(content).length > 0) {
            console.log(`  📄 Unit ${unitNumber} (${lang}): ${Object.keys(content).length} content sections found`);
            stats.dev.unitContent += Object.keys(content).length;
            
            // #region agent log
            log('cleanup-old-units-7-27.ts:dev-content', 'Found content to delete', {
              unitNumber,
              language: lang,
              sections: Object.keys(content).length
            });
            // #endregion
          }
        } catch (e: any) {
          // Unit might not exist, skip
        }
      }

      // 3. Delete unitInteractiveTests
      for (const lang of ["en", "de"]) {
        try {
          const tests = await devClient.query(api.units.getUnitInteractiveTest as any, {
            unitNumber,
            language: lang,
          });
          
          if (tests && tests.length > 0) {
            console.log(`  🎯 Unit ${unitNumber} (${lang}): ${tests.length} tests found`);
            stats.dev.unitInteractiveTests += tests.length;
            
            // #region agent log
            log('cleanup-old-units-7-27.ts:dev-tests', 'Found tests to delete', {
              unitNumber,
              language: lang,
              count: tests.length
            });
            // #endregion
          }
        } catch (e: any) {
          // Unit might not exist, skip
        }
      }

      // 4. Delete courseVocabulary
      try {
        const vocab = await devClient.query(api.vocabulary.getCourseVocabularyByUnit as any, {
          unitNumber,
        });
        
        if (vocab && vocab.length > 0) {
          console.log(`  📚 Unit ${unitNumber}: ${vocab.length} vocabulary items found`);
          stats.dev.courseVocabulary += vocab.length;
          
          // #region agent log
          log('cleanup-old-units-7-27.ts:dev-vocab', 'Found vocabulary to delete', {
            unitNumber,
            count: vocab.length
          });
          // #endregion
        }
      } catch (e: any) {
        // Unit might not exist, skip
      }
    } catch (error: any) {
      console.error(`  ❌ Error checking Unit ${unitNumber}: ${error.message}`);
      // #region agent log
      log('cleanup-old-units-7-27.ts:dev-error', 'Error during cleanup', {
        unitNumber,
        error: error.message
      });
      // #endregion
    }
  }

  console.log("\n🔄 Step 2/2: Cleaning Production Database...\n");

  // #region agent log
  log('cleanup-old-units-7-27.ts:prod-cleanup', 'Cleaning production database', {});
  // #endregion

  for (const unitNumber of unitsToDelete) {
    try {
      // 1. Delete unitMetadata (EN + DE)
      for (const lang of ["en", "de"]) {
        try {
          const metadata = await prodClient.query(api.units.getUnitMetadata as any, {
            unitNumber,
            language: lang,
          });
          
          if (metadata && metadata._id) {
            console.log(`  📝 Unit ${unitNumber} (${lang}): Metadata found (ID: ${metadata._id})`);
            stats.prod.unitMetadata++;
            
            // #region agent log
            log('cleanup-old-units-7-27.ts:prod-metadata', 'Found metadata to delete', {
              unitNumber,
              language: lang,
              id: metadata._id
            });
            // #endregion
          }
        } catch (e: any) {
          // Unit might not exist, skip
        }
      }

      // 2. Delete unitContent
      for (const lang of ["en", "de"]) {
        try {
          const content = await prodClient.query(api.units.getUnitContentSections as any, {
            unitNumber,
            language: lang,
          });
          
          if (content && Object.keys(content).length > 0) {
            console.log(`  📄 Unit ${unitNumber} (${lang}): ${Object.keys(content).length} content sections found`);
            stats.prod.unitContent += Object.keys(content).length;
            
            // #region agent log
            log('cleanup-old-units-7-27.ts:prod-content', 'Found content to delete', {
              unitNumber,
              language: lang,
              sections: Object.keys(content).length
            });
            // #endregion
          }
        } catch (e: any) {
          // Unit might not exist, skip
        }
      }

      // 3. Delete unitInteractiveTests
      for (const lang of ["en", "de"]) {
        try {
          const tests = await prodClient.query(api.units.getUnitInteractiveTest as any, {
            unitNumber,
            language: lang,
          });
          
          if (tests && tests.length > 0) {
            console.log(`  🎯 Unit ${unitNumber} (${lang}): ${tests.length} tests found`);
            stats.prod.unitInteractiveTests += tests.length;
            
            // #region agent log
            log('cleanup-old-units-7-27.ts:prod-tests', 'Found tests to delete', {
              unitNumber,
              language: lang,
              count: tests.length
            });
            // #endregion
          }
        } catch (e: any) {
          // Unit might not exist, skip
        }
      }

      // 4. Delete courseVocabulary
      try {
        const vocab = await prodClient.query(api.vocabulary.getCourseVocabularyByUnit as any, {
          unitNumber,
        });
        
        if (vocab && vocab.length > 0) {
          console.log(`  📚 Unit ${unitNumber}: ${vocab.length} vocabulary items found`);
          stats.prod.courseVocabulary += vocab.length;
          
          // #region agent log
          log('cleanup-old-units-7-27.ts:prod-vocab', 'Found vocabulary to delete', {
            unitNumber,
            count: vocab.length
          });
          // #endregion
        }
      } catch (error: any) {
        // Unit might not exist, skip
      }
    } catch (error: any) {
      console.error(`  ❌ Error checking Unit ${unitNumber}: ${error.message}`);
      // #region agent log
      log('cleanup-old-units-7-27.ts:prod-error', 'Error during cleanup', {
        unitNumber,
        error: error.message
      });
      // #endregion
    }
  }

  // Print Summary
  console.log("\n========================================");
  console.log("📊 CLEANUP SUMMARY (SCAN ONLY)");
  console.log("========================================\n");

  console.log("🔧 Development Database:");
  console.log(`  Unit Metadata:        ${stats.dev.unitMetadata} entries`);
  console.log(`  Unit Content:         ${stats.dev.unitContent} sections`);
  console.log(`  Interactive Tests:    ${stats.dev.unitInteractiveTests} tests`);
  console.log(`  Course Vocabulary:    ${stats.dev.courseVocabulary} words`);

  console.log("\n🌐 Production Database:");
  console.log(`  Unit Metadata:        ${stats.prod.unitMetadata} entries`);
  console.log(`  Unit Content:         ${stats.prod.unitContent} sections`);
  console.log(`  Interactive Tests:    ${stats.prod.unitInteractiveTests} tests`);
  console.log(`  Course Vocabulary:    ${stats.prod.courseVocabulary} words`);

  const totalDev = stats.dev.unitMetadata + stats.dev.unitContent + stats.dev.unitInteractiveTests + stats.dev.courseVocabulary;
  const totalProd = stats.prod.unitMetadata + stats.prod.unitContent + stats.prod.unitInteractiveTests + stats.prod.courseVocabulary;

  console.log("\n========================================");
  console.log(`Total items to delete: ${totalDev + totalProd}`);
  console.log("========================================");

  // #region agent log
  log('cleanup-old-units-7-27.ts:summary', 'Cleanup summary', {
    dev: stats.dev,
    prod: stats.prod,
    totalDev,
    totalProd
  });
  // #endregion

  console.log("\n⚠️  NOTE: This was a SCAN ONLY.");
  console.log("\n🗑️  Do you want to DELETE these items? (y/n)");
  console.log("   This action CANNOT be undone!");
  
  // Wait for user confirmation
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  readline.question('\nConfirm deletion (type "DELETE" to proceed): ', async (answer: string) => {
    readline.close();
    
    if (answer !== 'DELETE') {
      console.log("\n❌ Deletion cancelled.");
      process.exit(0);
    }

    console.log("\n🗑️  Starting deletion...\n");

    // #region agent log
    log('cleanup-old-units-7-27.ts:deletion-start', 'Starting actual deletion', {});
    // #endregion

    try {
      // Delete from Development
      console.log("🔄 Deleting from Development...");
      const devDeleted = await devClient.mutation(api.units.batchDeleteUnits as any, {
        unitNumbers: unitsToDelete,
      });
      console.log(`  ✅ Deleted ${devDeleted.metadata} metadata, ${devDeleted.content} content, ${devDeleted.tests} tests`);

      const devVocabDeleted = await devClient.mutation(api.vocabulary.batchDeleteVocabularyByUnits as any, {
        unitNumbers: unitsToDelete,
      });
      console.log(`  ✅ Deleted ${devVocabDeleted.deleted} vocabulary items`);

      // Delete from Production
      console.log("\n🔄 Deleting from Production...");
      const prodDeleted = await prodClient.mutation(api.units.batchDeleteUnits as any, {
        unitNumbers: unitsToDelete,
      });
      console.log(`  ✅ Deleted ${prodDeleted.metadata} metadata, ${prodDeleted.content} content, ${prodDeleted.tests} tests`);

      const prodVocabDeleted = await prodClient.mutation(api.vocabulary.batchDeleteVocabularyByUnits as any, {
        unitNumbers: unitsToDelete,
      });
      console.log(`  ✅ Deleted ${prodVocabDeleted.deleted} vocabulary items`);

      console.log("\n========================================");
      console.log("✅ CLEANUP COMPLETE!");
      console.log("========================================");
      console.log("\n🎉 Successfully deleted Units 7-27 from both databases!");
      console.log("   Only Units 1-6 remain.");

      // #region agent log
      log('cleanup-old-units-7-27.ts:deletion-complete', 'Deletion complete', {
        dev: devDeleted,
        prod: prodDeleted,
        devVocab: devVocabDeleted,
        prodVocab: prodVocabDeleted
      });
      // #endregion

      process.exit(0);
    } catch (error: any) {
      console.error("\n❌ Deletion failed:", error);
      // #region agent log
      log('cleanup-old-units-7-27.ts:deletion-error', 'Deletion error', { error: error.message });
      // #endregion
      process.exit(1);
    }
  });
}

// Run cleanup
cleanupOldUnits()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Cleanup failed:", error);
    // #region agent log
    log('cleanup-old-units-7-27.ts:fatal', 'Fatal error', { error: error.message });
    // #endregion
    process.exit(1);
  });


