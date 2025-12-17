/**
 * Replace Unit 1 vocabulary - Delete all existing and import new from Markdown file
 * 
 * Usage: npx tsx scripts/replace-unit1-vocabulary.ts
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

const UNIT_NUMBER = 1;
const MARKDOWN_FILE = path.join(
  process.cwd(),
  "New Content",
  "Betta Deploy",
  "Module 1_ Ankommen (Arrival).md"
);

interface VocabularyWord {
  serbian: string;
  english: string;
  notes?: string;
}

/**
 * Parse markdown table and extract vocabulary words from Unit 1
 * Includes phrases and sentences (unlike Unit 6 script)
 */
function parseMarkdownTable(content: string): VocabularyWord[] {
  const words: VocabularyWord[] = [];
  const lines = content.split("\n");
  
  let inVocabularySection = false;
  let inTable = false;
  let headerFound = false;
  
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
        let serbian = cells[0].trim();
        const english = cells[1].trim();
        const notes = cells[2]?.trim();
        
        // Skip if empty or header row
        if (serbian && english && serbian !== "Serbian" && english !== "English") {
          // Clean up serbian (remove asterisks for Montenegro variants)
          serbian = serbian.replace(/\*$/, "").trim();
          
          // Handle multiple entries separated by "/" (e.g., "Razumem*. / Ne razumem*.")
          if (serbian.includes("/")) {
            const parts = serbian.split("/").map(p => p.trim());
            const englishParts = english.includes("/") 
              ? english.split("/").map(p => p.trim())
              : [english];
            
            // Add each part as separate entry
            parts.forEach((part, idx) => {
              const cleanPart = part.replace(/\*\.?$/, "").trim();
              const englishPart = englishParts[idx] || englishParts[0];
              
              if (cleanPart && englishPart) {
                words.push({
                  serbian: cleanPart,
                  english: englishPart,
                  notes: notes || undefined,
                });
              }
            });
          } else {
            // Single entry
            words.push({
              serbian: serbian,
              english: english,
              notes: notes || undefined,
            });
          }
        }
      }
    }
    
    // End of table (empty line or new section)
    if (inTable && (line === "" || line.startsWith("#") || line.startsWith("---"))) {
      inTable = false;
      headerFound = false;
    }
  }
  
  return words;
}

