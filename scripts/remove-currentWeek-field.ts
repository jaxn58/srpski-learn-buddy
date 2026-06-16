/**
 * Migration Script: Remove currentWeek field from userProgress
 *
 * Removes the deprecated `currentWeek` field from all userProgress documents.
 *
 * SECURITY NOTE: The underlying Convex functions are now `internal*` and can no
 * longer be invoked over the network. This wrapper runs the batch migration via
 * the Convex CLI (`npx convex run`), which authenticates through your local
 * Convex deploy credentials instead of an open public endpoint.
 *
 * Usage:
 *   - Against the configured (dev) deployment:  pnpm tsx scripts/remove-currentWeek-field.ts
 *   - Against production:                        pnpm tsx scripts/remove-currentWeek-field.ts --prod
 */

import { execSync } from "node:child_process";

const targetProd = process.argv.includes("--prod");

function runMigration() {
  console.log("============================================================");
  console.log("Migration: Remove currentWeek from userProgress");
  console.log("============================================================");
  console.log("");
  console.log(`Target deployment: ${targetProd ? "PRODUCTION" : "configured (dev)"}`);
  console.log("");

  const prodFlag = targetProd ? " --prod" : "";
  const command = `npx convex run internal.admin.removeCurrentWeekFromAllProgress${prodFlag}`;

  try {
    console.log(`Running: ${command}`);
    console.log("");
    const output = execSync(command, { encoding: "utf-8", stdio: "pipe" });
    console.log(output);
    console.log("Migration completed successfully.");
  } catch (error) {
    console.error("Migration failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

runMigration();
