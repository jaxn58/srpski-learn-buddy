import { isUnitUnlockedByModule, type PlannedUnit } from "./moduleUnlock";

/**
 * Single access decision for one unit. Callers (unit overview, direct unit
 * view, content queries and progress writes) must all use this so the lock
 * shown in the overview never disagrees with the server.
 *
 * Order:
 * 1. admin / superadmin: allowed
 * 2. featureTierOverride: allowed up to the published unit count
 * 3. offline unit: unavailable
 * 4. subscription / beta cap: otherwise plan
 * 5. module curriculum (completed units stay open): otherwise curriculum
 */

export type UnitLockReason = "curriculum" | "plan" | "unavailable";

export type UnitAccessDecision = {
  allowed: boolean;
  reason: UnitLockReason | null;
};

export type UnitAccessFacts = {
  unitNumber: number;
  role: string | null;
  hasFeatureTierOverride: boolean;
  totalUnits: number;
  isOffline: boolean;
  hasActiveSubscription: boolean;
  subscriptionPlanType: string | null;
  /** Null when the subscription does not grant an early cap. */
  maxAccessibleUnits: number | null;
  isBetaTester: boolean;
  betaMaxUnits: number;
  completedUnits: readonly number[];
  plannedUnits: readonly PlannedUnit[];
};

function passesPlanGate(facts: UnitAccessFacts): boolean {
  if (facts.subscriptionPlanType === "beta") {
    return facts.unitNumber <= facts.betaMaxUnits;
  }

  if (
    facts.maxAccessibleUnits != null &&
    facts.maxAccessibleUnits > 0 &&
    facts.unitNumber <= facts.maxAccessibleUnits
  ) {
    return true;
  }

  if (facts.hasActiveSubscription && facts.unitNumber <= facts.totalUnits) {
    return true;
  }

  if (facts.isBetaTester) {
    return facts.unitNumber <= facts.betaMaxUnits;
  }

  return true;
}

function passesCurriculumGate(facts: UnitAccessFacts): boolean {
  if (facts.completedUnits.includes(facts.unitNumber)) return true;
  if (facts.plannedUnits.length > 0) {
    return isUnitUnlockedByModule({
      unitNumber: facts.unitNumber,
      completedUnits: facts.completedUnits,
      units: [...facts.plannedUnits],
    });
  }
  return facts.unitNumber === 1 || facts.completedUnits.includes(facts.unitNumber - 1);
}

export function evaluateUnitAccess(facts: UnitAccessFacts): UnitAccessDecision {
  if (facts.role === "admin" || facts.role === "superadmin") {
    return { allowed: true, reason: null };
  }

  if (facts.hasFeatureTierOverride) {
    return facts.unitNumber <= facts.totalUnits
      ? { allowed: true, reason: null }
      : { allowed: false, reason: "plan" };
  }

  if (facts.isOffline) {
    return { allowed: false, reason: "unavailable" };
  }

  if (!passesPlanGate(facts)) {
    return { allowed: false, reason: "plan" };
  }

  if (!passesCurriculumGate(facts)) {
    return { allowed: false, reason: "curriculum" };
  }

  return { allowed: true, reason: null };
}
