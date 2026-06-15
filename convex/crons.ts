import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/**
 * Täglich um 3:00 UTC (4:00 MEZ / 5:00 MESZ)
 * Erstellt automatisches Backup der gesamten Production-Datenbank
 * 
 * Retention: 30 Tage
 * Storage: Convex Storage (File Storage)
 */
crons.daily(
  "daily-production-backup",
  { hourUTC: 3, minuteUTC: 0 },
  internal.backup.createDatabaseBackup
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

export default crons;
