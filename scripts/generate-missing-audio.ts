import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import "dotenv/config";
import * as readline from "readline";

const CONVEX_URL = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL;
const EXPRESS_SERVER_URL = process.env.EXPRESS_SERVER_URL || "http://localhost:3001";

if (!CONVEX_URL) {
  console.error("❌ CONVEX_URL is not set");
  process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);

interface VocabularyWord {
  _id: string;
  serbian: string;
  unitNumber: number;
  audioStorageId?: string;
  audioUrl?: string;
}

async function promptUser(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question + " (y/n): ", (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}

async function generateAudio(word: VocabularyWord): Promise<{ success: boolean; storageId?: string; error?: string }> {
  try {
    const response = await fetch(`${EXPRESS_SERVER_URL}/api/audio/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serbianWord: word.serbian,
        vocabularyId: word._id,
        unitNumber: word.unitNumber,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }

    const result = await response.json();

    if (!result.success) {
      return { success: false, error: result.error };
    }

    // Update vocabulary with new storageId
    await client.mutation(api.vocabulary.updateVocabularyAudioStorageId, {
      vocabularyId: word._id as any,
      audioStorageId: result.storageId,
    });

    return { success: true, storageId: result.storageId };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function generateMissingAudio() {
  console.log("🔍 Fetching vocabulary...");
  
  const vocabulary = (await client.query(
    api.vocabulary.getAllCourseVocabulary
  )) as VocabularyWord[];

  console.log(`✅ Found ${vocabulary.length} vocabulary items.\n`);

  // Find words without audio
  const withoutAudio = vocabulary.filter(
    (w) => !w.audioStorageId && !w.audioUrl
  );

  if (withoutAudio.length === 0) {
    console.log("✅ All words already have audio!");
    return;
  }

  console.log(`📊 Found ${withoutAudio.length} words without audio\n`);

  // Group by unit
  const byUnit = new Map<number, VocabularyWord[]>();
  withoutAudio.forEach((w) => {
    if (!byUnit.has(w.unitNumber)) {
      byUnit.set(w.unitNumber, []);
    }
    byUnit.get(w.unitNumber)!.push(w);
  });

  const sortedUnits = Array.from(byUnit.keys()).sort((a, b) => a - b);

  console.log("📚 Words by Unit:");
  sortedUnits.forEach((unitNum) => {
    const unitWords = byUnit.get(unitNum)!;
    console.log(`  Unit ${unitNum}: ${unitWords.length} words`);
  });
  console.log();

  console.log("⚠️  IMPORTANT:");
  console.log("  - Make sure Express server is running: .\\dev-with-tts.ps1");
  console.log("  - This will generate audio for ALL words without audio");
  console.log("  - This may take several minutes\n");

  const confirm = await promptUser(
    `Generate audio for ${withoutAudio.length} words?`
  );

  if (!confirm) {
    console.log("❌ Cancelled");
    return;
  }

  console.log("\n🎵 Generating audio...\n");

  let successCount = 0;
  let errorCount = 0;
  const errors: Array<{ word: string; error: string }> = [];

  for (let i = 0; i < withoutAudio.length; i++) {
    const word = withoutAudio[i];
    const progress = `[${i + 1}/${withoutAudio.length}]`;

    process.stdout.write(`${progress} ${word.serbian} (Unit ${word.unitNumber})... `);

    const result = await generateAudio(word);

    if (result.success) {
      successCount++;
      console.log("✅");
    } else {
      errorCount++;
      console.log(`❌ ${result.error}`);
      errors.push({ word: word.serbian, error: result.error || "Unknown error" });
    }

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  console.log("\n📊 Summary:");
  console.log(`  ✅ Success: ${successCount}`);
  console.log(`  ❌ Errors: ${errorCount}`);

  if (errors.length > 0) {
    console.log("\n❌ Failed words:");
    errors.forEach((e) => {
      console.log(`  - ${e.word}: ${e.error}`);
    });
  }

  }

generateMissingAudio().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
