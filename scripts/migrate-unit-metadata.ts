import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { COURSE_UNITS } from "../shared/data/course/units";
import { getModuleForUnit } from "../shared/data/course/modules";
import * as dotenv from "dotenv";

// Load environment variables from .env.local
dotenv.config({ path: ".env.local" });

const CONVEX_URL = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL;

if (!CONVEX_URL) {
  console.error("❌ CONVEX_URL not found in environment variables");
  console.error("Please set VITE_CONVEX_URL in .env.local");
  process.exit(1);
}

async function migrateUnitMetadata() {
  console.log("🚀 Migrating Unit Metadata to Convex...");
  console.log(`   Convex URL: ${CONVEX_URL}`);

  const client = new ConvexHttpClient(CONVEX_URL);
  const moduleRefCache = new Map<string, string>();

  const getModuleRef = async (moduleSlug: string, language: "en" | "de") => {
    const key = `${moduleSlug}:${language}`;
    if (moduleRefCache.has(key)) {
      return moduleRefCache.get(key)!;
    }

    const moduleRef = await client.query(api.modules.getModuleRefBySlug, {
      moduleSlug,
      language,
    });

    if (!moduleRef) {
      throw new Error(`❌ Module reference not found for slug "${moduleSlug}" (${language})`);
    }

    moduleRefCache.set(key, moduleRef);
    return moduleRef;
  };
  let successCount = 0;
  let errorCount = 0;

  for (const unit of COURSE_UNITS) {
    console.log(`Processing Unit ${unit.number}: ${unit.titleEnglish}`);
    const module = getModuleForUnit(unit.number);
    const moduleSlug = module?.id;

    // 1. Migrate English Data
    try {
      const moduleRef = moduleSlug ? await getModuleRef(moduleSlug, "en") : undefined;
      await client.mutation(api.units.insertUnitMetadata, {
        unitNumber: unit.number,
        language: "en",
        title: unit.titleEnglish,
        topics: unit.topics,
        grammarFocus: unit.grammarFocus,
        vocabularyThemes: unit.vocabularyThemes,
        moduleRef,
      });
      process.stdout.write("  ✅ EN ");
      successCount++;
    } catch (error: any) {
      console.error(`  ❌ EN Error: ${error.message}`);
      errorCount++;
    }

    // 2. Migrate German Data
    try {
      const moduleRef = moduleSlug ? await getModuleRef(moduleSlug, "de") : undefined;
      await client.mutation(api.units.insertUnitMetadata, {
        unitNumber: unit.number,
        language: "de",
        title: unit.titleGerman || `[TODO] ${unit.titleEnglish}`,
        topics: unit.topicsGerman || unit.topics.map(t => `[TODO] ${t}`),
        // Grammar and Vocab themes are currently only in English in the source file
        grammarFocus: unit.grammarFocus.map(t => `[TODO] ${t}`),
        vocabularyThemes: unit.vocabularyThemes.map(t => `[TODO] ${t}`),
        moduleRef,
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

migrateUnitMetadata().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
