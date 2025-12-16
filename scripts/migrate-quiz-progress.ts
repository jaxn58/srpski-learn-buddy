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
 * Phase 7 Migration Script:
 * Convert quizProgress.incorrectWordIds from serbianWord[] to courseVocabularyId[]
 * 
 * This script runs in dry-run mode by default. Set DRY_RUN=false to execute.
 */
async function migrateQuizProgress() {
  const DRY_RUN = process.env.DRY_RUN !== "false";
  
  console.log("🚀 Migrating Quiz Progress incorrectWordIds...");
  console.log(`   Convex URL: ${CONVEX_URL}`);
  console.log(`   Mode: ${DRY_RUN ? "DRY RUN (no changes)" : "LIVE (will modify data)"}`);
  console.log("");

  const client = new ConvexHttpClient(CONVEX_URL);
  
  let quizProgressUpdated = 0;
  let quizProgressSkipped = 0;
  let quizProgressErrors = 0;
  let totalWordsConverted = 0;
  let wordsNotFound = 0;

  // Get all users
  const allUsers = await client.query(api.users.getAllUsers);
  console.log(`   Found ${allUsers.length} users`);

  for (const user of allUsers) {
    try {
      // Get all quiz progress for this user
      const allQuizProgress = await client.query(api.exercises.getAllQuizProgress);
      const userQuizProgress = allQuizProgress.filter(qp => qp.userId === user._id);

      console.log(`   Processing user ${user._id} (${user.email || user.name || "unknown"}): ${userQuizProgress.length} quiz progress entries`);

      for (const quizProgress of userQuizProgress) {
        try {
          // Skip if already migrated (has incorrectVocabularyIds)
          if (quizProgress.incorrectVocabularyIds && quizProgress.incorrectVocabularyIds.length > 0) {
            quizProgressSkipped++;
            continue;
          }

          // Skip if no incorrectWordIds to migrate
          if (!quizProgress.incorrectWordIds || quizProgress.incorrectWordIds.length === 0) {
            quizProgressSkipped++;
            continue;
          }

          // Convert serbianWord[] to courseVocabularyId[]
          const incorrectVocabularyIds: string[] = [];
          const notFoundWords: string[] = [];

          for (const serbianWord of quizProgress.incorrectWordIds) {
            // Find courseVocabulary entry by serbianWord and unitNumber
            const courseVocab = await client.query(api.vocabulary.findCourseVocabularyBySerbianAndUnit, {
              serbian: serbianWord,
              unitNumber: quizProgress.unitNumber,
            });

            if (courseVocab) {
              incorrectVocabularyIds.push(courseVocab._id);
              totalWordsConverted++;
            } else {
              notFoundWords.push(serbianWord);
              wordsNotFound++;
              console.warn(`   ⚠️  No courseVocabulary found for ${serbianWord} (unit ${quizProgress.unitNumber})`);
            }
          }

          if (notFoundWords.length > 0 && incorrectVocabularyIds.length === 0) {
            // All words not found - skip this quiz progress
            console.warn(`   ⚠️  Skipping quiz progress for unit ${quizProgress.unitNumber}: All words not found`);
            quizProgressSkipped++;
            continue;
          }

          if (!DRY_RUN) {
            await client.mutation(api.exercises.updateQuizProgress, {
              unitNumber: quizProgress.unitNumber,
              currentIndex: quizProgress.currentIndex,
              lastScore: quizProgress.lastScore,
              incorrectVocabularyIds: incorrectVocabularyIds as any, // Type assertion needed
            });
          }

          quizProgressUpdated++;
          
          if (notFoundWords.length > 0) {
            console.log(`   ⚠️  Unit ${quizProgress.unitNumber}: ${incorrectVocabularyIds.length} converted, ${notFoundWords.length} not found`);
          }
        } catch (error) {
          console.error(`   ❌ Error migrating quiz progress for unit ${quizProgress.unitNumber}:`, error);
          quizProgressErrors++;
        }
      }
    } catch (error) {
      console.error(`   ❌ Error processing user ${user._id}:`, error);
    }
  }

  console.log("");
  console.log("📊 Migration Summary:");
  console.log(`   quizProgress: ${quizProgressUpdated} updated, ${quizProgressSkipped} skipped, ${quizProgressErrors} errors`);
  console.log(`   words: ${totalWordsConverted} converted, ${wordsNotFound} not found`);
  
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
migrateQuizProgress().catch((error) => {
  console.error("❌ Migration failed:", error);
  process.exit(1);
});

