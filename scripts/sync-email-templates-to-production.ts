/**
 * Synchronization script to copy email templates from Development to Production
 * 
 * This script:
 * 1. Connects to both Dev and Prod Convex deployments
 * 2. Fetches all templates from Development
 * 3. Compares with Production templates
 * 4. Shows differences and asks for confirmation
 * 5. Syncs templates to Production (overwrites existing)
 * 
 * Usage: 
 *   tsx scripts/sync-email-templates-to-production.ts
 *   tsx scripts/sync-email-templates-to-production.ts --dry-run
 * 
 * Required Environment Variables:
 *   VITE_CONVEX_URL_DEV  - Development Convex deployment URL
 *   VITE_CONVEX_URL_PROD - Production Convex deployment URL
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import "dotenv/config";
import * as readline from "readline";

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");

// Get Convex URLs from environment variables
const DEV_URL = 
  process.env.VITE_CONVEX_URL_DEV || 
  process.env.CONVEX_URL_DEV;

const PROD_URL = 
  process.env.VITE_CONVEX_URL_PROD || 
  process.env.CONVEX_URL_PROD;

// Validate environment variables
if (!DEV_URL) {
  console.error("❌ Development Convex URL is not set");
  console.error("\nPlease set VITE_CONVEX_URL_DEV:");
  console.error("  $env:VITE_CONVEX_URL_DEV='https://your-dev-deployment.convex.cloud'");
  console.error("\nOr add to your .env file:");
  console.error("  VITE_CONVEX_URL_DEV=https://your-dev-deployment.convex.cloud");
  process.exit(1);
}

if (!PROD_URL) {
  console.error("❌ Production Convex URL is not set");
  console.error("\nPlease set VITE_CONVEX_URL_PROD:");
  console.error("  $env:VITE_CONVEX_URL_PROD='https://your-prod-deployment.convex.cloud'");
  console.error("\nOr add to your .env file:");
  console.error("  VITE_CONVEX_URL_PROD=https://your-prod-deployment.convex.cloud");
  process.exit(1);
}

// Create Convex clients
const devClient = new ConvexHttpClient(DEV_URL);
const prodClient = new ConvexHttpClient(PROD_URL);

// Helper function to prompt user for confirmation
function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) =>
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer);
    })
  );
}

// Helper to compare templates
interface Template {
  _id: string;
  _creationTime: number;
  name: string;
  subject: string;
  htmlContent: string;
  description?: string;
  variables: string[];
  category: "transactional" | "subscription" | "marketing";
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

function compareTemplates(devTemplates: Template[], prodTemplates: Template[]) {
  const devMap = new Map(devTemplates.map(t => [t.name, t]));
  const prodMap = new Map(prodTemplates.map(t => [t.name, t]));

  const newTemplates: string[] = [];
  const updatedTemplates: string[] = [];
  const unchangedTemplates: string[] = [];

  for (const [name, devTemplate] of devMap) {
    const prodTemplate = prodMap.get(name);
    
    if (!prodTemplate) {
      newTemplates.push(name);
    } else {
      // Compare key fields (ignore timestamps and IDs)
      const hasChanges = 
        devTemplate.subject !== prodTemplate.subject ||
        devTemplate.htmlContent !== prodTemplate.htmlContent ||
        devTemplate.description !== prodTemplate.description ||
        JSON.stringify(devTemplate.variables) !== JSON.stringify(prodTemplate.variables) ||
        devTemplate.category !== prodTemplate.category ||
        devTemplate.isActive !== prodTemplate.isActive;

      if (hasChanges) {
        updatedTemplates.push(name);
      } else {
        unchangedTemplates.push(name);
      }
    }
  }

  return { newTemplates, updatedTemplates, unchangedTemplates };
}

async function syncTemplates() {
  console.log("🚀 EmailTemplate Synchronization Script");
  console.log("=" .repeat(60));
  
  if (isDryRun) {
    console.log("🔍 DRY RUN MODE - No changes will be made");
    console.log("=" .repeat(60));
  }
  
  console.log(`\n📡 Development: ${DEV_URL}`);
  console.log(`📡 Production:  ${PROD_URL}\n`);

  try {
    // Step 1: Fetch templates from Development
    console.log("📥 Fetching templates from Development...");
    const devTemplates = await devClient.query(api.emailTemplates.getAll);
    console.log(`   ✅ Found ${devTemplates.length} templates in Development\n`);

    // Step 2: Fetch templates from Production
    console.log("📥 Fetching templates from Production...");
    const prodTemplates = await prodClient.query(api.emailTemplates.getAll);
    console.log(`   ✅ Found ${prodTemplates.length} templates in Production\n`);

    // Step 3: Compare templates
    console.log("🔍 Comparing templates...\n");
    const { newTemplates, updatedTemplates, unchangedTemplates } = compareTemplates(
      devTemplates,
      prodTemplates
    );

    // Display comparison results
    console.log("=" .repeat(60));
    console.log("📊 COMPARISON RESULTS");
    console.log("=" .repeat(60));

    if (newTemplates.length > 0) {
      console.log(`\n✨ NEW Templates (${newTemplates.length}):`);
      newTemplates.forEach(name => console.log(`   + ${name}`));
    }

    if (updatedTemplates.length > 0) {
      console.log(`\n🔄 UPDATED Templates (${updatedTemplates.length}):`);
      updatedTemplates.forEach(name => console.log(`   ~ ${name}`));
    }

    if (unchangedTemplates.length > 0) {
      console.log(`\n✓ UNCHANGED Templates (${unchangedTemplates.length}):`);
      unchangedTemplates.forEach(name => console.log(`   = ${name}`));
    }

    const totalChanges = newTemplates.length + updatedTemplates.length;

    if (totalChanges === 0) {
      console.log("\n✅ No changes detected. Production is already up to date!");
      return;
    }

    console.log("\n" + "=" .repeat(60));
    console.log(`📝 Total changes to sync: ${totalChanges}`);
    console.log("=" .repeat(60));

    // Step 4: Ask for confirmation (skip in dry-run mode)
    if (isDryRun) {
      console.log("\n🔍 DRY RUN completed. No changes were made.");
      return;
    }

    console.log("\n⚠️  WARNING: This will overwrite existing templates in Production!");
    const answer = await askQuestion("\n❓ Do you want to proceed? (yes/no): ");

    if (answer.toLowerCase() !== "yes") {
      console.log("\n❌ Synchronization cancelled by user.");
      return;
    }

    // Step 5: Sync templates to Production
    console.log("\n🔄 Synchronizing templates to Production...\n");

    let successCount = 0;
    let errorCount = 0;

    for (const devTemplate of devTemplates) {
      try {
        console.log(`   📝 Syncing: ${devTemplate.name}...`);

        await prodClient.action(api.emailTemplates.setupTemplate, {
          name: devTemplate.name,
          subject: devTemplate.subject,
          htmlContent: devTemplate.htmlContent,
          description: devTemplate.description,
          variables: devTemplate.variables,
          category: devTemplate.category,
          isActive: devTemplate.isActive,
        });

        console.log(`      ✅ Success`);
        successCount++;
      } catch (error: any) {
        console.error(`      ❌ Failed: ${error.message}`);
        errorCount++;
      }
    }

    // Final summary
    console.log("\n" + "=" .repeat(60));
    console.log("✅ SYNCHRONIZATION COMPLETE");
    console.log("=" .repeat(60));
    console.log(`   Success: ${successCount}`);
    console.log(`   Errors:  ${errorCount}`);
    console.log("=" .repeat(60));

    if (errorCount > 0) {
      console.log("\n⚠️  Some templates failed to sync. Please check the errors above.");
      process.exit(1);
    }

  } catch (error: any) {
    console.error("\n❌ Synchronization failed:", error.message);
    
    if (error.message.includes("Unauthorized")) {
      console.error("\n💡 Make sure you are logged in as Superadmin on both deployments.");
      console.error("   You need to be authenticated in your browser for the Convex client to work.");
    }
    
    process.exit(1);
  }
}

// Run synchronization
syncTemplates().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});










