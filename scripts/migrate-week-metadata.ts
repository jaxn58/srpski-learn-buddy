import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { COURSE_WEEKS } from "../shared/data/course/weeks";
import * as dotenv from "dotenv";

// Load environment variables from .env.local
dotenv.config({ path: ".env.local" });

const CONVEX_URL = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL;

if (!CONVEX_URL) {
  console.error("❌ CONVEX_URL not found in environment variables");
  process.exit(1);
}

async function migrateWeekMetadata() {
  console.log("🚀 Migrating Week Metadata to Convex...");
  console.log(`   Convex URL: ${CONVEX_URL}`);

  const client = new ConvexHttpClient(CONVEX_URL);
  let successCount = 0;
  let errorCount = 0;

  for (const week of COURSE_WEEKS) {
    console.log(`Processing Week ${week.weekNumber}: ${week.title}`);

    // 1. Migrate English Data
    try {
      await client.mutation(api.weeks.insertWeekMetadata, {
        weekNumber: week.weekNumber,
        language: "en",
        title: week.title,
        goals: week.goals,
        practiceActivities: week.practiceActivities,
      });
      process.stdout.write("  ✅ EN ");
      successCount++;
    } catch (error: any) {
      console.error(`  ❌ EN Error: ${error.message}`);
      errorCount++;
    }

    // 2. Migrate German Data
    try {
      await client.mutation(api.weeks.insertWeekMetadata, {
        weekNumber: week.weekNumber,
        language: "de",
        title: week.titleGerman || `[TODO] ${week.title}`,
        goals: week.goalsGerman || week.goals.map(g => `[TODO] ${g}`),
        practiceActivities: week.practiceActivitiesGerman || week.practiceActivities.map(p => `[TODO] ${p}`),
      });
      process.stdout.write("✅ DE\n");
      successCount++;
    } catch (error: any) {
      console.error(`  ❌ DE Error: ${error.message}\n`);
      errorCount++;
    }
  }

  console.log("\n-----------------------------------");
  console.log(`Migration Complete!`);
  console.log(`✅ Successful operations: ${successCount}`);
  console.log(`❌ Failed operations: ${errorCount}`);
}

migrateWeekMetadata().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
