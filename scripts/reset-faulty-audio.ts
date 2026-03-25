import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import * as dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as readline from "readline";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(projectRoot, ".env") });
dotenv.config({ path: path.join(projectRoot, ".env.local"), override: true });

const CONVEX_URL = (process.env.VITE_CONVEX_URL || process.env.CONVEX_URL || "").trim();

if (!CONVEX_URL) {
  console.error("❌ No Convex URL found.");
  console.error("💡 Set VITE_CONVEX_URL (or CONVEX_URL) in .env or .env.local — e.g. Dev deployment URL.");
  process.exit(1);
}

const ADMIN_SECRET = (process.env.ADMIN_SECRET ?? "").trim().replace(/^["']|["']$/g, "");
if (!ADMIN_SECRET) {
  const pEnv = path.join(projectRoot, ".env");
  const pLocal = path.join(projectRoot, ".env.local");
  const raw = process.env.ADMIN_SECRET;
  console.error("❌ ADMIN_SECRET is empty after loading env files.");
  console.error(`   Resolved project root: ${projectRoot}`);
  console.error(`   ${pEnv} exists: ${fs.existsSync(pEnv)}`);
  console.error(`   ${pLocal} exists: ${fs.existsSync(pLocal)}`);
  if (raw !== undefined && String(raw).trim() === "") {
    console.error("   ADMIN_SECRET is defined but only whitespace.");
  }
  if (raw === undefined) {
    console.error("   ADMIN_SECRET is undefined — check key name, # comments, or UTF-8 BOM on line 1.");
  }
  console.error("💡 Exact key: ADMIN_SECRET=... in .env.local next to package.json.");
  process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);

console.log(`\nTarget Convex (this script never touches Production unless this URL is Prod):\n  ${CONVEX_URL}\n`);

/** ConvexHttpClient has no logged-in user; resetVocabularyAudio requires adminSecret or an admin session. */
function resetAudioMutationArgs(vocabularyId: string) {
  return { vocabularyId: vocabularyId as any, adminSecret: ADMIN_SECRET };
}

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

async function resetFaultyAudio() {
  console.log("🔍 Fetching all vocabulary...");
  

  const vocabulary = (await client.query(
    api.vocabulary.getAllCourseVocabulary
  )) as VocabularyWord[];

  console.log(`✅ Found ${vocabulary.length} vocabulary items.\n`);


  // Categorize vocabulary
  const withStorageId = vocabulary.filter((w) => w.audioStorageId);
  const withOldAudioUrl = vocabulary.filter(
    (w) => !w.audioStorageId && w.audioUrl
  );
  const withoutAudio = vocabulary.filter(
    (w) => !w.audioStorageId && !w.audioUrl
  );

  console.log("📊 Audio Status:");
  console.log(`  ✅ With Storage ID: ${withStorageId.length}`);
  console.log(`  ⚠️  With old audioUrl only: ${withOldAudioUrl.length}`);
  console.log(`  ❌ Without audio: ${withoutAudio.length}\n`);


  // Interactive mode: Let user specify which words to reset
  console.log("🎯 Reset Options:");
  console.log("1. Reset specific word by serbian text");
  console.log("2. Reset specific word by vocabulary ID");
  console.log("3. Reset all words in a specific unit");
  console.log("4. Reset all words with old audioUrl (migrate to Storage)");
  console.log("5. List all words without audio");
  console.log("6. Exit");
  console.log(
    "7. Reset ALL stored vocabulary audio (every word with audioStorageId or legacy audioUrl) — use for Dev after TTS changes\n"
  );

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question("Choose an option (1-7): ", async (choice) => {
    rl.close();

  
    try {
      switch (choice) {
        case "1":
          await resetBySerbian(vocabulary);
          break;
        case "2":
          await resetById();
          break;
        case "3":
          await resetByUnit(vocabulary);
          break;
        case "4":
          await resetOldAudioUrls(withOldAudioUrl);
          break;
        case "5":
          listWordsWithoutAudio(withoutAudio);
          break;
        case "6":
          console.log("👋 Exiting...");
          break;
        case "7":
          await resetAllStoredVocabularyAudio(vocabulary);
          break;
        default:
          console.log("❌ Invalid option");
      }
    } catch (error) {
          console.error("❌ Error:", error);
    }
  });
}

async function resetBySerbian(vocabulary: VocabularyWord[]) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question("Enter serbian word to reset: ", async (serbian) => {
    rl.close();

  
    const matches = vocabulary.filter((w) => w.serbian.toLowerCase() === serbian.toLowerCase());

    if (matches.length === 0) {
      console.log(`❌ No vocabulary found for "${serbian}"`);
      return;
    }

    console.log(`\n✅ Found ${matches.length} match(es):`);
    matches.forEach((w, i) => {
      console.log(
        `  ${i + 1}. Unit ${w.unitNumber} - ${w.serbian} (ID: ${w._id})`
      );
      console.log(
        `     Storage ID: ${w.audioStorageId || "none"}, Audio URL: ${
          w.audioUrl ? "yes" : "no"
        }`
      );
    });

  
    const confirm = await promptUser(
      `\nReset audio for ${matches.length} word(s)?`
    );

    if (!confirm) {
      console.log("❌ Cancelled");
      return;
    }

    for (const word of matches) {
    
      await client.mutation(api.vocabulary.resetVocabularyAudio, resetAudioMutationArgs(word._id));

    
      console.log(`  ✅ Reset: ${word.serbian} (Unit ${word.unitNumber})`);
    }

    console.log(`\n✅ Successfully reset ${matches.length} word(s)`);
  });
}

async function resetById() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question("Enter vocabulary ID: ", async (id) => {
    rl.close();

  
    try {
      const result = await client.mutation(api.vocabulary.resetVocabularyAudio, resetAudioMutationArgs(id));

    
      console.log(`✅ Successfully reset audio for: ${result.serbian} (Unit ${result.unitNumber})`);
    } catch (error) {
          console.error("❌ Error:", error);
    }
  });
}

