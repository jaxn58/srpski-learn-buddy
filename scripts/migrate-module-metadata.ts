import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { COURSE_MODULES } from "../shared/data/course/modules";
import * as dotenv from "dotenv";

// Load environment variables from .env.local
dotenv.config({ path: ".env.local" });

const CONVEX_URL = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL;

if (!CONVEX_URL) {
  console.error("❌ CONVEX_URL not found in environment variables");
  console.error("Please set VITE_CONVEX_URL in .env.local");
  process.exit(1);
}

interface OldModuleMetadata {
  _id: string;
  moduleId: string;
  language: string;
  title: string;
  description: string;
}

async function migrateModuleMetadata() {
  console.log("🚀 Migrating Module Metadata to new structure...");
  console.log(`   Convex URL: ${CONVEX_URL}\n`);

  const client = new ConvexHttpClient(CONVEX_URL);
  let successCount = 0;
  let errorCount = 0;

  try {
    // Step 1: Fetch all existing moduleMetadata entries
    console.log("📊 Step 1: Fetching existing module metadata...");
    const allModules = await client.query(api.modules.getAllModules, { language: "en" });
    
    // Also fetch German entries
    const allModulesDe = await client.query(api.modules.getAllModules, { language: "de" });
    
    // Combine and group by moduleId
    const modulesBySlug = new Map<string, { en?: OldModuleMetadata; de?: OldModuleMetadata }>();
    
    // Process English entries
    for (const module of allModules as OldModuleMetadata[]) {
      if (!modulesBySlug.has(module.moduleId)) {
        modulesBySlug.set(module.moduleId, {});
      }
      modulesBySlug.get(module.moduleId)!.en = module;
    }
    
    // Process German entries
    for (const module of allModulesDe as OldModuleMetadata[]) {
      if (!modulesBySlug.has(module.moduleId)) {
        modulesBySlug.set(module.moduleId, {});
      }
      modulesBySlug.get(module.moduleId)!.de = module;
    }

    console.log(`   Found ${modulesBySlug.size} unique modules in database\n`);

    // Step 2: Create consolidated module entries
    // Also include modules from COURSE_MODULES that might not be in DB yet
    console.log("📝 Step 2: Creating consolidated module entries...");
    const moduleIdMap = new Map<string, string>(); // slug -> new _id

    // First, process modules found in database
    for (const [slug, entries] of modulesBySlug.entries()) {
      const enEntry = entries.en;
      const deEntry = entries.de;

      // Find module number from COURSE_MODULES
      const courseModule = COURSE_MODULES.find(m => m.id === slug);
      const moduleNumber = courseModule?.number;

      // Use data from COURSE_MODULES as source of truth, fallback to DB entries
      const titleEn = courseModule?.titleEnglish || enEntry?.title || "";
      const titleDe = courseModule?.titleGerman || deEntry?.title || "";
      const descriptionEn = courseModule?.description || enEntry?.description || "";
      const descriptionDe = courseModule?.descriptionGerman || deEntry?.description || "";

      if (!titleEn || !titleDe) {
        console.warn(`⚠️  Warning: Missing data for module "${slug}"`);
      }

      try {
        // Check if consolidated entry already exists
        const existing = await client.query(api.modules.getModuleBySlug, { slug });
        
        let newModuleId: string;
        
        if (existing) {
          // Update existing entry
          console.log(`   ↻ Updating module "${slug}" (${titleEn})...`);
          await client.mutation(api.modules.updateModuleMetadata, {
            moduleId: existing._id,
            titleDe,
            titleEn,
            descriptionDe,
            descriptionEn,
            slug,
            moduleNumber,
          });
          newModuleId = existing._id;
        } else {
          // Create new consolidated entry
          console.log(`   ➕ Creating module "${slug}" (${titleEn})...`);
          newModuleId = await client.mutation(api.modules.insertConsolidatedModuleMetadata, {
            titleDe,
            titleEn,
            descriptionDe,
            descriptionEn,
            slug,
            moduleNumber,
          });
        }

        moduleIdMap.set(slug, newModuleId);
        successCount++;
        console.log(`      ✅ Created/Updated with ID: ${newModuleId}`);
      } catch (error: any) {
        console.error(`      ❌ Error: ${error.message}`);
        errorCount++;
      }
    }

    // Also create modules from COURSE_MODULES that weren't in database
    console.log("\n📝 Step 2b: Creating modules from COURSE_MODULES that weren't in database...");
    for (const courseModule of COURSE_MODULES) {
      // Skip if already processed
      if (moduleIdMap.has(courseModule.id)) {
        continue;
      }

      const titleEn = courseModule.titleEnglish;
      const titleDe = courseModule.titleGerman;
      const descriptionEn = courseModule.description;
      const descriptionDe = courseModule.descriptionGerman;
      const slug = courseModule.id;
      const moduleNumber = courseModule.number;

      try {
        // Check if consolidated entry already exists
        const existing = await client.query(api.modules.getModuleBySlug, { slug });
        
        let newModuleId: string;
        
        if (existing) {
          // Update existing entry
          console.log(`   ↻ Updating module "${slug}" (${titleEn})...`);
          await client.mutation(api.modules.updateModuleMetadata, {
            moduleId: existing._id,
            titleDe,
            titleEn,
            descriptionDe,
            descriptionEn,
            slug,
            moduleNumber,
          });
          newModuleId = existing._id;
        } else {
          // Create new consolidated entry
          console.log(`   ➕ Creating module "${slug}" (${titleEn})...`);
          newModuleId = await client.mutation(api.modules.insertConsolidatedModuleMetadata, {
            titleDe,
            titleEn,
            descriptionDe,
            descriptionEn,
            slug,
            moduleNumber,
          });
        }

        moduleIdMap.set(slug, newModuleId);
        successCount++;
        console.log(`      ✅ Created/Updated with ID: ${newModuleId}`);
      } catch (error: any) {
        console.error(`      ❌ Error: ${error.message}`);
        errorCount++;
      }
    }

    console.log(`\n✅ Created/Updated ${successCount} modules`);
    if (errorCount > 0) {
      console.error(`❌ Failed ${errorCount} modules\n`);
    }

    // Step 3: Update unitMetadata entries
    console.log("\n📝 Step 3: Updating unitMetadata entries...");
    let unitUpdateCount = 0;
    let unitErrorCount = 0;

    // Get all unitMetadata entries
    for (let unitNumber = 1; unitNumber <= 27; unitNumber++) {
      for (const language of ["en", "de"]) {
        try {
          const unitMetadata = await client.query(api.units.getUnitMetadata, {
            unitNumber,
            language,
          });

          if (unitMetadata?.moduleId) {
            const newModuleId = moduleIdMap.get(unitMetadata.moduleId);
            
            if (newModuleId) {
              await client.mutation(api.units.updateUnitModuleMetadataId, {
                unitNumber,
                language,
                moduleMetadataId: newModuleId,
              });
              unitUpdateCount++;
              if (unitNumber <= 3) {
                // Only log first few for brevity
                console.log(`   ✅ Unit ${unitNumber} (${language}): Updated moduleMetadataId`);
              }
            } else {
              console.warn(`   ⚠️  Unit ${unitNumber} (${language}): Module "${unitMetadata.moduleId}" not found in map`);
            }
          }
        } catch (error: any) {
          if (unitNumber <= 3) {
            console.error(`   ❌ Unit ${unitNumber} (${language}): ${error.message}`);
          }
          unitErrorCount++;
        }
      }
    }

    console.log(`\n✅ Updated ${unitUpdateCount} unitMetadata entries`);
    if (unitErrorCount > 0) {
      console.error(`❌ Failed ${unitErrorCount} unitMetadata updates\n`);
    }

    // Summary
    console.log("\n" + "=".repeat(80));
    console.log("📊 MIGRATION SUMMARY");
    console.log("=".repeat(80));
    console.log(`✅ Modules created/updated: ${successCount}`);
    console.log(`✅ UnitMetadata entries updated: ${unitUpdateCount}`);
    if (errorCount > 0 || unitErrorCount > 0) {
      console.log(`❌ Errors: ${errorCount + unitErrorCount}`);
    } else {
      console.log("✅ Migration completed successfully!");
    }
    console.log("=".repeat(80));

  } catch (error: any) {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  }
}

migrateModuleMetadata().catch((error) => {
  console.error("❌ Migration script failed:", error);
  process.exit(1);
});
