import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import * as dotenv from "dotenv";

// Load environment variables from .env.local
dotenv.config({ path: ".env.local" });

const CONVEX_URL = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL;

if (!CONVEX_URL) {
  console.error("❌ CONVEX_URL not found in environment variables");
  process.exit(1);
}

/**
 * Script to shift Units 1-5 to make room for new Units 1 and 2
 * 
 * Shifts:
 * - Unit 1 → Unit 7 (copy, keep original as backup)
 * - Unit 2 → Unit 3
 * - Unit 3 → Unit 4
 * - Unit 4 → Unit 5
 * - Unit 5 → Unit 6
 * 
 * IMPORTANT: Process from back to front (5→6, then 4→5, etc.) to avoid conflicts
 */
async function shiftUnits() {
  console.log("🚀 Shifting Units 1-5...");
  console.log(`   Convex URL: ${CONVEX_URL}`);
  console.log("\n⚠️  WARNING: This will copy Units 1-5 to new positions.");
  console.log("   Unit 1 will be copied to Unit 7 (original kept as backup)");
  console.log("   Units 2-5 will be shifted up by 1 position\n");

  const client = new ConvexHttpClient(CONVEX_URL);

  // Define shifts: [from, to] - process from back to front
  const shifts: [number, number][] = [
    [5, 6], // Unit 5 → Unit 6
    [4, 5], // Unit 4 → Unit 5
    [3, 4], // Unit 3 → Unit 4
    [2, 3], // Unit 2 → Unit 3
    [1, 7], // Unit 1 → Unit 7 (special case - keep original)
  ];

  let totalCopied = {
    metadata: 0,
    content: 0,
    interactiveTests: 0,
    vocabulary: 0,
    explanations: 0,
  };

  for (const [fromUnit, toUnit] of shifts) {
    console.log(`\n${"=".repeat(80)}`);
    console.log(`📦 Copying Unit ${fromUnit} → Unit ${toUnit}`);
    console.log("=".repeat(80));

    try {
      // Use internal mutation to copy unit data
      const result = await client.mutation(api.units.copyUnitData, {
        fromUnitNumber: fromUnit,
        toUnitNumber: toUnit,
      });

      console.log(`✅ Unit ${fromUnit} → Unit ${toUnit}:`);
      console.log(`   Metadata: ${result.metadata}`);
      console.log(`   Content: ${result.content}`);
      console.log(`   Interactive Tests: ${result.interactiveTests}`);
      console.log(`   Vocabulary: ${result.vocabulary}`);
      console.log(`   Explanations: ${result.explanations}`);

      // Accumulate totals
      totalCopied.metadata += result.metadata;
      totalCopied.content += result.content;
      totalCopied.interactiveTests += result.interactiveTests;
      totalCopied.vocabulary += result.vocabulary;
      totalCopied.explanations += result.explanations;
    } catch (error: any) {
      console.error(`❌ Error copying Unit ${fromUnit} → Unit ${toUnit}:`, error.message);
      throw error;
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("✅ Migration Complete!");
  console.log("=".repeat(80));
  console.log("\nTotal items copied:");
  console.log(`   Metadata: ${totalCopied.metadata}`);
  console.log(`   Content: ${totalCopied.content}`);
  console.log(`   Interactive Tests: ${totalCopied.interactiveTests}`);
  console.log(`   Vocabulary: ${totalCopied.vocabulary}`);
  console.log(`   Explanations: ${totalCopied.explanations}`);
  console.log("\n📝 Next steps:");
  console.log("   1. Run migration script for new Units 1 and 2");
  console.log("   2. Update unitExercises.ts with new unit numbers");
  console.log("   3. Update shared/data/course/units.ts");
  console.log("   4. Create exercises for new Units 1 and 2");
}

shiftUnits().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});



