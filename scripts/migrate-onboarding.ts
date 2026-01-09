/**
 * Migration Script: Convert hardcoded onboarding steps to database entries
 * 
 * This script migrates the 4 hardcoded onboarding steps from WelcomeOnboarding.tsx
 * to the new onboardingSteps database table.
 * 
 * Usage:
 *   npx tsx scripts/migrate-onboarding.ts
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

// Onboarding steps data extracted from WelcomeOnboarding.tsx
const onboardingStepsData = [
  {
    stepNumber: 1,
    language: "en",
    title: "Welcome to Serbian AI Tutor",
    description: "Step 1 of 4",
    icon: "Info",
    content: `
<div class="space-y-4">
  <div class="p-4 border rounded-lg bg-blue-50">
    <h3 class="font-semibold text-lg mb-2">Your Learning Journey Starts Here</h3>
    <p class="text-sm text-muted-foreground">
      Serbian AI Tutor is your companion to the "Serbian LearnBuddy" textbook.
      This interactive platform helps you master Serbian through structured units,
      exercises, and AI-powered support.
    </p>
  </div>

  <div class="space-y-2">
    <h3 class="font-semibold">What You'll Learn:</h3>
    <ul class="list-disc list-inside space-y-1 text-sm text-muted-foreground">
      <li>Serbian alphabet and pronunciation</li>
      <li>Essential grammar (cases, verb conjugations, gender)</li>
      <li>Practical vocabulary for everyday situations</li>
      <li>Conversation skills through interactive exercises</li>
    </ul>
  </div>
</div>
    `.trim(),
    isActive: true,
  },
  {
    stepNumber: 2,
    language: "en",
    title: "How the Course Works",
    description: "Step 2 of 4",
    icon: "BookOpen",
    content: `
<div class="space-y-4">
  <div class="p-4 border rounded-lg bg-blue-50">
    <h3 class="font-semibold text-lg mb-2">5 Modules, 27 Units</h3>
    <p class="text-sm text-muted-foreground">
      The course is divided into 5 comprehensive modules with 27 interactive units covering different topics.
      You can choose your learning pace: 3, 6, 9, or 12 months. Each module builds on the previous one, creating a solid foundation for advanced learning.
    </p>
  </div>

  <div class="space-y-3">
    <div class="p-3 border rounded-lg">
      <h4 class="font-semibold text-sm mb-1">📖 Unit Content</h4>
      <p class="text-sm text-muted-foreground">
        Each unit includes an overview, detailed grammar explanations, and practice examples.
      </p>
    </div>

    <div class="p-3 border rounded-lg">
      <h4 class="font-semibold text-sm mb-1">✍️ Interactive Exercises</h4>
      <p class="text-sm text-muted-foreground">
        Complete fill-in-the-blank and translation exercises to reinforce your learning.
      </p>
    </div>

    <div class="p-3 border rounded-lg">
      <h4 class="font-semibold text-sm mb-1">📊 Progress Tracking</h4>
      <p class="text-sm text-muted-foreground">
        Your progress is automatically saved. Complete units to unlock new ones.
      </p>
    </div>
  </div>
</div>
    `.trim(),
    isActive: true,
  },
  {
    stepNumber: 3,
    language: "en",
    title: "Gamification & Rewards",
    description: "Step 3 of 4",
    icon: "Trophy",
    content: `
<div class="space-y-4">
  <div class="p-4 border rounded-lg bg-blue-50">
    <h3 class="font-semibold text-lg mb-2">Earn XP, Badges & Streaks</h3>
    <p class="text-sm text-muted-foreground">
      Stay motivated with our gamification system that rewards your learning efforts.
    </p>
  </div>

  <div class="space-y-3">
    <div class="p-3 border rounded-lg bg-blue-50">
      <h4 class="font-semibold text-sm mb-1">⭐ Experience Points (XP)</h4>
      <p class="text-sm text-muted-foreground">
        Earn 50 XP for completing a unit + 50 XP bonus for finishing all exercises.
        Level up as you progress!
      </p>
    </div>

    <div class="p-3 border rounded-lg bg-purple-50">
      <h4 class="font-semibold text-sm mb-1">🏅 Achievement Badges</h4>
      <p class="text-sm text-muted-foreground">
        Unlock 7 special badges: First Steps, Week Warrior, Grammar Guru, Serbian Star, and more.
      </p>
    </div>

    <div class="p-3 border rounded-lg bg-green-50">
      <h4 class="font-semibold text-sm mb-1">🔥 Daily Streaks</h4>
      <p class="text-sm text-muted-foreground">
        Study every day to build your streak. Track your current and longest streaks!
      </p>
    </div>
  </div>
</div>
    `.trim(),
    isActive: true,
  },
  {
    stepNumber: 4,
    language: "en",
    title: "AI Learn Buddy - Your AI Tutor",
    description: "Step 4 of 4",
    icon: "Brain",
    content: `
<div class="space-y-4">
  <div class="p-4 border rounded-lg bg-blue-50">
    <h3 class="font-semibold text-lg mb-2">AI Learn Buddy - Your AI Tutor</h3>
    <p class="text-sm text-muted-foreground">
      Get instant help with grammar questions, vocabulary, and practice conversations.
    </p>
  </div>

  <div class="space-y-3">
    <div class="p-3 border rounded-lg">
      <h4 class="font-semibold text-sm mb-1">💬 Ask Questions</h4>
      <p class="text-sm text-muted-foreground">
        Stuck on a grammar rule? Need clarification? Just ask the AI Learn Buddy!
      </p>
    </div>

    <div class="p-3 border rounded-lg">
      <h4 class="font-semibold text-sm mb-1">🗣️ Practice Conversations</h4>
      <p class="text-sm text-muted-foreground">
        Have short conversations in Serbian to practice what you've learned.
      </p>
    </div>

    <div class="p-3 border rounded-lg">
      <h4 class="font-semibold text-sm mb-1">📝 Get Examples</h4>
      <p class="text-sm text-muted-foreground">
        Request additional examples and explanations tailored to your level.
      </p>
    </div>
  </div>

  <div class="p-4 border rounded-lg bg-green-50 border-green-200">
    <h3 class="font-semibold text-green-800 mb-2">Ready to Start!</h3>
    <p class="text-sm text-green-700">
      Begin with Unit 1: "Na aerodromu" (At the airport). Good luck on your Serbian learning journey!
    </p>
  </div>
</div>
    `.trim(),
    isActive: true,
  },
];

async function migrateOnboardingSteps() {
  console.log("🚀 Starting onboarding migration...");
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
    console.log("ℹ️  Starting migration of 4 onboarding steps...");
    console.log("");

    // Migrate each step
    let successCount = 0;
    let errorCount = 0;

    for (const stepData of onboardingStepsData) {
      try {
        console.log(`📝 Creating step ${stepData.stepNumber}: ${stepData.title}...`);
        
        const stepId = await client.mutation(api.onboarding.createOnboardingStepWithSecret, {
          adminSecret,
          stepNumber: stepData.stepNumber,
          language: stepData.language,
          title: stepData.title,
          description: stepData.description,
          content: stepData.content,
          icon: stepData.icon,
          isActive: stepData.isActive,
          backgroundColor: stepData.backgroundColor || undefined,
        });

        console.log(`   ✅ Created successfully (ID: ${stepId})`);
        successCount++;
      } catch (error) {
        console.error(`   ❌ Failed to create step ${stepData.stepNumber}:`, error);
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
      console.log("🎉 Onboarding migration completed successfully!");
      console.log("");
      console.log("Next steps:");
      console.log("1. Test the onboarding in the frontend (Dashboard should show it for new users)");
      console.log("2. Visit /admin/onboarding to manage the steps");
      console.log("3. Consider creating German (de) translations");
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
migrateOnboardingSteps()
  .then(() => {
    console.log("");
    console.log("✅ Migration script completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Unhandled error:", error);
    process.exit(1);
  });
