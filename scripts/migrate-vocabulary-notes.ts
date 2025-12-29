/**
 * Migration script: Extract notes from existing vocabulary translations
 * 
 * This script:
 * 1. Reads all courseVocabulary entries
 * 2. Extracts note information from translations using multiple patterns
 * 3. Stores extracted notes in corresponding note fields (noteEn, noteDe, etc.)
 * 4. Optionally cleans translations (removes note text from translation)
 * 5. Provides preview mode to review changes before applying
 * 
 * Usage: 
 *   npx tsx scripts/migrate-vocabulary-notes.ts [--preview] [--clean] [--unit=N]
 * 
 * Options:
 *   --preview: Show what would be extracted without making changes
 *   --clean: Remove note text from translations after extraction
 *   --unit=N: Only process vocabulary from unit N
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

const client = new ConvexHttpClient(CONVEX_URL);
const CLEAN_TRANSLATIONS = process.argv.includes("--clean");
const PREVIEW_MODE = process.argv.includes("--preview");

// Parse unit filter
const unitArg = process.argv.find(arg => arg.startsWith("--unit="));
const UNIT_FILTER = unitArg ? parseInt(unitArg.split("=")[1]) : null;

/**
 * Common note patterns to recognize
 */
const NOTE_PATTERNS = [
  // Pattern 1: (informal), (formal), (informell), etc.
  /^(.+?)\s*\((informal|formal|informell|formell|casual|polite|slang|colloquial)\)\s*$/i,
  
  // Pattern 2: (m), (f), (n) - gender markers (can be notes)
  /^(.+?)\s*\((m|f|n|m\/f|männlich|weiblich|neutral|masculine|feminine|neuter)\)\s*$/i,
  
  // Pattern 3: (used with...), (wird verwendet mit...), etc.
  /^(.+?)\s*\((used\s+with|wird\s+verwendet\s+mit|used\s+for|wird\s+benutzt\s+für)[^)]+\)\s*$/i,
  
  // Pattern 4: Generic parentheses content (catch-all)
  /^(.+?)\s*\(([^)]+)\)\s*$/,
  
  // Pattern 5: Square brackets [note]
  /^(.+?)\s*\[([^\]]+)\]\s*$/,
  
  // Pattern 6: Dash separated - note
  /^(.+?)\s*-\s*(informal|formal|note|Hinweis|used\s+with|wird\s+verwendet)/i,
];

/**
 * Check if extracted note is valid (not too short)
 * Note: Gender markers (m, f, n) are allowed as notes per user request
 */
function isValidNote(note: string): boolean {
  if (!note || note.length < 1) return false;
  
  // Skip very short notes that are likely not meaningful (but allow single char like "m", "f", "n")
  const trimmed = note.trim();
  if (trimmed.length < 1) return false;
  
  return true;
}

/**
 * Extract note from translation text using multiple patterns
 * Examples:
 * - "you (informal)" → { translation: "you", note: "informal" }
 * - "Hallo (informell)" → { translation: "Hallo", note: "informell" }
 * - "word (used with...)" → { translation: "word", note: "used with..." }
 * - "ti [informal]" → { translation: "ti", note: "informal" }
 */
function extractNote(translation: string): { translation: string; note: string | null; pattern?: string } {
  if (!translation || !translation.trim()) {
    return { translation: translation || "", note: null };
  }

  const trimmed = translation.trim();
  
  // Try each pattern in order
  for (const pattern of NOTE_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match && match[2]) {
      const cleanedTranslation = match[1].trim();
      const note = match[2].trim();
      
      // Validate note
      if (isValidNote(note)) {
        return { 
          translation: cleanedTranslation, 
          note,
          pattern: pattern.toString()
        };
      }
    }
  }

  return { translation: trimmed, note: null };
}

/**
 * Extract notes from all translation fields
 */
