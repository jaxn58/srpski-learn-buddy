import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import "dotenv/config";

// PRODUCTION Convex URL
const PROD_CONVEX_URL = "https://fleet-labrador-324.convex.cloud";

const client = new ConvexHttpClient(PROD_CONVEX_URL);

async function checkAudioFile() {
  console.log("🔍 Checking audio file for 'Da'...\n");

  // Get all vocabulary
  const vocabulary = await client.query(api.vocabulary.getAllCourseVocabulary) as any[];

  // Find "Da"
  const daWord = vocabulary.find((w) => w.serbian.toLowerCase() === "da");

  if (!daWord) {
    console.log("❌ Word 'Da' not found");
    return;
  }

  console.log("📊 Word Info:");
  console.log(`  Serbian: ${daWord.serbian}`);
  console.log(`  Unit: ${daWord.unitNumber}`);
  console.log(`  ID: ${daWord._id}`);
  console.log(`  Audio Storage ID: ${daWord.audioStorageId || "none"}`);
  console.log(`  Audio URL (deprecated): ${daWord.audioUrl || "none"}`);
  console.log();

  if (!daWord.audioStorageId) {
    console.log("⚠️  No audio storage ID - audio needs to be generated");
    return;
  }

  // Get audio URL
  try {
    const audioUrl = await client.query(api.vocabulary.getVocabularyAudioUrl, {
      vocabularyId: daWord._id,
    }) as string | null;

    console.log("🔗 Audio URL:");
    console.log(`  ${audioUrl || "none"}`);
    console.log();

    if (audioUrl) {
      // Fetch the audio file to check its size
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const sizeBytes = arrayBuffer.byteLength;
      const sizeKB = (sizeBytes / 1024).toFixed(2);

      console.log("📦 Audio File Info:");
      console.log(`  Size: ${sizeBytes} bytes (${sizeKB} KB)`);
      console.log(`  Content-Type: ${response.headers.get("content-type")}`);
      console.log(`  Status: ${response.status}`);
      console.log();

      if (sizeBytes < 1000) {
        console.log("⚠️  WARNING: Audio file is very small (< 1 KB)");
        console.log("   This might indicate an empty or corrupted file");
      } else {
        console.log("✅ Audio file size looks normal");
      }
    }
  } catch (error) {
    console.error("❌ Error fetching audio:", error);
  }
}

checkAudioFile().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
