import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import "dotenv/config";

// #region agent log
const logEndpoint = 'http://127.0.0.1:7243/ingest/e54bf5a1-a12e-470b-9800-914f012d5363';
function log(location: string, message: string, data: any, hypothesisId: string) {
  fetch(logEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location,
      message,
      data,
      timestamp: Date.now(),
      sessionId: 'debug-session',
      hypothesisId,
    }),
  }).catch(() => {});
}
// #endregion

// Production and Development Convex URLs
const PROD_CONVEX_URL = "https://fleet-labrador-324.convex.cloud";
const DEV_CONVEX_URL = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL;

if (!DEV_CONVEX_URL) {
  console.error("❌ DEV CONVEX_URL is not set in .env");
  process.exit(1);
}

console.log("🔄 Audio Sync Configuration:");
console.log(`  📦 Production DB: ${PROD_CONVEX_URL}`);
console.log(`  🔧 Development DB: ${DEV_CONVEX_URL}\n`);

// #region agent log
log('sync-audio-from-production.ts:40', 'Script started', {
  prodUrl: PROD_CONVEX_URL,
  devUrl: DEV_CONVEX_URL,
}, 'H6');
// #endregion

const prodClient = new ConvexHttpClient(PROD_CONVEX_URL);
const devClient = new ConvexHttpClient(DEV_CONVEX_URL);

interface VocabularyWord {
  _id: string;
  serbian: string;
  unitNumber: number;
  audioStorageId?: string;
  audioUrl?: string;
}

async function syncAudioFromProduction() {
  console.log("🔍 Fetching vocabulary from Production...");
  
  // #region agent log
  log('sync-audio-from-production.ts:63', 'Fetching production vocabulary', {}, 'H7');
  // #endregion

  const prodVocabulary = (await prodClient.query(
    api.vocabulary.getAllCourseVocabulary
  )) as VocabularyWord[];

  console.log(`✅ Found ${prodVocabulary.length} words in Production\n`);

  // #region agent log
  log('sync-audio-from-production.ts:73', 'Production vocabulary fetched', {
    totalCount: prodVocabulary.length,
  }, 'H7');
  // #endregion

  console.log("🔍 Fetching vocabulary from Development...");

  const devVocabulary = (await devClient.query(
    api.vocabulary.getAllCourseVocabulary
  )) as VocabularyWord[];

  console.log(`✅ Found ${devVocabulary.length} words in Development\n`);

  // #region agent log
  log('sync-audio-from-production.ts:87', 'Development vocabulary fetched', {
    totalCount: devVocabulary.length,
  }, 'H6');
  // #endregion

  // Analyze audio status
  const prodWithAudio = prodVocabulary.filter((w) => w.audioStorageId || w.audioUrl);
  const devWithAudio = devVocabulary.filter((w) => w.audioStorageId || w.audioUrl);

  console.log("📊 Audio Status:");
  console.log(`  Production: ${prodWithAudio.length}/${prodVocabulary.length} words with audio`);
  console.log(`  Development: ${devWithAudio.length}/${devVocabulary.length} words with audio\n`);

  // #region agent log
  log('sync-audio-from-production.ts:103', 'Audio status comparison', {
    production: {
      total: prodVocabulary.length,
      withAudio: prodWithAudio.length,
    },
    development: {
      total: devVocabulary.length,
      withAudio: devWithAudio.length,
    },
  }, 'H6');
  // #endregion

  // Create a map of serbian word -> production audio data
  const prodAudioMap = new Map<string, { audioStorageId?: string; audioUrl?: string }>();
  
  for (const word of prodVocabulary) {
    if (word.audioStorageId || word.audioUrl) {
      prodAudioMap.set(word.serbian, {
        audioStorageId: word.audioStorageId,
        audioUrl: word.audioUrl,
      });
    }
  }

  console.log("⚠️  WARNING: This script cannot copy actual audio files between Convex deployments.");
  console.log("⚠️  Audio files are stored in Convex Storage and are deployment-specific.");
  console.log("⚠️  You need to regenerate audio in Development.\n");

  console.log("📋 Recommendation:");
  console.log("  1. Use 'pnpm reset:audio' to clear Development audio references");
  console.log("  2. Test audio generation in Development by playing a word");
  console.log("  3. Audio will be generated automatically on-demand\n");

  // #region agent log
  log('sync-audio-from-production.ts:139', 'Sync analysis complete', {
    prodAudioMapSize: prodAudioMap.size,
    cannotCopyFiles: true,
  }, 'H8');
  // #endregion

  // Show words that have audio in Production but not in Development
  console.log("🔍 Words with audio in Production but missing in Development:\n");

  let missingCount = 0;
  const devAudioMap = new Map<string, boolean>();
  
  for (const word of devVocabulary) {
    if (word.audioStorageId || word.audioUrl) {
      devAudioMap.set(word.serbian, true);
    }
  }

  const missingWords: Array<{ serbian: string; unitNumber: number }> = [];

  for (const word of prodVocabulary) {
    if ((word.audioStorageId || word.audioUrl) && !devAudioMap.has(word.serbian)) {
      missingWords.push({ serbian: word.serbian, unitNumber: word.unitNumber });
      missingCount++;
    }
  }

  // Group by unit
  const byUnit = new Map<number, Array<{ serbian: string }>>();
  for (const word of missingWords) {
    if (!byUnit.has(word.unitNumber)) {
      byUnit.set(word.unitNumber, []);
    }
    byUnit.get(word.unitNumber)!.push({ serbian: word.serbian });
  }

  const sortedUnits = Array.from(byUnit.keys()).sort((a, b) => a - b);

  for (const unitNum of sortedUnits) {
    const unitWords = byUnit.get(unitNum)!;
    console.log(`📚 Unit ${unitNum} (${unitWords.length} words):`);
    unitWords.slice(0, 10).forEach((w) => {
      console.log(`   - ${w.serbian}`);
    });
    if (unitWords.length > 10) {
      console.log(`   ... and ${unitWords.length - 10} more`);
    }
    console.log();
  }

  // #region agent log
  log('sync-audio-from-production.ts:191', 'Missing words analysis', {
    missingCount,
    unitCounts: Array.from(byUnit.entries()).map(([unit, words]) => ({
      unit,
      count: words.length,
    })),
  }, 'H9');
  // #endregion

  console.log(`\n📊 Summary:`);
  console.log(`  Total words missing audio in Development: ${missingCount}`);
  console.log(`\n💡 Next Steps:`);
  console.log(`  1. Start Development server with TTS: .\\dev-with-tts.ps1`);
  console.log(`  2. Navigate to vocabulary page in browser`);
  console.log(`  3. Click play button on words to generate audio on-demand`);
  console.log(`  4. Or use a script to bulk-generate audio (not yet implemented)\n`);
}

syncAudioFromProduction().catch((error) => {
  // #region agent log
  log('sync-audio-from-production.ts:213', 'Fatal error', { error: String(error) }, 'H6');
  // #endregion
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
