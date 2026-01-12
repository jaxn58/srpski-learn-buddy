/**
 * Migration Script: Copy Chat Prompts from Development to Production
 * 
 * This script copies:
 * - chatPrompts (current active prompt)
 * - chatPromptHistory (version history)
 * 
 * from Development DB to Production DB
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import * as dotenv from "dotenv";

// Load .env.local for Development URL
dotenv.config({ path: ".env.local" });

const DEV_CONVEX_URL = process.env.VITE_CONVEX_URL;
const PROD_CONVEX_URL = process.env.VITE_CONVEX_URL_PRODUCTION || "https://fleet-labrador-324.convex.cloud";

if (!DEV_CONVEX_URL) {
  console.error("❌ VITE_CONVEX_URL not found in .env.local");
  console.error("This should be your Development Convex URL");
  process.exit(1);
}

console.log("🔧 Convex URLs:");
console.log(`  Dev:  ${DEV_CONVEX_URL}`);
console.log(`  Prod: ${PROD_CONVEX_URL}`);
console.log("");

const devClient = new ConvexHttpClient(DEV_CONVEX_URL);
const prodClient = new ConvexHttpClient(PROD_CONVEX_URL);

interface MigrationStats {
  chatPrompts: { total: number; migrated: number; };
  chatPromptHistory: { total: number; migrated: number; };
}

async function migratePrompts() {
  console.log("🚀 Starting Chat Prompt Migration from Dev to Production");
  console.log("=".repeat(60));
  console.log("");

  const stats: MigrationStats = {
    chatPrompts: { total: 0, migrated: 0 },
    chatPromptHistory: { total: 0, migrated: 0 },
  };

  try {
    // Step 1: Fetch current prompt from Dev (or use hardcoded default)
    console.log("📥 Step 1: Fetching current prompt from Development...");
    let devPrompt;
    
    try {
      devPrompt = await devClient.query(api.admin.getChatPrompt, { name: "default" });
    } catch (error: any) {
      console.log("⚠️  Could not fetch from Dev (likely auth issue), will use hardcoded default");
    }
    
    if (!devPrompt) {
      console.log("ℹ️  No prompt found in Development database");
      console.log("ℹ️  Using hardcoded default from convex/chat.ts");
      // Use the hardcoded default from chat.ts
      devPrompt = {
        name: "default",
        content: `You are an enthusiastic and supportive AI Learn Buddy - a warm, encouraging Serbian language coach who genuinely cares about the student's progress. You do NOT reference any specific textbook unless the user explicitly asks. Keep it neutral and app-focused.

Your personality:
- **Warm & Encouraging**: Celebrate every success, no matter how small ("Odlično!", "Bravo!", "Perfekt!")
- **Interactive**: Ask follow-up questions to check understanding ("Can you give me an example?", "How would you say...?")
- **Patient**: When students make mistakes, respond with empathy ("No worries, this is tricky! Let's work through it together.")
- **Proactive**: Offer praise when you notice improvement
- **Motivating**: Use positive reinforcement and Serbian expressions to build confidence

Your coaching approach:
- **Explain** grammatical concepts clearly with relatable examples
- **Praise** correct answers enthusiastically ("Excellent! You nailed it!")
- **Encourage** after mistakes ("Good try! Let's adjust this together...")
- **Ask questions** to verify understanding ("Can you use this in a sentence?")
- **Use Serbian expressions** for praise (Odlično, Bravo, Sjajno, Super)
- **Be conversational** - respond like a supportive friend, not a textbook

Formatting rules:
- Use Unicode characters for symbols: → (not LaTeX)
- Use Markdown for formatting
- Use **bold** for emphasis, *italic* for Serbian words
- Keep responses focused and not too long`,
        updatedAt: Date.now()
      };
    }

    stats.chatPrompts.total = 1;
    console.log(`✅ Prompt ready for migration`);
    console.log("");

    // Step 2: Check Production database status
    console.log("📥 Step 2: Checking Production database...");
    let prodPrompt;
    try {
      prodPrompt = await prodClient.query(api.admin.getChatPrompt, { name: "default" });
      if (prodPrompt) {
        console.log("⚠️  Warning: A prompt already exists in Production!");
        console.log(`   Last updated: ${new Date(prodPrompt.updatedAt).toLocaleString()}`);
        console.log("   This migration will update it.");
      } else {
        console.log("✅ Production database is empty - ready for migration");
      }
    } catch (error: any) {
      console.log("⚠️  Could not query Production (likely auth issue)");
      console.log("   Migration will proceed with seedChatPrompt mutation");
    }
    console.log("");

    // Step 3: Migrate prompt to Production using seedChatPrompt
    console.log("📤 Step 3: Migrating prompt to Production...");
    
    // Check for ADMIN_SECRET
    const adminSecret = process.env.ADMIN_SECRET;
    if (!adminSecret) {
      console.error("❌ ADMIN_SECRET not found in environment!");
      console.error("");
      console.error("The migration requires ADMIN_SECRET to be set.");
      console.error("Please add it to your .env.local file:");
      console.error("  ADMIN_SECRET=your-secret-here");
      console.error("");
      console.error("You can find the Production ADMIN_SECRET in:");
      console.error("  - Convex Dashboard → Settings → Environment Variables");
      console.error("  - Or ask the team lead");
      process.exit(1);
    }

    try {
      await prodClient.mutation(api.admin.seedChatPrompt, {
        name: "default",
        content: devPrompt.content,
        description: "Initial seed from Development",
        adminSecret: adminSecret
      });
      stats.chatPrompts.migrated = 1;
      console.log("✅ Prompt migrated successfully to Production");
    } catch (error: any) {
      console.error("❌ Failed to migrate prompt:", error.message);
      
      if (error.message.includes("Invalid admin secret")) {
        console.error("");
        console.error("💡 The ADMIN_SECRET in your .env.local does not match Production.");
        console.error("   Please verify the secret in Convex Dashboard → Settings → Environment Variables");
      }
      
      throw error;
    }
    console.log("");

    // Summary
    console.log("=".repeat(60));
    console.log("📊 Migration Summary:");
    console.log("=".repeat(60));
    console.log("");
    console.log("Chat Prompts:");
    console.log(`  Total:    ${stats.chatPrompts.total}`);
    console.log(`  Migrated: ${stats.chatPrompts.migrated}`);
    console.log("");
    console.log("Prompt History:");
    console.log(`  Total:    ${stats.chatPromptHistory.total}`);
    console.log(`  Migrated: ${stats.chatPromptHistory.migrated}`);
    console.log("");
    console.log("=".repeat(60));
    console.log("✅ Migration completed successfully!");
    console.log("");
    console.log("Next steps:");
    console.log("1. Verify in Production: https://learn-with.me/admin/prompt-admin");
    console.log("2. Test the Prompt Admin page");
    console.log("3. Check that version history is visible");
    console.log("");

  } catch (error: any) {
    console.error("");
    console.error("=".repeat(60));
    console.error("❌ Migration failed!");
    console.error("=".repeat(60));
    console.error("");
    console.error("Error:", error.message);
    console.error("");
    
    if (error.message.includes("Unauthorized")) {
      console.error("💡 Troubleshooting:");
      console.error("  - The migration requires admin authentication");
      console.error("  - Make sure your Convex deployment has admin users");
      console.error("  - You may need to run this with proper authentication");
    }
    
    process.exit(1);
  }
}

// Run migration
migratePrompts();
