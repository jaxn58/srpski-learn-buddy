/**
 * Test Script for Markdown Parser
 * Tests the parser with real Unit 7 Markdown file
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { parseMarkdownToUnitPackage } from "./markdownParser/parser";
import { autofixUnitPackage } from "./unitPackage/autofix";
import { validateUnitPackageDeep } from "./unitPackage/schema";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testMarkdownParser() {
  console.log("=== Testing Markdown Parser ===\n");

  // Read Unit 7 Markdown file
  const mdPath = path.join(__dirname, "../New Content/jsons/Unit-7-Going-Out-with-Friends-v1.md");
  
  if (!fs.existsSync(mdPath)) {
    console.error(`Error: Markdown file not found at ${mdPath}`);
    process.exit(1);
  }

  const markdown = fs.readFileSync(mdPath, "utf-8");
  console.log(`✓ Loaded Markdown file: ${path.basename(mdPath)}`);
  console.log(`  File size: ${(markdown.length / 1024).toFixed(2)} KB\n`);

  // Parse Markdown to JSON
  console.log("Step 1: Parsing Markdown to JSON...");
  let unitPackage;
  try {
    unitPackage = parseMarkdownToUnitPackage(markdown);
    console.log(`✓ Successfully parsed to JSON`);
    console.log(`  Unit Number: ${unitPackage.unitNumber}`);
    console.log(`  Title: ${unitPackage.title}`);
    console.log(`  Module: ${unitPackage.module.moduleNumber} - ${unitPackage.module.title}`);
    console.log(`  Vocabulary entries: ${unitPackage.vocabulary.en?.length || 0}`);
    console.log(`  Exercise categories: ${unitPackage.exercises.en?.length || 0}\n`);
  } catch (error: any) {
    console.error(`✗ Parse Error: ${error.message}`);
    process.exit(1);
  }

  // Apply auto-fixes
  console.log("Step 2: Applying auto-fixes...");
  const { fixed, changes } = autofixUnitPackage(unitPackage);
  console.log(`✓ Auto-fixes applied: ${changes.length}`);
  if (changes.length > 0) {
    console.log("\n  Changes made:");
    changes.slice(0, 10).forEach(change => {
      console.log(`    - ${change.kind} at ${change.path}: ${change.note || "—"}`);
    });
    if (changes.length > 10) {
      console.log(`    ... and ${changes.length - 10} more`);
    }
  }
  console.log();

  // Validate
  console.log("Step 3: Validating JSON...");
  const issues = validateUnitPackageDeep(fixed);
  const errors = issues.filter(i => i.level === "error");
  const warnings = issues.filter(i => i.level === "warning");

  console.log(`✓ Validation complete`);
  console.log(`  Errors: ${errors.length}`);
  console.log(`  Warnings: ${warnings.length}\n`);

  if (errors.length > 0) {
    console.log("❌ VALIDATION FAILED\n");
    console.log("Errors found:");
    errors.slice(0, 20).forEach((err, idx) => {
      console.log(`  ${idx + 1}. ${err.path}: ${err.message}`);
    });
    if (errors.length > 20) {
      console.log(`  ... and ${errors.length - 20} more errors`);
    }
    console.log();
  } else {
    console.log("✅ VALIDATION PASSED - Unit can be imported!\n");
  }

  // Write output files
  const outputDir = path.join(__dirname, "../New Content/jsons/_test-output");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const parsedJsonPath = path.join(outputDir, "unit-7-parsed.json");
  const fixedJsonPath = path.join(outputDir, "unit-7-fixed.json");
  const reportPath = path.join(outputDir, "unit-7-validation-report.json");

  fs.writeFileSync(parsedJsonPath, JSON.stringify(unitPackage, null, 2), "utf-8");
  fs.writeFileSync(fixedJsonPath, JSON.stringify(fixed, null, 2), "utf-8");
  fs.writeFileSync(reportPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    fileName: path.basename(mdPath),
    unitNumber: fixed.unitNumber,
    title: fixed.title,
    changesCount: changes.length,
    changes: changes,
    errorsCount: errors.length,
    errors: errors,
    warningsCount: warnings.length,
    warnings: warnings,
    valid: errors.length === 0
  }, null, 2), "utf-8");

  console.log("Output files written:");
  console.log(`  - Parsed JSON: ${parsedJsonPath}`);
  console.log(`  - Fixed JSON: ${fixedJsonPath}`);
  console.log(`  - Validation Report: ${reportPath}\n`);

  console.log("=== Test Complete ===");
  process.exit(errors.length > 0 ? 1 : 0);
}

testMarkdownParser().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});
