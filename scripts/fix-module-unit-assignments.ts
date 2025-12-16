import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { COURSE_MODULES } from "../shared/data/course/modules";
import * as dotenv from "dotenv";

// Load environment variables from .env.local
dotenv.config({ path: ".env.local" });

const CONVEX_URL = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL;

if (!CONVEX_URL) {
  console.error("❌ CONVEX_URL not found in environment variables");
  console.error("Please set VITE_CONVEX_URL in .env.local");
  process.exit(1);
}

// Correct module assignments based on user requirements
// Foundation (The Arrival): Only Units 1-6
// Daily Life: Units 7-11 (was 7-11, but 7-8 were incorrectly in foundation)
const CORRECT_ASSIGNMENTS: Record<number, string> = {
  1: "foundation",
  2: "foundation",
  3: "foundation",
  4: "foundation",
  5: "foundation",
  6: "foundation",
  7: "daily-life",
  8: "daily-life",
  9: "daily-life",
  10: "daily-life",
  11: "daily-life",
  12: "communication-culture",
  13: "communication-culture",
  14: "communication-culture",
  15: "communication-culture",
  16: "advanced-communication",
  17: "advanced-communication",
  18: "advanced-communication",
  19: "advanced-communication",
  20: "advanced-communication",
  21: "mastery",
  22: "mastery",
  23: "mastery",
  24: "mastery",
  25: "mastery",
  26: "mastery",
  27: "mastery",
};

async function fixModuleUnitAssignments() {
  console.log("🔧 Fixing Module-Unit Assignments...");
  console.log(`   Convex URL: ${CONVEX_URL}\n`);

  const client = new ConvexHttpClient(CONVEX_URL);
  let updateCount = 0;
  let errorCount = 0;
  let removeCount = 0;

  try {
    // Step 1: Get all module slugs and their IDs
    console.log("📊 Step 1: Fetching module metadata...");
    const moduleIdMap = new Map<string, string>(); // slug -> _id

    for (const courseModule of COURSE_MODULES) {
      const module = await client.query(api.modules.getModuleBySlug, {
        slug: courseModule.id,
      });
      if (module) {
        moduleIdMap.set(courseModule.id, module._id);
        console.log(`   ✅ Found module "${courseModule.id}": ${module._id}`);
      } else {
        console.warn(`   ⚠️  Module "${courseModule.id}" not found in database`);
      }
    }

    console.log(`\n   Found ${moduleIdMap.size} modules\n`);

    // Step 2: Update unitMetadata entries
    console.log("📝 Step 2: Updating unitMetadata entries...");

    for (let unitNumber = 1; unitNumber <= 27; unitNumber++) {
      const correctModuleSlug = CORRECT_ASSIGNMENTS[unitNumber];

      if (!correctModuleSlug) {
        console.warn(`   ⚠️  Unit ${unitNumber}: No module assignment defined`);
        continue;
      }

      const correctModuleId = moduleIdMap.get(correctModuleSlug);
      if (!correctModuleId) {
        console.warn(`   ⚠️  Unit ${unitNumber}: Module "${correctModuleSlug}" not found`);
        continue;
      }

      for (const language of ["en", "de"]) {
        try {
          const unitMetadata = await client.query(api.units.getUnitMetadata, {
            unitNumber,
            language,
          });

          if (!unitMetadata) {
            console.warn(`   ⚠️  Unit ${unitNumber} (${language}): No metadata found`);
            continue;
          }

          const currentModuleId = unitMetadata.moduleMetadataId;
          const needsUpdate =
            !currentModuleId || currentModuleId !== correctModuleId;

          if (needsUpdate) {
            if (currentModuleId) {
              console.log(
                `   ↻ Unit ${unitNumber} (${language}): Changing from module to "${correctModuleSlug}"`
              );
            } else {
              console.log(
                `   ➕ Unit ${unitNumber} (${language}): Assigning to module "${correctModuleSlug}"`
              );
            }

            await client.mutation(api.units.updateUnitModuleMetadataId, {
              unitNumber,
              language,
              moduleMetadataId: correctModuleId,
            });
            updateCount++;
          } else {
            // Only log first few for brevity
            if (unitNumber <= 3) {
              console.log(
                `   ✓ Unit ${unitNumber} (${language}): Already correctly assigned to "${correctModuleSlug}"`
              );
            }
          }
        } catch (error: any) {
          console.error(
            `   ❌ Unit ${unitNumber} (${language}): ${error.message}`
          );
          errorCount++;
        }
      }
    }

    // Step 3: Remove moduleMetadataId from units that shouldn't have one
    // (This shouldn't happen based on CORRECT_ASSIGNMENTS, but just in case)
    console.log("\n📝 Step 3: Checking for units with incorrect module assignments...");
    for (let unitNumber = 1; unitNumber <= 27; unitNumber++) {
      const correctModuleSlug = CORRECT_ASSIGNMENTS[unitNumber];
      if (!correctModuleSlug) {
        // This unit shouldn't be in any module - remove assignment
        for (const language of ["en", "de"]) {
          try {
            const unitMetadata = await client.query(api.units.getUnitMetadata, {
              unitNumber,
              language,
            });

            if (unitMetadata?.moduleMetadataId) {
              console.log(
                `   🗑️  Unit ${unitNumber} (${language}): Removing incorrect module assignment`
              );
              await client.mutation(api.units.updateUnitModuleMetadataId, {
                unitNumber,
                language,
                moduleMetadataId: undefined as any, // Remove assignment
              });
              removeCount++;
            }
          } catch (error: any) {
            // Ignore errors for units that don't exist
          }
        }
      }
    }

    // Summary
    console.log("\n" + "=".repeat(80));
    console.log("📊 FIX SUMMARY");
    console.log("=".repeat(80));
    console.log(`✅ UnitMetadata entries updated: ${updateCount}`);
    if (removeCount > 0) {
      console.log(`🗑️  Incorrect assignments removed: ${removeCount}`);
    }
    if (errorCount > 0) {
      console.log(`❌ Errors: ${errorCount}`);
    } else {
      console.log("✅ All unit-module assignments fixed successfully!");
    }
    console.log("=".repeat(80));
  } catch (error: any) {
    console.error("\n❌ Fix failed:", error);
    process.exit(1);
  }
}

fixModuleUnitAssignments().catch((error) => {
  console.error("❌ Fix script failed:", error);
  process.exit(1);
});