function extractNotesFromWord(word: any): {
  en?: string;
  de?: string;
  sr?: string;
  es?: string;
  fr?: string;
  enAlt?: string;
  deAlt?: string;
  updatedTranslations: {
    en?: string;
    de?: string;
    sr?: string;
    es?: string;
    fr?: string;
    enAlt?: string;
    deAlt?: string;
  };
} {
  const notes: Record<string, string> = {};
  const updatedTranslations: Record<string, string> = {};

  // Extract from column-based translations
  const fields = ["en", "de", "sr", "es", "fr", "enAlt", "deAlt"] as const;
  
  for (const field of fields) {
    if (word[field]) {
      const { translation, note } = extractNote(word[field]);
      if (note && isValidNote(note)) {
        // Map field to note field (e.g., "en" -> "noteEn", "enAlt" -> "noteEn")
        // For alternative translations, use the same note as the primary translation
        if (field === "enAlt") {
          // Only set if noteEn doesn't already exist
          if (!notes.noteEn) {
            notes.noteEn = note;
          }
        } else if (field === "deAlt") {
          // Only set if noteDe doesn't already exist
          if (!notes.noteDe) {
            notes.noteDe = note;
          }
        } else {
          const noteField = `note${field.charAt(0).toUpperCase() + field.slice(1)}`;
          // Only set if not already set
          if (!notes[noteField]) {
            notes[noteField] = note;
          }
        }
        
        if (CLEAN_TRANSLATIONS || PREVIEW_MODE) {
          updatedTranslations[field] = translation;
        }
      }
    }
  }

  // Also check translations array (deprecated but still used)
  if (word.translations && Array.isArray(word.translations)) {
    for (const trans of word.translations) {
      if (trans.translation) {
        const { translation, note } = extractNote(trans.translation);
        if (note && isValidNote(note)) {
          const lang = trans.language;
          const noteField = `note${lang.charAt(0).toUpperCase() + lang.slice(1)}`;
          if (!notes[noteField]) {
            notes[noteField] = note;
          }
          
          if (CLEAN_TRANSLATIONS || PREVIEW_MODE) {
            trans.translation = translation;
          }
        }
      }
    }
  }

  return { ...notes, updatedTranslations };
}

/**
 * Analyze vocabulary and extract notes
 */
function analyzeVocabulary(allVocab: any[]) {
  const analysis: Array<{
    serbian: string;
    unitNumber: number;
    original: Record<string, string>;
    extracted: Record<string, string>;
    cleaned: Record<string, string>;
  }> = [];

  for (const word of allVocab) {
    const { updatedTranslations, ...notes } = extractNotesFromWord(word);
    
    if (Object.keys(notes).length > 0 || Object.keys(updatedTranslations).length > 0) {
      const original: Record<string, string> = {};
      const extracted: Record<string, string> = {};
      const cleaned: Record<string, string> = {};

      // Collect original values
      if (word.en) original.en = word.en;
      if (word.de) original.de = word.de;
      if (word.sr) original.sr = word.sr;
      if (word.es) original.es = word.es;
      if (word.fr) original.fr = word.fr;
      if (word.enAlt) original.enAlt = word.enAlt;
      if (word.deAlt) original.deAlt = word.deAlt;

      // Collect extracted notes
      for (const [key, value] of Object.entries(notes)) {
        if (value) extracted[key] = value;
      }

      // Collect cleaned translations
      for (const [key, value] of Object.entries(updatedTranslations)) {
        if (value !== undefined) cleaned[key] = value;
      }

      analysis.push({
        serbian: word.serbian,
        unitNumber: word.unitNumber,
        original,
        extracted,
        cleaned,
      });
    }
  }

  return analysis;
}