async function replaceUnit1Vocabulary() {
  console.log("🚀 Replacing Unit 1 Vocabulary...");
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
  
  // Step 1: Delete all existing Unit 1 vocabulary
  console.log("\n   Step 1: Deleting all existing Unit 1 vocabulary...");
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
      // Extract note from English translation if it contains parentheses (e.g., "Hello (Informal)")
      let primaryTranslation = word.english;
      let extractedNote: string | undefined = undefined;
      
      // Check if translation contains note in parentheses
      const noteMatch = primaryTranslation.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
      if (noteMatch) {
        primaryTranslation = noteMatch[1].trim();
        extractedNote = noteMatch[2].trim();
      }
      
      // Combine extracted note with notes column (prefer notes column if both exist)
      // If both exist, combine them with a separator
      let finalNote: string | undefined = undefined;
      if (word.notes && extractedNote) {
        // Both exist - combine them
        finalNote = `${word.notes} (${extractedNote})`;
      } else {
        finalNote = word.notes || extractedNote || undefined;
      }
      
      // Clean up final note (remove extra spaces, limit length)
      if (finalNote) {
        finalNote = finalNote.trim();
        // Limit note length to 500 characters (reasonable limit)
        if (finalNote.length > 500) {
          finalNote = finalNote.substring(0, 497) + '...';
        }
      }
      
      // Split English translation if it contains "/" (e.g., "Please / You're welcome")
      const englishTranslations = primaryTranslation.split("/").map(t => t.trim());
      let mainTranslation = englishTranslations[0];
      const altTranslation = englishTranslations.length > 1 ? englishTranslations[1] : undefined;
      
      // Ensure mainTranslation is not empty (fallback to serbian word if empty)
      if (!mainTranslation || mainTranslation.trim().length === 0) {
        mainTranslation = word.serbian;
      }
      
      // Create translations array (for backward compatibility)
      const translations = [
        {
          language: "en",
          translation: mainTranslation,
          alt: altTranslation,
        },
        {
          language: "de",
          translation: mainTranslation, // Use English as fallback for German
        },
      ];
      
      // Prepare note fields (only include if not empty)
      const noteFields: Record<string, string> = {};
      if (finalNote && finalNote.trim().length > 0) {
        noteFields.noteEn = finalNote.trim();
      }
      
      // Import using upsertCourseVocabulary
      await client.mutation(api.vocabulary.upsertCourseVocabulary, {
        unitNumber: UNIT_NUMBER,
        serbian: word.serbian,
        translations: translations,
        gender: undefined,
        pronunciation: undefined,
        ...noteFields,
      });
      
      successCount++;
      console.log(`   ✅ ${word.serbian} → ${mainTranslation}${finalNote ? ` [Note: ${finalNote}]` : ''}`);
    } catch (error: any) {
      errorCount++;
      console.error(`   ❌ Error importing "${word.serbian}":`, error.message || error);
      console.error(`      English: "${word.english}"`);
      console.error(`      Notes: "${word.notes || 'none'}"`);
      console.error(`      Extracted note: "${extractedNote || 'none'}"`);
      console.error(`      Final note: "${finalNote || 'none'}"`);
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
      // Extract note from English translation if it contains parentheses
      let primaryTranslation = importedWord.english;
      let extractedNote: string | undefined = undefined;
      
      const noteMatch = primaryTranslation.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
      if (noteMatch) {
        primaryTranslation = noteMatch[1].trim();
        extractedNote = noteMatch[2].trim();
      }
      
      // Combine extracted note with notes column (prefer notes column if both exist)
      // If both exist, combine them with a separator
      let finalNote: string | undefined = undefined;
      if (importedWord.notes && extractedNote) {
        // Both exist - combine them
        finalNote = `${importedWord.notes} (${extractedNote})`;
      } else {
        finalNote = importedWord.notes || extractedNote || undefined;
      }
      
      // Clean up final note (remove extra spaces, limit length)
      if (finalNote) {
        finalNote = finalNote.trim();
        // Limit note length to 500 characters (reasonable limit)
        if (finalNote.length > 500) {
          finalNote = finalNote.substring(0, 497) + '...';
        }
      }
      
      // Split English translation if it contains "/"
      const englishTranslations = primaryTranslation.split("/").map(t => t.trim());
      let mainTranslation = englishTranslations[0];
      const altTranslation = englishTranslations.length > 1 ? englishTranslations[1] : undefined;
      
      // Ensure mainTranslation is not empty (fallback to serbian word if empty)
      if (!mainTranslation || mainTranslation.trim().length === 0) {
        mainTranslation = vocab.serbian;
      }
      
      // Prepare note fields (only include if not empty)
      const noteFields: Record<string, string> = {};
      if (finalNote && finalNote.trim().length > 0) {
        noteFields.noteEn = finalNote.trim();
      }
      
      try {
        await client.mutation(api.vocabulary.updateCourseVocabularyColumns, {
          courseVocabularyId: vocab._id,
          en: mainTranslation,
          de: mainTranslation, // Use English as fallback for German
          enAlt: altTranslation,
          deAlt: undefined,
          ...noteFields,
        });
        updateCount++;
      } catch (error: any) {
        console.error(`   ❌ Error updating columns for "${vocab.serbian}":`, error.message || error);
        console.error(`      Translation: "${mainTranslation}"`);
        console.error(`      Note: "${finalNote || 'none'}"`);
      }
    }
  }
  
  console.log("\n-----------------------------------");
  console.log(`Replacement Complete!`);
  console.log(`✅ Imported Words: ${successCount}`);
  console.log(`✅ Updated Columns: ${updateCount}`);
  console.log(`❌ Failed Operations: ${errorCount}`);
  console.log(`\n📊 Total Unit 1 Vocabulary: ${allVocab.length} words`);
}

replaceUnit1Vocabulary().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
