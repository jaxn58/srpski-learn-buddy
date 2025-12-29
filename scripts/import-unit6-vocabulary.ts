/**
 * Import Unit 6 vocabulary from Markdown file into Convex database
 * 
 * Usage: npx tsx scripts/import-unit6-vocabulary.ts
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

// Load environment variables
dotenv.config({ path: ".env.local" });

const CONVEX_URL = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL;

if (!CONVEX_URL) {
  console.error("❌ CONVEX_URL not found in environment variables");
  process.exit(1);
}

const UNIT_NUMBER = 6;
const MARKDOWN_FILE = path.join(
  process.cwd(),
  "New Content",
  "learn-with.me-main",
  "Unit-6-My-Town-or-Village-v3.md"
);

interface VocabularyWord {
  serbian: string;
  english: string;
  notes?: string;
}

/**
 * Parse markdown table and extract vocabulary words
 * Imports ALL vocabulary from Vocabulary section (Core + Extended), excludes grammar examples, sentences, and dialogues
 */
function parseMarkdownTable(content: string): VocabularyWord[] {
  const words: VocabularyWord[] = [];
  const lines = content.split("\n");
  
  let inVocabularySection = false;
  let inTable = false;
  let headerFound = false;
  let tableHeader: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Detect Vocabulary section start (## 2. Vocabulary)
    if (line.startsWith("## 2. Vocabulary") || line.startsWith("## 2. Vokabular")) {
      inVocabularySection = true;
      continue;
    }
    
    // Stop at Grammar section (## 3. Grammar) - we only want vocabulary
    if (line.startsWith("## 3. Grammar") || line.startsWith("## 3. Gramatika")) {
      inVocabularySection = false;
      break;
    }
    
    // Only process tables within Vocabulary section
    if (!inVocabularySection) {
      continue;
    }
    
    // Detect table start (markdown table with | Serbian | English |)
    if (line.startsWith("|") && line.includes("Serbian") && line.includes("English")) {
      inTable = true;
      headerFound = true;
      // Extract header columns to check for unwanted table types
      tableHeader = line
        .split("|")
        .map(cell => cell.trim())
        .filter(cell => cell.length > 0);
      
      // Skip tables that are NOT vocabulary tables:
      // - Tables with "Person" (grammar conjugations)
      // - Tables with "Role" (dialogues)
      // - Tables with "Situation" (phrases)
      // - Tables with "Imperative" (grammar examples)
      if (tableHeader.some(h => 
        h.includes("Person") || 
        h.includes("Role") || 
        h.includes("Situation") ||
        h.includes("Imperative")
      )) {
        inTable = false;
        headerFound = false;
        continue;
      }
      continue;
    }
    
    // Skip separator line (|---|---|)
    if (inTable && line.match(/^\|[\s\-:]+\|/)) {
      continue;
    }
    
    // Parse table rows
    if (inTable && line.startsWith("|") && headerFound) {
      const cells = line
        .split("|")
        .map(cell => cell.trim())
        .filter(cell => cell.length > 0);
      
      if (cells.length >= 2) {
        const serbian = cells[0].trim();
        const english = cells[1].trim();
        const notes = cells[2]?.trim();
        
        // Skip if empty or header row
        if (serbian && english && serbian !== "Serbian" && english !== "English") {
          // Skip if it's a grammar example (starts with **)
          if (serbian.startsWith("**") || english.startsWith("**")) {
            continue;
          }
          
          // Skip if it's a sentence (contains question marks, periods, or too many words)
          const isSentence = serbian.includes("?") || 
                            serbian.includes(".") || 
                            english.includes("?") ||
                            english.includes(".") ||
                            serbian.split(/\s+/).length > 3 ||
                            english.split(/\s+/).length > 3;
          
          if (isSentence) {
            continue;
          }
          
          // Clean up serbian (remove asterisks for Montenegro variants)
          const cleanSerbian = serbian.replace(/\*$/, "").trim();
          
          words.push({
            serbian: cleanSerbian,
            english: english,
            notes: notes || undefined,
          });
        }
      }
    }
    
    // End of table (empty line or new section)
    if (inTable && (line === "" || line.startsWith("#") || line.startsWith("---"))) {
      inTable = false;
      headerFound = false;
      tableHeader = [];
    }
  }
  
  return words;
}

