/**
 * Sync dashboard announcements (banners) from Development Convex to Production.
 *
 * After loading Dev data, you **interactively choose** which entries to sync (by list number).
 * Only those keys are copied to Production (create or overwrite EN/DE, isActive, audience).
 *
 * Prerequisites (Convex Dashboard -> Settings -> Environment Variables):
 *   - ADMIN_SECRET must be set on BOTH Dev and Production (can be the same value or different).
 *
 * Local .env.local:
 *   - VITE_CONVEX_URL (or VITE_CONVEX_URL_DEV) -> Dev deployment URL
 *   - VITE_CONVEX_URL_PRODUCTION (or VITE_CONVEX_URL_PROD) -> Prod URL (default: fleet-labrador-324)
 *   - ADMIN_SECRET -> Production ADMIN_SECRET (used for writes to Prod)
 *   - ADMIN_SECRET_DEV -> Dev ADMIN_SECRET if it differs from ADMIN_SECRET; otherwise omit and ADMIN_SECRET is used for Dev reads too
 *
 * Usage:
 *   pnpm sync:dashboard-announcements
 *   pnpm sync:dashboard-announcements --dry-run
 *   pnpm sync:dashboard-announcements --yes   (skips final "type yes" after selection; selection stays interactive)
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import * as dotenv from "dotenv";
import * as readline from "readline";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const skipConfirm = args.includes("--yes");

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRootFromScript = path.resolve(scriptsDir, "..");
const cwd = process.cwd();
const candidates = [cwd, path.resolve(cwd, ".."), repoRootFromScript].filter(Boolean);

function loadEnvFrom(root: string) {
  const envLocal = path.join(root, ".env.local");
  const env = path.join(root, ".env");
  if (fs.existsSync(envLocal)) dotenv.config({ path: envLocal });
  if (fs.existsSync(env)) dotenv.config({ path: env });
}

for (const root of candidates) {
  loadEnvFrom(root);
}

const DEV_URL =
  process.env.VITE_CONVEX_URL_DEV ||
  process.env.CONVEX_URL_DEV ||
  process.env.VITE_CONVEX_URL ||
  process.env.CONVEX_URL ||
  (process.env.CONVEX_DEPLOYMENT
    ? `https://${process.env.CONVEX_DEPLOYMENT}.convex.cloud`
    : undefined);

const DEFAULT_PROD_URL = "https://fleet-labrador-324.convex.cloud";
const PROD_URL =
  process.env.VITE_CONVEX_URL_PROD ||
  process.env.CONVEX_URL_PROD ||
  process.env.VITE_CONVEX_URL_PRODUCTION ||
  process.env.CONVEX_URL_PRODUCTION ||
  DEFAULT_PROD_URL;

const adminSecretProd = process.env.ADMIN_SECRET;
const adminSecretDev = process.env.ADMIN_SECRET_DEV || process.env.ADMIN_SECRET;

function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) =>
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer);
    }),
  );
}

/** Best-effort: Convex client errors sometimes hide details in `data` or non-Error throws. */
function formatConvexCallError(e: unknown): string {
  const parts: string[] = [];
  if (e instanceof Error) {
    parts.push(e.message);
    const ext = e as Error & { data?: unknown };
    if (ext.data !== undefined) {
      try {
        parts.push(`detail: ${JSON.stringify(ext.data)}`);
      } catch {
        parts.push(`detail: ${String(ext.data)}`);
      }
    }
  } else {
    parts.push(typeof e === "object" && e !== null ? JSON.stringify(e) : String(e));
  }
  return parts.filter(Boolean).join("\n");
}

function printProductionFailureHints(fullText: string): void {
  console.error("");
  if (/unauthorized|invalid admin secret/i.test(fullText)) {
    console.error(
      "ADMIN_SECRET in .env.local must match the ADMIN_SECRET in the Production deployment:",
    );
    console.error(
      "  Convex Dashboard -> project -> Production (fleet-labrador-324) -> Settings -> Environment Variables",
    );
    return;
  }
  console.error('If you only see "Server Error", typical causes are:');
  console.error(
    "  1) dashboardAnnouncements admin functions not deployed to Production yet (run convex deploy for prod).",
  );
  console.error(
    "  2) ADMIN_SECRET is missing or wrong in Production Convex env (not only in .env.local).",
  );
  console.error("  3) Open Convex Dashboard -> Logs and search the Request ID from the error line above.");
}

