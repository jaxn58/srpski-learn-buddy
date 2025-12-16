import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import * as dotenv from "dotenv";

// Load environment variables from .env.local (try both current dir and parent dir)
dotenv.config({ path: ".env.local" });
dotenv.config({ path: "../.env.local" });

const CONVEX_URL = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL;

if (!CONVEX_URL) {
  console.error("❌ CONVEX_URL not found in environment variables");
  process.exit(1);
}

/**
 * Cleanup Script: Remove duplicate vocabularyProgress entries
 * 
 * This script finds and removes duplicate entries where the same user
 * has multiple vocabularyProgress entries for the same courseVocabularyId.
 * Keeps the oldest entry (by _creationTime) and merges the counts.
 * 
 * This script runs in dry-run mode by default. Set DRY_RUN=false to execute.
 */
async function cleanupDuplicateVocabularyProgress() {
  const DRY_RUN = process.env.DRY_RUN !== "false";
  
  console.log("🚀 Cleaning up duplicate vocabularyProgress entries...");
  console.log(`   Convex URL: ${CONVEX_URL}`);
  console.log(`   Mode: ${DRY_RUN ? "DRY RUN (no changes)" : "LIVE (will modify data)"}`);
  console.log("");

  const client = new ConvexHttpClient(CONVEX_URL);
  
  let duplicatesFound = 0;
  let duplicatesRemoved = 0;
  let entriesMerged = 0;
  let errors = 0;

  // Get all vocabularyProgress entries directly (requires admin, but we'll handle auth via CONVEX_AUTH_TOKEN if needed)
  console.log("   Fetching all vocabularyProgress entries...");
  let allProgress;
  try {
    allProgress = await client.query(api.vocabulary.getAllVocabularyProgress);
  } catch (error: any) {
    if (error.message?.includes("Unauthorized")) {
      console.error("   ❌ Unauthorized: This script requires admin access.");
      console.error("   💡 Tip: Run this script from the Convex Dashboard Functions tab as an admin user.");
      console.error("   💡 Or set CONVEX_AUTH_TOKEN environment variable with an admin token.");
      process.exit(1);
    }
    throw error;
  }
  
  console.log(`   Found ${allProgress.length} vocabularyProgress entries`);

  // Group by userId and courseVocabularyId
  const progressByUserAndCourseVocab = new Map<string, typeof allProgress>();
  
  for (const progress of allProgress) {
    const key = `${progress.userId}:${progress.courseVocabularyId}`;
    if (!progressByUserAndCourseVocab.has(key)) {
      progressByUserAndCourseVocab.set(key, []);
    }
    progressByUserAndCourseVocab.get(key)!.push(progress);
  }

  // Process each user+courseVocabularyId combination
  for (const [key, entries] of progressByUserAndCourseVocab.entries()) {
    const [userId, courseVocabId] = key.split(":");
    
    if (entries.length > 1) {
      duplicatesFound++;
      console.log(`   ⚠️  Found ${entries.length} duplicate entries for userId: ${userId}, courseVocabularyId: ${courseVocabId}`);

      // Find duplicates (more than one entry per courseVocabularyId)
      for (const [courseVocabId, entries] of progressByCourseVocab.entries()) {
        if (entries.length > 1) {
          duplicatesFound++;
          console.log(`   ⚠️  Found ${entries.length} duplicate entries for courseVocabularyId: ${courseVocabId}`);

          // Sort by creation time (oldest first)
          entries.sort((a, b) => (a._creationTime || 0) - (b._creationTime || 0));

          // Keep the first (oldest) entry
          const keepEntry = entries[0];
          const duplicateEntries = entries.slice(1);

          // Merge counts from duplicates into keepEntry
          let mergedCorrectCount = keepEntry.correctAnswerCount || 0;
          let mergedIncorrectCount = keepEntry.incorrectAnswerCount || 0;
          let mergedReviewCount = keepEntry.reviewCount || 0;
          let latestAnsweredAt = keepEntry.lastAnsweredAt || 0;
          let latestReviewedAt = keepEntry.lastReviewedAt || 0;
          let isMastered = keepEntry.mastered || false;

          for (const dup of duplicateEntries) {
            mergedCorrectCount += dup.correctAnswerCount || 0;
            mergedIncorrectCount += dup.incorrectAnswerCount || 0;
            mergedReviewCount += dup.reviewCount || 0;
            if (dup.lastAnsweredAt && dup.lastAnsweredAt > latestAnsweredAt) {
              latestAnsweredAt = dup.lastAnsweredAt;
            }
            if (dup.lastReviewedAt && dup.lastReviewedAt > latestReviewedAt) {
              latestReviewedAt = dup.lastReviewedAt;
            }
            if (dup.mastered) {
              isMastered = true;
            }
          }

          // Update mastered status based on merged counts
          if (mergedCorrectCount >= 3) {
            isMastered = true;
          }

          console.log(`   📊 Merged counts: correct=${mergedCorrectCount}, incorrect=${mergedIncorrectCount}, review=${mergedReviewCount}`);

          if (!DRY_RUN) {
            try {
              // Update the kept entry with merged counts
              await client.mutation(api.vocabulary.updateVocabularyProgress, {
                vocabularyProgressId: keepEntry._id,
                correctAnswerCount: mergedCorrectCount,
                incorrectAnswerCount: mergedIncorrectCount,
                reviewCount: mergedReviewCount,
                mastered: isMastered,
                lastAnsweredAt: latestAnsweredAt || undefined,
                lastReviewedAt: latestReviewedAt || undefined,
              });

              // Delete duplicate entries
              for (const dup of duplicateEntries) {
                await client.mutation(api.vocabulary.deleteVocabularyProgress, {
                  vocabularyProgressId: dup._id,
                });
                duplicatesRemoved++;
              }

              entriesMerged++;
            } catch (error) {
              console.error(`   ❌ Error processing duplicates for ${key}:`, error);
              errors++;
            }
          }
        }
      }
    }

  console.log("");
  console.log("📊 Cleanup Summary:");
  console.log(`   duplicates found: ${duplicatesFound}`);
  console.log(`   entries merged: ${entriesMerged}`);
  console.log(`   duplicates removed: ${duplicatesRemoved}`);
  console.log(`   errors: ${errors}`);
  
  if (DRY_RUN) {
    console.log("");
    console.log("⚠️  This was a DRY RUN. No data was modified.");
    console.log("   Set DRY_RUN=false to execute the cleanup.");
  } else {
    console.log("");
    console.log("✅ Cleanup completed successfully!");
  }
}

// Run cleanup
cleanupDuplicateVocabularyProgress().catch((error) => {
  console.error("❌ Cleanup failed:", error);
  process.exit(1);
});
