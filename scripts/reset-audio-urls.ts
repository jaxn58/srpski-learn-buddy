import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import "dotenv/config";

const CONVEX_URL = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL;

if (!CONVEX_URL) {
  console.error("CONVEX_URL is not set");
  process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);

async function resetAudioUrls() {
  console.log("Fetching vocabulary...");
  const vocabulary = await client.query(api.vocabulary.getAllCourseVocabulary);
  
  console.log(`Found ${vocabulary.length} vocabulary items.`);
  
  let count = 0;
  for (const word of vocabulary) {
    if (word.audioUrl) {
      // We need a mutation to clear the URL.
      // Since we don't have a specific 'clear' mutation, we can use updateVocabularyAudioUrl with empty string or null?
      // Looking at the schema, audioUrl is optional string.
      // But updateVocabularyAudioUrl expects a string.
      
      // Let's rely on the fact that generating new audio will overwrite the file in storage.
      // BUT the URL in DB might remain the same if filename hasn't changed.
      // And Frontend uses cached URL.
      
      // Actually, if I just want to FORCE regeneration, I should probably just delete the audioUrl.
      // But I don't have a mutation for that exposed easily.
      
      // Alternative: I can modify the storage path in textToSpeech.ts to include a version or voice name.
      // This is cleaner as it avoids cache issues entirely.
    }
  }
  
  console.log("To force regeneration, we will update the storage path strategy.");
}

resetAudioUrls().catch(console.error);