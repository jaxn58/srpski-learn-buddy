/**
 * Migration Script: Copy all Unit data from Development to Production
 * 
 * This script copies:
 * - unitMetadata (all languages)
 * - unitContent (all sections)
 * - unitInteractiveTests
 * - moduleMetadata
 * - courseVocabulary
 * 
 * from Development DB to Production DB
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import * as dotenv from "dotenv";

// Load .env.local for Development URL
dotenv.config({ path: ".env.local" });

const DEV_CONVEX_URL = process.env.VITE_CONVEX_URL;
const PROD_CONVEX_URL = process.env.VITE_CONVEX_URL_PRODUCTION;

if (!DEV_CONVEX_URL) {
  console.error("❌ VITE_CONVEX_URL not found in .env.local");
  console.error("This should be your Development Convex URL");
  process.exit(1);
}

if (!PROD_CONVEX_URL) {
  console.error("❌ VITE_CONVEX_URL_PRODUCTION not found in .env.local");
  console.error("");
  console.error("Please add your Production Convex URL to .env.local:");
  console.error("  VITE_CONVEX_URL_PRODUCTION=https://your-production-deployment.convex.cloud");
  console.error("");
  console.error("You can find it in:");
  console.error("  1. Vercel Dashboard → Environment Variables → VITE_CONVEX_URL (Production)");
  console.error("  2. Or: Convex Dashboard → Settings → Deployment URL (Production)");
  process.exit(1);
}

const devClient = new ConvexHttpClient(DEV_CONVEX_URL);
const prodClient = new ConvexHttpClient(PROD_CONVEX_URL);

interface MigrationStats {
  moduleMetadata: { total: number; migrated: number; };
  unitMetadata: { total: number; migrated: number; };
  unitContent: { total: number; migrated: number; };
  unitInteractiveTests: { total: number; migrated: number; skipped: number; protected: number; };
  courseVocabulary: { total: number; migrated: number; };
}

async function migrateData() {
  console.log("========================================");
  console.log("🔄 Migrating Units from Dev to Production");
  console.log("========================================");
  console.log("");
  console.log(`📍 Source (Dev):  ${DEV_CONVEX_URL}`);
  console.log(`📍 Target (Prod): ${PROD_CONVEX_URL}`);
  console.log("");
  
  const stats: MigrationStats = {
    moduleMetadata: { total: 0, migrated: 0 },
    unitMetadata: { total: 0, migrated: 0 },
    unitContent: { total: 0, migrated: 0 },
    unitInteractiveTests: { total: 0, migrated: 0, skipped: 0, protected: 0 },
    courseVocabulary: { total: 0, migrated: 0 },
  };

  // Get all questionIds that have user progress in Production (to protect them)
  console.log("🔒 Checking for questions with user progress in Production...");
  let protectedQuestionIds: Set<string>;
  try {
    const questionIdsWithProgress = await prodClient.query(api.progress.getQuestionIdsWithProgress as any);
    protectedQuestionIds = new Set(questionIdsWithProgress || []);
    console.log(`   ✅ Found ${protectedQuestionIds.size} questions with user progress (will be protected)`);
  } catch (e: any) {
    console.warn(`   ⚠️  Could not check for protected questions: ${e.message}`);
    console.warn(`   ⚠️  Proceeding without protection - this may overwrite user progress!`);
    protectedQuestionIds = new Set();
  }

  try {
    // 1. Migrate Module Metadata (Consolidated Structure)
    console.log("📦 Step 1/5: Migrating Module Metadata (Consolidated)...");
    const devModules = await devClient.query(api.modules.getAllModulesConsolidated as any) as any[];
    stats.moduleMetadata.total = devModules?.length || 0;
    
    for (const module of devModules || []) {
      try {
        // Use consolidated structure mutation
        await prodClient.mutation(api.modules.insertConsolidatedModuleMetadata as any, {
          slug: module.slug,
          moduleNumber: module.moduleNumber,
          titleEn: module.titleEn,
          titleDe: module.titleDe,
          descriptionEn: module.descriptionEn,
          descriptionDe: module.descriptionDe,
        });
        stats.moduleMetadata.migrated++;
        console.log(`  ✅ Module ${module.moduleNumber}: ${module.slug}`);
      } catch (e: any) {
        if (e.message?.includes("already exists") || e.message?.includes("duplicate")) {
          console.log(`  ⏭️  Module ${module.moduleNumber}: ${module.slug} (already exists)`);
          stats.moduleMetadata.migrated++;
        } else {
          console.error(`  ❌ Module ${module.moduleNumber}: ${e.message}`);
        }
      }
    }

    // 2. Migrate Unit Metadata (EN + DE)
    console.log("\n📝 Step 2/5: Migrating Unit Metadata...");
    const devUnitsEn = await devClient.query(api.units.getAllUnitsMetadata as any, { language: "en" }) as any[];
    const devUnitsDe = await devClient.query(api.units.getAllUnitsMetadata as any, { language: "de" }) as any[];
    
    const allUnits = [...(devUnitsEn || []), ...(devUnitsDe || [])];
    stats.unitMetadata.total = allUnits.length;
    
    for (const unit of allUnits) {
      try {
        await prodClient.mutation(api.units.insertUnitMetadata as any, {
          unitNumber: unit.unitNumber,
          language: unit.language,
          title: unit.title,
          topics: unit.topics || [],
          grammarFocus: unit.grammarFocus || [],
          vocabularyThemes: unit.vocabularyThemes || [],
          moduleId: unit.moduleId,
        });
        stats.unitMetadata.migrated++;
        console.log(`  ✅ Unit ${unit.unitNumber} (${unit.language}): ${unit.title}`);
      } catch (e: any) {
        if (e.message?.includes("already exists") || e.message?.includes("duplicate")) {
          console.log(`  ⏭️  Unit ${unit.unitNumber} (${unit.language}) (already exists)`);
          stats.unitMetadata.migrated++;
        } else {
          console.error(`  ❌ Unit ${unit.unitNumber} (${unit.language}): ${e.message}`);
        }
      }
    }

    // 3. Migrate Unit Content
    console.log("\n📄 Step 3/5: Migrating Unit Content...");
    // We need to query all units and their content sections
    for (let unitNumber = 1; unitNumber <= 27; unitNumber++) {
      for (const lang of ["en", "de"]) {
        try {
          const content = await devClient.query(api.units.getUnitContentSections as any, { 
            unitNumber, 
            language: lang 
          }) as Record<string, string>;
          
          if (!content || Object.keys(content).length === 0) continue;
          
          for (const [contentType, contentText] of Object.entries(content)) {
            try {
              await prodClient.mutation(api.units.insertUnitContent as any, {
                unitNumber,
                language: lang,
                contentType,
                content: contentText,
              });
              stats.unitContent.migrated++;
            } catch (e: any) {
              if (e.message?.includes("already exists")) {
                stats.unitContent.migrated++;
              } else {
                console.error(`  ❌ Unit ${unitNumber} (${lang}) ${contentType}: ${e.message}`);
              }
            }
          }
          stats.unitContent.total += Object.keys(content).length;
          console.log(`  ✅ Unit ${unitNumber} (${lang}): ${Object.keys(content).length} sections`);
        } catch (e: any) {
          // Unit might not have content, skip
          if (!e.message?.includes("not found")) {
            console.error(`  ⚠️  Unit ${unitNumber} (${lang}): ${e.message}`);
          }
        }
      }
    }

    // 4. Migrate Interactive Tests (with protection for questions with user progress)
    console.log("\n🎯 Step 4/5: Migrating Interactive Tests...");
    console.log(`   🔒 Protecting ${protectedQuestionIds.size} questions with user progress`);
    for (let unitNumber = 1; unitNumber <= 27; unitNumber++) {
      for (const lang of ["en", "de"]) {
        try {
          const tests = await devClient.query(api.units.getUnitInteractiveTest as any, {
            unitNumber,
            language: lang,
          }) as any[];
          
          if (!tests || tests.length === 0) continue;
          
          for (const test of tests) {
            // Check if this question has user progress - if yes, skip to protect user data
            if (protectedQuestionIds.has(test.questionId)) {
              stats.unitInteractiveTests.protected++;
              stats.unitInteractiveTests.skipped++;
              console.log(`  🔒 Unit ${unitNumber} Test ${test.questionId}: Protected (has user progress)`);
              continue;
            }
            
            try {
              await prodClient.mutation(api.units.insertUnitInteractiveTest as any, {
                unitNumber: test.unitNumber,
                language: test.language,
                category: test.category,
                categoryInstructions: test.categoryInstructions,
                questionId: test.questionId,
                questionType: test.questionType,
                question: test.question,
                correctAnswer: test.correctAnswer,
                acceptableAlternatives: test.acceptableAlternatives,
                options: test.options,
                hint: test.hint,
                order: test.order,
              });
              stats.unitInteractiveTests.migrated++;
            } catch (e: any) {
              if (e.message?.includes("already exists")) {
                stats.unitInteractiveTests.migrated++;
              } else {
                console.error(`  ❌ Unit ${unitNumber} Test ${test.questionId}: ${e.message}`);
              }
            }
          }
          stats.unitInteractiveTests.total += tests.length;
          console.log(`  ✅ Unit ${unitNumber} (${lang}): ${tests.length} tests (${stats.unitInteractiveTests.migrated} migrated, ${stats.unitInteractiveTests.protected} protected)`);
        } catch (e: any) {
          // Unit might not have tests, skip
        }
      }
    }

    // 5. Migrate Course Vocabulary
    console.log("\n📚 Step 5/5: Migrating Course Vocabulary...");
    for (let unitNumber = 1; unitNumber <= 27; unitNumber++) {
      try {
        const vocab = await devClient.query(api.vocabulary.getCourseVocabularyByUnit as any, { 
          unitNumber 
        }) as any[];
        
        if (!vocab || vocab.length === 0) continue;
        
        for (const word of vocab) {
          try {
            // Use upsertCourseVocabulary to handle both insert and update
            await prodClient.mutation(api.vocabulary.upsertCourseVocabulary as any, {
              unitNumber: word.unitNumber,
              serbian: word.serbian,
              translations: word.translations || [],
              gender: word.gender,
              pronunciation: word.pronunciation,
            });
            
            // Also update column-based translations if available
            if (word.en || word.de) {
              // Find the courseVocabulary ID first
              const prodWord = await prodClient.query(api.vocabulary.findCourseVocabularyBySerbianAndUnit as any, {
                serbian: word.serbian,
                unitNumber: word.unitNumber,
              });
              
              if (prodWord && prodWord._id) {
                await prodClient.mutation(api.vocabulary.updateCourseVocabularyColumns as any, {
                  courseVocabularyId: prodWord._id,
                  en: word.en || "",
                  de: word.de || "",
                  enAlt: word.enAlt,
                  deAlt: word.deAlt,
                });
              }
            }
            
            stats.courseVocabulary.migrated++;
          } catch (e: any) {
            if (e.message?.includes("already exists") || e.message?.includes("duplicate")) {
              stats.courseVocabulary.migrated++;
            } else {
              console.error(`  ❌ Unit ${unitNumber} Vocab "${word.serbian}": ${e.message}`);
            }
          }
        }
        stats.courseVocabulary.total += vocab.length;
        console.log(`  ✅ Unit ${unitNumber}: ${vocab.length} vocabulary items`);
      } catch (e: any) {
        // Unit might not have vocabulary, skip
        if (!e.message?.includes("not found")) {
          console.error(`  ⚠️  Unit ${unitNumber}: ${e.message}`);
        }
      }
    }

    // Print Summary
    console.log("\n========================================");
    console.log("✅ Migration Complete!");
    console.log("========================================");
    console.log("");
    console.log("📊 Summary:");
    console.log(`  Modules:         ${stats.moduleMetadata.migrated}/${stats.moduleMetadata.total}`);
    console.log(`  Unit Metadata:   ${stats.unitMetadata.migrated}/${stats.unitMetadata.total}`);
    console.log(`  Unit Content:    ${stats.unitContent.migrated}/${stats.unitContent.total}`);
    console.log(`  Tests:           ${stats.unitInteractiveTests.migrated}/${stats.unitInteractiveTests.total} (${stats.unitInteractiveTests.protected} protected)`);
    console.log(`  Vocabulary:      ${stats.courseVocabulary.migrated}/${stats.courseVocabulary.total}`);
    console.log("");
    console.log("🎉 Your Production database is now populated!");
    console.log("");
    console.log("Next steps:");
    console.log("  1. Test your Production app");
    console.log("  2. Verify Unit 1 loads correctly");
    console.log("  3. Remove debug logs if everything works");
    
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  }
}

// Run migration
migrateData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });




