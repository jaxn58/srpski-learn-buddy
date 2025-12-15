import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

const CONVEX_URL = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL;

if (!CONVEX_URL) {
  console.error("❌ CONVEX_URL not found in environment variables");
  process.exit(1);
}

interface IntegrityReport {
  orphanedContent: Array<{ unitNumber: number; language: string; contentType: string }>;
  orphanedTests: Array<{ unitNumber: number; language: string; questionId: string }>;
  orphanedMetadata: Array<{ unitNumber: number; language: string; moduleRef?: string; moduleId?: string }>;
  totalIssues: number;
}

async function validateReferentialIntegrity() {
  console.log("🔍 Validating Referential Integrity...");
  console.log(`   Convex URL: ${CONVEX_URL}\n`);

  const client = new ConvexHttpClient(CONVEX_URL);
  const report: IntegrityReport = {
    orphanedContent: [],
    orphanedTests: [],
    orphanedMetadata: [],
    totalIssues: 0,
  };

  console.log("📊 Checking all units for referential integrity...\n");

  // Check all units
  for (let unitNumber = 1; unitNumber <= 27; unitNumber++) {
    for (const language of ["en", "de"]) {
      try {
        // Check if metadata exists
        const metadata = await client.query(api.units.getUnitMetadata, {
          unitNumber,
          language,
        });

        // Check content entries
        const content = await client.query(api.units.getUnitContentSections, {
          unitNumber,
          language,
        });

        // If content exists but no metadata (for required language)
        if (content && Object.keys(content).length > 0 && !metadata && language === "en") {
          Object.keys(content).forEach((contentType) => {
            report.orphanedContent.push({
              unitNumber,
              language,
              contentType,
            });
          });
        }

        // Check test entries
        const tests = await client.query(api.units.getUnitInteractiveTest, {
          unitNumber,
          language,
        });

        if (tests && tests.length > 0 && !metadata && language === "en") {
          tests.forEach((test) => {
            report.orphanedTests.push({
              unitNumber,
              language,
              questionId: test.questionId,
            });
          });
        }

        // Check metadata with moduleRef
        if (metadata && (metadata.moduleRef || (metadata as any).moduleId)) {
          const module = await client.query(api.modules.getModuleMetadata, {
            moduleRef: metadata.moduleRef,
            moduleSlug: (metadata as any)?.moduleId,
            language,
          });

          if (!module && language === "en") {
            report.orphanedMetadata.push({
              unitNumber,
              language,
              moduleRef: metadata.moduleRef,
              moduleId: (metadata as any)?.moduleId,
            });
          }
        }
      } catch (error: any) {
        console.error(`Error checking Unit ${unitNumber} (${language}): ${error.message}`);
      }
    }
  }

  report.totalIssues =
    report.orphanedContent.length +
    report.orphanedTests.length +
    report.orphanedMetadata.length;

  // Print report
  console.log("\n" + "=".repeat(80));
  console.log("📊 REFERENTIAL INTEGRITY REPORT");
  console.log("=".repeat(80));

  if (report.orphanedContent.length > 0) {
    console.log(`\n❌ Orphaned Content Entries: ${report.orphanedContent.length}`);
    report.orphanedContent.forEach((entry) => {
      console.log(
        `   Unit ${entry.unitNumber} (${entry.language}): ${entry.contentType} - Missing unitMetadata`
      );
    });
  }

  if (report.orphanedTests.length > 0) {
    console.log(`\n❌ Orphaned Test Entries: ${report.orphanedTests.length}`);
    report.orphanedTests.forEach((entry) => {
      console.log(
        `   Unit ${entry.unitNumber} (${entry.language}): ${entry.questionId} - Missing unitMetadata`
      );
    });
  }

  if (report.orphanedMetadata.length > 0) {
    console.log(`\n❌ Orphaned Metadata Entries: ${report.orphanedMetadata.length}`);
    report.orphanedMetadata.forEach((entry) => {
      const identifier = entry.moduleRef ? `moduleRef ${entry.moduleRef}` : `moduleId "${entry.moduleId}"`;
      console.log(
        `   Unit ${entry.unitNumber} (${entry.language}): ${identifier} - Missing moduleMetadata`
      );
    });
  }

  console.log("\n" + "-".repeat(80));
  console.log(`Total Issues: ${report.totalIssues}`);

  if (report.totalIssues === 0) {
    console.log("✅ All Foreign Key relationships are valid!");
  } else {
    console.log("❌ Referential integrity violations found!");
    process.exit(1);
  }
}

validateReferentialIntegrity().catch((error) => {
  console.error("❌ Validation failed:", error);
  process.exit(1);
});
