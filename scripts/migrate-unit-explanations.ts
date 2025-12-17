import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import * as dotenv from "dotenv";
import { COURSE_UNITS } from "../shared/data/course/units";

// Load environment variables
dotenv.config({ path: ".env.local" });

const CONVEX_URL = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL;

if (!CONVEX_URL) {
  console.error("❌ CONVEX_URL not found in environment variables");
  process.exit(1);
}

interface MigrationStats {
  unitsProcessed: number;
  contentMigrated: number;
  germanTranslationsMigrated: number;
  errors: number;
  skipped: number;
}

async function migrateUnitExplanations(dryRun: boolean = false) {
  console.log("🚀 Migrating unitExplanations → unitContent");
  console.log(`   Convex URL: ${CONVEX_URL}`);
  console.log(`   Mode: ${dryRun ? "DRY RUN (no changes)" : "LIVE MIGRATION"}\n`);

  const client = new ConvexHttpClient(CONVEX_URL);
  const stats: MigrationStats = {
    unitsProcessed: 0,
    contentMigrated: 0,
    germanTranslationsMigrated: 0,
    errors: 0,
    skipped: 0,
  };

  // Get all explanations
  console.log("📊 Fetching unitExplanations...");
  const explanations = await client.query(api.units.getAllExplanations);

  if (!explanations || explanations.length === 0) {
    console.log("✅ No unitExplanations found. Migration not needed.");
    return;
  }

  console.log(`   Found ${explanations.length} unit explanations\n`);

  for (const explanation of explanations) {
    const unitNumber = explanation.unitNumber;
    const unitFromTs = COURSE_UNITS.find((u) => u.number === unitNumber);

    console.log(`\n${"=".repeat(80)}`);
    console.log(`Unit ${unitNumber}: ${unitFromTs?.titleEnglish || "Unknown"}`);
    console.log("=".repeat(80));

    stats.unitsProcessed++;

    try {
      // Check if content already exists in unitContent
      const existingContent = await client.query(api.units.getUnitContentSections, {
        unitNumber,
        language: "en",
      });

      const hasOverview = existingContent?.overview;
      const hasGrammar = existingContent?.grammar;

      // Migrate English content
      if (explanation.overview && !hasOverview) {
        console.log("  📝 Migrating overview...");
        if (!dryRun) {
          await client.mutation(api.units.insertUnitContent, {
            unitNumber,
            language: "en",
            contentType: "overview",
            content: explanation.overview,
          });
        }
        stats.contentMigrated++;
        console.log("  ✅ Overview migrated");
      } else if (hasOverview) {
        console.log("  ⏭️  Overview already exists in unitContent, skipping");
        stats.skipped++;
      }

      if (explanation.grammarExplained && !hasGrammar) {
        console.log("  📝 Migrating grammar...");
        if (!dryRun) {
          await client.mutation(api.units.insertUnitContent, {
            unitNumber,
            language: "en",
            contentType: "grammar",
            content: explanation.grammarExplained,
          });
        }
        stats.contentMigrated++;
        console.log("  ✅ Grammar migrated");
      } else if (hasGrammar) {
        console.log("  ⏭️  Grammar already exists in unitContent, skipping");
        stats.skipped++;
      }

      // Migrate practiceExamples to dialogues or phrases
      if (explanation.practiceExamples) {
        const hasDialogues = existingContent?.dialogues;
        const hasPhrases = existingContent?.phrases;

        // Determine if it's dialogues or phrases based on content
        const isDialogue = explanation.practiceExamples.includes("Dialogue") ||
          explanation.practiceExamples.match(/^[A-Z][^:]*:/);

        if (!hasDialogues && !hasPhrases) {
          const contentType = isDialogue ? "dialogues" : "phrases";
          console.log(`  📝 Migrating practiceExamples as ${contentType}...`);
          if (!dryRun) {
            await client.mutation(api.units.insertUnitContent, {
              unitNumber,
              language: "en",
              contentType,
              content: explanation.practiceExamples,
            });
          }
          stats.contentMigrated++;
          console.log(`  ✅ PracticeExamples migrated as ${contentType}`);
        } else {
          console.log("  ⏭️  Dialogues/Phrases already exist in unitContent, skipping");
          stats.skipped++;
        }
      }

      // Migrate German translations
      if (explanation.overviewGerman) {
        console.log("  📝 Migrating German overview...");
        if (!dryRun) {
          await client.mutation(api.units.insertUnitContent, {
            unitNumber,
            language: "de",
            contentType: "overview",
            content: explanation.overviewGerman,
          });
        }
        stats.germanTranslationsMigrated++;
        console.log("  ✅ German overview migrated");
      }

      if (explanation.grammarExplainedGerman) {
        console.log("  📝 Migrating German grammar...");
        if (!dryRun) {
          await client.mutation(api.units.insertUnitContent, {
            unitNumber,
            language: "de",
            contentType: "grammar",
            content: explanation.grammarExplainedGerman,
          });
        }
        stats.germanTranslationsMigrated++;
        console.log("  ✅ German grammar migrated");
      }

      if (explanation.practiceExamplesGerman) {
        const isDialogue = explanation.practiceExamplesGerman.includes("Dialogue") ||
          explanation.practiceExamplesGerman.match(/^[A-Z][^:]*:/);

        const contentType = isDialogue ? "dialogues" : "phrases";
        console.log(`  📝 Migrating German practiceExamples as ${contentType}...`);
        if (!dryRun) {
          await client.mutation(api.units.insertUnitContent, {
            unitNumber,
            language: "de",
            contentType,
            content: explanation.practiceExamplesGerman,
          });
        }
        stats.germanTranslationsMigrated++;
        console.log(`  ✅ German practiceExamples migrated as ${contentType}`);
      }

      // Validate against units.ts
      if (unitFromTs) {
        const metadata = await client.query(api.units.getUnitMetadata, {
          unitNumber,
          language: "en",
        });

        if (metadata && metadata.title !== unitFromTs.titleEnglish) {
          console.log(
            `  ⚠️  Warning: Title mismatch - units.ts: "${unitFromTs.titleEnglish}", DB: "${metadata.title}"`
          );
        }
      }
    } catch (error: any) {
      console.error(`  ❌ Error migrating Unit ${unitNumber}: ${error.message}`);
      stats.errors++;
    }
  }

  // Print summary
  console.log("\n" + "=".repeat(80));
  console.log("📊 MIGRATION SUMMARY");
  console.log("=".repeat(80));
  console.log(`Units Processed: ${stats.unitsProcessed}`);
  console.log(`Content Entries Migrated: ${stats.contentMigrated}`);
  console.log(`German Translations Migrated: ${stats.germanTranslationsMigrated}`);
  console.log(`Skipped (already exists): ${stats.skipped}`);
  console.log(`Errors: ${stats.errors}`);

  if (dryRun) {
    console.log("\n⚠️  DRY RUN MODE - No changes were made");
    console.log("   Run without --dry-run flag to perform actual migration");
  } else {
    console.log("\n✅ Migration completed!");
    console.log("   Next steps:");
    console.log("   1. Run validation script to verify data consistency");
    console.log("   2. Test frontend with new structure");
    console.log("   3. After verification, unitExplanations table can be deleted");
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run") || args.includes("-d");

migrateUnitExplanations(dryRun).catch((error) => {
  console.error("❌ Migration failed:", error);
  process.exit(1);
});




