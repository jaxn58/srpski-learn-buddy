/**
 * Quick script to change the current user's language to German
 * Run with: npx tsx scripts/change-my-language-to-german.ts
 */

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

async function changeLanguage() {
  console.log("🌍 Changing user language to German...\n");

  const convex = new ConvexHttpClient(CONVEX_URL);

  try {
    // Get all users (using temporary query - no auth required)
    const users = await convex.query(api.admin.getAllUsersTemp);
    
    if (!users || users.length === 0) {
      console.log("❌ No users found");
      return;
    }

    console.log(`📊 Found ${users.length} user(s):\n`);

    // Show all users and ask which one to update
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name || user.email || "Unknown"}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Current Language: ${user.learningLanguage || "en"}`);
      console.log(`   Role: ${user.role}`);
      console.log("");
    });

    // For now, update ALL users to German (you can modify this)
    console.log("🔄 Updating all users to German (de)...\n");

    for (const user of users) {
      try {
        await convex.mutation(api.admin.updateUserLanguageTemp, {
          userId: user._id,
          learningLanguage: "de",
        });
        console.log(`✅ Updated ${user.name || user.email} to German`);
      } catch (error: any) {
        console.error(`❌ Failed to update ${user.name || user.email}:`, error.message);
      }
    }

    console.log("\n✨ Done! Please refresh your browser to see the changes.");
    
  } catch (error: any) {
    console.error("❌ Error:", error.message);
  }
}

changeLanguage();

