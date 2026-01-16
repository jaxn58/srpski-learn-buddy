/**
 * Check Email Templates on Production
 * 
 * This script checks which email templates exist on Production.
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { config } from "dotenv";

// Load environment variables from .env.local
config({ path: ".env.local" });

const PROD_URL = process.env.VITE_CONVEX_URL_PRODUCTION || "https://fleet-labrador-324.convex.cloud";
const ADMIN_SECRET = process.env.ADMIN_SECRET;

if (!ADMIN_SECRET) {
  console.error("❌ ADMIN_SECRET not found in .env.local");
  process.exit(1);
}

const prodClient = new ConvexHttpClient(PROD_URL);

async function checkTemplates() {
  console.log("🔍 Checking Email Templates on Production");
  console.log("=" .repeat(60));
  console.log(`📡 Production: ${PROD_URL}\n`);

  try {
    const templates = await prodClient.query(api.admin.adminGetAllEmailTemplates, {
      adminSecret: ADMIN_SECRET,
    });

    if (!templates || templates.length === 0) {
      console.log("❌ No email templates found on Production!");
      console.log("\n💡 Run: pnpm exec tsx scripts/sync-email-templates-prod-with-secret.ts");
      process.exit(1);
    }

    console.log(`✅ Found ${templates.length} email templates on Production:\n`);

    templates.forEach((t: any, i: number) => {
      const status = t.isActive ? "✅ active" : "⚠️  inactive";
      console.log(`   ${i + 1}. ${t.name.padEnd(45)} ${status} (${t.category})`);
    });

    console.log("\n" + "=" .repeat(60));
    console.log("✅ All templates are on Production!");
    console.log("=" .repeat(60));

  } catch (error: any) {
    console.error("\n❌ Failed to check templates:", error.message);
    
    if (error.message.includes("Unauthorized") || error.message.includes("Invalid admin secret")) {
      console.error("\n💡 Make sure ADMIN_SECRET is correct in your .env.local file.");
    }
    
    process.exit(1);
  }
}

checkTemplates().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
