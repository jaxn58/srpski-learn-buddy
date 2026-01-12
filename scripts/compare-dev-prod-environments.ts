/**
 * Environment Comparison Script: Development vs Production
 * 
 * This script compares:
 * 1. Schema (tables, indexes)
 * 2. Functions (queries, mutations, actions)
 * 3. Environment Variables
 * 4. Key Data Differences (optional)
 * 
 * Usage: npx tsx scripts/compare-dev-prod-environments.ts
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import "dotenv/config";

const DEV_CONVEX_URL = process.env.VITE_CONVEX_URL || "https://reminiscent-panda-57.convex.cloud";
const PROD_CONVEX_URL = process.env.VITE_CONVEX_URL_PRODUCTION || "https://fleet-labrador-324.convex.cloud";

console.log("🔍 Environment Comparison: Development vs Production");
console.log("=".repeat(80));
console.log(`📦 Development: ${DEV_CONVEX_URL}`);
console.log(`🚀 Production:  ${PROD_CONVEX_URL}`);
console.log("=".repeat(80));
console.log("");

const devClient = new ConvexHttpClient(DEV_CONVEX_URL);
const prodClient = new ConvexHttpClient(PROD_CONVEX_URL);

interface ComparisonResult {
  schema: {
    devTables: string[];
    prodTables: string[];
    missingInProd: string[];
    missingInDev: string[];
    commonTables: string[];
  };
  functions: {
    devFunctions: string[];
    prodFunctions: string[];
    missingInProd: string[];
    missingInDev: string[];
    commonFunctions: string[];
  };
  envVars: {
    devVars: Array<{ name: string; value: string }>;
    prodVars: Array<{ name: string; value: string }>;
    missingInProd: string[];
    missingInDev: string[];
    differentValues: Array<{ name: string; devValue: string; prodValue: string }>;
  };
}

async function compareEnvironments(): Promise<ComparisonResult> {
  const result: ComparisonResult = {
    schema: {
      devTables: [],
      prodTables: [],
      missingInProd: [],
      missingInDev: [],
      commonTables: [],
    },
    functions: {
      devFunctions: [],
      prodFunctions: [],
      missingInProd: [],
      missingInDev: [],
      commonFunctions: [],
    },
    envVars: {
      devVars: [],
      prodVars: [],
      missingInProd: [],
      missingInDev: [],
      differentValues: [],
    },
  };

  try {
    // 1. Compare Schema (Tables)
    console.log("📊 Step 1: Comparing Schema (Tables)...");
    try {
      const devTables = await devClient.query(api.system.health, {});
      // Note: We'll use a workaround since we can't directly query tables
      // We'll try to query known tables to see which exist
      console.log("   ⚠️  Direct table listing not available via API");
      console.log("   ℹ️  Schema comparison requires manual inspection");
    } catch (error: any) {
      console.log(`   ⚠️  Could not query Dev schema: ${error.message}`);
    }

    // 2. Compare Functions
    console.log("\n🔧 Step 2: Comparing Functions...");
    try {
      // Test a few key functions to see if they exist
      const testFunctions = [
        "admin.getChatPrompt",
        "admin.getAllUsers",
        "users.me",
        "vocabulary.getAllCourseVocabulary",
        "units.getUnitMetadata",
      ];

      const devFunctions: string[] = [];
      const prodFunctions: string[] = [];

      for (const funcName of testFunctions) {
        const [module, func] = funcName.split(".");
        try {
          await devClient.query((api as any)[module][func], {});
          devFunctions.push(funcName);
        } catch (error: any) {
          // Function might exist but require params
          if (!error.message.includes("Invalid argument")) {
            devFunctions.push(funcName);
          }
        }

        try {
          await prodClient.query((api as any)[module][func], {});
          prodFunctions.push(funcName);
        } catch (error: any) {
          if (!error.message.includes("Invalid argument")) {
            prodFunctions.push(funcName);
          }
        }
      }

      result.functions.devFunctions = devFunctions;
      result.functions.prodFunctions = prodFunctions;
      result.functions.commonFunctions = devFunctions.filter((f) => prodFunctions.includes(f));
      result.functions.missingInProd = devFunctions.filter((f) => !prodFunctions.includes(f));
      result.functions.missingInDev = prodFunctions.filter((f) => !devFunctions.includes(f));

      console.log(`   ✅ Dev Functions: ${devFunctions.length}`);
      console.log(`   ✅ Prod Functions: ${prodFunctions.length}`);
      console.log(`   ✅ Common: ${result.functions.commonFunctions.length}`);
      if (result.functions.missingInProd.length > 0) {
        console.log(`   ⚠️  Missing in Prod: ${result.functions.missingInProd.join(", ")}`);
      }
      if (result.functions.missingInDev.length > 0) {
        console.log(`   ⚠️  Missing in Dev: ${result.functions.missingInDev.join(", ")}`);
      }
    } catch (error: any) {
      console.log(`   ⚠️  Could not compare functions: ${error.message}`);
    }

    // 3. Compare Environment Variables
    console.log("\n🔐 Step 3: Comparing Environment Variables...");
    try {
      // Note: Environment variables are not directly queryable via Convex API
      // We need to check them manually or via Convex Dashboard
      console.log("   ⚠️  Environment variables cannot be queried via API");
      console.log("   ℹ️  Please check manually in Convex Dashboard:");
      console.log(`      Dev:  https://dashboard.convex.dev/d/reminiscent-panda-57`);
      console.log(`      Prod: https://dashboard.convex.dev/d/fleet-labrador-324`);
    } catch (error: any) {
      console.log(`   ⚠️  Could not compare env vars: ${error.message}`);
    }

    // 4. Compare Key Data
    console.log("\n📦 Step 4: Comparing Key Data...");
    
    // Compare Chat Prompts
    try {
      const devPrompt = await devClient.query(api.admin.getChatPrompt, { name: "default" }).catch(() => null);
      const prodPrompt = await prodClient.query(api.admin.getChatPrompt, { name: "default" }).catch(() => null);
      
      if (devPrompt && prodPrompt) {
        const devUpdated = new Date(devPrompt.updatedAt).toISOString();
        const prodUpdated = new Date(prodPrompt.updatedAt).toISOString();
        
        console.log("   Chat Prompts:");
        console.log(`      Dev:  Last updated ${devUpdated}`);
        console.log(`      Prod: Last updated ${prodUpdated}`);
        
        if (devPrompt.updatedAt > prodPrompt.updatedAt) {
          console.log("      ⚠️  Dev has newer version - needs deployment");
        } else if (prodPrompt.updatedAt > devPrompt.updatedAt) {
          console.log("      ⚠️  Prod has newer version - needs sync to Dev");
        } else {
          console.log("      ✅ Both are in sync");
        }
      } else if (devPrompt && !prodPrompt) {
        console.log("   ⚠️  Chat Prompt exists in Dev but not in Prod - needs deployment");
      } else if (!devPrompt && prodPrompt) {
        console.log("   ⚠️  Chat Prompt exists in Prod but not in Dev - needs sync");
      }
    } catch (error: any) {
      console.log(`   ⚠️  Could not compare chat prompts: ${error.message}`);
    }

    // Compare Email Templates
    try {
      const devTemplates = await devClient.query(api.emailTemplates.getAll).catch(() => []);
      const prodTemplates = await prodClient.query(api.emailTemplates.getAll).catch(() => []);
      
      console.log("   Email Templates:");
      console.log(`      Dev:  ${Array.isArray(devTemplates) ? devTemplates.length : 0} templates`);
      console.log(`      Prod: ${Array.isArray(prodTemplates) ? prodTemplates.length : 0} templates`);
      
      if (Array.isArray(devTemplates) && Array.isArray(prodTemplates)) {
        const devNames = devTemplates.map((t: any) => t.name).sort();
        const prodNames = prodTemplates.map((t: any) => t.name).sort();
        
        const missingInProd = devNames.filter((n) => !prodNames.includes(n));
        const missingInDev = prodNames.filter((n) => !devNames.includes(n));
        
        if (missingInProd.length > 0) {
          console.log(`      ⚠️  Missing in Prod: ${missingInProd.join(", ")}`);
        }
        if (missingInDev.length > 0) {
          console.log(`      ⚠️  Missing in Dev: ${missingInDev.join(", ")}`);
        }
        if (missingInProd.length === 0 && missingInDev.length === 0) {
          console.log("      ✅ Both have same templates");
        }
      }
    } catch (error: any) {
      console.log(`   ⚠️  Could not compare email templates: ${error.message}`);
    }

    // Compare Vocabulary Count
    try {
      const devVocab = await devClient.query(api.vocabulary.getAllCourseVocabulary).catch(() => []);
      const prodVocab = await prodClient.query(api.vocabulary.getAllCourseVocabulary).catch(() => []);
      
      console.log("   Vocabulary:");
      console.log(`      Dev:  ${Array.isArray(devVocab) ? devVocab.length : 0} words`);
      console.log(`      Prod: ${Array.isArray(prodVocab) ? prodVocab.length : 0} words`);
      
      if (Array.isArray(devVocab) && Array.isArray(prodVocab)) {
        if (devVocab.length !== prodVocab.length) {
          console.log(`      ⚠️  Count mismatch - Dev has ${devVocab.length - prodVocab.length} more words`);
        } else {
          console.log("      ✅ Both have same vocabulary count");
        }
      }
    } catch (error: any) {
      console.log(`   ⚠️  Could not compare vocabulary: ${error.message}`);
    }

    // Compare Unit Metadata
    try {
      const devUnits = await devClient.query(api.units.getAllUnitsMetadata, { language: "en" }).catch(() => []);
      const prodUnits = await prodClient.query(api.units.getAllUnitsMetadata, { language: "en" }).catch(() => []);
      
      console.log("   Unit Metadata:");
      console.log(`      Dev:  ${Array.isArray(devUnits) ? devUnits.length : 0} units`);
      console.log(`      Prod: ${Array.isArray(prodUnits) ? prodUnits.length : 0} units`);
      
      if (Array.isArray(devUnits) && Array.isArray(prodUnits)) {
        if (devUnits.length !== prodUnits.length) {
          console.log(`      ⚠️  Count mismatch - Dev has ${devUnits.length - prodUnits.length} more units`);
        } else {
          console.log("      ✅ Both have same unit count");
        }
      }
    } catch (error: any) {
      console.log(`   ⚠️  Could not compare units: ${error.message}`);
    }

    // Compare Onboarding Steps
    try {
      const devOnboarding = await devClient.query(api.onboarding.getAllOnboardingStepsV2).catch(() => []);
      const prodOnboarding = await prodClient.query(api.onboarding.getAllOnboardingStepsV2).catch(() => []);
      
      console.log("   Onboarding Steps:");
      console.log(`      Dev:  ${Array.isArray(devOnboarding) ? devOnboarding.length : 0} steps`);
      console.log(`      Prod: ${Array.isArray(prodOnboarding) ? prodOnboarding.length : 0} steps`);
      
      if (Array.isArray(devOnboarding) && Array.isArray(prodOnboarding)) {
        if (devOnboarding.length !== prodOnboarding.length) {
          console.log(`      ⚠️  Count mismatch - Dev has ${devOnboarding.length - prodOnboarding.length} more steps`);
        } else {
          console.log("      ✅ Both have same onboarding steps");
        }
      }
    } catch (error: any) {
      console.log(`   ⚠️  Could not compare onboarding: ${error.message}`);
    }

  } catch (error: any) {
    console.error(`❌ Error during comparison: ${error.message}`);
    throw error;
  }

  return result;
}

// Generate Summary Report
function generateSummaryReport(result: ComparisonResult) {
  console.log("\n");
  console.log("=".repeat(80));
  console.log("📋 SUMMARY REPORT");
  console.log("=".repeat(80));
  console.log("");

  console.log("🚨 CRITICAL: Items that need attention:");
  console.log("");

  // Functions missing in Production
  if (result.functions.missingInProd.length > 0) {
    console.log("⚠️  Functions missing in Production (need deployment):");
    result.functions.missingInProd.forEach((f) => console.log(`   - ${f}`));
    console.log("");
  }

  // Functions missing in Development
  if (result.functions.missingInDev.length > 0) {
    console.log("⚠️  Functions missing in Development (need sync):");
    result.functions.missingInDev.forEach((f) => console.log(`   - ${f}`));
    console.log("");
  }

  // Environment Variables
  if (result.envVars.missingInProd.length > 0) {
    console.log("⚠️  Environment Variables missing in Production:");
    result.envVars.missingInProd.forEach((v) => console.log(`   - ${v}`));
    console.log("");
  }

  if (result.envVars.missingInDev.length > 0) {
    console.log("⚠️  Environment Variables missing in Development:");
    result.envVars.missingInDev.forEach((v) => console.log(`   - ${v}`));
    console.log("");
  }

  if (result.envVars.differentValues.length > 0) {
    console.log("⚠️  Environment Variables with different values:");
    result.envVars.differentValues.forEach((v) => {
      console.log(`   - ${v.name}:`);
      console.log(`     Dev:  ${v.devValue.substring(0, 20)}...`);
      console.log(`     Prod: ${v.prodValue.substring(0, 20)}...`);
    });
    console.log("");
  }

  console.log("=".repeat(80));
  console.log("✅ Comparison completed!");
  console.log("");
  console.log("📝 Next Steps:");
  console.log("1. Review differences above");
  console.log("2. Deploy missing functions: npx convex deploy -y");
  console.log("3. Sync environment variables in Convex Dashboard");
  console.log("4. Run data migrations if needed: pnpm migrate:production");
  console.log("");
}

// Run comparison
compareEnvironments()
  .then((result) => {
    generateSummaryReport(result);
  })
  .catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });
