/**
 * Check Email Signatures on Production
 * 
 * This script checks which email signatures exist on Production.
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { config } from "dotenv";

// Load environment variables from .env.local
config({ path: ".env.local" });

const DEV_URL = process.env.VITE_CONVEX_URL;
const PROD_URL = process.env.VITE_CONVEX_URL_PRODUCTION || "https://fleet-labrador-324.convex.cloud";
const ADMIN_SECRET = process.env.ADMIN_SECRET;

if (!ADMIN_SECRET) {
  console.error("❌ ADMIN_SECRET not found in .env.local");
  process.exit(1);
}

const devClient = new ConvexHttpClient(DEV_URL!);
const prodClient = new ConvexHttpClient(PROD_URL);

async function checkSignatures() {
  console.log("🔍 Checking Email Signatures");
  console.log("=" .repeat(60));
  
  try {
    // Check Development
    console.log(`\n📡 Development: ${DEV_URL}`);
    try {
      const devSignatures = await devClient.query(api.admin.adminGetAllEmailSignatures, {
        adminSecret: ADMIN_SECRET,
      });
      
      if (!devSignatures || devSignatures.length === 0) {
        console.log("   ⚠️  No signatures found in Development");
      } else {
        console.log(`   ✅ Found ${devSignatures.length} signatures in Development:`);
        devSignatures.forEach((s: any) => {
          const status = s.isActive ? "active" : "inactive";
          console.log(`      - ${s.category} (${status})`);
        });
      }
    } catch (e: any) {
      console.log(`   ⚠️  Could not check Development: ${e.message}`);
    }

    // Check Production
    console.log(`\n📡 Production: ${PROD_URL}`);
    try {
      const prodSignatures = await prodClient.query(api.admin.adminGetAllEmailSignatures, {
        adminSecret: ADMIN_SECRET,
      });

      if (!prodSignatures || prodSignatures.length === 0) {
        console.log("   ❌ No signatures found on Production!");
        console.log("\n💡 Email signatures are stored separately from templates.");
        console.log("   Templates have built-in signatures, but the emailSignatures table is empty.");
      } else {
        console.log(`   ✅ Found ${prodSignatures.length} signatures on Production:`);
        prodSignatures.forEach((s: any) => {
          const status = s.isActive ? "active" : "inactive";
          console.log(`      - ${s.category} (${status})`);
        });
      }
    } catch (e: any) {
      console.log(`   ❌ Could not check Production: ${e.message}`);
    }

    console.log("\n" + "=" .repeat(60));

  } catch (error: any) {
    console.error("\n❌ Failed:", error.message);
    process.exit(1);
  }
}

checkSignatures().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
