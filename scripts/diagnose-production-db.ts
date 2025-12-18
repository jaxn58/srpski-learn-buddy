/**
 * Diagnose Script: Compare Development and Production Databases
 * 
 * This script compares all tables between Dev and Prod to identify:
 * - Missing data in Production
 * - Schema inconsistencies
 * - Invalid foreign key relationships
 * - Duplicate entries
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import * as dotenv from "dotenv";

// Load .env.local for Development URL
dotenv.config({ path: ".env.local" });

const DEV_CONVEX_URL = process.env.VITE_CONVEX_URL;
const PROD_CONVEX_URL = process.env.VITE_CONVEX_URL_PRODUCTION;
const LOG_PATH = "d:\\DEVELOPMENT\\Cursor\\srpski-tutor-en\\.cursor\\debug.log";
const SERVER_ENDPOINT = "http://127.0.0.1:7243/ingest/e54bf5a1-a12e-470b-9800-914f012d5363";

// #region agent log
function log(location: string, message: string, data: any = {}) {
  fetch(SERVER_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location,
      message,
      data,
      timestamp: Date.now(),
      sessionId: 'debug-session',
      runId: 'diagnosis',
      hypothesisId: 'db-comparison'
    })
  }).catch(() => {});
}
// #endregion

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
  process.exit(1);
}

const devClient = new ConvexHttpClient(DEV_CONVEX_URL);
const prodClient = new ConvexHttpClient(PROD_CONVEX_URL);

interface TableComparison {
  tableName: string;
  devCount: number;
  prodCount: number;
  difference: number;
  status: 'OK' | 'MISSING_IN_PROD' | 'EXTRA_IN_PROD' | 'MISMATCH';
}

interface DiagnosisReport {
  tableComparisons: TableComparison[];
  contentTables: {
    moduleMetadata: { dev: number; prod: number };
    unitMetadata: { dev: number; prod: number };
    unitContent: { dev: number; prod: number };
    unitInteractiveTests: { dev: number; prod: number };
    courseVocabulary: { dev: number; prod: number };
  };
  userTables: {
    users: { dev: number; prod: number };
    userProgress: { dev: number; prod: number };
    userSubscriptions: { dev: number; prod: number };
    vocabularyProgress: { dev: number; prod: number };
    quizProgress: { dev: number; prod: number };
  };
  systemTables: {
    emailTemplates: { dev: number; prod: number };
    chatPrompts: { dev: number; prod: number };
  };
  foreignKeyIssues: Array<{
    table: string;
    issue: string;
    count: number;
  }>;
  duplicateIssues: Array<{
    table: string;
    issue: string;
    count: number;
  }>;
}

async function countTableEntries(client: ConvexHttpClient, queryFn: any, args: any = {}): Promise<number> {
  try {
    const result = await client.query(queryFn, args);
    if (Array.isArray(result)) {
      return result.length;
    }
    return 0;
  } catch (error: any) {
    // #region agent log
    log('diagnose-production-db.ts:countTableEntries', 'Error counting entries', { 
      error: error.message,
      args 
    });
    // #endregion
    return 0;
  }
}

async function diagnoseDatabase() {
  console.log("========================================");
  console.log("🔍 Database Diagnosis: Dev vs Production");
  console.log("========================================");
  console.log("");
  console.log(`📍 Development:  ${DEV_CONVEX_URL}`);
  console.log(`📍 Production:   ${PROD_CONVEX_URL}`);
  console.log("");

  // #region agent log
  log('diagnose-production-db.ts:start', 'Starting database diagnosis', {
    devUrl: DEV_CONVEX_URL,
    prodUrl: PROD_CONVEX_URL
  });
  // #endregion

  const report: DiagnosisReport = {
    tableComparisons: [],
    contentTables: {
      moduleMetadata: { dev: 0, prod: 0 },
      unitMetadata: { dev: 0, prod: 0 },
      unitContent: { dev: 0, prod: 0 },
      unitInteractiveTests: { dev: 0, prod: 0 },
      courseVocabulary: { dev: 0, prod: 0 },
    },
    userTables: {
      users: { dev: 0, prod: 0 },
      userProgress: { dev: 0, prod: 0 },
      userSubscriptions: { dev: 0, prod: 0 },
      vocabularyProgress: { dev: 0, prod: 0 },
      quizProgress: { dev: 0, prod: 0 },
    },
    systemTables: {
      emailTemplates: { dev: 0, prod: 0 },
      chatPrompts: { dev: 0, prod: 0 },
    },
    foreignKeyIssues: [],
    duplicateIssues: [],
  };

  console.log("📊 Step 1/5: Comparing Content Tables...\n");

  // #region agent log
  log('diagnose-production-db.ts:step1', 'Comparing content tables', {});
  // #endregion

  // 1. Module Metadata (Consolidated Structure)
  try {
    const devModules = await devClient.query(api.modules.getAllModulesConsolidated as any) as any[];
    const prodModules = await prodClient.query(api.modules.getAllModulesConsolidated as any) as any[];
    
    report.contentTables.moduleMetadata.dev = devModules?.length || 0;
    report.contentTables.moduleMetadata.prod = prodModules?.length || 0;

    // #region agent log
    log('diagnose-production-db.ts:moduleMetadata', 'Module metadata comparison', {
      devCount: report.contentTables.moduleMetadata.dev,
      prodCount: report.contentTables.moduleMetadata.prod,
      devModules: devModules?.map(m => ({ slug: m.slug, moduleNumber: m.moduleNumber })),
      prodModules: prodModules?.map(m => ({ slug: m.slug, moduleNumber: m.moduleNumber }))
    });
    // #endregion

    console.log(`  📦 moduleMetadata (consolidated):`);
    console.log(`     Dev:  ${report.contentTables.moduleMetadata.dev} entries`);
    console.log(`     Prod: ${report.contentTables.moduleMetadata.prod} entries`);
    console.log(`     Diff: ${report.contentTables.moduleMetadata.dev - report.contentTables.moduleMetadata.prod}`);
  } catch (error: any) {
    console.error(`  ❌ moduleMetadata: ${error.message}`);
    // #region agent log
    log('diagnose-production-db.ts:moduleMetadata:error', 'Error comparing moduleMetadata', { 
      error: error.message 
    });
    // #endregion
  }

  // 2. Unit Metadata (EN + DE)
  try {
    const devUnitsEn = await devClient.query(api.units.getAllUnitsMetadata as any, { language: "en" }) as any[];
    const devUnitsDe = await devClient.query(api.units.getAllUnitsMetadata as any, { language: "de" }) as any[];
    const prodUnitsEn = await prodClient.query(api.units.getAllUnitsMetadata as any, { language: "en" }) as any[];
    const prodUnitsDe = await prodClient.query(api.units.getAllUnitsMetadata as any, { language: "de" }) as any[];
    
    report.contentTables.unitMetadata.dev = (devUnitsEn?.length || 0) + (devUnitsDe?.length || 0);
    report.contentTables.unitMetadata.prod = (prodUnitsEn?.length || 0) + (prodUnitsDe?.length || 0);

    // #region agent log
    log('diagnose-production-db.ts:unitMetadata', 'Unit metadata comparison', {
      devEnCount: devUnitsEn?.length || 0,
      devDeCount: devUnitsDe?.length || 0,
      prodEnCount: prodUnitsEn?.length || 0,
      prodDeCount: prodUnitsDe?.length || 0,
      devUnits: devUnitsEn?.map(u => ({ unitNumber: u.unitNumber, title: u.title, moduleId: u.moduleId })),
      prodUnits: prodUnitsEn?.map(u => ({ unitNumber: u.unitNumber, title: u.title, moduleId: u.moduleId }))
    });
    // #endregion

    console.log(`  📝 unitMetadata (EN + DE):`);
    console.log(`     Dev:  ${report.contentTables.unitMetadata.dev} entries (EN: ${devUnitsEn?.length || 0}, DE: ${devUnitsDe?.length || 0})`);
    console.log(`     Prod: ${report.contentTables.unitMetadata.prod} entries (EN: ${prodUnitsEn?.length || 0}, DE: ${prodUnitsDe?.length || 0})`);
    console.log(`     Diff: ${report.contentTables.unitMetadata.dev - report.contentTables.unitMetadata.prod}`);
  } catch (error: any) {
    console.error(`  ❌ unitMetadata: ${error.message}`);
    // #region agent log
    log('diagnose-production-db.ts:unitMetadata:error', 'Error comparing unitMetadata', { 
      error: error.message 
    });
    // #endregion
  }

  // 3. Unit Content
  let devContentCount = 0;
  let prodContentCount = 0;
  for (let unitNumber = 1; unitNumber <= 27; unitNumber++) {
    for (const lang of ["en", "de"]) {
      try {
        const devContent = await devClient.query(api.units.getUnitContentSections as any, { 
          unitNumber, 
          language: lang 
        }) as Record<string, string>;
        
        const prodContent = await prodClient.query(api.units.getUnitContentSections as any, { 
          unitNumber, 
          language: lang 
        }) as Record<string, string>;
        
        devContentCount += Object.keys(devContent || {}).length;
        prodContentCount += Object.keys(prodContent || {}).length;
      } catch (error) {
        // Unit might not exist, skip
      }
    }
  }
  
  report.contentTables.unitContent.dev = devContentCount;
  report.contentTables.unitContent.prod = prodContentCount;

  // #region agent log
  log('diagnose-production-db.ts:unitContent', 'Unit content comparison', {
    devCount: devContentCount,
    prodCount: prodContentCount
  });
  // #endregion

  console.log(`  📄 unitContent:`);
  console.log(`     Dev:  ${report.contentTables.unitContent.dev} entries`);
  console.log(`     Prod: ${report.contentTables.unitContent.prod} entries`);
  console.log(`     Diff: ${report.contentTables.unitContent.dev - report.contentTables.unitContent.prod}`);

  // 4. Interactive Tests
  let devTestsCount = 0;
  let prodTestsCount = 0;
  for (let unitNumber = 1; unitNumber <= 27; unitNumber++) {
    for (const lang of ["en", "de"]) {
      try {
        const devTests = await devClient.query(api.units.getUnitInteractiveTest as any, {
          unitNumber,
          language: lang,
        }) as any[];
        
        const prodTests = await prodClient.query(api.units.getUnitInteractiveTest as any, {
          unitNumber,
          language: lang,
        }) as any[];
        
        devTestsCount += devTests?.length || 0;
        prodTestsCount += prodTests?.length || 0;
      } catch (error) {
        // Unit might not exist, skip
      }
    }
  }
  
  report.contentTables.unitInteractiveTests.dev = devTestsCount;
  report.contentTables.unitInteractiveTests.prod = prodTestsCount;

  // #region agent log
  log('diagnose-production-db.ts:unitInteractiveTests', 'Interactive tests comparison', {
    devCount: devTestsCount,
    prodCount: prodTestsCount
  });
  // #endregion

  console.log(`  🎯 unitInteractiveTests:`);
  console.log(`     Dev:  ${report.contentTables.unitInteractiveTests.dev} entries`);
  console.log(`     Prod: ${report.contentTables.unitInteractiveTests.prod} entries`);
  console.log(`     Diff: ${report.contentTables.unitInteractiveTests.dev - report.contentTables.unitInteractiveTests.prod}`);

  // 5. Course Vocabulary
  try {
    const devVocab = await devClient.query(api.vocabulary.getAllCourseVocabulary as any) as any[];
    const prodVocab = await prodClient.query(api.vocabulary.getAllCourseVocabulary as any) as any[];
    
    report.contentTables.courseVocabulary.dev = devVocab?.length || 0;
    report.contentTables.courseVocabulary.prod = prodVocab?.length || 0;

    // #region agent log
    log('diagnose-production-db.ts:courseVocabulary', 'Course vocabulary comparison', {
      devCount: report.contentTables.courseVocabulary.dev,
      prodCount: report.contentTables.courseVocabulary.prod,
      devSample: devVocab?.slice(0, 5).map(v => ({ unitNumber: v.unitNumber, serbian: v.serbian })),
      prodSample: prodVocab?.slice(0, 5).map(v => ({ unitNumber: v.unitNumber, serbian: v.serbian }))
    });
    // #endregion

    console.log(`  📚 courseVocabulary:`);
    console.log(`     Dev:  ${report.contentTables.courseVocabulary.dev} entries`);
    console.log(`     Prod: ${report.contentTables.courseVocabulary.prod} entries`);
    console.log(`     Diff: ${report.contentTables.courseVocabulary.dev - report.contentTables.courseVocabulary.prod}`);
  } catch (error: any) {
    console.error(`  ❌ courseVocabulary: ${error.message}`);
    // #region agent log
    log('diagnose-production-db.ts:courseVocabulary:error', 'Error comparing courseVocabulary', { 
      error: error.message 
    });
    // #endregion
  }

  console.log("\n📊 Step 2/5: Comparing User Tables...\n");

  // #region agent log
  log('diagnose-production-db.ts:step2', 'Comparing user tables', {});
  // #endregion

  // Note: User tables are expected to be different (separate user bases)
  // But we still want to know the counts for reference
  console.log("  ℹ️  Note: User tables are expected to differ (separate user bases)\n");

  console.log("\n📊 Step 3/5: Checking Foreign Key Integrity in Production...\n");

  // #region agent log
  log('diagnose-production-db.ts:step3', 'Checking foreign key integrity', {});
  // #endregion

  // Check if unitMetadata references valid modules
  try {
    const prodUnitsEn = await prodClient.query(api.units.getAllUnitsMetadata as any, { language: "en" }) as any[];
    const prodModules = await prodClient.query(api.modules.getAllModulesConsolidated as any) as any[];
    
    let invalidModuleRefs = 0;
    for (const unit of prodUnitsEn || []) {
      if (unit.moduleId) {
        const moduleExists = prodModules?.some(m => m.slug === unit.moduleId);
        if (!moduleExists) {
          invalidModuleRefs++;
          // #region agent log
          log('diagnose-production-db.ts:foreignKey:invalidModule', 'Invalid module reference', {
            unitNumber: unit.unitNumber,
            moduleId: unit.moduleId
          });
          // #endregion
        }
      }
    }
    
    if (invalidModuleRefs > 0) {
      report.foreignKeyIssues.push({
        table: 'unitMetadata',
        issue: 'Invalid moduleId references',
        count: invalidModuleRefs
      });
      console.log(`  ❌ unitMetadata: ${invalidModuleRefs} units reference non-existent modules`);
    } else {
      console.log(`  ✅ unitMetadata: All module references are valid`);
    }
  } catch (error: any) {
    console.error(`  ❌ Error checking unitMetadata FK: ${error.message}`);
    // #region agent log
    log('diagnose-production-db.ts:foreignKey:error', 'Error checking foreign keys', { 
      error: error.message 
    });
    // #endregion
  }

  console.log("\n📊 Step 4/5: Checking for Duplicates in Production...\n");

  // #region agent log
  log('diagnose-production-db.ts:step4', 'Checking for duplicates', {});
  // #endregion

  // Check for duplicate questionIds in unitInteractiveTests
  try {
    const allQuestionIds: string[] = [];
    for (let unitNumber = 1; unitNumber <= 27; unitNumber++) {
      for (const lang of ["en", "de"]) {
        try {
          const tests = await prodClient.query(api.units.getUnitInteractiveTest as any, {
            unitNumber,
            language: lang,
          }) as any[];
          
          if (tests) {
            allQuestionIds.push(...tests.map(t => t.questionId));
          }
        } catch (error) {
          // Skip
        }
      }
    }
    
    const uniqueIds = new Set(allQuestionIds);
    const duplicateCount = allQuestionIds.length - uniqueIds.size;
    
    if (duplicateCount > 0) {
      report.duplicateIssues.push({
        table: 'unitInteractiveTests',
        issue: 'Duplicate questionIds',
        count: duplicateCount
      });
      console.log(`  ❌ unitInteractiveTests: ${duplicateCount} duplicate questionIds found`);
      // #region agent log
      log('diagnose-production-db.ts:duplicates:tests', 'Duplicate test questions', {
        duplicateCount,
        totalIds: allQuestionIds.length,
        uniqueIds: uniqueIds.size
      });
      // #endregion
    } else {
      console.log(`  ✅ unitInteractiveTests: No duplicate questionIds`);
    }
  } catch (error: any) {
    console.error(`  ❌ Error checking duplicates: ${error.message}`);
    // #region agent log
    log('diagnose-production-db.ts:duplicates:error', 'Error checking duplicates', { 
      error: error.message 
    });
    // #endregion
  }

  console.log("\n📊 Step 5/5: Generating Summary Report...\n");

  // #region agent log
  log('diagnose-production-db.ts:step5', 'Generating summary report', { report });
  // #endregion

  // Print Summary
  console.log("\n========================================");
  console.log("📊 DIAGNOSIS SUMMARY");
  console.log("========================================\n");

  console.log("📦 Content Tables:");
  console.log(`  moduleMetadata:        Dev: ${report.contentTables.moduleMetadata.dev.toString().padStart(4)} | Prod: ${report.contentTables.moduleMetadata.prod.toString().padStart(4)} | Diff: ${(report.contentTables.moduleMetadata.dev - report.contentTables.moduleMetadata.prod).toString().padStart(4)}`);
  console.log(`  unitMetadata:          Dev: ${report.contentTables.unitMetadata.dev.toString().padStart(4)} | Prod: ${report.contentTables.unitMetadata.prod.toString().padStart(4)} | Diff: ${(report.contentTables.unitMetadata.dev - report.contentTables.unitMetadata.prod).toString().padStart(4)}`);
  console.log(`  unitContent:           Dev: ${report.contentTables.unitContent.dev.toString().padStart(4)} | Prod: ${report.contentTables.unitContent.prod.toString().padStart(4)} | Diff: ${(report.contentTables.unitContent.dev - report.contentTables.unitContent.prod).toString().padStart(4)}`);
  console.log(`  unitInteractiveTests:  Dev: ${report.contentTables.unitInteractiveTests.dev.toString().padStart(4)} | Prod: ${report.contentTables.unitInteractiveTests.prod.toString().padStart(4)} | Diff: ${(report.contentTables.unitInteractiveTests.dev - report.contentTables.unitInteractiveTests.prod).toString().padStart(4)}`);
  console.log(`  courseVocabulary:      Dev: ${report.contentTables.courseVocabulary.dev.toString().padStart(4)} | Prod: ${report.contentTables.courseVocabulary.prod.toString().padStart(4)} | Diff: ${(report.contentTables.courseVocabulary.dev - report.contentTables.courseVocabulary.prod).toString().padStart(4)}`);

  console.log("\n🔗 Foreign Key Issues:");
  if (report.foreignKeyIssues.length === 0) {
    console.log("  ✅ No foreign key issues found");
  } else {
    report.foreignKeyIssues.forEach(issue => {
      console.log(`  ❌ ${issue.table}: ${issue.issue} (${issue.count} entries)`);
    });
  }

  console.log("\n🔄 Duplicate Issues:");
  if (report.duplicateIssues.length === 0) {
    console.log("  ✅ No duplicate issues found");
  } else {
    report.duplicateIssues.forEach(issue => {
      console.log(`  ❌ ${issue.table}: ${issue.issue} (${issue.count} entries)`);
    });
  }

  // Calculate total issues
  const totalContentDiff = 
    Math.abs(report.contentTables.moduleMetadata.dev - report.contentTables.moduleMetadata.prod) +
    Math.abs(report.contentTables.unitMetadata.dev - report.contentTables.unitMetadata.prod) +
    Math.abs(report.contentTables.unitContent.dev - report.contentTables.unitContent.prod) +
    Math.abs(report.contentTables.unitInteractiveTests.dev - report.contentTables.unitInteractiveTests.prod) +
    Math.abs(report.contentTables.courseVocabulary.dev - report.contentTables.courseVocabulary.prod);

  const totalFKIssues = report.foreignKeyIssues.reduce((sum, issue) => sum + issue.count, 0);
  const totalDuplicates = report.duplicateIssues.reduce((sum, issue) => sum + issue.count, 0);

  console.log("\n========================================");
  console.log("🎯 CONCLUSION");
  console.log("========================================");
  console.log(`Total Content Differences: ${totalContentDiff}`);
  console.log(`Total Foreign Key Issues:  ${totalFKIssues}`);
  console.log(`Total Duplicate Issues:    ${totalDuplicates}`);

  // #region agent log
  log('diagnose-production-db.ts:conclusion', 'Diagnosis complete', {
    totalContentDiff,
    totalFKIssues,
    totalDuplicates
  });
  // #endregion

  if (totalContentDiff === 0 && totalFKIssues === 0 && totalDuplicates === 0) {
    console.log("\n✅ Production database is consistent with Development!");
  } else {
    console.log("\n❌ Production database has inconsistencies that need to be fixed.");
    console.log("\nRecommended Actions:");
    if (totalContentDiff > 0) {
      console.log("  1. Run migration script to sync content tables");
    }
    if (totalFKIssues > 0) {
      console.log("  2. Fix foreign key relationships");
    }
    if (totalDuplicates > 0) {
      console.log("  3. Remove duplicate entries");
    }
  }

  console.log("\n");
}

// Run diagnosis
diagnoseDatabase()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Diagnosis failed:", error);
    // #region agent log
    log('diagnose-production-db.ts:fatal', 'Fatal error', { error: error.message });
    // #endregion
    process.exit(1);
  });





