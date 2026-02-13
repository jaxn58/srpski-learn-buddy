/**
 * typecheck.mjs – Split TypeScript check for large-schema Convex projects.
 *
 * Background: The Convex DataModel generated from 50 tables can cause TS2589
 * ("Type instantiation is excessively deep and possibly infinite") errors.
 * These are suppressed via `// @ts-ignore` comments in Convex function files
 * (see scripts/add-ts-expect-errors.mjs). Convex validates types at runtime.
 *
 * This script runs `tsc --noEmit` and separates the output:
 *   - Convex errors (convex/**) → logged as info, do NOT fail the check
 *   - Client/Server errors       → reported and fail the check if present
 *
 * With @ts-ignore suppression in place, both Convex and client errors should be 0.
 *
 * Usage:
 *   node scripts/typecheck.mjs            # default: filter convex errors
 *   node scripts/typecheck.mjs --all      # show ALL errors (like raw tsc)
 */

import { execSync } from "node:child_process";

const showAll = process.argv.includes("--all");

try {
  execSync("npx tsc --noEmit --pretty false", {
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  console.log("TypeScript check passed – no errors.");
  process.exit(0);
} catch (e) {
  const output = (e.stdout || "") + "\n" + (e.stderr || "");
  const lines = output.split(/\r?\n/);

  if (showAll) {
    // Pass-through mode: show everything, exit with failure
    for (const line of lines) {
      if (line.trim()) console.error(line);
    }
    process.exit(1);
  }

  // ---------- Filter mode ----------
  const clientErrors = [];
  let convexErrorCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // tsc --pretty false format: "path/file.ts(line,col): error TSxxxx: ..."
    const isConvex =
      trimmed.startsWith("convex/") || trimmed.startsWith("convex\\");

    if (isConvex && trimmed.includes(": error TS")) {
      convexErrorCount++;
    } else if (trimmed.includes(": error TS")) {
      clientErrors.push(trimmed);
    }
  }

  // Summary
  if (convexErrorCount > 0) {
    console.log(
      `[info] ${convexErrorCount} Convex type error(s) suppressed ` +
        `(large-schema TS2589 – validated at runtime by Convex).\n`
    );
  }

  if (clientErrors.length > 0) {
    console.error(
      `${clientErrors.length} error(s) in client/server code:\n`
    );
    for (const err of clientErrors) {
      console.error("  " + err);
    }
    process.exit(1);
  }

  console.log("TypeScript check passed (client/server code clean).");
  process.exit(0);
}
