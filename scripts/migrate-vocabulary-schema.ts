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
 * Phase 1 Migration Script:
 * 1. Convert courseVocabulary.translations[] array to column-based translations (en, de, sr, es, fr)
 * 2. Create vocabularyProgress entries from existing vocabulary entries (for all users)
 * 
 * This script runs in dry-run mode by default. Set DRY_RUN=false to execute.
 */
async function migrateVocabularySchema() {
  const DRY_RUN = process.env.DRY_RUN !== "false";
  
  console.log("🚀 Migrating Vocabulary Schema...");
  console.log(`   Convex URL: ${CONVEX_URL}`);
  console.log(`   Mode: ${DRY_RUN ? "DRY RUN (no changes)" : "LIVE (will modify data)"}`);
  console.log("");

  const client = new ConvexHttpClient(CONVEX_URL);
  
  let courseVocabUpdated = 0;
  let courseVocabSkipped = 0;
  let courseVocabErrors = 0;
  
  let vocabProgressCreated = 0;
  let vocabProgressSkipped = 0;
  let vocabProgressErrors = 0;

  // ============= STEP 1: Convert courseVocabulary.translations[] to columns =============
  console.log("📝 Step 1: Converting courseVocabulary.translations[] to columns...");
  
  const allCourseVocab = await client.query(api.vocabulary.getAllCourseVocabulary);
  console.log(`   Found ${allCourseVocab.length} course vocabulary entries`);

  for (const word of allCourseVocab) {
    try {
      // Skip if columns already exist
      if (word.en && word.de) {
        courseVocabSkipped++;
        continue;
      }

      // Extract translations from array
      const translations = word.translations || [];
      const enTrans = translations.find((t: { language: string }) => t.language === "en");
      const deTrans = translations.find((t: { language: string }) => t.language === "de");
      const srTrans = translations.find((t: { language: string }) => t.language === "sr");
      const esTrans = translations.find((t: { language: string }) => t.language === "es");
      const frTrans = translations.find((t: { language: string }) => t.language === "fr");

      // Validate required translations
      if (!enTrans || !deTrans) {
        console.warn(`   ⚠️  Skipping ${word.serbian} (unit ${word.unitNumber}): Missing required translations (en or de)`);
        courseVocabSkipped++;
        continue;
      }

      const updates: Record<string, unknown> = {
        en: enTrans.translation,
        de: deTrans.translation,
        enAlt: enTrans.alt,
        deAlt: deTrans.alt,
      };

      if (srTrans) updates.sr = srTrans.translation;
      if (esTrans) updates.es = esTrans.translation;
      if (frTrans) updates.fr = frTrans.translation;

      if (!DRY_RUN) {
        await client.mutation(api.vocabulary.updateCourseVocabularyColumns, {
          courseVocabularyId: word._id,
          ...updates,
        });
      }

      courseVocabUpdated++;
      
      if (courseVocabUpdated % 100 === 0) {
        console.log(`   Progress: ${courseVocabUpdated} updated...`);
      }
    } catch (error) {
      console.error(`   ❌ Error updating ${word.serbian} (unit ${word.unitNumber}):`, error);
      courseVocabErrors++;
    }
  }

  console.log(`   ✅ Step 1 Complete: ${courseVocabUpdated} updated, ${courseVocabSkipped} skipped, ${courseVocabErrors} errors`);
  console.log("");

  // ============= STEP 2: Create vocabularyProgress from vocabulary =============
  console.log("📝 Step 2: Creating vocabularyProgress from vocabulary...");
  
  // Get all users
  const allUsers = await client.query(api.users.getAllUsers);
  console.log(`   Found ${allUsers.length} users`);

  for (const user of allUsers) {
    try {
      // Get all vocabulary entries for this user
      // Note: getUserVocabulary requires admin access, so this script must be run by an admin
      const userVocab = await client.query(api.vocabulary.getUserVocabulary, {
        userId: user._id,
      });

      console.log(`   Processing user ${user._id} (${user.email || user.name || "unknown"}): ${userVocab.length} vocabulary entries`);

      for (const vocabEntry of userVocab) {
        try {
          // Find matching courseVocabulary entry
          const courseVocab = await client.query(api.vocabulary.findCourseVocabularyBySerbianAndUnit, {
            serbian: vocabEntry.serbianWord,
            unitNumber: vocabEntry.unitNumber,
          });

          if (!courseVocab) {
            console.warn(`   ⚠️  No courseVocabulary found for ${vocabEntry.serbianWord} (unit ${vocabEntry.unitNumber})`);
            vocabProgressSkipped++;
            continue;
          }

          // Check if vocabularyProgress already exists
          const existingProgress = await client.query(api.vocabulary.getVocabularyProgress, {
            userId: user._id,
            courseVocabularyId: courseVocab._id,
          });

          if (existingProgress) {
            vocabProgressSkipped++;
            continue;
          }

          if (!DRY_RUN) {
            await client.mutation(api.vocabulary.createVocabularyProgress, {
              userId: user._id,
              courseVocabularyId: courseVocab._id,
              mastered: vocabEntry.mastered,
              reviewCount: vocabEntry.reviewCount,
              lastReviewedAt: vocabEntry.lastReviewedAt,
              correctAnswerCount: vocabEntry.correctAnswerCount,
              incorrectAnswerCount: vocabEntry.incorrectAnswerCount,
              lastAnsweredAt: vocabEntry.lastAnsweredAt,
            });
          }

          vocabProgressCreated++;
        } catch (error) {
          console.error(`   ❌ Error creating vocabularyProgress for ${vocabEntry.serbianWord}:`, error);
          vocabProgressErrors++;
        }
      }
    } catch (error) {
      console.error(`   ❌ Error processing user ${user._id}:`, error);
    }
  }

  console.log(`   ✅ Step 2 Complete: ${vocabProgressCreated} created, ${vocabProgressSkipped} skipped, ${vocabProgressErrors} errors`);
  console.log("");

  // ============= SUMMARY =============
  console.log("📊 Migration Summary:");
  console.log(`   courseVocabulary: ${courseVocabUpdated} updated, ${courseVocabSkipped} skipped, ${courseVocabErrors} errors`);
  console.log(`   vocabularyProgress: ${vocabProgressCreated} created, ${vocabProgressSkipped} skipped, ${vocabProgressErrors} errors`);
  
  if (DRY_RUN) {
    console.log("");
    console.log("⚠️  This was a DRY RUN. No data was modified.");
    console.log("   Set DRY_RUN=false to execute the migration.");
  } else {
    console.log("");
    console.log("✅ Migration completed successfully!");
  }
}

// Run migration
migrateVocabularySchema().catch((error) => {
  console.error("❌ Migration failed:", error);
  process.exit(1);
});

