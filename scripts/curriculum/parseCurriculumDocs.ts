/**
 * Parsers for docs/curriculum/UNIT_MAP.md and docs/curriculum/CAN_DO_INVENTORY.md.
 *
 * Pure functions (no I/O) so they can be unit-tested; the runner
 * scripts/curriculum/import-curriculum.ts feeds the result into
 * api.curriculum.adminImportCurriculum.
 */

export type CefrLevel = "A1.1" | "A1.2" | "A2.1" | "A2.2" | "B1";
export type UnitType = "standard" | "review" | "checkpoint" | "exam";
export type Strand = "ARR" | "SET" | "DAY" | "SOC" | "BIZ" | "DIG" | "GEN";
export type Setting = "serbia" | "montenegro_coast" | "mixed";

export interface ParsedCurriculumUnit {
  unitNumber: number;
  moduleNumber: number;
  unitType: UnitType;
  cefrLevel: CefrLevel;
  strand?: Strand;
  setting: Setting;
  titleEn: string;
  situationEn: string;
  primaryGrammarEn: string;
  recycleEn?: string;
  chunksEn?: string;
  canDoIds: string[];
}

export interface ParsedCanDo {
  canDoId: string;
  cefrLevel: CefrLevel;
  strand: Strand;
  statementEn: string;
  targetUnits: number[];
  targetNote?: string;
}

const STRANDS: Strand[] = ["ARR", "SET", "DAY", "SOC", "BIZ", "DIG", "GEN"];
const UNIT_TYPES: UnitType[] = ["standard", "review", "checkpoint", "exam"];
const LEVELS: CefrLevel[] = ["A1.1", "A1.2", "A2.1", "A2.2", "B1"];

/**
 * Units whose scenes are set on the Montenegrin coast (euros) or mix both
 * countries. Everything else defaults to Serbia (dinars). Kept explicit rather
 * than inferred from prose so a wording change in the map cannot silently
 * flip a unit's currency.
 */
export const SETTING_OVERRIDES: Record<number, Setting> = {
  27: "montenegro_coast",
  33: "mixed",
  46: "montenegro_coast",
  51: "mixed",
  68: "mixed",
};

/** Exam units carry a coarse level in the map; map it to the last sub-level. */
const EXAM_LEVEL: Record<string, CefrLevel> = { A1: "A1.2", A2: "A2.2", B1: "B1" };

function splitRow(line: string): string[] {
  // "| a | b |" -> ["a", "b"]; keeps empty cells; strips outer pipes.
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((c) => c.trim());
}

function isSeparatorRow(cells: string[]): boolean {
  return cells.every((c) => /^:?-{3,}:?$/.test(c) || c === "");
}

function dashToUndefined(value: string): string | undefined {
  const v = value.trim();
  if (!v || v === "–" || v === "-" || v === "—") return undefined;
  return v;
}

