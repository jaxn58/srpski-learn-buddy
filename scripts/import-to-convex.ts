/**
 * Import CSV data into Convex
 * Run with: npx tsx scripts/import-to-convex.ts
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import * as fs from "fs";
import * as path from "path";

// CSV data folder
const CSV_FOLDER = "D:\\Nextcloud\\Business Monte\\AI Dev\\SRPSKI TUTOR\\Manus\\All";

// Get Convex URL from environment or use default
const CONVEX_URL = process.env.VITE_CONVEX_URL || "https://reminiscent-panda-57.convex.cloud";

const client = new ConvexHttpClient(CONVEX_URL);

// Simple CSV parser (handles quoted fields with commas)
function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split('\n');
  if (lines.length < 2) return [];
  
  const headers = parseCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];
  
  let currentRow = '';
  for (let i = 1; i < lines.length; i++) {
    currentRow += lines[i];
    
    // Count quotes to check if row is complete
    const quoteCount = (currentRow.match(/"/g) || []).length;
    if (quoteCount % 2 === 0) {
      if (currentRow.trim()) {
        const values = parseCSVLine(currentRow);
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => {
          row[h] = values[idx] || '';
        });
        rows.push(row);
      }
      currentRow = '';
    } else {
      currentRow += '\n';
    }
  }
  
  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

async function importUnitExplanations() {
  console.log("📚 Importing Unit Explanations...");
  
  const csvPath = path.join(CSV_FOLDER, "unitExplanations_20251201_100729.csv");
  const content = fs.readFileSync(csvPath, 'utf-8');
  const rows = parseCSV(content);
  
  console.log(`   Found ${rows.length} unit explanations`);
  
  let imported = 0;
  let skipped = 0;
  
  for (const row of rows) {
    try {
      const unitNumber = parseInt(row.unitNumber, 10);
      if (isNaN(unitNumber)) {
        console.log(`   ⚠️ Skipping invalid unit number: ${row.unitNumber}`);
        skipped++;
        continue;
      }
      
      // Use the upsertExplanation mutation (requires admin auth)
      // For now, we'll use a direct insert approach via a seed mutation
      await client.mutation(api.units.seedExplanation, {
        unitNumber,
        overview: row.overview || '',
        grammarExplained: row.grammarExplained || '',
        practiceExamples: row.practiceExamples || '',
        bookReference: row.bookReference || undefined,
      });
      
      imported++;
      console.log(`   ✅ Unit ${unitNumber} imported`);
    } catch (error: any) {
      console.log(`   ❌ Error importing unit ${row.unitNumber}: ${error.message}`);
      skipped++;
    }
  }
  
  console.log(`   ✅ Imported: ${imported}, Skipped: ${skipped}`);
}

async function main() {
  console.log("🚀 Starting Convex Data Import");
  console.log(`   Convex URL: ${CONVEX_URL}`);
  console.log(`   CSV Folder: ${CSV_FOLDER}`);
  console.log("");
  
  try {
    await importUnitExplanations();
    console.log("\n✅ Import complete!");
  } catch (error: any) {
    console.error("\n❌ Import failed:", error.message);
    process.exit(1);
  }
}

main();

