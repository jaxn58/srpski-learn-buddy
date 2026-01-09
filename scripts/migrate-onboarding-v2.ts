/**
 * Migration Script V2: Convert row-based to column-based onboarding steps
 * 
 * This script migrates onboarding steps from row-based structure (one row per language)
 * to column-based structure (one row with language columns).
 * 
 * Usage:
 *   npx tsx scripts/migrate-onboarding-v2.ts
 * 
 * Environment:
 *   - Dev: Uses CONVEX_URL from .env.local
 *   - Prod: Set CONVEX_URL environment variable to production URL
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import * as dotenv from "dotenv";
import * as path from "path";

// Load .env.local file
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const CONVEX_URL = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL;

if (!CONVEX_URL) {
  console.error("❌ Error: CONVEX_URL not set");
  console.error("Please set VITE_CONVEX_URL in .env.local or CONVEX_URL as environment variable");
  process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);

interface OldStep {
  _id: string;
  stepNumber: number;
  language: string;
  title: string;
  description: string;
  content: string;
  icon: string;
  isActive: boolean;
  backgroundColor?: string;
  createdAt: number;
  updatedAt: number;
}

async function migrateToColumnBased() {
  console.log("🚀 Starting onboarding V2 migration (row→column based)...");
  console.log(`📡 Using Convex URL: ${CONVEX_URL}`);
  console.log("");

  try {
    // Check if admin secret is set
    const adminSecret = process.env.ADMIN_SECRET;
    if (!adminSecret) {
      console.error("❌ Error: ADMIN_SECRET not set");
      console.error("Migration requires admin authentication.");
      console.error("Please set ADMIN_SECRET in your .env.local file");
      process.exit(1);
    }

    console.log("✅ Admin secret loaded");
    console.log("");

    // Get all existing row-based steps (using secret-based auth)
    console.log("📖 Reading existing row-based steps...");
    const oldSteps = await client.query(api.onboarding.getAllOnboardingStepsWithSecret, {
      adminSecret,
    }) as OldStep[];
    
    if (!oldSteps || oldSteps.length === 0) {
      console.log("⚠️  No existing steps found. Nothing to migrate.");
      return;
    }

    console.log(`   Found ${oldSteps.length} row-based step(s)`);
    console.log("");

    // Group steps by stepNumber
    const groupedSteps = new Map<number, Map<string, OldStep>>();
    
    for (const step of oldSteps) {
      if (!groupedSteps.has(step.stepNumber)) {
        groupedSteps.set(step.stepNumber, new Map());
      }
      groupedSteps.get(step.stepNumber)!.set(step.language, step);
    }

    console.log(`📊 Grouped into ${groupedSteps.size} unique step(s)`);
    console.log("");

    // Create column-based steps
    let successCount = 0;
    let errorCount = 0;

    for (const [stepNumber, languageSteps] of groupedSteps.entries()) {
      try {
        const enStep = languageSteps.get("en");
        const deStep = languageSteps.get("de");
        const esStep = languageSteps.get("es");
        const frStep = languageSteps.get("fr");

        if (!enStep) {
          console.error(`   ❌ Step ${stepNumber}: No English version found, skipping`);
          errorCount++;
          continue;
        }

        console.log(`📝 Migrating step ${stepNumber}...`);
        console.log(`   Languages: ${Array.from(languageSteps.keys()).join(", ")}`);

        const newStepId = await client.mutation(api.onboarding.createOnboardingStepV2WithSecret, {
          adminSecret,
          stepNumber,
          titleEn: enStep.title,
          titleDe: deStep?.title,
          titleEs: esStep?.title,
          titleFr: frStep?.title,
          descriptionEn: enStep.description,
          descriptionDe: deStep?.description,
          descriptionEs: esStep?.description,
          descriptionFr: frStep?.description,
          contentEn: enStep.content,
          contentDe: deStep?.content,
          contentEs: esStep?.content,
          contentFr: frStep?.content,
          icon: enStep.icon,
          isActive: enStep.isActive,
          backgroundColor: enStep.backgroundColor,
        });

        console.log(`   ✅ Created column-based step (ID: ${newStepId})`);
        successCount++;
      } catch (error) {
        console.error(`   ❌ Failed to migrate step ${stepNumber}:`, error);
        errorCount++;
      }
      console.log("");
    }

    // Summary
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📊 Migration Summary:");
    console.log(`   ✅ Successfully migrated: ${successCount} step(s)`);
    if (errorCount > 0) {
      console.log(`   ❌ Failed: ${errorCount} step(s)`);
    }
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("");

    if (successCount > 0) {
      console.log("🎉 Migration completed successfully!");
      console.log("");
      console.log("⚠️  IMPORTANT: Old row-based steps are still in the database.");
      console.log("   After verifying the new column-based steps work correctly:");
      console.log("   1. Test the frontend");
      console.log("   2. Test the admin panel");
      console.log("   3. Delete old row-based steps manually in Convex Dashboard");
      console.log("");
      console.log("Next steps:");
      console.log("1. Update frontend to use getActiveOnboardingStepsV2");
      console.log("2. Update admin panel to use V2 mutations");
      console.log("3. Test thoroughly");
      console.log("4. Remove old row-based steps");
    }

    if (errorCount > 0) {
      console.log("");
      console.log("⚠️  Some steps failed to migrate. Please check the errors above.");
      process.exit(1);
    }

  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

// Run migration
migrateToColumnBased()
  .then(() => {
    console.log("");
    console.log("✅ Migration script completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Unhandled error:", error);
    process.exit(1);
  });