function stripCode(value: string): string {
  return value.replace(/`/g, "").trim();
}

export function parseUnitMap(markdown: string): ParsedCurriculumUnit[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const units: ParsedCurriculumUnit[] = [];
  let moduleNumber = 0;
  let moduleLevel: CefrLevel | null = null;
  let inTable = false;
  let header: string[] = [];

  for (const raw of lines) {
    const line = raw.trimEnd();
    const moduleMatch = line.match(/^## Module (\d+)\s+[–-]\s+.*\((A1\.1|A1\.2|A2\.1|A2\.2|B1),?\s*U\d{3}[–-]U\d{3}\)/);
    if (moduleMatch) {
      moduleNumber = Number(moduleMatch[1]);
      moduleLevel = moduleMatch[2] as CefrLevel;
      inTable = false;
      continue;
    }
    const examModuleMatch = line.match(/^## Module (\d+)\s+[–-]\s+Test Module/);
    if (examModuleMatch) {
      moduleNumber = Number(examModuleMatch[1]);
      moduleLevel = null;
      inTable = false;
      continue;
    }
    if (line.startsWith("## ") && !line.startsWith("## Module")) {
      // Any other section (module descriptions, appendices): stop parsing units.
      moduleNumber = 0;
      inTable = false;
      continue;
    }
    if (!moduleNumber) continue;

    if (line.startsWith("|")) {
      const cells = splitRow(line);
      if (!inTable) {
        header = cells;
        inTable = true;
        continue;
      }
      if (isSeparatorRow(cells)) continue;
      const unitCell = cells[0] ?? "";
      const unitMatch = unitCell.match(/^U(\d{3})$/);
      if (!unitMatch) continue;
      const unitNumber = Number(unitMatch[1]);

      if (header[0] === "Unit" && header[1] === "Type" && header[2] === "Level") {
        // Exam table: | Unit | Type | Level | Working title | Content |
        const type = cells[1] as UnitType;
        const level = EXAM_LEVEL[cells[2]] ?? "B1";
        units.push({
          unitNumber,
          moduleNumber,
          unitType: UNIT_TYPES.includes(type) ? type : "exam",
          cefrLevel: level,
          strand: undefined,
          setting: SETTING_OVERRIDES[unitNumber] ?? "serbia",
          titleEn: stripCode(cells[3] ?? ""),
          situationEn: stripCode(cells[4] ?? ""),
          primaryGrammarEn: "none (exam simulation; recap of the level)",
          recycleEn: undefined,
          chunksEn: undefined,
          canDoIds: [],
        });
        continue;
      }

      // Standard table: | Unit | Type | Strand | Working title | Situation | Primary grammar | Recycle | Chunks allowed |
      if (!moduleLevel) continue;
      const typeRaw = cells[1] ?? "standard";
      const unitType = (UNIT_TYPES.includes(typeRaw as UnitType) ? typeRaw : "standard") as UnitType;
      const strandRaw = dashToUndefined(cells[2] ?? "");
      const strand = strandRaw && STRANDS.includes(strandRaw as Strand) ? (strandRaw as Strand) : undefined;
      units.push({
        unitNumber,
        moduleNumber,
        unitType,
        cefrLevel: moduleLevel,
        strand,
        setting: SETTING_OVERRIDES[unitNumber] ?? "serbia",
        titleEn: stripCode(cells[3] ?? ""),
        situationEn: stripCode(cells[4] ?? ""),
        primaryGrammarEn: stripCode(cells[5] ?? ""),
        recycleEn: dashToUndefined(stripCode(cells[6] ?? "")),
        chunksEn: dashToUndefined(stripCode(cells[7] ?? "")),
        canDoIds: [],
      });
    } else if (inTable && line.trim() === "") {
      inTable = false;
    }
  }

  return units.sort((a, b) => a.unitNumber - b.unitNumber);
}

export function parseCanDoInventory(markdown: string): ParsedCanDo[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const out: ParsedCanDo[] = [];
  for (const raw of lines) {
    if (!raw.startsWith("|")) continue;
    const cells = splitRow(raw);
    if (cells.length < 4) continue;
    const id = cells[0];
    const idMatch = id.match(/^(A1\.1|A1\.2|A2\.1|A2\.2|B1)-(ARR|SET|DAY|SOC|BIZ|DIG|GEN)-\d{2}$/);
    if (!idMatch) continue;
    const cefrLevel = idMatch[1] as CefrLevel;
    const strand = idMatch[2] as Strand;
    const statementEn = stripCode(cells[1]);
    const targetCell = cells[3] ?? "";
    const targetUnits = Array.from(targetCell.matchAll(/U(\d{3})/g)).map((m) => Number(m[1]));
    // Ranges like "U053–U056" are written out explicitly in the inventory; expand "Uaaa–Ubbb" defensively.
    for (const m of targetCell.matchAll(/U(\d{3})[–-]U(\d{3})/g)) {
      const from = Number(m[1]);
      const to = Number(m[2]);
      for (let n = from; n <= to; n++) targetUnits.push(n);
    }
    const unique = Array.from(new Set(targetUnits)).sort((a, b) => a - b);
    out.push({
      canDoId: id,
      cefrLevel: LEVELS.includes(cefrLevel) ? cefrLevel : "A1.1",
      strand,
      statementEn,
      targetUnits: unique,
      targetNote: dashToUndefined(targetCell),
    });
  }
  return out;
}

/** Attach Can-Do ids to the units that introduce or recycle them. */
export function assignCanDosToUnits(units: ParsedCurriculumUnit[], canDos: ParsedCanDo[]): ParsedCurriculumUnit[] {
  const byUnit = new Map<number, string[]>();
  for (const c of canDos) {
    for (const u of c.targetUnits) {
      const list = byUnit.get(u) ?? [];
      list.push(c.canDoId);
      byUnit.set(u, list);
    }
  }
  return units.map((u) => ({ ...u, canDoIds: byUnit.get(u.unitNumber) ?? [] }));
}

export interface CurriculumConsistencyReport {
  unitsWithoutCanDo: number[];
  canDosWithUnknownUnit: Array<{ canDoId: string; units: number[] }>;
  duplicateUnitNumbers: number[];
}

export function checkCurriculumConsistency(units: ParsedCurriculumUnit[], canDos: ParsedCanDo[]): CurriculumConsistencyReport {
  const unitNumbers = new Set(units.map((u) => u.unitNumber));
  const seen = new Set<number>();
  const duplicateUnitNumbers: number[] = [];
  for (const u of units) {
    if (seen.has(u.unitNumber)) duplicateUnitNumbers.push(u.unitNumber);
    seen.add(u.unitNumber);
  }
  const unitsWithoutCanDo = units
    .filter((u) => u.unitType === "standard" && u.canDoIds.length === 0)
    .map((u) => u.unitNumber);
  const canDosWithUnknownUnit = canDos
    .map((c) => ({ canDoId: c.canDoId, units: c.targetUnits.filter((n) => !unitNumbers.has(n)) }))
    .filter((c) => c.units.length > 0);
  return { unitsWithoutCanDo, canDosWithUnknownUnit, duplicateUnitNumbers };
}
