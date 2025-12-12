/**
 * PROPER translation script using the project's existing LLM infrastructure
 * Uses invokeLLM from server/_core/llm.ts (supports Gemini and OpenAI)
 * 
 * ALWAYS re-translates from English to German, even if German translations already exist
 * 
 * Run with: npx tsx scripts/translate-units-with-ai.ts
 * 
 * Requirements:
 * - GEMINI_API_KEY or OPENAI_API_KEY in .env.local (uses existing project config)
 */

// IMPORTANT: Load environment variables BEFORE importing modules that use them
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

// Load .env FIRST
const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log("✅ Loaded .env");
}

// Load .env.local AND OVERRIDE
const envLocalPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath, override: true });
  console.log("✅ Loaded .env.local (overrides)");
}

// Debug: Check if API keys are loaded
console.log("🔍 Checking API keys:");
console.log(`   GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? "✅ Set (" + process.env.GEMINI_API_KEY.substring(0, 10) + "...)" : "❌ Not set"}`);
console.log(`   OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? "✅ Set (" + process.env.OPENAI_API_KEY.substring(0, 10) + "...)" : "❌ Not set"}`);
console.log(`   BUILT_IN_FORGE_API_KEY: ${process.env.BUILT_IN_FORGE_API_KEY ? "✅ Set" : "❌ Not set"}`);

// Ensure API keys are set in process.env (needed for ENV initialization in server/_core/env.ts)
if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY && !process.env.BUILT_IN_FORGE_API_KEY) {
  console.error("❌ No API key found in environment variables!");
  console.error("💡 Please ensure GEMINI_API_KEY or OPENAI_API_KEY is set in .env.local");
  process.exit(1);
}

// Now import modules that use environment variables
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
// Note: We directly call the API instead of using invokeLLM to avoid ENV initialization issues

const CONVEX_URL = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL;
const BUILT_IN_FORGE_API_KEY = process.env.BUILT_IN_FORGE_API_KEY;
const BUILT_IN_FORGE_API_URL = process.env.BUILT_IN_FORGE_API_URL;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!CONVEX_URL) {
  console.error("❌ CONVEX_URL not found");
  process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);

// Output file for translation log
const LOG_FILE = path.join(process.cwd(), "translation-log.txt");

function log(message: string) {
  console.log(message);
  fs.appendFileSync(LOG_FILE, message + "\n", "utf8");
}

function logError(message: string) {
  console.error(message);
  fs.appendFileSync(LOG_FILE, message + "\n", "utf8");
}

/**
 * Get the translation service being used (same priority as ENV.forgeApiKey)
 */
function getTranslationService(): "forge" | "gemini" | "openai" | null {
  if (BUILT_IN_FORGE_API_KEY) return "forge";
  if (GEMINI_API_KEY) return "gemini";
  if (OPENAI_API_KEY) return "openai";
  return null;
}

/**
 * Helper to list available models (removed for now as we mimic project logic)
 */
// async function detectBestModel...

async function translateText(text: string): Promise<string> {
  // Logic mirrored exactly from server/_core/llm.ts and server/_core/env.ts
  
  // 1. Determine API Key (ENV.forgeApiKey logic)
  const apiKey = BUILT_IN_FORGE_API_KEY || GEMINI_API_KEY || OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error("No API key found (checked BUILT_IN_FORGE_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY)");
  }

  // 2. Determine API URL (resolveApiUrl logic)
  let apiUrl: string;
  if (BUILT_IN_FORGE_API_URL && BUILT_IN_FORGE_API_URL.trim().length > 0) {
    apiUrl = `${BUILT_IN_FORGE_API_URL.replace(/\/$/, "")}/v1/chat/completions`;
    // log(`   Using Forge API URL: ${apiUrl}`); // Debug
  } else if (GEMINI_API_KEY) {
    apiUrl = `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`;
  } else {
    apiUrl = "https://api.openai.com/v1/chat/completions";
  }

  // 3. Determine Model
  // If using Gemini Key (even with Forge URL potentially?), prefer Gemini model
  const model = (GEMINI_API_KEY || (apiKey === GEMINI_API_KEY)) ? "gemini-1.5-flash" : "gpt-4o-mini";

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: "Du bist ein professioneller Übersetzer für Bildungstexte. Übersetze den folgenden englischen Text ins Deutsche. Behalte die Markdown-Formatierung bei. Übersetze technische Begriffe angemessen für einen Serbisch-Sprachkurs.",
          },
          {
            role: "user",
            content: text,
          },
        ],
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error (${response.status}) from ${apiUrl}: ${errorText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || text;

  } catch (error: any) {
    logError(`  ⚠️  Translation error: ${error.message}`);
    throw error;
  }
}

