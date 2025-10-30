import { getDb } from "../server/db";
import { unitExplanations } from "../drizzle/schema";
import { nanoid } from "nanoid";

// Import the data from shared
import { getUnitExplanation } from "../shared/unitExplanations";

async function seedUnitExplanations() {
  console.log("Seeding unit explanations...");

  const db = await getDb();
  if (!db) {
    console.error("Database not available!");
    process.exit(1);
  }

  // Insert Units 1-3 (the ones with comprehensive content)
  for (let unitNum = 1; unitNum <= 3; unitNum++) {
    const explanation = getUnitExplanation(unitNum);
    
    if (!explanation) {
      console.log(`No explanation found for Unit ${unitNum}, skipping...`);
      continue;
    }

    try {
      await db.insert(unitExplanations).values({
        id: nanoid(),
        unitNumber: unitNum,
        overview: explanation.overview,
        grammarExplained: explanation.grammarExplained,
        practiceExamples: explanation.practiceExamples,
        bookReference: explanation.bookReference || `Unit ${unitNum} from Step by Step Serbian 1`,
      });
      
      console.log(`✓ Inserted Unit ${unitNum} (${explanation.overview.length} chars)`);
    } catch (error: any) {
      console.error(`✗ Error inserting Unit ${unitNum}:`, error.message);
    }
  }

  console.log("Done!");
  process.exit(0);
}

seedUnitExplanations().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

