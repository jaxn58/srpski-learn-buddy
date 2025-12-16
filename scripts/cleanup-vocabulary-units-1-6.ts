import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const CONVEX_URL = process.env.CONVEX_URL;

if (!CONVEX_URL) {
  console.error("❌ CONVEX_URL not found in .env.local");
  process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);

async function cleanupVocabulary() {
  console.log("🧹 Cleaning up vocabulary for Units 1-6...");
  console.log(`   Convex URL: ${CONVEX_URL}`);
  console.log("");
  
  try {
    const result = await client.mutation(api.vocabulary.deleteVocabularyByUnits, {
      unitNumbers: [1, 2, 3, 4, 5, 6],
    });
    
    console.log("================================================================================");
    console.log(`✅ Cleanup Complete!`);
    console.log(`   Deleted ${result.deleted} vocabulary entries`);
    console.log("================================================================================");
    console.log("");
    console.log("Next step: Run 'npm run migrate:new-units' to re-migrate with new format");
    
  } catch (error: any) {
    console.error("❌ Cleanup failed:", error.message);
    process.exit(1);
  }
}

cleanupVocabulary().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});



