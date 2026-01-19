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

// Cancels installment subscriptions in Paddle after the fixed term has been fully paid.
// Runs hourly to ensure we cancel well before the next billing date.
crons.hourly("hourly-installment-cancellations", { minuteUTC: 5 }, internal.subscriptions.processInstallmentCancellations);

export default crons;
