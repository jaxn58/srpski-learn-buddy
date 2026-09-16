import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  assignCanDosToUnits,
  checkCurriculumConsistency,
  parseCanDoInventory,
  parseUnitMap,
  SETTING_OVERRIDES,
} from "./parseCurriculumDocs";

/**
 * Locks the contract between the curriculum markdown documents and the
 * database import: 75 units in six modules, every standard unit has Can-Do
 * statements, every Can-Do target exists, and the setting overrides match the
 * unit map (dinars vs euros).
 */

const docsDir = path.join(import.meta.dirname, "..", "..", "docs", "curriculum");
const unitMapMd = readFileSync(path.join(docsDir, "UNIT_MAP.md"), "utf8");
const canDoMd = readFileSync(path.join(docsDir, "CAN_DO_INVENTORY.md"), "utf8");

describe("parseUnitMap", () => {
  const units = parseUnitMap(unitMapMd);

  it("finds 75 units numbered 1..75 across six modules", () => {
    expect(units).toHaveLength(75);
    expect(units.map((u) => u.unitNumber)).toEqual(Array.from({ length: 75 }, (_, i) => i + 1));
    const perModule = new Map<number, number>();
    for (const u of units) perModule.set(u.moduleNumber, (perModule.get(u.moduleNumber) ?? 0) + 1);
    expect(Object.fromEntries(perModule)).toEqual({ 1: 12, 2: 12, 3: 14, 4: 14, 5: 20, 6: 3 });
  });

  it("maps module levels and unit types", () => {
    const byNo = new Map(units.map((u) => [u.unitNumber, u]));
    expect(byNo.get(1)?.cefrLevel).toBe("A1.1");
    expect(byNo.get(13)?.cefrLevel).toBe("A1.2");
    expect(byNo.get(25)?.cefrLevel).toBe("A2.1");
    expect(byNo.get(39)?.cefrLevel).toBe("A2.2");
    expect(byNo.get(53)?.cefrLevel).toBe("B1");
    expect(byNo.get(6)?.unitType).toBe("review");
    expect(byNo.get(12)?.unitType).toBe("checkpoint");
    expect(byNo.get(72)?.unitType).toBe("checkpoint");
    expect(byNo.get(73)?.unitType).toBe("exam");
    expect(byNo.get(74)?.cefrLevel).toBe("A2.2");
    expect(units.filter((u) => u.unitType === "review")).toHaveLength(7);
    expect(units.filter((u) => u.unitType === "checkpoint")).toHaveLength(5);
  });

  it("keeps the pilot units with their core topics", () => {
    const byNo = new Map(units.map((u) => [u.unitNumber, u]));
    expect(byNo.get(1)?.titleEn).toBe("Getting Started – First Encounters");
    expect(byNo.get(1)?.strand).toBe("SOC");
    expect(byNo.get(1)?.primaryGrammarEn).toContain("biti");
    expect(byNo.get(2)?.titleEn).toBe("The Morning Coffee Ritual");
    expect(byNo.get(2)?.chunksEn).toContain("sa mlekom");
    expect(byNo.get(6)?.strand).toBeUndefined();
    expect(byNo.get(6)?.chunksEn).toBeUndefined();
  });

  it("applies the Serbia default and the coast/mixed overrides", () => {
    const byNo = new Map(units.map((u) => [u.unitNumber, u]));
    expect(byNo.get(1)?.setting).toBe("serbia");
    expect(byNo.get(27)?.setting).toBe("montenegro_coast");
    expect(byNo.get(46)?.setting).toBe("montenegro_coast");
    expect(byNo.get(68)?.setting).toBe("mixed");
    for (const n of Object.keys(SETTING_OVERRIDES).map(Number)) {
      expect(byNo.get(n)).toBeDefined();
    }
  });
});

describe("parseCanDoInventory", () => {
  const canDos = parseCanDoInventory(canDoMd);

  it("finds statements for every level with valid ids", () => {
    expect(canDos.length).toBeGreaterThan(100);
    const ids = new Set(canDos.map((c) => c.canDoId));
    expect(ids.size).toBe(canDos.length);
    for (const level of ["A1.1", "A1.2", "A2.1", "A2.2", "B1"]) {
      expect(canDos.some((c) => c.cefrLevel === level)).toBe(true);
    }
  });

  it("extracts target units including recycled ones", () => {
    const gen02 = canDos.find((c) => c.canDoId === "A1.1-GEN-02");
    expect(gen02?.targetUnits).toEqual([1, 7]);
    const b1gen01 = canDos.find((c) => c.canDoId === "B1-GEN-01");
    expect(b1gen01?.targetUnits).toEqual([53, 54, 55, 56, 63]);
  });
});

describe("assignCanDosToUnits + consistency", () => {
  const canDos = parseCanDoInventory(canDoMd);
  const units = assignCanDosToUnits(parseUnitMap(unitMapMd), canDos);
  const report = checkCurriculumConsistency(units, canDos);

  it("has no duplicate units and no dangling Can-Do targets", () => {
    expect(report.duplicateUnitNumbers).toEqual([]);
    expect(report.canDosWithUnknownUnit).toEqual([]);
  });

  it("gives every standard unit at least one Can-Do statement", () => {
    expect(report.unitsWithoutCanDo).toEqual([]);
    const u1 = units.find((u) => u.unitNumber === 1);
    expect(u1?.canDoIds).toContain("A1.1-SOC-01");
    expect(u1?.canDoIds).toContain("A1.1-GEN-02");
  });
});
