import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import * as dotenv from "dotenv";
import { COURSE_UNITS } from "../shared/data/course/units";

// Load environment variables
dotenv.config({ path: ".env.local" });

const CONVEX_URL = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL;

if (!CONVEX_URL) {
  console.error("❌ CONVEX_URL not found in environment variables");
  process.exit(1);
}

interface ValidationResult {
  unitNumber: number;
  language: string;
  issues: string[];
  warnings: string[];
}

interface ValidationReport {
  totalUnits: number;
  unitsWithIssues: number;
  unitsWithWarnings: number;
  results: ValidationResult[];
  referentialIntegrity: {
    orphanedContent: number;
    orphanedTests: number;
    orphanedMetadata: number;
  };
  normalization: {
    duplicateContent: number;
    duplicateTests: number;
  };
}

async function validateContentConsistency() {
  console.log("🔍 Validating Content Consistency...");
  console.log(`   Convex URL: ${CONVEX_URL}\n`);

  const client = new ConvexHttpClient(CONVEX_URL);
  const report: ValidationReport = {
    totalUnits: 0,
    unitsWithIssues: 0,
    unitsWithWarnings: 0,
    results: [],
    referentialIntegrity: {
      orphanedContent: 0,
      orphanedTests: 0,
      orphanedMetadata: 0,
    },
    normalization: {
      duplicateContent: 0,
      duplicateTests: 0,
    },
  };

  // Get all data
  console.log("📊 Fetching data from Convex...");
  const allExplanations = await client.query(api.units.getAllExplanations).catch(() => []);

  console.log("📋 Checking all 27 units...\n");

  for (let unitNumber = 1; unitNumber <= 27; unitNumber++) {
    report.totalUnits++;

    const unitFromTs = COURSE_UNITS.find((u) => u.number === unitNumber);
    if (!unitFromTs) {
      console.log(`⚠️  Unit ${unitNumber}: Not found in units.ts`);
      continue;
    }

    // Check for each language
    for (const language of ["en", "de"]) {
      const result: ValidationResult = {
        unitNumber,
        language,
        issues: [],
        warnings: [],
      };

      try {
        // 1. Check unitMetadata exists
        const metadata = await client.query(api.units.getUnitMetadata, {
          unitNumber,
          language,
        });

        if (!metadata && language === "en") {
          result.issues.push(`Missing unitMetadata for ${language}`);
        } else if (!metadata && language === "de") {
          result.warnings.push(`Missing unitMetadata for ${language} (optional)`);
        } else if (metadata) {
          // Check title consistency
          const expectedTitle =
            language === "en" ? unitFromTs.titleEnglish : unitFromTs.titleGerman;
          if (metadata.title !== expectedTitle) {
            result.issues.push(
              `Title mismatch: expected "${expectedTitle}", got "${metadata.title}"`
            );
          }
        }

        // 2. Check unitContent exists and has required types
        const content = await client.query(api.units.getUnitContentSections, {
          unitNumber,
          language,
        });

        if (!content || Object.keys(content).length === 0) {
          if (language === "en") {
            result.issues.push(`Missing unitContent for ${language}`);
          } else {
            result.warnings.push(`Missing unitContent for ${language} (optional)`);
          }
        } else {
          // Check required content types
          const requiredTypes = ["overview", "grammar"];
          for (const type of requiredTypes) {
            if (!content[type]) {
              result.warnings.push(`Missing contentType: ${type}`);
            }
          }

          // Check for duplicate content entries
          const contentEntries = await client.query(api.units.getUnitContentSections, {
            unitNumber,
            language,
          });
          // Note: We can't easily check duplicates without direct DB access,
          // but we can check if content exists
        }

        // 3. Check unitExplanations (legacy - should be migrated)
        if (language === "en") {
          const explanation = await client.query(api.units.getExplanation, {
            unitNumber,
          });

          if (explanation && (explanation.overview || explanation.grammarExplained)) {
            result.warnings.push(
              "unitExplanations still exists (should be migrated to unitContent)"
            );
          }
        }

        // 4. Check unitInteractiveTests
        const tests = await client.query(api.units.getUnitInteractiveTest, {
          unitNumber,
          language,
        });

        if (tests && tests.length > 0) {
          // Check for duplicate questionIds
          const questionIds = tests.map((t) => t.questionId);
          const uniqueIds = new Set(questionIds);
          if (questionIds.length !== uniqueIds.size) {
            result.issues.push(`Duplicate questionIds found in tests`);
            report.normalization.duplicateTests++;
          }
        }

        // 5. Referential Integrity: Check if content/test entries have corresponding metadata
        if (content && Object.keys(content).length > 0 && !metadata && language === "en") {
          result.issues.push(
            `unitContent exists but unitMetadata missing (referential integrity violation)`
          );
          report.referentialIntegrity.orphanedContent++;
        }

        if (tests && tests.length > 0 && !metadata && language === "en") {
          result.issues.push(
            `unitInteractiveTests exists but unitMetadata missing (referential integrity violation)`
          );
          report.referentialIntegrity.orphanedTests++;
        }

        if (result.issues.length > 0 || result.warnings.length > 0) {
          report.results.push(result);
          if (result.issues.length > 0) {
            report.unitsWithIssues++;
          }
          if (result.warnings.length > 0) {
            report.unitsWithWarnings++;
          }
        }
      } catch (error) {
        result.issues.push(`Error checking unit: ${error}`);
        report.results.push(result);
        report.unitsWithIssues++;
      }
    }
  }

  // Print report
  console.log("\n" + "=".repeat(80));
  console.log("📊 VALIDATION REPORT");
  console.log("=".repeat(80));
  console.log(`Total Units Checked: ${report.totalUnits}`);
  console.log(`Units with Issues: ${report.unitsWithIssues}`);
  console.log(`Units with Warnings: ${report.unitsWithWarnings}`);
  console.log("\n");

  if (report.referentialIntegrity.orphanedContent > 0) {
    console.log(
      `⚠️  Referential Integrity: ${report.referentialIntegrity.orphanedContent} orphaned content entries`
    );
  }
  if (report.referentialIntegrity.orphanedTests > 0) {
    console.log(
      `⚠️  Referential Integrity: ${report.referentialIntegrity.orphanedTests} orphaned test entries`
    );
  }
  if (report.normalization.duplicateContent > 0) {
    console.log(
      `⚠️  Normalization: ${report.normalization.duplicateContent} duplicate content entries`
    );
  }
  if (report.normalization.duplicateTests > 0) {
    console.log(
      `⚠️  Normalization: ${report.normalization.duplicateTests} duplicate test entries`
    );
  }

  console.log("\n" + "-".repeat(80));
  console.log("DETAILED RESULTS");
  console.log("-".repeat(80) + "\n");

  for (const result of report.results) {
    if (result.issues.length > 0 || result.warnings.length > 0) {
      console.log(`Unit ${result.unitNumber} (${result.language}):`);
      if (result.issues.length > 0) {
        console.log("  ❌ Issues:");
        result.issues.forEach((issue) => console.log(`     - ${issue}`));
      }
      if (result.warnings.length > 0) {
        console.log("  ⚠️  Warnings:");
        result.warnings.forEach((warning) => console.log(`     - ${warning}`));
      }
      console.log("");
    }
  }

  // Summary
  console.log("\n" + "=".repeat(80));
  if (report.unitsWithIssues === 0 && report.unitsWithWarnings === 0) {
    console.log("✅ All checks passed!");
  } else {
    console.log("❌ Validation found issues. Please review the report above.");
    process.exit(1);
  }
}

validateContentConsistency().catch((error) => {
  console.error("❌ Validation failed:", error);
  process.exit(1);
});