async function importUnit6Vocabulary() {
  console.log("🚀 Importing Unit 6 Vocabulary...");
  console.log(`   Convex URL: ${CONVEX_URL}`);
  console.log(`   Markdown File: ${MARKDOWN_FILE}`);
  
  // Read markdown file
  if (!fs.existsSync(MARKDOWN_FILE)) {
    console.error(`❌ Markdown file not found: ${MARKDOWN_FILE}`);
    process.exit(1);
  }
  
  const markdownContent = fs.readFileSync(MARKDOWN_FILE, "utf-8");
  console.log(`   File size: ${markdownContent.length} characters`);
  
  // Parse vocabulary from markdown
  const words = parseMarkdownTable(markdownContent);
  console.log(`   Found ${words.length} vocabulary words`);
  
  if (words.length === 0) {
    console.error("❌ No vocabulary words found in markdown file");
    process.exit(1);
  }
  
  // Display found words
  console.log("\n   Words to import:");
  words.forEach((word, i) => {
    console.log(`   ${i + 1}. ${word.serbian} → ${word.english}`);
  });
  
  const client = new ConvexHttpClient(CONVEX_URL);
  let successCount = 0;
  let errorCount = 0;
  
  // Import each word
  console.log("\n   Importing to database...");
  for (const word of words) {
    try {
      // Split English translation if it contains "/" (e.g., "Town / City")
      const englishTranslations = word.english.split("/").map(t => t.trim());
      const primaryTranslation = englishTranslations[0];
      const altTranslation = englishTranslations.length > 1 ? englishTranslations[1] : undefined;
      
      // Create translations array (for backward compatibility)
      const translations = [
        {
          language: "en",
          translation: primaryTranslation,
          alt: altTranslation,
        },
        {
          language: "de",
          translation: primaryTranslation, // Use English as fallback for German
        },
      ];
      
      // Import using upsertCourseVocabulary
      await client.mutation(api.vocabulary.upsertCourseVocabulary, {
        unitNumber: UNIT_NUMBER,
        serbian: word.serbian,
        translations: translations,
        gender: undefined,
        pronunciation: undefined,
        noteEn: word.notes || undefined,
        noteDe: undefined,
        noteSr: undefined,
        noteEs: undefined,
        noteFr: undefined,
      });
      
      successCount++;
      console.log(`   ✅ ${word.serbian} → ${primaryTranslation}`);
    } catch (error: any) {
      console.error(`   ❌ Error importing "${word.serbian}": ${error.message}`);
      errorCount++;
    }
  }
  
  // Update column-based translations (en, de, enAlt, deAlt)
  console.log("\n   Updating column-based translations...");
  const allVocab = await client.query(api.vocabulary.getCourseVocabularyByUnit, {
    unitNumber: UNIT_NUMBER,
  });
  
  let updateCount = 0;
  for (const vocab of allVocab) {
    // Find matching word from import
    const importedWord = words.find(w => w.serbian === vocab.serbian);
    if (importedWord) {
      const englishTranslations = importedWord.english.split("/").map(t => t.trim());
      const primaryTranslation = englishTranslations[0];
      const altTranslation = englishTranslations.length > 1 ? englishTranslations[1] : undefined;
      
      try {
        await client.mutation(api.vocabulary.updateCourseVocabularyColumns, {
          courseVocabularyId: vocab._id,
          en: primaryTranslation,
          de: primaryTranslation, // Use English as fallback for German
          enAlt: altTranslation,
          deAlt: undefined,
        });
        updateCount++;
      } catch (error: any) {
        console.error(`   ❌ Error updating columns for "${vocab.serbian}": ${error.message}`);
      }
    }
  }
  
  console.log("\n-----------------------------------");
  console.log(`Import Complete!`);
  console.log(`✅ Imported Words: ${successCount}`);
  console.log(`✅ Updated Columns: ${updateCount}`);
  console.log(`❌ Failed Operations: ${errorCount}`);
  console.log(`\n📊 Total Unit 6 Vocabulary: ${allVocab.length} words`);
}

importUnit6Vocabulary().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});










