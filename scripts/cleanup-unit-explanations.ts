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
 * Cleanup script to remove deprecated unitExplanations table entries
 * 
 * WARNING: This script will DELETE all entries from unitExplanations table.
 * Only run this after:
 * 1. Migration to unitContent is complete
 * 2. Validation scripts pass
 * 3. Frontend is tested and working
 * 
 * Usage:
 *   npm run cleanup-unit-explanations -- --dry-run  (preview only)
 *   npm run cleanup-unit-explanations                (actual deletion)
 */

async function cleanupUnitExplanations(dryRun: boolean = false) {
  console.log("🗑️  Cleaning up deprecated unitExplanations table");
  console.log(`   Convex URL: ${CONVEX_URL}`);
  console.log(`   Mode: ${dryRun ? "DRY RUN (no deletions)" : "LIVE DELETION"}\n`);

  if (!dryRun) {
    console.log("⚠️  WARNING: This will DELETE all entries from unitExplanations table!");
    console.log("   Make sure you have:");
    console.log("   1. Completed migration to unitContent");
    console.log("   2. Run validation scripts");
    console.log("   3. Tested frontend\n");
  }

  const client = new ConvexHttpClient(CONVEX_URL);

  // Get all explanations
  console.log("📊 Fetching unitExplanations entries...");
  const explanations = await client.query(api.units.getAllExplanations);

  if (!explanations || explanations.length === 0) {
    console.log("✅ No unitExplanations entries found. Nothing to clean up.");
    return;
  }

  console.log(`   Found ${explanations.length} entries\n`);

  if (dryRun) {
    console.log("📋 Entries that would be deleted:");
    explanations.forEach((exp) => {
      console.log(`   - Unit ${exp.unitNumber}`);
    });
    console.log("\n⚠️  DRY RUN MODE - No deletions were made");
    console.log("   Run without --dry-run flag to perform actual deletion");
  } else {
    console.log("❌ This script cannot delete entries directly.");
    console.log("   To delete unitExplanations entries:");
    console.log("   1. Go to Convex Dashboard");
    console.log("   2. Navigate to unitExplanations table");
    console.log("   3. Delete all entries manually");
    console.log("\n   OR create a mutation in convex/units.ts to delete entries");
    console.log("   (Convex doesn't allow direct table deletion via HTTP client)");
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run") || args.includes("-d");

cleanupUnitExplanations(dryRun).catch((error) => {
  console.error("❌ Cleanup failed:", error);
  process.exit(1);
});












