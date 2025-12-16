import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import * as dotenv from "dotenv";

// Load environment variables from .env.local
dotenv.config({ path: ".env.local" });

const CONVEX_URL = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL;

if (!CONVEX_URL) {
  console.error("❌ CONVEX_URL not found in environment variables");
  process.exit(1);
}

/**
 * Clean Markdown syntax from text
 * Removes: **bold**, *italic*
 * Preserves: Montenegrin markers (word*)
 */
function cleanMarkdown(text: string): string {
  if (!text) return text;
  
  let cleaned = text;
  
  // Remove bold: **text** → text
  cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1');
  
  // Remove italic: *text* → text
  // But preserve Montenegrin markers (word* at end of line or before space/punctuation)
  // Match *text* where * is NOT preceded by alphanumeric and NOT followed by alphanumeric
  // This preserves: "lepo*" or "gdje*" but removes: "*italic*"
  cleaned = cleaned.replace(/(?<![a-zA-Z0-9])\*([^*\s][^*]*?)\*(?![a-zA-Z0-9])/g, '$1');
  
  return cleaned;
}

async function cleanDatabase() {
  console.log("🧹 Cleaning Markdown syntax from database...");
  console.log(`   Convex URL: ${CONVEX_URL}`);
  
  const client = new ConvexHttpClient(CONVEX_URL);
  
  let totalUpdated = 0;
  
  // 1. Clean unitContent (testIntroduction type)
  console.log("\n📝 Cleaning unitContent (testIntroduction)...");
  try {
    const result = await client.mutation(api.units.cleanMarkdownInContent, {
      contentType: "testIntroduction"
    });
    console.log(`   ✅ Updated ${result.updated} testIntroduction entries`);
    totalUpdated += result.updated;
  } catch (e: any) {
    console.error(`   ❌ Error cleaning unitContent: ${e.message}`);
  }
  
  // 2. Clean unitInteractiveTests (categoryInstructions and question fields)
  console.log("\n📋 Cleaning unitInteractiveTests...");
  try {
    const result = await client.mutation(api.units.cleanMarkdownInTests, {});
    console.log(`   ✅ Updated ${result.updated} test questions`);
    console.log(`   ℹ️  Categories cleaned: ${result.categoriesCleaned}`);
    console.log(`   ℹ️  Questions cleaned: ${result.questionsCleaned}`);
    totalUpdated += result.updated;
  } catch (e: any) {
    console.error(`   ❌ Error cleaning tests: ${e.message}`);
  }
  
  console.log(`\n✨ Total updated: ${totalUpdated} entries`);
  console.log("🎉 Cleanup complete!");
}

cleanDatabase().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});