function truncate(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

type ParsedSelection =
  | { kind: "all" }
  | { kind: "indices"; indices0: number[] }
  | { kind: "quit" }
  | { kind: "invalid" };

function parseSelectionInput(raw: string, listLength: number): ParsedSelection {
  const trimmed = raw.trim().toLowerCase();
  if (trimmed === "q" || trimmed === "quit") return { kind: "quit" };
  if (trimmed === "all" || trimmed === "a") return { kind: "all" };

  const parts = trimmed.split(/[\s,]+/).filter(Boolean);
  if (parts.length === 0) return { kind: "invalid" };

  const set = new Set<number>();
  for (const p of parts) {
    const n = parseInt(p, 10);
    if (Number.isNaN(n) || n < 1 || n > listLength) return { kind: "invalid" };
    set.add(n - 1);
  }
  return { kind: "indices", indices0: [...set].sort((a, b) => a - b) };
}

async function promptSelectRows(devRows: AnnouncementRow[]): Promise<AnnouncementRow[] | null> {
  console.log("Announcements on Development (from Dev database):");
  console.log("-".repeat(60));
  devRows.forEach((row, i) => {
    const active = row.isActive ? "active" : "inactive";
    const title = truncate(row.titleEn, 52);
    console.log(
      `  [${i + 1}] ${row.key}  |  ${active}  |  ${row.audience}\n      ${title}`,
    );
  });
  console.log("-".repeat(60));
  console.log("Enter numbers to sync (comma or space separated), e.g. 1,3");
  console.log("Or: all  — sync every listed entry    |    q  — quit without changes");
  console.log("");

  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const raw = await askQuestion(`Your selection (attempt ${attempt}/${maxAttempts}): `);
    const parsed = parseSelectionInput(raw, devRows.length);
    if (parsed.kind === "quit") {
      console.log("Aborted.");
      return null;
    }
    if (parsed.kind === "invalid") {
      console.log(
        `Invalid input. Use numbers 1–${devRows.length}, comma/space separated, or "all" / "q".\n`,
      );
      continue;
    }
    if (parsed.kind === "all") {
      return [...devRows];
    }
    return parsed.indices0.map((i) => devRows[i]);
  }
  console.error("Too many invalid attempts.");
  return null;
}

type AnnouncementRow = {
  key: string;
  titleEn: string;
  introEn: string;
  bodyEn: string;
  titleDe?: string;
  introDe?: string;
  bodyDe?: string;
  isActive: boolean;
  audience: "all_authenticated" | "beta_testers_only";
};

function payloadEqual(a: AnnouncementRow, b: AnnouncementRow): boolean {
  return (
    a.key === b.key &&
    a.titleEn === b.titleEn &&
    a.introEn === b.introEn &&
    a.bodyEn === b.bodyEn &&
    (a.titleDe ?? "") === (b.titleDe ?? "") &&
    (a.introDe ?? "") === (b.introDe ?? "") &&
    (a.bodyDe ?? "") === (b.bodyDe ?? "") &&
    a.isActive === b.isActive &&
    a.audience === b.audience
  );
}

function rowToPayload(doc: AnnouncementRow): AnnouncementRow {
  return {
    key: doc.key,
    titleEn: doc.titleEn,
    introEn: doc.introEn,
    bodyEn: doc.bodyEn,
    titleDe: doc.titleDe,
    introDe: doc.introDe,
    bodyDe: doc.bodyDe,
    isActive: doc.isActive,
    audience: doc.audience,
  };
}

