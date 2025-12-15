import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

const CONVEX_URL = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL;

if (!CONVEX_URL) {
  console.error("❌ CONVEX_URL not found in environment variables");
  process.exit(1);
}

/**
 * Cleanup script to remove invalid "bookReference" contentType entries from unitContent table
 * 
 * Problem: Some units have old data with contentType "bookReference" which is not needed.
 * The schema only allows: "overview", "grammar", "phrases", "dialogues", "vocabulary", "testIntroduction", "practice"
 * 
 * This script will DELETE all unitContent entries with contentType "bookReference" for units 7-27.
 * 
 * Usage:
 *   npm run cleanup-practice -- --dry-run  (preview only)
 *   npm run cleanup-practice                (actual deletion)
 */

async function cleanupInvalidPracticeContent(dryRun: boolean = false) {
  console.log("🗑️  Cleaning up invalid 'bookReference' contentType entries");
  console.log(`   Convex URL: ${CONVEX_URL}`);
  console.log(`   Mode: ${dryRun ? "DRY RUN (no deletions)" : "LIVE DELETION"}\n`);

  if (!dryRun) {
    console.log("⚠️  WARNING: This will DELETE all 'bookReference' contentType entries from units 7-27!");
    console.log("   These entries are unnecessary and should be removed.\n");
  }

  const client = new ConvexHttpClient(CONVEX_URL);

  // Scan ALL units (1-27) to be safe
  const affectedUnits = Array.from({ length: 27 }, (_, i) => i + 1); // [1, 2, 3, ..., 27]

  console.log(`📊 Scanning ALL units (1-27) for invalid 'bookReference' entries...`);
  console.log(`   Affected units: ${affectedUnits.join(", ")}\n`);

  try {
    const result = await client.mutation(api.units.deleteInvalidContentTypes, {
      unitNumbers: affectedUnits,
      contentTypes: ["bookReference"],
      dryRun: dryRun,
    });

    console.log("\n📋 Results:");
    console.log(`   Found: ${result.found} entries`);
    console.log(`   Deleted: ${result.deleted} entries\n`);

    if (result.entries.length > 0) {
      console.log("📄 Details:");
      result.entries.forEach((entry) => {
        console.log(`   - Unit ${entry.unitNumber} (${entry.language}) [${entry.contentType}]: ${entry.id}`);
      });
      console.log("");
    }

    if (dryRun) {
      console.log("⚠️  DRY RUN MODE - No deletions were made");
      console.log("   Run without --dry-run flag to perform actual deletion\n");
    } else {
      console.log("✅ Cleanup completed successfully!");
      console.log("   Schema validation errors should now be resolved.\n");
    }
  } catch (error) {
    console.error("❌ Cleanup failed:", error);
    throw error;
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run") || args.includes("-d");

cleanupInvalidPracticeContent(dryRun).catch((error) => {
  console.error("❌ Script execution failed:", error);
  process.exit(1);
});