async function resetByUnit(vocabulary: VocabularyWord[]) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question("Enter unit number: ", async (unitStr) => {
    rl.close();

    const unitNumber = parseInt(unitStr);
    if (isNaN(unitNumber)) {
      console.log("❌ Invalid unit number");
      return;
    }

  
    const unitWords = vocabulary.filter((w) => w.unitNumber === unitNumber);

    if (unitWords.length === 0) {
      console.log(`❌ No vocabulary found for unit ${unitNumber}`);
      return;
    }

    console.log(`\n✅ Found ${unitWords.length} words in unit ${unitNumber}`);
    console.log("First 5 words:");
    unitWords.slice(0, 5).forEach((w, i) => {
      console.log(`  ${i + 1}. ${w.serbian} (Storage ID: ${w.audioStorageId || "none"})`);
    });

  
    const confirm = await promptUser(
      `\nReset audio for all ${unitWords.length} words in unit ${unitNumber}?`
    );

    if (!confirm) {
      console.log("❌ Cancelled");
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    for (const word of unitWords) {
      try {
      
        await client.mutation(api.vocabulary.resetVocabularyAudio, resetAudioMutationArgs(word._id));

      
        successCount++;
        console.log(`  ✅ Reset: ${word.serbian}`);
      } catch (error) {
      
        errorCount++;
        console.error(`  ❌ Failed: ${word.serbian} - ${error}`);
      }
    }

    console.log(
      `\n✅ Successfully reset ${successCount} word(s), ${errorCount} error(s)`
    );
  });
}

async function resetOldAudioUrls(words: VocabularyWord[]) {
  if (words.length === 0) {
    console.log("✅ No words with old audioUrl found");
    return;
  }

  console.log(`\n⚠️  Found ${words.length} words with old audioUrl (no Storage ID)`);
  console.log("First 5 words:");
  words.slice(0, 5).forEach((w, i) => {
    console.log(`  ${i + 1}. ${w.serbian} (Unit ${w.unitNumber})`);
  });


  const confirm = await promptUser(
    `\nReset audio for all ${words.length} words to force migration to Storage?`
  );

  if (!confirm) {
    console.log("❌ Cancelled");
    return;
  }

  let successCount = 0;
  let errorCount = 0;

  for (const word of words) {
    try {
    
      await client.mutation(api.vocabulary.resetVocabularyAudio, resetAudioMutationArgs(word._id));

    
      successCount++;
      console.log(`  ✅ Reset: ${word.serbian} (Unit ${word.unitNumber})`);
    } catch (error) {
    
      errorCount++;
      console.error(`  ❌ Failed: ${word.serbian} - ${error}`);
    }
  }

  console.log(
    `\n✅ Successfully reset ${successCount} word(s), ${errorCount} error(s)`
  );
}

/** Clears audioStorageId + audioUrl for every word that had either (full Dev refresh for new TTS). */
async function resetAllStoredVocabularyAudio(vocabulary: VocabularyWord[]) {
  const targets = vocabulary.filter((w) => w.audioStorageId || w.audioUrl);
  if (targets.length === 0) {
    console.log("✅ No vocabulary rows with stored audio or legacy audioUrl — nothing to reset.");
    return;
  }

  console.log(
    `\n⚠️  Option 7: Reset audio metadata for ${targets.length} word(s) on the deployment above.`
  );
  console.log("    Next play will regenerate audio (local: Express /api/audio/generate must be running).");

  const confirm = await promptUser(`\nProceed with FULL reset of stored vocabulary audio?`);
  if (!confirm) {
    console.log("❌ Cancelled");
    return;
  }

  let successCount = 0;
  let errorCount = 0;

  for (const word of targets) {
    try {
      await client.mutation(api.vocabulary.resetVocabularyAudio, resetAudioMutationArgs(word._id));
      successCount++;
      if (successCount <= 10 || successCount % 50 === 0) {
        console.log(`  ✅ Reset: ${word.serbian} (unit ${word.unitNumber})`);
      }
    } catch (error) {
      errorCount++;
      console.error(`  ❌ Failed: ${word.serbian} - ${error}`);
    }
  }

  console.log(
    `\n✅ Finished: ${successCount} reset, ${errorCount} error(s). (${targets.length} targeted)`
  );
}

function listWordsWithoutAudio(words: VocabularyWord[]) {
  if (words.length === 0) {
    console.log("✅ All words have audio!");
    return;
  }

  console.log(`\n❌ Found ${words.length} words without audio:\n`);

  // Group by unit
  const byUnit = new Map<number, VocabularyWord[]>();
  words.forEach((w) => {
    if (!byUnit.has(w.unitNumber)) {
      byUnit.set(w.unitNumber, []);
    }
    byUnit.get(w.unitNumber)!.push(w);
  });


  const sortedUnits = Array.from(byUnit.keys()).sort((a, b) => a - b);

  sortedUnits.forEach((unitNum) => {
    const unitWords = byUnit.get(unitNum)!;
    console.log(`📚 Unit ${unitNum} (${unitWords.length} words):`);
    unitWords.forEach((w) => {
      console.log(`   - ${w.serbian} (ID: ${w._id})`);
    });
    console.log();
  });
}

resetFaultyAudio().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
