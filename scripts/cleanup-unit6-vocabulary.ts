/**
 * Cleanup Unit 6 vocabulary - delete all Unit 6 entries before re-import
 * 
 * Usage: npx tsx scripts/cleanup-unit6-vocabulary.ts
 */

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

const UNIT_NUMBER = 6;

async function cleanupUnit6Vocabulary() {
  console.log("🧹 Cleaning up Unit 6 Vocabulary...");
  console.log(`   Convex URL: ${CONVEX_URL}`);
  
  const client = new ConvexHttpClient(CONVEX_URL);
  
  // Get all Unit 6 vocabulary
  const unit6Vocab = await client.query(api.vocabulary.getCourseVocabularyByUnit, {
    unitNumber: UNIT_NUMBER,
  });
  
  console.log(`   Found ${unit6Vocab.length} Unit 6 vocabulary entries`);
  
  if (unit6Vocab.length === 0) {
    console.log("   ✅ No entries to delete");
    return;
  }
  
  // Display entries to be deleted
  console.log("\n   Entries to delete:");
  unit6Vocab.forEach((word, i) => {
    console.log(`   ${i + 1}. ${word.serbian} → ${word.en || 'N/A'}`);
  });
  
  // Delete all Unit 6 vocabulary
  const result = await client.mutation(api.vocabulary.deleteVocabularyByUnits, {
    unitNumbers: [UNIT_NUMBER],
  });
  
  console.log("\n-----------------------------------");
  console.log(`Cleanup Complete!`);
  console.log(`✅ Deleted ${result.deleted} vocabulary entries`);
}

cleanupUnit6Vocabulary().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});