async function migrateVocabularyNotes() {
  console.log("🔄 Starting vocabulary notes migration...");
  console.log(`📋 Mode: ${PREVIEW_MODE ? "PREVIEW (no changes)" : CLEAN_TRANSLATIONS ? "Extract + Clean" : "Extract only"}`);
  if (UNIT_FILTER) {
    console.log(`🔍 Filter: Unit ${UNIT_FILTER} only`);
  }
  console.log("");

  try {
    // Get all vocabulary
    console.log("📥 Fetching vocabulary entries...");
    let allVocab = await client.query(api.vocabulary.getAllCourseVocabulary);
    
    // Filter by unit if specified
    if (UNIT_FILTER) {
      allVocab = allVocab.filter((v: any) => v.unitNumber === UNIT_FILTER);
    }
    
    console.log(`✅ Found ${allVocab.length} vocabulary entries\n`);

    // Preview mode: analyze and show what would be changed
    if (PREVIEW_MODE) {
      console.log("📊 Analyzing vocabulary for note extraction...\n");
      const analysis = analyzeVocabulary(allVocab);
      
      if (analysis.length === 0) {
        console.log("ℹ️  No notes found to extract.\n");
        return;
      }

      console.log(`📝 Found ${analysis.length} words with extractable notes:\n`);
      
      // Group by unit
      const byUnit = new Map<number, typeof analysis>();
      for (const item of analysis) {
        if (!byUnit.has(item.unitNumber)) {
          byUnit.set(item.unitNumber, []);
        }
        byUnit.get(item.unitNumber)!.push(item);
      }

      // Display by unit
      for (const [unit, items] of Array.from(byUnit.entries()).sort((a, b) => a[0] - b[0])) {
        console.log(`\n📚 Unit ${unit} (${items.length} words):`);
        console.log("─".repeat(80));
        
        for (const item of items) {
          console.log(`\n  ${item.serbian}:`);
          
          // Show all extracted notes
          const noteEntries = Object.entries(item.extracted);
          if (noteEntries.length > 0) {
            console.log(`    📝 Notes to extract:`);
            for (const [noteField, noteValue] of noteEntries) {
              console.log(`      ${noteField}: "${noteValue}"`);
            }
          }
          
          // Show translation changes
          const cleanedEntries = Object.entries(item.cleaned);
          if (cleanedEntries.length > 0) {
            console.log(`    ✏️  Translation changes:`);
            for (const [lang, cleanedValue] of cleanedEntries) {
              const original = item.original[lang];
              if (original && original !== cleanedValue) {
                console.log(`      ${lang}: "${original}" → "${cleanedValue}"`);
              }
            }
          } else if (noteEntries.length > 0) {
            console.log(`    ℹ️  Translations unchanged (use --clean to remove notes from translations)`);
          }
        }
      }

      console.log("\n" + "=".repeat(80));
      console.log(`\n📊 Summary:`);
      console.log(`  📝 Words with notes: ${analysis.length}`);
      console.log(`  📚 Units affected: ${byUnit.size}`);
      console.log(`\n💡 Run without --preview to apply changes`);
      if (CLEAN_TRANSLATIONS) {
        console.log(`  ⚠️  --clean flag is set: translations will be cleaned`);
      }
      console.log("");
      return;
    }

    // Actual migration mode
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    const changes: Array<{ serbian: string; notes: Record<string, string> }> = [];

    for (const word of allVocab) {
      try {
        const { updatedTranslations, ...notes } = extractNotesFromWord(word);
        
        // Check if we have any notes to add
        const hasNotes = Object.keys(notes).length > 0;
        const hasUpdatedTranslations = Object.keys(updatedTranslations).length > 0;

        if (!hasNotes && !hasUpdatedTranslations) {
          skipped++;
          continue;
        }

        // Prepare update data
        const updateData: Record<string, unknown> = {};
        
        // Add notes
        for (const [key, value] of Object.entries(notes)) {
          if (value) {
            updateData[key] = value;
          }
        }

        // Update translations if cleaning
        if (CLEAN_TRANSLATIONS && hasUpdatedTranslations) {
          for (const [key, value] of Object.entries(updatedTranslations)) {
            if (value !== undefined) {
              updateData[key] = value;
            }
          }
        }

        // Track changes
        if (Object.keys(notes).length > 0) {
          changes.push({ serbian: word.serbian, notes });
        }

        // Update the word
        await client.mutation(api.vocabulary.updateCourseVocabularyColumns, {
          courseVocabularyId: word._id,
          en: word.en || "",
          de: word.de || "",
          sr: word.sr,
          es: word.es,
          fr: word.fr,
          enAlt: word.enAlt,
          deAlt: word.deAlt,
          ...updateData,
        });

        updated++;
        
        if (updated % 10 === 0) {
          console.log(`  ✅ Updated ${updated} entries...`);
        }
      } catch (error) {
        errors++;
        console.error(`  ❌ Error updating word ${word.serbian} (${word._id}):`, error);
      }
    }

    console.log("");
    console.log("📊 Migration Summary:");
    console.log(`  ✅ Updated: ${updated}`);
    console.log(`  ⏭️  Skipped: ${skipped}`);
    console.log(`  ❌ Errors: ${errors}`);
    
    if (changes.length > 0) {
      console.log("\n📝 Sample of extracted notes:");
      for (const change of changes.slice(0, 5)) {
        console.log(`  ${change.serbian}:`, Object.entries(change.notes).map(([k, v]) => `${k}="${v}"`).join(", "));
      }
      if (changes.length > 5) {
        console.log(`  ... and ${changes.length - 5} more`);
      }
    }
    
    console.log("");
    console.log("✨ Migration completed!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

// Run migration
migrateVocabularyNotes().catch((error) => {
  console.error("❌ Unexpected error:", error);
  process.exit(1);
});








