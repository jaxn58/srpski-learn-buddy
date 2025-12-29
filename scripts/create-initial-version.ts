#!/usr/bin/env tsx
/**
 * Create Initial Version Script
 * 
 * This script creates the initial version (1.0.0 Beta) in the database
 * and optionally adds initial changelog entries.
 * 
 * Usage:
 *   tsx scripts/create-initial-version.ts
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const CONVEX_URL = process.env.CONVEX_DEPLOYMENT || process.env.VITE_CONVEX_URL;

async function main() {
  console.log("🚀 Creating Initial Version");
  console.log("===========================");
  console.log("");

  if (!CONVEX_URL) {
    console.error("❌ Error: CONVEX_DEPLOYMENT or VITE_CONVEX_URL environment variable not set");
    console.log("Please set the Convex URL in your environment variables.");
    process.exit(1);
  }

  console.log("📝 This script will create:");
  console.log("   - Version 1.0.0 (Beta environment)");
  console.log("   - Initial changelog entries");
  console.log("");
  console.log("⚠️  IMPORTANT: This script requires admin authentication.");
  console.log("   Please run this manually via the Admin UI instead:");
  console.log("");
  console.log("   1. Start your development server: pnpm dev");
  console.log("   2. Login as admin");
  console.log("   3. Go to /admin/changelog");
  console.log("   4. Click 'New Version'");
  console.log("   5. Enter version: 1.0.0");
  console.log("   6. Select environment: Beta");
  console.log("   7. Click 'Create Version'");
  console.log("");
  console.log("   Then add changelog entries:");
  console.log("   - Category: Added");
  console.log("   - Title: Initial beta release");
  console.log("   - Description: Serbian AI Tutor beta version with core features");
  console.log("");
  console.log("   Additional entries to add:");
  console.log("   - [Added] Complete course content for Units 1-5");
  console.log("   - [Added] AI-powered chat assistant for learning support");
  console.log("   - [Added] Interactive vocabulary practice with audio");
  console.log("   - [Added] Progress tracking and gamification system");
  console.log("   - [Added] XP system with levels and badges");
  console.log("");

  // Initialize Convex client (read-only operations)
  const client = new ConvexHttpClient(CONVEX_URL);

  try {
    console.log("📥 Checking for existing versions...");
    const currentVersion = await client.query(api.versions.getCurrentVersion, {
      environment: "beta",
    });

    if (currentVersion) {
      console.log(`✅ Version ${currentVersion.version} already exists (${currentVersion.environment})`);
      console.log("   No action needed.");
    } else {
      console.log("⚠️  No version found. Please create it via the Admin UI as described above.");
    }
  } catch (error: any) {
    console.error("❌ Error checking versions:", error.message);
  }

  console.log("");
  console.log("✨ Script completed!");
}

main().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
