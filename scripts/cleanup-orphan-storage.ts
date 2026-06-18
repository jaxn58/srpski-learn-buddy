/**
 * One-time / maintenance: delete orphaned Convex storage blobs.
 *
 * Compares `_storage` system table against references in app tables.
 *
 * Usage (Dev):
 *   pnpm cleanup:orphan-storage -- --dry-run
 *   pnpm cleanup:orphan-storage
 *
 * Production (requires explicit approval):
 *   pnpm cleanup:orphan-storage -- --production
 */

import { execSync } from "node:child_process";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const dryRun = process.argv.includes("--dry-run");
const useProduction = process.argv.includes("--production");

if (useProduction) {
  console.warn("WARNING: Running against PRODUCTION. Ensure you have explicit approval.");
}

const prodFlag = useProduction ? " --prod" : "";

async function main() {
  console.log("========================================");
  console.log("Orphan storage cleanup");
  console.log("========================================");
  console.log(`Mode: ${dryRun ? "DRY RUN (no deletes)" : "DELETE orphans"}\n`);

  let cursor: string | null = null;
  let pageNum = 0;
  let totalScanned = 0;
  let totalOrphaned = 0;
  let totalDeleted = 0;
  let totalFreed = 0;

  for (;;) {
    pageNum += 1;
    const args = JSON.stringify({
      dryRun,
      paginationOpts: { numItems: 100, cursor },
    });

    const output = execSync(
      `npx convex run${prodFlag} internal.storageAdmin.vacuumOrphanStorage '${args.replace(/'/g, "'\\''")}'`,
      { encoding: "utf8", stdio: ["pipe", "pipe", "inherit"] }
    ).trim();

    const result = JSON.parse(output) as {
      scanned: number;
      orphaned: number;
      deleted: number;
      freedBytes: number;
      isDone: boolean;
      continueCursor: string | null;
    };

    totalScanned += result.scanned;
    totalOrphaned += result.orphaned;
    totalDeleted += result.deleted;
    totalFreed += result.freedBytes;

    console.log(
      `Page ${pageNum}: scanned=${result.scanned} orphaned=${result.orphaned} ` +
        `deleted=${result.deleted} freed=${(result.freedBytes / (1024 * 1024)).toFixed(2)} MB`
    );

    if (result.isDone || !result.continueCursor) break;
    cursor = result.continueCursor;
  }

  console.log("\nDone.");
  console.log(`Total scanned: ${totalScanned}`);
  console.log(`Total orphaned: ${totalOrphaned}`);
  console.log(`Total deleted: ${totalDeleted}`);
  console.log(`Total freed: ${(totalFreed / (1024 * 1024)).toFixed(2)} MB`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
