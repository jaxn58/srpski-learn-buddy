/**
 * Backfill preferredLocale for existing newsletterContacts
 *
 * Finds all contacts whose linked user has a learningLanguage and sets
 * preferredLocale accordingly (de → "de", everything else → "en").
 *
 * The script is idempotent: contacts already carrying the correct value
 * are left untouched.
 *
 * Usage:
 *   # Dry-run against DEV (shows what would change, writes nothing)
 *   tsx scripts/backfill-newsletter-locale.ts --dry-run
 *
 *   # Apply to DEV
 *   tsx scripts/backfill-newsletter-locale.ts
 *
 *   # Apply to PRODUCTION
 *   VITE_CONVEX_URL=https://fleet-labrador-324.convex.cloud tsx scripts/backfill-newsletter-locale.ts
 *
 *   # Dry-run against PRODUCTION
 *   VITE_CONVEX_URL=https://fleet-labrador-324.convex.cloud tsx scripts/backfill-newsletter-locale.ts --dry-run
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
  console.log(`\n[backfill-newsletter-locale]`);
  console.log(`  Target : ${target} (${CONVEX_URL})`);
  console.log(`  Mode   : ${dryRun ? "DRY-RUN (no writes)" : "LIVE"}`);
  console.log("");

  if (target === "PRODUCTION" && !dryRun) {
    console.log(
      "  Writing to PRODUCTION. Press Ctrl+C within 5 seconds to abort."
    );
    await new Promise((r) => setTimeout(r, 5000));
  }

  const result = await client.action(api.newsletter.adminBackfillNewsletterLocales, {
    adminSecret: ADMIN_SECRET!,
    dryRun,
  });

  console.log("\nResult:");
  console.log(`  Total contacts  : ${result.total}`);
  console.log(`  Updated         : ${result.updated}${dryRun ? " (would be updated)" : ""}`);
  console.log(`  Already correct : ${result.skipped}`);
  console.log(`  No linked user  : ${result.noUser}`);
  console.log(`\n  ${result.success ? "Done." : "FAILED."}`);
}

run().catch((err) => {
  console.error("\nFATAL:", err.message ?? err);
  process.exit(1);
});
