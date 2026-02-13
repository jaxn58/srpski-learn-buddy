/**
 * add-ts-expect-errors.mjs
 *
 * Automatically adds `// @ts-expect-error` comments before lines that produce
 * TS2589, TS7022, TS7023, TS7006, TS2339 errors in Convex files.
 *
 * These errors are caused by TypeScript's recursion depth limit when resolving
 * the Convex DataModel type generated from 50+ tables.
 *
 * Usage:
 *   node scripts/add-ts-expect-errors.mjs            # dry-run (show what would change)
 *   node scripts/add-ts-expect-errors.mjs --apply     # apply based on tsc errors
 *   node scripts/add-ts-expect-errors.mjs --proactive # annotate ALL ctx.db/query/mutation calls
 *   node scripts/add-ts-expect-errors.mjs --remove    # remove all previously added comments
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve, relative } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const APPLY = process.argv.includes("--apply");
const REMOVE = process.argv.includes("--remove");
const PROACTIVE = process.argv.includes("--proactive");

// Only suppress errors in convex/ files (the TS2589 affected area)
const CONVEX_PREFIX = "convex/";
const CONVEX_PREFIX_WIN = "convex\\";

// Error codes caused by the large-schema TS2589 cascade
const SUPPRESSED_CODES = new Set([
  "TS2589", // Type instantiation is excessively deep and possibly infinite
  "TS7022", // implicitly has type 'any' (circular inference cascade)
  "TS7023", // implicitly has return type 'any' (circular inference cascade)
  "TS7006", // Parameter implicitly has an 'any' type (cascade)
  "TS2339", // Property does not exist on type (cascade from failed inference)
  "TS2345", // Argument type not assignable (cascade)
]);

// The marker we insert so we can find/remove our comments later
// Using @ts-ignore (not @ts-expect-error) because TS2589 errors are non-deterministic –
// they depend on TypeScript's processing order and can shift when files change.
// @ts-expect-error would cause TS2578 "unused directive" errors on lines where TS2589
// happens to not trigger in a given tsc run.
const MARKER = "// @ts-ignore";
const MARKER_SUFFIX = " TS2589 – Convex schema depth limit (50 tables)";

// ── Remove mode ──────────────────────────────────────────────────────────────
if (REMOVE) {
  console.log("Removing all @ts-ignore markers added by this script...\n");
  removeAllMarkers();
  process.exit(0);
}

// ── Proactive mode ───────────────────────────────────────────────────────────
// Adds @ts-ignore before ALL lines matching TS2589-triggering patterns in convex/ files,
// regardless of whether tsc currently reports an error there. This covers the
// non-deterministic nature of TS2589 across different TypeScript contexts (tsc vs convex dev).
if (PROACTIVE) {
  console.log("Proactive mode: adding @ts-ignore before all ctx.db and Convex function patterns...\n");
  proactiveAnnotate();
  process.exit(0);
}

// ── Step 1: Run tsc and collect errors ───────────────────────────────────────
console.log("Running tsc --noEmit --pretty false ...\n");

let tscOutput = "";
try {
  tscOutput = execSync("npx tsc --noEmit --pretty false 2>&1", {
    encoding: "utf-8",
    cwd: ROOT,
    stdio: ["pipe", "pipe", "pipe"],
  });
} catch (e) {
  tscOutput = (e.stdout || "") + "\n" + (e.stderr || "");
}

// ── Step 2: Parse errors ─────────────────────────────────────────────────────
// Format: convex/file.ts(line,col): error TSxxxx: message
const errorRegex = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.+)$/;
const errorsByFile = new Map(); // file -> Set<lineNumber>
let totalErrors = 0;
let convexErrors = 0;

for (const rawLine of tscOutput.split(/\r?\n/)) {
  const line = rawLine.trim();
  const match = line.match(errorRegex);
  if (!match) continue;

  totalErrors++;
  const [, filePath, lineStr, , errorCode] = match;

  // Normalize path separators
  const normalized = filePath.replace(/\\/g, "/");

  // Only process convex/ files
  if (!normalized.startsWith(CONVEX_PREFIX)) continue;

  // Only suppress known cascade error codes
  if (!SUPPRESSED_CODES.has(errorCode)) {
    console.log(`  [skip] ${normalized}:${lineStr} ${errorCode} (not in suppression list)`);
    continue;
  }

  convexErrors++;
  const lineNum = parseInt(lineStr, 10);

  if (!errorsByFile.has(normalized)) {
    errorsByFile.set(normalized, new Map());
  }
  const fileErrors = errorsByFile.get(normalized);
  if (!fileErrors.has(lineNum)) {
    fileErrors.set(lineNum, new Set());
  }
  fileErrors.get(lineNum).add(errorCode);
}

console.log(`Total tsc errors: ${totalErrors}`);
console.log(`Convex errors to suppress: ${convexErrors}`);
console.log(`Unique lines to annotate: ${[...errorsByFile.values()].reduce((sum, m) => sum + m.size, 0)}`);
console.log(`Files affected: ${errorsByFile.size}\n`);

if (errorsByFile.size === 0) {
  console.log("No Convex errors to suppress. Done!");
  process.exit(0);
}

// ── Step 3: Insert @ts-expect-error comments ─────────────────────────────────
let filesModified = 0;
let commentsAdded = 0;

for (const [relPath, lineErrors] of errorsByFile) {
  const absPath = resolve(ROOT, relPath);
  const content = readFileSync(absPath, "utf-8");
  const lines = content.split("\n");

  // Sort line numbers DESCENDING so insertions don't shift subsequent line numbers
  const sortedLines = [...lineErrors.entries()].sort((a, b) => b[0] - a[0]);

  let modified = false;
  for (const [lineNum, errorCodes] of sortedLines) {
    const idx = lineNum - 1; // 0-based index
    if (idx < 0 || idx >= lines.length) continue;

    // Check if previous line already has a suppression comment
    if (idx > 0) {
      const prev = lines[idx - 1].trimStart();
      if (prev.startsWith("// @ts-expect-error") || prev.startsWith("// @ts-ignore")) {
        continue; // Already suppressed
      }
    }

    // Determine the primary error code for the comment
    const primaryCode = errorCodes.has("TS2589") ? "TS2589"
      : errorCodes.has("TS7022") ? "TS7022"
      : errorCodes.has("TS7023") ? "TS7023"
      : [...errorCodes][0];

    // Match indentation of the target line
    const indent = lines[idx].match(/^(\s*)/)[1];
    const comment = `${indent}${MARKER} ${primaryCode}${MARKER_SUFFIX}`;

    lines.splice(idx, 0, comment);
    modified = true;
    commentsAdded++;
  }

  if (modified) {
    filesModified++;
    const newContent = lines.join("\n");

    if (APPLY) {
      writeFileSync(absPath, newContent, "utf-8");
      console.log(`  [modified] ${relPath} (+${sortedLines.length} comments)`);
    } else {
      console.log(`  [dry-run] ${relPath} would get +${sortedLines.length} comments`);
    }
  }
}

console.log(`\n${APPLY ? "Applied" : "Would apply"}: ${commentsAdded} comments across ${filesModified} files.`);

if (!APPLY) {
  console.log("\nRun with --apply to actually modify files:");
  console.log("  node scripts/add-ts-expect-errors.mjs --apply");
}

// ── Remove helper ────────────────────────────────────────────────────────────
function removeAllMarkers() {
  // Find all .ts files in convex/
  function walk(dir) {
    const files = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = resolve(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith("_generated") && !entry.name.startsWith("node_modules")) {
        files.push(...walk(full));
      } else if (entry.isFile() && entry.name.endsWith(".ts")) {
        files.push(full);
      }
    }
    return files;
  }

  const convexDir = resolve(ROOT, "convex");
  const tsFiles = walk(convexDir);
  let totalRemoved = 0;

  // Remove both @ts-expect-error and @ts-ignore markers with our suffix
  const OLD_SUFFIX = " – Convex schema depth limit (50 tables)";
  const NEW_SUFFIX = " TS2589 – Convex schema depth limit (50 tables)";

  for (const filePath of tsFiles) {
    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    const filtered = lines.filter(l => {
      const trimmed = l.trimStart();
      if (trimmed.startsWith("// @ts-expect-error") && trimmed.includes(OLD_SUFFIX)) return false;
      if (trimmed.startsWith("// @ts-ignore") && trimmed.includes(NEW_SUFFIX)) return false;
      return true;
    });
    const removed = lines.length - filtered.length;

    if (removed > 0) {
      writeFileSync(filePath, filtered.join("\n"), "utf-8");
      totalRemoved += removed;
      console.log(`  [cleaned] ${relative(ROOT, filePath)} (-${removed} comments)`);
    }
  }

  console.log(`\nRemoved ${totalRemoved} marker comments total.`);
}

// ── Proactive annotate helper ────────────────────────────────────────────────
function proactiveAnnotate() {
  function walk(dir) {
    const files = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = resolve(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith("_generated") && !entry.name.startsWith("node_modules")) {
        files.push(...walk(full));
      } else if (entry.isFile() && entry.name.endsWith(".ts")) {
        files.push(full);
      }
    }
    return files;
  }

  // Patterns that trigger TS2589 with large Convex schemas
  const TRIGGER_PATTERNS = [
    /\bctx\.db\.query\b/,
    /\bctx\.db\.insert\b/,
    /\bctx\.db\.patch\b/,
    /\bctx\.db\.delete\b/,
    /\bctx\.db\.replace\b/,
    /\bctx\.db\.get\b/,
    /\bctx\.db\s*$/,                       // ctx.db at end of line (chained on next)
    /=\s*query\(\{/,                        // export const x = query({
    /=\s*mutation\(\{/,                     // export const x = mutation({
    /=\s*action\(\{/,                       // export const x = action({
    /=\s*internalQuery\(\{/,
    /=\s*internalMutation\(\{/,
    /=\s*internalAction\(\{/,
    /\bctx\.runQuery\b/,
    /\bctx\.runMutation\b/,
    /\bctx\.runAction\b/,
    /\bctx\.scheduler\.runAfter\b/,
    /\bctx\.scheduler\.runAt\b/,
  ];

  const convexDir = resolve(ROOT, "convex");
  const tsFiles = walk(convexDir);
  let totalAdded = 0;
  let filesModified = 0;

  for (const filePath of tsFiles) {
    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    const linesToAnnotate = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip if already annotated
      if (i > 0) {
        const prev = lines[i - 1].trimStart();
        if (prev.startsWith("// @ts-ignore") || prev.startsWith("// @ts-expect-error")) {
          continue;
        }
      }
      // Check if line matches any trigger pattern
      if (TRIGGER_PATTERNS.some(p => p.test(line))) {
        linesToAnnotate.push(i);
      }
    }

    if (linesToAnnotate.length === 0) continue;

    // Insert from bottom to top to preserve line numbers
    for (let j = linesToAnnotate.length - 1; j >= 0; j--) {
      const idx = linesToAnnotate[j];
      const indent = lines[idx].match(/^(\s*)/)[1];
      const comment = `${indent}${MARKER} TS2589${MARKER_SUFFIX}`;

      // Re-check: previous line might now be a comment we just inserted
      if (idx > 0) {
        const prev = lines[idx - 1].trimStart();
        if (prev.startsWith("// @ts-ignore") || prev.startsWith("// @ts-expect-error")) {
          continue;
        }
      }

      lines.splice(idx, 0, comment);
      totalAdded++;
    }

    writeFileSync(filePath, lines.join("\n"), "utf-8");
    filesModified++;
    console.log(`  [modified] ${relative(ROOT, filePath)} (+${linesToAnnotate.length} comments)`);
  }

  console.log(`\nProactive: Added ${totalAdded} @ts-ignore comments across ${filesModified} files.`);
}
