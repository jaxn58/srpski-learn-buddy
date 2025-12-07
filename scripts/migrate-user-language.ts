/**
 * Migration Script: Add learningLanguage field to existing users
 * 
 * This script updates all existing users in the Convex database
 * to have the new learningLanguage field (defaults to "en" for English).
 * 
 * Usage:
 * 1. Make sure Convex is running (npx convex dev)
 * 2. Run: npx ts-node scripts/migrate-user-language.ts
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const CONVEX_URL = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL;

if (!CONVEX_URL) {
  console.error("❌ Error: CONVEX_URL environment variable not set!");
  console.error("Make sure you have a .env.local file with VITE_CONVEX_URL");
  process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);

async function migrateUserLanguages() {
  console.log("🚀 Starting migration: Adding learningLanguage to existing users...\n");

  try {
    // Fetch all users
    console.log("📊 Fetching all users from database...");
    const users = await client.query(api.admin.getAllUsersForMigration);
    
    if (!users || users.length === 0) {
      console.log("✅ No users found in database. Migration not needed.");
      return;
    }

    console.log(`📦 Found ${users.length} users to migrate.\n`);

    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    // Process each user
    for (const user of users) {
      try {
        // Check if user already has learningLanguage
        if (user.learningLanguage) {
          console.log(`⏭️  Skipping user ${user.name || user.email} - already has learningLanguage: ${user.learningLanguage}`);
          skipped++;
          continue;
        }

        // Determine default language
        // You could add logic here to detect language based on user.uiLanguage or other fields
        const defaultLanguage = "en"; // Default to English

        console.log(`🔄 Migrating user: ${user.name || user.email || user.clerkId}`);
        console.log(`   Setting learningLanguage to: ${defaultLanguage}`);

        // Update user with learningLanguage field
        await client.mutation(api.admin.updateUser, {
          userId: user._id,
          learningLanguage: defaultLanguage,
        });

        console.log(`✅ Successfully migrated user ${user.name || user.email}\n`);
        migrated++;

      } catch (error) {
        console.error(`❌ Error migrating user ${user.name || user.email}:`, error);
        errors++;
      }
    }

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("📊 MIGRATION SUMMARY");
    console.log("=".repeat(60));
    console.log(`✅ Successfully migrated: ${migrated} users`);
    console.log(`⏭️  Skipped (already migrated): ${skipped} users`);
    console.log(`❌ Errors: ${errors} users`);
    console.log(`📦 Total users: ${users.length}`);
    console.log("=".repeat(60));

    if (migrated > 0) {
      console.log("\n✨ Migration completed successfully!");
      console.log("🎯 All existing users now have learningLanguage field set to 'en' (English)");
      console.log("💡 New users will automatically get their chosen language upon registration.");
    }

  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  }
}

// Run migration
migrateUserLanguages()
  .then(() => {
    console.log("\n✅ Migration script completed.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  });

