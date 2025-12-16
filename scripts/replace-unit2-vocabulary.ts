/**
 * Replace Unit 2 vocabulary - Delete all existing and import new from Markdown file
 * Handles nationalities with masculine/feminine forms
 * 
 * Usage: npx tsx scripts/replace-unit2-vocabulary.ts
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

const UNIT_NUMBER = 2;
const MARKDOWN_FILE = path.join(
  process.cwd(),
  "New Content",
  "learn-with.me-main",
  "Unit-2-Who-Are-You-v7.md"
);

interface VocabularyWord {
  serbian: string;
  english: string;
  gender?: string; // "m" for masculine, "f" for feminine
}

/**
 * Parse markdown table and extract vocabulary words from Unit 2
 * Handles special case: Nationalities table with masculine/feminine columns
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
    
    // Detect table start (markdown table)
    if (line.startsWith("|") && line.includes("Serbian") && line.includes("English")) {
      inTable = true;
      headerFound = true;
      tableHeader = line
        .split("|")
        .map(cell => cell.trim())
        .filter(cell => cell.length > 0);
      continue;
    }
    
    // Special handling for Nationalities table (has Masculine/Feminine columns)
    if (line.startsWith("|") && line.includes("Masculine") && line.includes("Feminine")) {
      inTable = true;
      headerFound = true;
      tableHeader = line
        .split("|")
        .map(cell => cell.trim())
        .filter(cell => cell.length > 0);
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
        // Check if this is a Nationalities table (has Masculine/Feminine columns)
        const isNationalitiesTable = tableHeader.includes("Masculine") && tableHeader.includes("Feminine");
        
        if (isNationalitiesTable) {
          // Nationalities table: Extract masculine and feminine forms
          const masculine = cells[0]?.trim();
          const feminine = cells[1]?.trim();
          const english = cells[2]?.trim();
          
          if (masculine && english) {
            words.push({
              serbian: masculine,
              english: english + " (m)",
              gender: "m",
            });
          }
          
          if (feminine && english) {
            words.push({
              serbian: feminine,
              english: english + " (f)",
              gender: "f",
            });
          }
        } else {
          // Regular vocabulary table
          let serbian = cells[0].trim();
          let english = cells[1].trim();
          const notes = cells[2]?.trim();
          
          // Skip if empty or header row
          if (serbian && english && serbian !== "Serbian" && english !== "English" && 
              serbian !== "Masculine" && serbian !== "Feminine") {
            // Clean up serbian (remove asterisks for Montenegro variants)
            serbian = serbian.replace(/\*$/, "").trim();
            
            // Handle multiple entries separated by "/" (e.g., "Dobrodošao / Dobrodošla")
            if (serbian.includes("/")) {
              const parts = serbian.split("/").map(p => p.trim());
              
              // Handle English translation
              let baseEnglish = english.trim();
              // Check if notes contain (m/f) OR if english itself contains (m/f)
              const hasMfNote = notes?.includes("(m/f)") || english.includes("(m/f)");
              
              if (hasMfNote) {
                // Remove (m/f) from translation - handle various formats
                baseEnglish = baseEnglish.replace(/\s*\(m\/f\)/gi, "").trim();
              }
              
              // Add each part as separate entry
              parts.forEach((part, idx) => {
                const cleanPart = part.replace(/\*\.?$/, "").trim();
                
                // Determine English translation for this part
                let englishPart: string;
                if (hasMfNote) {
                  // First part gets (m), second gets (f)
                  englishPart = idx === 0 ? `${baseEnglish} (m)` : `${baseEnglish} (f)`;
                } else {
                  // Use same translation for both
                  englishPart = baseEnglish;
                }
                
                if (cleanPart && englishPart) {
                  // Determine gender
                  let gender: string | undefined = undefined;
                  if (hasMfNote) {
                    gender = idx === 0 ? "m" : "f";
                  } else if (notes?.includes("(m)")) {
                    gender = "m";
                  } else if (notes?.includes("(f)")) {
                    gender = "f";
                  }
                  
                  words.push({
                    serbian: cleanPart,
                    english: englishPart,
                    gender: gender,
                  });
                }
              });
            } else {
              // Single entry
              // Try to detect gender from notes
              let gender: string | undefined = undefined;
              if (notes?.includes("(m)")) {
                gender = "m";
              } else if (notes?.includes("(f)")) {
                gender = "f";
              }
              
              words.push({
                serbian: serbian,
                english: english,
                gender: gender,
              });
            }
          }
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

async function replaceUnit2Vocabulary() {
  console.log("🚀 Replacing Unit 2 Vocabulary...");
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
  console.log(`   Found ${words.length} vocabulary words/phrases`);
  
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
  
  // Step 1: Delete all existing Unit 2 vocabulary
  console.log("\n   Step 1: Deleting all existing Unit 2 vocabulary...");
  try {
    const deleteResult = await client.mutation(api.vocabulary.deleteVocabularyByUnits, {
      unitNumbers: [UNIT_NUMBER],
    });
    console.log(`   ✅ Deleted ${deleteResult.deleted} existing vocabulary entries`);
  } catch (error: any) {
    console.error(`   ❌ Error deleting existing vocabulary: ${error.message}`);
    process.exit(1);
  }
  
  // Step 2: Import new words
  console.log("\n   Step 2: Importing new vocabulary...");
  let successCount = 0;
  let errorCount = 0;
  
  for (const word of words) {
    try {
      // Split English translation if it contains "/" (for alt translations)
      const englishParts = word.english.split("/").map(t => t.trim());
      const primaryTranslation = englishParts[0];
      const altTranslation = englishParts.length > 1 ? englishParts[1] : undefined;
      
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
        gender: word.gender, // Store gender in database
        pronunciation: undefined,
      });
      
      successCount++;
      console.log(`   ✅ ${word.serbian} → ${primaryTranslation}`);
    } catch (error: any) {
      console.error(`   ❌ Error importing "${word.serbian}": ${error.message}`);
      errorCount++;
    }
  }
  
  // Step 3: Update column-based translations (en, de, enAlt, deAlt)
  console.log("\n   Step 3: Updating column-based translations...");
  const allVocab = await client.query(api.vocabulary.getCourseVocabularyByUnit, {
    unitNumber: UNIT_NUMBER,
  });
  
  let updateCount = 0;
  for (const vocab of allVocab) {
    // Find matching word from import
    const importedWord = words.find(w => w.serbian === vocab.serbian);
    if (importedWord) {
      // Split English translation if it contains "/" (for alt translations)
      const englishParts = importedWord.english.split("/").map(t => t.trim());
      const primaryTranslation = englishParts[0];
      const altTranslation = englishParts.length > 1 ? englishParts[1] : undefined;
      
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
  console.log(`Replacement Complete!`);
  console.log(`✅ Imported Words: ${successCount}`);
  console.log(`✅ Updated Columns: ${updateCount}`);
  console.log(`❌ Failed Operations: ${errorCount}`);
  console.log(`\n📊 Total Unit 2 Vocabulary: ${allVocab.length} words`);
}

replaceUnit2Vocabulary().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
