import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { VOCABULARY } from "../shared/data/vocabulary/words";
import * as dotenv from "dotenv";

// Load environment variables from .env.local
dotenv.config({ path: ".env.local" });

const CONVEX_URL = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL;

if (!CONVEX_URL) {
  console.error("❌ CONVEX_URL not found in environment variables");
  process.exit(1);
}

async function migrateVocabularyTranslations() {
  console.log("🚀 Migrating Vocabulary Translations to Convex...");
  console.log(`   Convex URL: ${CONVEX_URL}`);
  console.log(`   Total Words to Process: ${VOCABULARY.length}`);

  const client = new ConvexHttpClient(CONVEX_URL);
  let successCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  // Process in chunks to avoid overwhelming the server
  const CHUNK_SIZE = 50;
  for (let i = 0; i < VOCABULARY.length; i += CHUNK_SIZE) {
    const chunk = VOCABULARY.slice(i, i + CHUNK_SIZE);
    console.log(`Processing chunk ${i/CHUNK_SIZE + 1} (${i} - ${Math.min(i + CHUNK_SIZE, VOCABULARY.length)})...`);

    await Promise.all(chunk.map(async (word) => {
      try {
        // 1. Find existing vocabulary entries (for all users)
        const vocabIds = await client.query(api.vocabulary.findVocabularyId, {
          serbianWord: word.serbianWord,
          unitNumber: word.unit,
        });

        if (vocabIds.length === 0) {
          // Word not found in any user's vocabulary yet - skip
          // This is expected if no user has reached this unit or initialized this word
          skippedCount++;
          return;
        }

        // 2. Create translations for each user's vocabulary entry
        for (const vocabId of vocabIds) {
          // English Translation
          if (word.translations.en) {
            await client.mutation(api.vocabulary.insertVocabularyTranslation, {
              vocabularyId: vocabId,
              language: "en",
              translation: word.translations.en,
              alternatives: word.alternatives?.en,
            });
          }

          // German Translation
          if (word.translations.de) {
            await client.mutation(api.vocabulary.insertVocabularyTranslation, {
              vocabularyId: vocabId,
              language: "de",
              translation: word.translations.de,
              alternatives: word.alternatives?.de,
            });
          }
        }
        successCount++;
      } catch (error: any) {
        console.error(`  ❌ Error processing word "${word.serbianWord}": ${error.message}`);
        errorCount++;
      }
    }));
  }

  console.log("\n-----------------------------------");
  console.log(`Migration Complete!`);
  console.log(`✅ Processed Words: ${successCount}`);
  console.log(`⏭️ Skipped Words (not in DB): ${skippedCount}`);
  console.log(`❌ Failed Operations: ${errorCount}`);
}

migrateVocabularyTranslations().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
