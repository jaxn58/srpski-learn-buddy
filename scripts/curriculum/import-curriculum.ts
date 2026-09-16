/**
 * Import the curriculum plan (docs/curriculum/UNIT_MAP.md and
 * docs/curriculum/CAN_DO_INVENTORY.md) into the Convex tables
 * curriculumUnits / curriculumCanDo.
 *
 * Idempotent: existing rows are updated by unitNumber / canDoId, rows that
 * disappeared from the docs are deactivated (never deleted).
 *
 * Usage:
 *   # Dry-run against DEV (parses, validates, shows counts, writes nothing)
 *   pnpm import:curriculum -- --dry-run
 *
 *   # Apply to DEV
 *   pnpm import:curriculum
 *
 *   # PRODUCTION: only after explicit approval (see AGENTS.md)
 *   VITE_CONVEX_URL=https://fleet-labrador-324.convex.cloud pnpm import:curriculum -- --dry-run
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { ConvexHttpClient } from "convex/browser";
import * as dotenv from "dotenv";
import { api } from "../../convex/_generated/api";
import {
  assignCanDosToUnits,
  checkCurriculumConsistency,
  parseCanDoInventory,
  parseUnitMap,
} from "./parseCurriculumDocs";

dotenv.config({ path: ".env.local" });

const CONVEX_URL = process.env.VITE_CONVEX_URL;
const ADMIN_SECRET = process.env.ADMIN_SECRET;
const dryRun = process.argv.includes("--dry-run");

if (!CONVEX_URL) {
  console.error("ERROR: VITE_CONVEX_URL not set in .env.local or environment");
  process.exit(1);
}
if (!ADMIN_SECRET) {
  console.error("ERROR: ADMIN_SECRET not set in .env.local or environment");
  process.exit(1);
}

const docsDir = path.join(process.cwd(), "docs", "curriculum");
const unitMapPath = path.join(docsDir, "UNIT_MAP.md");
const canDoPath = path.join(docsDir, "CAN_DO_INVENTORY.md");

async function run() {
  const target = CONVEX_URL!.includes("fleet-labrador") ? "PRODUCTION" : "DEV";
  console.log(`\n[import-curriculum]`);
  console.log(`  Target : ${target} (${CONVEX_URL})`);
  console.log(`  Mode   : ${dryRun ? "DRY-RUN (no writes)" : "LIVE"}`);

  const unitMapMd = fs.readFileSync(unitMapPath, "utf8");
  const canDoMd = fs.readFileSync(canDoPath, "utf8");
  const canDos = parseCanDoInventory(canDoMd);
  const units = assignCanDosToUnits(parseUnitMap(unitMapMd), canDos);
  const report = checkCurriculumConsistency(units, canDos);

  console.log(`  Parsed : ${units.length} units, ${canDos.length} Can-Do statements`);
  const byModule = new Map<number, number>();
  for (const u of units) byModule.set(u.moduleNumber, (byModule.get(u.moduleNumber) ?? 0) + 1);
  console.log(`  Modules: ${Array.from(byModule.entries()).map(([m, n]) => `M${m}=${n}`).join(", ")}`);

  if (report.duplicateUnitNumbers.length) {
    console.error(`  ERROR: duplicate unit numbers: ${report.duplicateUnitNumbers.join(", ")}`);
    process.exit(1);
  }
  if (report.canDosWithUnknownUnit.length) {
    console.error(`  ERROR: Can-Do statements point to unknown units:`);
    for (const c of report.canDosWithUnknownUnit) console.error(`    ${c.canDoId} -> U${c.units.join(", U")}`);
    process.exit(1);
  }
  if (report.unitsWithoutCanDo.length) {
    console.warn(`  WARN : standard units without Can-Do statements: U${report.unitsWithoutCanDo.join(", U")}`);
  }

  if (target === "PRODUCTION" && !dryRun) {
    console.log("  Writing to PRODUCTION. Press Ctrl+C within 5 seconds to abort.");
    await new Promise((r) => setTimeout(r, 5000));
  }

  const client = new ConvexHttpClient(CONVEX_URL!);
  const source = `UNIT_MAP.md+CAN_DO_INVENTORY.md@${new Date().toISOString().slice(0, 10)}`;
  const result = await client.mutation(api.curriculum.adminImportCurriculum, {
    adminSecret: ADMIN_SECRET!,
    source,
    units: units.map((u) => ({
      unitNumber: u.unitNumber,
      moduleNumber: u.moduleNumber,
      unitType: u.unitType,
      cefrLevel: u.cefrLevel,
      strand: u.strand,
      setting: u.setting,
      titleEn: u.titleEn,
      situationEn: u.situationEn,
      primaryGrammarEn: u.primaryGrammarEn,
      recycleEn: u.recycleEn,
      chunksEn: u.chunksEn,
      canDoIds: u.canDoIds,
    })),
    canDos: canDos.map((c) => ({
      canDoId: c.canDoId,
      cefrLevel: c.cefrLevel,
      strand: c.strand,
      statementEn: c.statementEn,
      targetUnits: c.targetUnits,
      targetNote: c.targetNote,
    })),
    dryRun,
  });

  console.log(`  Result : ${JSON.stringify(result)}`);
  console.log("");
}

run().catch((e) => {
  console.error("Import failed:", e?.message || e);
  process.exit(1);
});
