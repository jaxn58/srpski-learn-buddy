import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read the markdown file
const practiceExamplesPath = path.join(__dirname, "..", "docs", "UNIT16_PRACTICE_EXAMPLES.md");
const practiceExamplesContent = fs.readFileSync(practiceExamplesPath, "utf-8");

// Add interactive exercises at the end
const updatedPracticeExamples = `${practiceExamplesContent}

---

## 🎮 Interactive Exercises

Now practice what you've learned with these interactive exercises!

<InteractiveExercise type="fillInBlank" id="unit16-dative-pronouns" />

<InteractiveExercise type="fillInBlank" id="unit16-dative-nouns" />

<InteractiveExercise type="translation" id="unit16-apartment-vocab" />

<InteractiveExercise type="genderRecognition" id="unit16-furniture-gender" />

---

## 🎯 Keep Practicing!

Great job! You've completed the interactive exercises for Unit 16. Continue practicing the dative case and apartment vocabulary to master this unit.
`;

// Overview and Grammar (keep existing)
// We'll only update the practiceExamples field
// Keep existing overview and grammarExplained by fetching them first

async function updateUnit16() {
  const deploymentUrl = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL;
  if (!deploymentUrl) {
    console.error("❌ CONVEX_URL not found in environment variables");
    console.error("Please set VITE_CONVEX_URL or CONVEX_URL in .env");
    process.exit(1);
  }

  const client = new ConvexHttpClient(deploymentUrl);

  console.log("Fetching existing Unit 16 data...");
  
  // First, get the existing data
  const existingData = await client.query(api.units.getExplanation, {
    unitNumber: 16,
  });

  if (!existingData || !existingData.overview || !existingData.grammarExplained) {
    throw new Error("Unit 16 data not found in database. Please ensure overview and grammar are already set.");
  }

  console.log("Updating Unit 16 with interactive exercises...");

  try {
    await client.mutation(api.units.seedExplanation, {
      unitNumber: 16,
      overview: existingData.overview,
      grammarExplained: existingData.grammarExplained,
      practiceExamples: updatedPracticeExamples,
    });

    console.log("✅ Successfully updated Unit 16 with interactive exercises!");
    console.log("\nInteractive exercises added:");
    console.log("  - Exercise 1: Dative Personal Pronouns (Fill-in-blank)");
    console.log("  - Exercise 2: Dative Case with Nouns (Fill-in-blank)");
    console.log("  - Exercise 3: Apartment Vocabulary (Translation)");
    console.log("  - Exercise 4: Furniture Gender Recognition");
  } catch (error) {
    console.error("❌ Error updating Unit 16:", error);
    throw error;
  }
}

updateUnit16();



