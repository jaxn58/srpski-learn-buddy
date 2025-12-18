import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import "dotenv/config";
import * as readline from "readline";

// PRODUCTION Convex URL (hardcoded for safety)
const PROD_CONVEX_URL = "https://fleet-labrador-324.convex.cloud";
const ADMIN_SECRET = process.env.ADMIN_SECRET;

if (!ADMIN_SECRET) {
  console.error("❌ ADMIN_SECRET is not set in .env");
  console.error("💡 Add ADMIN_SECRET=your-secret-key to .env file");
  process.exit(1);
}

console.log("🚨 PRODUCTION AUDIO RESET TOOL");
console.log(`📦 Target: ${PROD_CONVEX_URL}\n`);

const client = new ConvexHttpClient(PROD_CONVEX_URL);

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

async function resetProductionAudio() {
  console.log("⚠️  WARNING: This script will reset audio on PRODUCTION!");
  console.log("⚠️  Make sure you are logged in as admin/superadmin.\n");

  const confirm = await promptUser("Continue with PRODUCTION reset?");
  if (!confirm) {
    console.log("❌ Cancelled");
    return;
  }

  console.log("\n🔍 Fetching vocabulary from Production...");

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

  console.log("📊 Production Audio Status:");
  console.log(`  ✅ With Storage ID: ${withStorageId.length}`);
  console.log(`  ⚠️  With old audioUrl only: ${withOldAudioUrl.length}`);
  console.log(`  ❌ Without audio: ${withoutAudio.length}\n`);

  // Interactive mode
  console.log("🎯 Reset Options:");
  console.log("1. Reset specific word by serbian text");
  console.log("2. Reset specific word by vocabulary ID");
  console.log("3. Reset all words in a specific unit");
  console.log("4. Exit\n");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question("Choose an option (1-4): ", async (choice) => {
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
          console.log("👋 Exiting...");
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
      `\n⚠️  Reset audio for ${matches.length} word(s) on PRODUCTION?`
    );

    if (!confirm) {
      console.log("❌ Cancelled");
      return;
    }

    for (const word of matches) {
      try {
        await client.mutation(api.vocabulary.resetVocabularyAudio, {
          vocabularyId: word._id as any,
          adminSecret: ADMIN_SECRET,
        });
        console.log(`  ✅ Reset: ${word.serbian} (Unit ${word.unitNumber})`);
      } catch (error) {
        console.error(`  ❌ Failed: ${word.serbian} - ${error}`);
      }
    }

    console.log(`\n✅ Successfully reset ${matches.length} word(s)`);
    console.log("💡 Audio will be regenerated automatically when played next time.");
  });
}

async function resetById() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question("Enter vocabulary ID: ", async (id) => {
    rl.close();

    const confirm = await promptUser(
      `\n⚠️  Reset audio for vocabulary ID "${id}" on PRODUCTION?`
    );

    if (!confirm) {
      console.log("❌ Cancelled");
      return;
    }

    try {
      const result = await client.mutation(api.vocabulary.resetVocabularyAudio, {
        vocabularyId: id as any,
        adminSecret: ADMIN_SECRET,
      });

      console.log(`✅ Successfully reset audio for: ${result.serbian} (Unit ${result.unitNumber})`);
      console.log("💡 Audio will be regenerated automatically when played next time.");
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
      `\n⚠️  Reset audio for all ${unitWords.length} words in unit ${unitNumber} on PRODUCTION?`
    );

    if (!confirm) {
      console.log("❌ Cancelled");
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    for (const word of unitWords) {
      try {
        await client.mutation(api.vocabulary.resetVocabularyAudio, {
          vocabularyId: word._id as any,
          adminSecret: ADMIN_SECRET,
        });
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
    console.log("💡 Audio will be regenerated automatically when played next time.");
  });
}

resetProductionAudio().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