/**
 * Main translation function
 */
async function translateAllUnits() {
  // Clear log file
  fs.writeFileSync(LOG_FILE, "", "utf8");
  log("=".repeat(80));
  log("🌍 AI-POWERED GERMAN TRANSLATION (RE-TRANSLATING ALL UNITS)");
  log("=".repeat(80));
  log(`Generated: ${new Date().toISOString()}\n`);

  const service = getTranslationService();
  if (!service) {
    log("❌ No LLM API key found!");
    log("💡 Please set one of the following in .env.local:");
    log("   - GEMINI_API_KEY (recommended, free tier available)");
    log("   - OPENAI_API_KEY");
    process.exit(1);
  }

  log(`✅ Using translation service: ${service}\n`);
  if (!CONVEX_URL) {
    log("❌ No Convex URL set!");
    process.exit(1);
  }
  log(`📡 Connecting to Convex: ${CONVEX_URL.substring(0, 30)}...\n`);

  try {
    log("📚 Fetching all unit explanations...");
    const explanations = await client.query(api.units.getAllExplanations);
    
    if (!explanations || explanations.length === 0) {
      log("❌ No unit explanations found");
      process.exit(1);
    }

    log(`✅ Found ${explanations.length} unit explanations\n`);
    log("⚠️  NOTE: This script will RE-TRANSLATE all units from English to German\n");
    log("   Even if German translations already exist, they will be overwritten.\n");

    const sorted = explanations.sort((a, b) => a.unitNumber - b.unitNumber);
    let successCount = 0;
    let errorCount = 0;

    for (const unit of sorted) {
      try {
        log(`\n${"=".repeat(80)}`);
        log(`🔄 Processing Unit ${unit.unitNumber}...`);
        log("=".repeat(80));

        // Always translate from English source, regardless of existing German translations
        const translations: {
          overviewGerman?: string;
          grammarExplainedGerman?: string;
          practiceExamplesGerman?: string;
        } = {};

        // Translate overview from English source
        if (unit.overview) {
          log(`  📝 Translating overview from English (${unit.overview.length} chars)...`);
          translations.overviewGerman = await translateText(unit.overview);
          log(`  ✅ Overview translated`);
        }

        // Translate grammar from English source
        if (unit.grammarExplained) {
          log(`  📝 Translating grammar from English (${unit.grammarExplained.length} chars)...`);
          translations.grammarExplainedGerman = await translateText(unit.grammarExplained);
          log(`  ✅ Grammar translated`);
        }

        // Translate practice examples from English source
        if (unit.practiceExamples) {
          log(`  📝 Translating practice examples from English (${unit.practiceExamples.length} chars)...`);
          translations.practiceExamplesGerman = await translateText(unit.practiceExamples);
          log(`  ✅ Practice examples translated`);
        }

        // Save to Convex (overwrites existing German translations)
        log(`  💾 Saving new translations to database...`);
        await client.mutation(api.units.updateGermanTranslationsScript, {
          unitNumber: unit.unitNumber,
          ...translations,
        });

        log(`✅ Unit ${unit.unitNumber} re-translated and saved successfully!`);
        successCount++;

        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error: any) {
        logError(`❌ Failed to translate Unit ${unit.unitNumber}: ${error.message}`);
        if (error.stack) {
          logError(`   Stack: ${error.stack}`);
        }
        errorCount++;
      }
    }

    log(`\n${"=".repeat(80)}`);
    log("📊 SUMMARY");
    log("=".repeat(80));
    log(`\n✅ Successfully re-translated: ${successCount} units`);
    log(`❌ Errors: ${errorCount} units`);
    log(`\n📄 Complete log saved to: ${LOG_FILE}\n`);

  } catch (error: any) {
    logError("❌ Fatal error: " + error.message);
    if (error.stack) {
      logError("Stack: " + error.stack);
    }
    process.exit(1);
  }
}

// Main execution
(async () => {
  try {
    await translateAllUnits();
    console.log("\n✅ Script completed successfully!");
    process.exit(0);
  } catch (error: any) {
    console.error("\n❌ Fatal error:", error);
    if (error.stack) {
      console.error("Stack:", error.stack);
    }
    process.exit(1);
  }
})();