async function main() {
  if (!DEV_URL) {
    console.error("Development Convex URL missing. Set VITE_CONVEX_URL (or VITE_CONVEX_URL_DEV) in .env.local.");
    process.exit(1);
  }
  if (!PROD_URL) {
    console.error("Production Convex URL missing. Set VITE_CONVEX_URL_PRODUCTION in .env.local.");
    process.exit(1);
  }
  if (!adminSecretProd) {
    console.error("ADMIN_SECRET missing in .env.local (Production secret for writes).");
    process.exit(1);
  }
  if (!adminSecretDev) {
    console.error(
      "No secret for Dev reads: set ADMIN_SECRET_DEV or ADMIN_SECRET (must match Dev deployment ADMIN_SECRET).",
    );
    process.exit(1);
  }

  const devClient = new ConvexHttpClient(DEV_URL);
  const prodClient = new ConvexHttpClient(PROD_URL);

  console.log("Dashboard announcements: Dev -> Production sync");
  console.log("=".repeat(60));
  console.log(`Development: ${DEV_URL}`);
  console.log(`Production:  ${PROD_URL}`);
  if (isDryRun) console.log("Mode: DRY RUN (no writes)");
  console.log("");

  let devRows: AnnouncementRow[];
  try {
    devRows = await devClient.query(api.dashboardAnnouncements.adminGetAllDashboardAnnouncements, {
      adminSecret: adminSecretDev,
    });
  } catch (e: unknown) {
    console.error("Failed to list announcements on Development:");
    console.error(formatConvexCallError(e));
    console.error("Check ADMIN_SECRET_DEV / ADMIN_SECRET matches Dev Convex ADMIN_SECRET.");
    process.exit(1);
  }

  if (devRows.length === 0) {
    console.log("No dashboard announcements on Development. Nothing to select.");
    process.exit(0);
  }

  const selectedRows = await promptSelectRows(devRows);
  if (selectedRows === null) {
    process.exit(0);
  }

  let prodRows: AnnouncementRow[];
  try {
    console.log("Fetching current announcements from Production for comparison…");
    prodRows = await prodClient.query(api.dashboardAnnouncements.adminGetAllDashboardAnnouncements, {
      adminSecret: adminSecretProd,
    });
  } catch (e: unknown) {
    console.error("Failed to list announcements on Production:");
    console.error(formatConvexCallError(e));
    printProductionFailureHints(formatConvexCallError(e));
    process.exit(1);
  }

  const prodByKey = new Map(prodRows.map((r) => [r.key, r]));

  const toCreate: AnnouncementRow[] = [];
  const toUpdate: AnnouncementRow[] = [];
  const unchanged: string[] = [];

  for (const doc of selectedRows) {
    const payload = rowToPayload(doc);
    const existing = prodByKey.get(payload.key);
    if (!existing) {
      toCreate.push(payload);
    } else if (!payloadEqual(payload, rowToPayload(existing))) {
      toUpdate.push(payload);
    } else {
      unchanged.push(payload.key);
    }
  }

  console.log("");
  console.log("Selection summary");
  console.log("=".repeat(60));
  console.log(`Selected: ${selectedRows.length} (of ${devRows.length} on Dev)`);
  console.log(`Prod rows (before): ${prodRows.length}`);
  console.log(`Would create on Prod: ${toCreate.length}`);
  console.log(`Would update on Prod: ${toUpdate.length}`);
  console.log(`Already identical on Prod (no write): ${unchanged.length}`);
  if (toCreate.length) console.log("  create keys:", toCreate.map((r) => r.key).join(", "));
  if (toUpdate.length) console.log("  update keys:", toUpdate.map((r) => r.key).join(", "));
  if (unchanged.length) console.log("  unchanged keys:", unchanged.join(", "));
  console.log("");

  if (toCreate.length === 0 && toUpdate.length === 0) {
    console.log("Nothing to write: all selected keys already match Production.");
    process.exit(0);
  }

  if (isDryRun) {
    console.log("Dry run: no writes performed.");
    process.exit(0);
  }

  if (!skipConfirm) {
    const answer = (await askQuestion('Type "yes" to write to Production: ')).trim().toLowerCase();
    if (answer !== "yes") {
      console.log("Aborted.");
      process.exit(0);
    }
  }

  let created = 0;
  let updated = 0;
  let failed = 0;

  const runUpsert = async (payload: AnnouncementRow) => {
    try {
      const result = await prodClient.mutation(
        api.dashboardAnnouncements.adminUpsertDashboardAnnouncement,
        {
          adminSecret: adminSecretProd,
          key: payload.key,
          titleEn: payload.titleEn,
          introEn: payload.introEn,
          bodyEn: payload.bodyEn,
          titleDe: payload.titleDe,
          introDe: payload.introDe,
          bodyDe: payload.bodyDe,
          isActive: payload.isActive,
          audience: payload.audience,
        },
      );
      if (result.created) created++;
      else if (result.updated) updated++;
    } catch (e: unknown) {
      failed++;
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`  [ERROR] ${payload.key}: ${msg}`);
    }
  };

  for (const p of toCreate) await runUpsert(p);
  for (const p of toUpdate) await runUpsert(p);

  console.log("");
  console.log(`Done. Created: ${created}, Updated: ${updated}, Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
