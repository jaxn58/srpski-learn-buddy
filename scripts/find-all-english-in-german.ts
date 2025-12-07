/**
 * Script to find all remaining English text in German translation fields
 * Run with: npx tsx scripts/find-all-english-in-german.ts > translation-analysis.txt
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const CONVEX_URL = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL;

if (!CONVEX_URL) {
  console.error("❌ CONVEX_URL not found");
  process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);

// Common English words and phrases to detect
const ENGLISH_PATTERNS = [
  // Common words
  /\b(the|is|are|was|were|to|from|at|in|on|of|for|with|by|as|an|a)\b/gi,
  // Common phrases
  /Meeting Someone/gi,
  /Fill in the Blanks/gi,
  /Translate to Serbian/gi,
  /Gender Recognition/gi,
  /At the Airport/gi,
  /At the Information Desk/gi,
  // Grammar terms
  /Masculine|Feminine|Neuter/gi,
  /consonant/gi,
  /words change their endings/gi,
  /This is called "cases"/gi,
  // Exercise instructions
  /Complete the sentences/gi,
  /Choose the correct/gi,
  /Match the following/gi,
  // Dialog titles
  /Dialog \d+:/gi,
  // Common sentences
  /I am from/gi,
  /Are you a/gi,
  /What is your/gi,
  // Table headers
  /\| English \|/gi,
  /\| Translation \|/gi,
  /\| Person \|/gi,
  /\| Example \|/gi,
  /\| Meaning \|/gi,
  // Parentheses content
  /\(airport\)/gi,
  /\(student\)/gi,
  /\(ticket\)/gi,
  /\(name\)/gi,
  /\(sea\)/gi,
  /\(Serbia\)/gi,
  /\(from Serbia\)/gi,
  // Other common phrases
  /Don't worry about/gi,
  /we'll introduce them/gi,
];

// Extended list of English words (common vocabulary)
const ENGLISH_WORDS = new Set([
  'the', 'is', 'are', 'was', 'were', 'to', 'from', 'at', 'in', 'on', 'of', 'for', 'with', 'by', 'as', 'an', 'a',
  'meeting', 'someone', 'airport', 'information', 'desk', 'fill', 'blanks', 'translate', 'serbian', 'gender',
  'recognition', 'complete', 'sentences', 'choose', 'correct', 'match', 'following', 'dialog', 'consonant',
  'masculine', 'feminine', 'neuter', 'words', 'change', 'endings', 'called', 'cases', 'worry', 'introduce',
  'student', 'ticket', 'name', 'sea', 'serbia', 'germany', 'tourist', 'example', 'meaning', 'translation',
  'english', 'person', 'table', 'header', 'row', 'column'
]);

interface EnglishFinding {
  unitNumber: number;
  field: 'overview' | 'grammar' | 'practice';
  text: string;
  context: string;
  lineNumber?: number;
}

function findEnglishInText(text: string, fieldName: string, unitNumber: number): EnglishFinding[] {
  if (!text) return [];
  
  const findings: EnglishFinding[] = [];
  const lines = text.split('\n');
  
  // Check each line
  lines.forEach((line, index) => {
    // Skip markdown headers and code blocks
    if (line.trim().startsWith('#') || line.trim().startsWith('```')) {
      return;
    }
    
    // Check for English patterns
    for (const pattern of ENGLISH_PATTERNS) {
      const matches = line.match(pattern);
      if (matches) {
        // Get context (30 chars before and after)
        const start = Math.max(0, line.indexOf(matches[0]) - 30);
        const end = Math.min(line.length, line.indexOf(matches[0]) + matches[0].length + 30);
        const context = line.substring(start, end);
        
        findings.push({
          unitNumber,
          field: fieldName as 'overview' | 'grammar' | 'practice',
          text: matches[0],
          context: context.trim(),
          lineNumber: index + 1
        });
      }
    }
    
    // Check for individual English words (be careful not to match German words)
    const words = line.split(/\s+/);
    words.forEach(word => {
      const cleanWord = word.toLowerCase().replace(/[.,!?;:()\[\]{}"]/g, '');
      if (ENGLISH_WORDS.has(cleanWord) && cleanWord.length > 2) {
        // Check if it's not part of a German word
        const isStandalone = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(line);
        if (isStandalone) {
          findings.push({
            unitNumber,
            field: fieldName as 'overview' | 'grammar' | 'practice',
            text: word,
            context: line.trim(),
            lineNumber: index + 1
          });
        }
      }
    });
  });
  
  return findings;
}

async function analyzeAllUnits() {
  console.log("🔍 Analyzing all units for English text in German translations...\n");
  
  try {
    // Get all unit explanations
    const allUnits = await client.query(api.units.getAllExplanations);
    
    if (!allUnits || allUnits.length === 0) {
      console.log("❌ No units found");
      return;
    }
    
    console.log(`📊 Found ${allUnits.length} units to analyze\n`);
    
    const allFindings: Map<number, EnglishFinding[]> = new Map();
    
    // Analyze each unit
    for (const unit of allUnits) {
      const unitNumber = unit.unitNumber;
      const findings: EnglishFinding[] = [];
      
      // Check overviewGerman
      if (unit.overviewGerman) {
        const overviewFindings = findEnglishInText(unit.overviewGerman, 'overview', unitNumber);
        findings.push(...overviewFindings);
      }
      
      // Check grammarExplainedGerman
      if (unit.grammarExplainedGerman) {
        const grammarFindings = findEnglishInText(unit.grammarExplainedGerman, 'grammar', unitNumber);
        findings.push(...grammarFindings);
      }
      
      // Check practiceExamplesGerman
      if (unit.practiceExamplesGerman) {
        const practiceFindings = findEnglishInText(unit.practiceExamplesGerman, 'practice', unitNumber);
        findings.push(...practiceFindings);
      }
      
      if (findings.length > 0) {
        allFindings.set(unitNumber, findings);
      }
    }
    
    // Generate report
    console.log("=".repeat(80));
    console.log("ANALYSIS REPORT: English Text in German Translations");
    console.log("=".repeat(80));
    console.log();
    
    if (allFindings.size === 0) {
      console.log("✅ No English text found in German translations!");
      return;
    }
    
    // Sort by unit number
    const sortedUnits = Array.from(allFindings.keys()).sort((a, b) => a - b);
    
    for (const unitNumber of sortedUnits) {
      const findings = allFindings.get(unitNumber)!;
      
      console.log(`\n${"=".repeat(80)}`);
      console.log(`Unit ${unitNumber}: ${findings.length} English findings`);
      console.log("=".repeat(80));
      
      // Group by field
      const byField = {
        overview: findings.filter(f => f.field === 'overview'),
        grammar: findings.filter(f => f.field === 'grammar'),
        practice: findings.filter(f => f.field === 'practice')
      };
      
      if (byField.overview.length > 0) {
        console.log(`\n📄 Overview (${byField.overview.length} findings):`);
        byField.overview.forEach(f => {
          console.log(`  Line ${f.lineNumber || '?'}: "${f.text}"`);
          console.log(`    Context: ...${f.context}...`);
        });
      }
      
      if (byField.grammar.length > 0) {
        console.log(`\n📚 Grammar (${byField.grammar.length} findings):`);
        byField.grammar.forEach(f => {
          console.log(`  Line ${f.lineNumber || '?'}: "${f.text}"`);
          console.log(`    Context: ...${f.context}...`);
        });
      }
      
      if (byField.practice.length > 0) {
        console.log(`\n✏️ Practice (${byField.practice.length} findings):`);
        byField.practice.forEach(f => {
          console.log(`  Line ${f.lineNumber || '?'}: "${f.text}"`);
          console.log(`    Context: ...${f.context}...`);
        });
      }
    }
    
    // Summary
    console.log("\n" + "=".repeat(80));
    console.log("SUMMARY");
    console.log("=".repeat(80));
    console.log(`Total units with English text: ${allFindings.size}`);
    console.log(`Total findings: ${Array.from(allFindings.values()).reduce((sum, f) => sum + f.length, 0)}`);
    
    const byFieldSummary = {
      overview: 0,
      grammar: 0,
      practice: 0
    };
    
    for (const findings of allFindings.values()) {
      findings.forEach(f => {
        byFieldSummary[f.field]++;
      });
    }
    
    console.log(`\nBy field:`);
    console.log(`  Overview: ${byFieldSummary.overview}`);
    console.log(`  Grammar: ${byFieldSummary.grammar}`);
    console.log(`  Practice: ${byFieldSummary.practice}`);
    
  } catch (error: any) {
    console.error("❌ Error analyzing units:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run analysis
analyzeAllUnits().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
