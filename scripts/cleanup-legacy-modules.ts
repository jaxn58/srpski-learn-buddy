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

async function cleanupLegacyModules() {
  console.log("🧹 Cleaning up legacy module entries from Convex...");
  console.log(`   Convex URL: ${CONVEX_URL}`);
  console.log("");

  const client = new ConvexHttpClient(CONVEX_URL);

  try {
    console.log("🔍 Searching for legacy 'module-X' pattern entries...");
    
    const result = await client.mutation(api.modules.removeLegacyModuleEntries, {});
    
    console.log("");
    console.log("-----------------------------------");
    console.log("✅ Cleanup Complete!");
    console.log(`   Total module entries: ${result.total}`);
    console.log(`   Deleted legacy entries: ${result.deleted}`);
    
    if (result.deleted > 0) {
      console.log("");
      console.log("📋 Deleted entries:");
      result.deletedIds.forEach((id: string) => {
        console.log(`   ❌ ${id}`);
      });
    } else {
      console.log("   ℹ️  No legacy entries found.");
    }
    
    console.log("-----------------------------------");
  } catch (error: any) {
    console.error("❌ Fatal error:", error.message);
    process.exit(1);
  }
}

cleanupLegacyModules().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});










