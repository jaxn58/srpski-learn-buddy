import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import "dotenv/config";
import * as readline from "readline";

const CONVEX_URL = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL;

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

async function resetFaultyAudio() {
  console.log("🔍 Fetching all vocabulary...");
  
  // #region agent log
  log('reset-faulty-audio.ts:60', 'Script started', {}, 'H1');
  // #endregion

  const vocabulary = (await client.query(
    api.vocabulary.getAllCourseVocabulary
  )) as VocabularyWord[];

  console.log(`✅ Found ${vocabulary.length} vocabulary items.\n`);

  // #region agent log
  log('reset-faulty-audio.ts:70', 'Vocabulary fetched', { totalCount: vocabulary.length }, 'H1');
  // #endregion

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

  // #region agent log
  log('reset-faulty-audio.ts:89', 'Audio categorization', {
    withStorageId: withStorageId.length,
    withOldAudioUrl: withOldAudioUrl.length,
    withoutAudio: withoutAudio.length,
  }, 'H1');
  // #endregion

  // Interactive mode: Let user specify which words to reset
  console.log("🎯 Reset Options:");
  console.log("1. Reset specific word by serbian text");
  console.log("2. Reset specific word by vocabulary ID");
  console.log("3. Reset all words in a specific unit");
  console.log("4. Reset all words with old audioUrl (migrate to Storage)");
  console.log("5. List all words without audio");
  console.log("6. Exit\n");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question("Choose an option (1-6): ", async (choice) => {
    rl.close();

    // #region agent log
    log('reset-faulty-audio.ts:115', 'User chose option', { choice }, 'H1');
    // #endregion

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
        default:
          console.log("❌ Invalid option");
      }
    } catch (error) {
      // #region agent log
      log('reset-faulty-audio.ts:143', 'Error in script', { error: String(error) }, 'H1');
      // #endregion
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

    // #region agent log
    log('reset-faulty-audio.ts:162', 'Searching for serbian word', { serbian }, 'H3');
    // #endregion

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

    // #region agent log
    log('reset-faulty-audio.ts:185', 'Found matches for serbian word', {
      serbian,
      matchCount: matches.length,
      matches: matches.map(m => ({ id: m._id, unit: m.unitNumber })),
    }, 'H3');
    // #endregion

    const confirm = await promptUser(
      `\nReset audio for ${matches.length} word(s)?`
    );

    if (!confirm) {
      console.log("❌ Cancelled");
      return;
    }

    for (const word of matches) {
      // #region agent log
      log('reset-faulty-audio.ts:203', 'Resetting word audio', {
        vocabularyId: word._id,
        serbian: word.serbian,
        unitNumber: word.unitNumber,
      }, 'H3');
      // #endregion

      await client.mutation(api.vocabulary.resetVocabularyAudio, {
        vocabularyId: word._id as any,
      });

      // #region agent log
      log('reset-faulty-audio.ts:215', 'Word audio reset complete', {
        vocabularyId: word._id,
        serbian: word.serbian,
      }, 'H3');
      // #endregion

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

    // #region agent log
    log('reset-faulty-audio.ts:239', 'Resetting by ID', { vocabularyId: id }, 'H1');
    // #endregion

    try {
      const result = await client.mutation(api.vocabulary.resetVocabularyAudio, {
        vocabularyId: id as any,
      });

      // #region agent log
      log('reset-faulty-audio.ts:249', 'Reset by ID successful', { result }, 'H1');
      // #endregion

      console.log(`✅ Successfully reset audio for: ${result.serbian} (Unit ${result.unitNumber})`);
    } catch (error) {
      // #region agent log
      log('reset-faulty-audio.ts:256', 'Reset by ID failed', { vocabularyId: id, error: String(error) }, 'H1');
      // #endregion
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

    // #region agent log
    log('reset-faulty-audio.ts:280', 'Filtering by unit', { unitNumber }, 'H1');
    // #endregion

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

    // #region agent log
    log('reset-faulty-audio.ts:299', 'Found words in unit', {
      unitNumber,
      wordCount: unitWords.length,
    }, 'H1');
    // #endregion

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
        // #region agent log
        log('reset-faulty-audio.ts:320', 'Resetting unit word', {
          vocabularyId: word._id,
          serbian: word.serbian,
        }, 'H1');
        // #endregion

        await client.mutation(api.vocabulary.resetVocabularyAudio, {
          vocabularyId: word._id as any,
        });

        // #region agent log
        log('reset-faulty-audio.ts:331', 'Unit word reset complete', {
          vocabularyId: word._id,
          serbian: word.serbian,
        }, 'H1');
        // #endregion

        successCount++;
        console.log(`  ✅ Reset: ${word.serbian}`);
      } catch (error) {
        // #region agent log
        log('reset-faulty-audio.ts:342', 'Unit word reset failed', {
          vocabularyId: word._id,
          serbian: word.serbian,
          error: String(error),
        }, 'H1');
        // #endregion

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

  // #region agent log
  log('reset-faulty-audio.ts:377', 'Found words with old audioUrl', {
    count: words.length,
  }, 'H4');
  // #endregion

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
      // #region agent log
      log('reset-faulty-audio.ts:398', 'Resetting old audioUrl word', {
        vocabularyId: word._id,
        serbian: word.serbian,
        oldAudioUrl: word.audioUrl,
      }, 'H4');
      // #endregion

      await client.mutation(api.vocabulary.resetVocabularyAudio, {
        vocabularyId: word._id as any,
      });

      // #region agent log
      log('reset-faulty-audio.ts:410', 'Old audioUrl word reset complete', {
        vocabularyId: word._id,
        serbian: word.serbian,
      }, 'H4');
      // #endregion

      successCount++;
      console.log(`  ✅ Reset: ${word.serbian} (Unit ${word.unitNumber})`);
    } catch (error) {
      // #region agent log
      log('reset-faulty-audio.ts:421', 'Old audioUrl word reset failed', {
        vocabularyId: word._id,
        serbian: word.serbian,
        error: String(error),
      }, 'H4');
      // #endregion

      errorCount++;
      console.error(`  ❌ Failed: ${word.serbian} - ${error}`);
    }
  }

  console.log(
    `\n✅ Successfully reset ${successCount} word(s), ${errorCount} error(s)`
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

  // #region agent log
  log('reset-faulty-audio.ts:459', 'Words without audio', {
    totalCount: words.length,
    unitCounts: Array.from(byUnit.entries()).map(([unit, words]) => ({
      unit,
      count: words.length,
    })),
  }, 'H1');
  // #endregion

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
  // #region agent log
  log('reset-faulty-audio.ts:485', 'Fatal script error', { error: String(error) }, 'H1');
  // #endregion
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
