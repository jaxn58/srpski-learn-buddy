import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { COURSE_MODULES } from "../shared/data/course/modules";
import * as dotenv from "dotenv";

// Load environment variables from .env.local
dotenv.config({ path: ".env.local" });

const CONVEX_URL = (process.env.VITE_CONVEX_DEV_URL || process.env.VITE_CONVEX_URL || process.env.CONVEX_URL || "").trim();

if (!CONVEX_URL) {
  console.error("❌ CONVEX_URL not found in environment variables");
  console.error("Please set VITE_CONVEX_URL in .env.local");
  process.exit(1);
}

async function migrateUnitModuleIds() {
  console.log("🚀 Migrating Unit Module IDs to Convex...");
  console.log(`   Convex URL: ${CONVEX_URL}`);

  const client = new ConvexHttpClient(CONVEX_URL);
  const moduleRefCache = new Map<string, string>();
  const moduleMapByLanguage = new Map<string, Map<string, string>>();

  const loadModuleMap = async (language: "en" | "de") => {
    if (moduleMapByLanguage.has(language)) {
      return moduleMapByLanguage.get(language)!;
    }

    const modules = await client.query(api.modules.getAllModules, { language });
    const map = new Map<string, string>();
    for (const mod of modules) {
      if (mod.moduleId && mod._id) {
        map.set(mod.moduleId, mod._id);
      }
    }
    moduleMapByLanguage.set(language, map);
    return map;
  };

  const getModuleRef = async (moduleSlug: string, language: "en" | "de") => {
    const key = `${moduleSlug}:${language}`;
    if (moduleRefCache.has(key)) {
      return moduleRefCache.get(key)!;
    }

    let moduleRef: string | null = null;
    try {
      moduleRef = await client.query(api.modules.getModuleRefBySlug, {
        moduleSlug,
        language,
      });
    } catch (error: any) {
      const message = error?.message || "";
      const missingFunction =
        message.includes("Could not find public function") ||
        message.includes("Unrecognized function");

      if (!missingFunction) {
        throw error;
      }
    }

    if (!moduleRef) {
      const moduleMap = await loadModuleMap(language);
      moduleRef = moduleMap.get(moduleSlug) ?? null;
    }

    if (!moduleRef) {
      throw new Error(`❌ Module reference not found for slug "${moduleSlug}" (${language})`);
    }

    moduleRefCache.set(key, moduleRef);
    return moduleRef;
  };
  let successCount = 0;
  let errorCount = 0;

  // Create a map of unitNumber -> moduleId
  const unitToModuleMap = new Map<number, string>();
  for (const module of COURSE_MODULES) {
    for (const unitNumber of module.units) {
      unitToModuleMap.set(unitNumber, module.id);
    }
  }

  // Process all units
  const allUnitNumbers = Array.from(new Set(unitToModuleMap.keys())).sort((a, b) => a - b);

  for (const unitNumber of allUnitNumbers) {
    const moduleId = unitToModuleMap.get(unitNumber);
    if (!moduleId) {
      console.warn(`⚠️  No module found for unit ${unitNumber}, skipping...`);
      continue;
    }

    console.log(`Processing Unit ${unitNumber} -> Module: ${moduleId}`);

    // Update both English and German entries
    for (const language of ["en", "de"] as const) {
      try {
        const moduleRef = await getModuleRef(moduleId, language);

        await client.mutation(api.units.updateUnitModuleRef, {
          unitNumber,
          language,
          moduleRef,
        });
        process.stdout.write(`  ✅ ${language.toUpperCase()} `);
        successCount++;
      } catch (error: any) {
        // If entry doesn't exist, that's okay - it will be created with moduleId on next insert
        if (error.message?.includes("not found")) {
          console.warn(`  ⚠️  ${language.toUpperCase()} entry not found, will be set on next insert`);
        } else {
          console.error(`  ❌ ${language.toUpperCase()} Error: ${error.message}`);
          errorCount++;
        }
      }
    }
    console.log(); // New line after each unit
  }

  console.log("\n-----------------------------------");
  console.log(`Migration Complete!`);
  console.log(`✅ Successful operations: ${successCount}`);
  console.log(`❌ Failed operations: ${errorCount}`);
  console.log(`\nNote: Units without existing metadata entries will get moduleRef on next insertUnitMetadata call.`);
}

migrateUnitModuleIds().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

