/**
 * Check which units still have data in Production
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const PROD_CONVEX_URL = process.env.VITE_CONVEX_URL_PRODUCTION;

if (!PROD_CONVEX_URL) {
  console.error("❌ Missing PROD_CONVEX_URL");
  process.exit(1);
}

const prodClient = new ConvexHttpClient(PROD_CONVEX_URL);

async function checkRemainingData() {
  console.log("========================================");
  console.log("🔍 Checking Remaining Data in Production");
  console.log("========================================\n");

  console.log("📄 Unit Content:");
  for (let unitNumber = 1; unitNumber <= 27; unitNumber++) {
    for (const lang of ["en", "de"]) {
      try {
        const content = await prodClient.query(api.units.getUnitContentSections as any, {
          unitNumber,
          language: lang,
        });
        
        if (content && Object.keys(content).length > 0) {
          console.log(`  Unit ${unitNumber} (${lang}): ${Object.keys(content).length} sections`);
        }
      } catch (e) {
        // Skip
      }
    }
  }

  console.log("\n🎯 Interactive Tests:");
  for (let unitNumber = 1; unitNumber <= 27; unitNumber++) {
    for (const lang of ["en", "de"]) {
      try {
        const tests = await prodClient.query(api.units.getUnitInteractiveTest as any, {
          unitNumber,
          language: lang,
        });
        
        if (tests && tests.length > 0) {
          console.log(`  Unit ${unitNumber} (${lang}): ${tests.length} tests`);
        }
      } catch (e) {
        // Skip
      }
    }
  }

  console.log("\n📚 Course Vocabulary:");
  for (let unitNumber = 1; unitNumber <= 27; unitNumber++) {
    try {
      const vocab = await prodClient.query(api.vocabulary.getCourseVocabularyByUnit as any, {
        unitNumber,
      });
      
      if (vocab && vocab.length > 0) {
        console.log(`  Unit ${unitNumber}: ${vocab.length} vocabulary items`);
      }
    } catch (e) {
      // Skip
    }
  }
}

checkRemainingData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });




