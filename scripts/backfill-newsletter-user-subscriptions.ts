/**
 * Backfill: sync all registered users (with email) to newsletterContacts with autoSubscribe.
 * Respects prior unsubscribe (unsubscribedAt) inside syncUserToNewsletter.
 *
 * Uses Convex HTTP client — no JSON quoting issues on Windows PowerShell.
 *
 * Usage:
 *   # Dry-run DEV (from .env.local VITE_CONVEX_URL)
 *   pnpm exec tsx scripts/backfill-newsletter-user-subscriptions.ts --dry-run
 *
 *   # Live DEV
 *   pnpm exec tsx scripts/backfill-newsletter-user-subscriptions.ts
 *
 *   # Production (set URL explicitly; live run waits 5s before writing)
 *   VITE_CONVEX_URL=https://fleet-labrador-324.convex.cloud pnpm exec tsx scripts/backfill-newsletter-user-subscriptions.ts --dry-run
 *   VITE_CONVEX_URL=https://fleet-labrador-324.convex.cloud pnpm exec tsx scripts/backfill-newsletter-user-subscriptions.ts
 *
 * Requires ADMIN_SECRET and VITE_CONVEX_URL in .env.local (or environment).
 *
 * If you see "Server Error" against production: (1) deploy latest Convex functions to prod,
 * (2) set ADMIN_SECRET in Convex Dashboard for that deployment (Prod vs Dev), matching .env.local.
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const CONVEX_URL = process.env.VITE_CONVEX_URL;
const ADMIN_SECRET = process.env.ADMIN_SECRET;

if (!CONVEX_URL) {
  console.error("ERROR: VITE_CONVEX_URL not set in .env.local or environment");
  process.exit(1);
}

if (!ADMIN_SECRET) {
  console.error("ERROR: ADMIN_SECRET not set in .env.local or environment");
  process.exit(1);
}

const dryRun = process.argv.includes("--dry-run");
const client = new ConvexHttpClient(CONVEX_URL);

async function run() {
  const target = CONVEX_URL!.includes("fleet-labrador") ? "PRODUCTION" : "DEV";
  console.log("\n[backfill-newsletter-user-subscriptions]");
  console.log(`  Target : ${target} (${CONVEX_URL})`);
  console.log(`  Mode   : ${dryRun ? "DRY-RUN (no writes)" : "LIVE"}`);
  console.log("");

  if (target === "PRODUCTION" && !dryRun) {
    console.log(
      "  Writing to PRODUCTION. Press Ctrl+C within 5 seconds to abort."
    );
    await new Promise((r) => setTimeout(r, 5000));
  }

  const result = await client.action(
    api.newsletter.adminBackfillRegisteredUsersNewsletter,
    {
      adminSecret: ADMIN_SECRET!,
      dryRun,
    }
  );

  console.log("\nResult:");
  console.log(`  success        : ${result.success}`);
  console.log(`  totalUsers     : ${result.totalUsers}`);
  console.log(`  withEmail      : ${result.withEmail}`);
  console.log(`  mutationCalls  : ${result.mutationCalls}`);
  if (result.preview) {
    const p = result.preview;
    console.log("\n  Preview (dry-run only):");
    console.log(`    wouldCreateContact      : ${p.wouldCreateContact}`);
    console.log(`    wouldSubscribe          : ${p.wouldSubscribe}`);
    console.log(`    wouldBackfillConsent    : ${p.wouldBackfillConsent}`);
    console.log(`    skippedNoEmail          : ${p.skippedNoEmail}`);
    console.log(`    skippedPriorUnsubscribe : ${p.skippedPriorUnsubscribe}`);
    console.log(`    noOpAlreadyComplete     : ${p.noOpAlreadyComplete}`);
  }
  console.log(`\n  Done.`);
}

function logError(err: unknown) {
  console.error("\nFATAL:", err instanceof Error ? err.message : String(err));
  if (err && typeof err === "object") {
    const o = err as Record<string, unknown>;
    for (const key of ["data", "cause", "response"]) {
      if (o[key] !== undefined) {
        console.error(`  ${key}:`, o[key]);
      }
    }
    try {
      console.error("  (full)", JSON.stringify(err, Object.getOwnPropertyNames(err as object), 2));
    } catch {
      // ignore
    }
  }
}

run().catch((err) => {
  logError(err);
  process.exit(1);
});
