/**
 * Module-level unlock. Module 1 is always open. Module N+1 opens when the
 * checkpoint of module N is completed; if there is no checkpoint, every
 * standard unit of module N must be completed. Review units do not gate.
 * Exam units are recorded but do not gate a later module in this iteration
 * (hook: pass examUnits of the previous module if that is ever required).
 */

export type CurriculumUnitType = "standard" | "review" | "checkpoint" | "exam";

export type PlannedUnit = {
  unitNumber: number;
  moduleNumber: number;
  unitType: CurriculumUnitType;
};

export type ModuleGate = {
  moduleNumber: number;
  unitNumbers: number[];
  standardUnitNumbers: number[];
  checkpointUnitNumber: number | null;
  examUnitNumbers: number[];
};

export function buildModuleGates(units: PlannedUnit[]): ModuleGate[] {
  const byModule = new Map<number, PlannedUnit[]>();
  for (const u of units) {
    const list = byModule.get(u.moduleNumber) ?? [];
    list.push(u);
    byModule.set(u.moduleNumber, list);
  }

  return [...byModule.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([moduleNumber, list]) => {
      const sorted = [...list].sort((a, b) => a.unitNumber - b.unitNumber);
      const checkpoints = sorted.filter((u) => u.unitType === "checkpoint");
      return {
        moduleNumber,
        unitNumbers: sorted.map((u) => u.unitNumber),
        standardUnitNumbers: sorted.filter((u) => u.unitType === "standard").map((u) => u.unitNumber),
        checkpointUnitNumber: checkpoints.length > 0 ? checkpoints[checkpoints.length - 1]!.unitNumber : null,
        examUnitNumbers: sorted.filter((u) => u.unitType === "exam").map((u) => u.unitNumber),
      };
    });
}

export function isModuleOpen(args: {
  moduleNumber: number;
  completedUnits: ReadonlyArray<number>;
  gates: ModuleGate[];
}): boolean {
  if (args.moduleNumber <= 1) return true;
  const completed = new Set(args.completedUnits);
  for (const gate of args.gates) {
    if (gate.moduleNumber >= args.moduleNumber) break;
    if (gate.checkpointUnitNumber != null) {
      if (!completed.has(gate.checkpointUnitNumber)) return false;
      continue;
    }
    const required = gate.standardUnitNumbers.length > 0 ? gate.standardUnitNumbers : gate.unitNumbers;
    if (required.length === 0) continue;
    if (!required.every((n) => completed.has(n))) return false;
  }
  return true;
}

export function isUnitUnlockedByModule(args: {
  unitNumber: number;
  completedUnits: ReadonlyArray<number>;
  units: PlannedUnit[];
}): boolean {
  const planned = args.units.find((u) => u.unitNumber === args.unitNumber);
  if (!planned) {
    // Unknown unit: keep sequential fallback so unpublished extras do not open.
    return args.unitNumber === 1 || args.completedUnits.includes(args.unitNumber - 1);
  }
  const gates = buildModuleGates(args.units);
  return isModuleOpen({
    moduleNumber: planned.moduleNumber,
    completedUnits: args.completedUnits,
    gates,
  });
}

export function nextRecommendedUnit(args: {
  completedUnits: ReadonlyArray<number>;
  units: PlannedUnit[];
}): number | null {
  const completed = new Set(args.completedUnits);
  const sorted = [...args.units].sort((a, b) => a.unitNumber - b.unitNumber);
  for (const u of sorted) {
    if (completed.has(u.unitNumber)) continue;
    if (isUnitUnlockedByModule({ unitNumber: u.unitNumber, completedUnits: args.completedUnits, units: args.units })) {
      return u.unitNumber;
    }
  }
  return null;
}
