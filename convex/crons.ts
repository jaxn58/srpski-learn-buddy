import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/**
 * Täglich um 3:00 UTC (4:00 MEZ / 5:00 MESZ)
 * Exportiert alle Dokument-Tabellen aus dem Schema nach Convex Storage.
 * Dateien in Convex Storage (Uploads, Audio) sind hier nicht enthalten.
 * Dafür im Convex-Dashboard ein tägliches Backup mit File Storage einschalten
 * (Dev und Production getrennt). Retention dieses Exports: 30 Tage.
 */
crons.daily(
  "daily-production-backup",
  { hourUTC: 3, minuteUTC: 0 },
  internal.backup.createDatabaseBackup
);

/**
 * Marks document backups as failed when a step has not reported progress
 * for 15 minutes. A killed action would otherwise stay in progress.
 */
crons.hourly(
  "hourly-backup-stale-check",
  { minuteUTC: 25 },
  internal.backup.failStaleBackups
);

// Safety-net: cancels fixed-term installment subscriptions in Dodo after the term is fully paid.
// Runs hourly to ensure we cancel well before the next billing date.
crons.hourly("hourly-dodo-installment-cancellations", { minuteUTC: 10 }, internal.subscriptions.processDodoInstallmentCancellations);

/**
 * AI Energy: monthly quota reset.
 *
 * Runs hourly and resets any subscription whose `energyPeriodResetAt` has
 * passed. We process small batches so a single run never gets too large; if
 * there is more work the next run picks it up. Idempotent per subscription
 * (no-op when `energyPeriodResetAt` is in the future).
 */
crons.hourly(
  "hourly-energy-monthly-reset",
  { minuteUTC: 5 },
  internal.energyAdmin.processMonthlyEnergyResets
);

/**
 * Content Studio: weekly cleanup of archived preview rows.
 *
 * Deletes rows in `courseVocabulary`, `unitContent`, and
 * `unitInteractiveTests` that meet ALL of:
 *   - isActive === false
 *   - releaseStatus !== "published"
 *   - archivedAt is older than 30 days
 *
 * Published rows are NEVER touched. Retention window and batch behaviour
 * are configured in `convex/contentStudio/_cleanup.ts`. Sunday 03:00 UTC
 * is chosen because it is a low-traffic slot for learners.
 *
 * Motivation: the publish-preview pipeline archives rows by patching
 * `isActive: false`. Over time these accumulate and push the publish
 * mutation over the Convex system-op ceiling. See
 * `docs/CONTENT_STUDIO_PUBLISH_TIMEOUT_FIX.md`.
 */
crons.weekly(
  "weekly-content-studio-archived-cleanup",
  { dayOfWeek: "sunday", hourUTC: 3, minuteUTC: 0 },
  internal.contentStudio._cleanup.internalCleanupArchivedContent,
);

export default crons;
