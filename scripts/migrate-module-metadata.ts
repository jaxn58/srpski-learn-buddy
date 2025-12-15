import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { COURSE_MODULES } from "../shared/data/course/modules";
import * as dotenv from "dotenv";

// Load environment variables from .env.local
dotenv.config({ path: ".env.local" });

const CONVEX_URL = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL;

if (!CONVEX_URL) {
  console.error("❌ CONVEX_URL not found in environment variables");
  process.exit(1);
}

async function migrateModuleMetadata() {
  console.log("🚀 Migrating Module Metadata to Convex...");
  console.log(`   Convex URL: ${CONVEX_URL}`);

  const client = new ConvexHttpClient(CONVEX_URL);
  let successCount = 0;
  let errorCount = 0;

  for (const module of COURSE_MODULES) {
    console.log(`Processing Module ${module.number}: ${module.titleEnglish}`);

    // 1. Migrate English Data
    try {
      await client.mutation(api.modules.insertModuleMetadata, {
        moduleId: module.id,
        language: "en",
        title: module.titleEnglish,
        description: module.description,
      });
      process.stdout.write("  ✅ EN ");
      successCount++;
    } catch (error: any) {
      console.error(`  ❌ EN Error: ${error.message}`);
      errorCount++;
    }

    // 2. Migrate German Data
    try {
      await client.mutation(api.modules.insertModuleMetadata, {
        moduleId: module.id,
        language: "de",
        title: module.titleGerman || `[TODO] ${module.titleEnglish}`,
        description: module.descriptionGerman || `[TODO] ${module.description}`,
      });
      process.stdout.write("✅ DE\n");
      successCount++;
    } catch (error: any) {
      console.error(`  ❌ DE Error: ${error.message}\n`);
      errorCount++;
    }
  }

  console.log("\n-----------------------------------");
  console.log(`Migration Complete!`);
  console.log(`✅ Successful operations: ${successCount}`);
  console.log(`❌ Failed operations: ${errorCount}`);
}

migrateModuleMetadata().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
