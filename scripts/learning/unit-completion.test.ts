import { describe, expect, it } from "vitest";
import { evaluateUnitCompletion } from "../../shared/learning/unitCompletion";
import {
  buildModuleGates,
  isModuleOpen,
  isUnitUnlockedByModule,
  nextRecommendedUnit,
  type PlannedUnit,
} from "../../shared/learning/moduleUnlock";
import { evaluateUnitAccess, type UnitAccessFacts } from "../../shared/learning/unitAccess";

const module1: PlannedUnit[] = [
  { unitNumber: 1, moduleNumber: 1, unitType: "standard" },
  { unitNumber: 2, moduleNumber: 1, unitType: "standard" },
  { unitNumber: 11, moduleNumber: 1, unitType: "review" },
  { unitNumber: 12, moduleNumber: 1, unitType: "checkpoint" },
  { unitNumber: 13, moduleNumber: 2, unitType: "standard" },
  { unitNumber: 24, moduleNumber: 2, unitType: "checkpoint" },
];

describe("evaluateUnitCompletion", () => {
  it("requires every vocab row and every question once correct", () => {
    const res = evaluateUnitCompletion({
      requiredVocabIds: ["v1", "v2"],
      requiredQuestionIds: ["q1", "q2"],
      vocabProgress: [
        { courseVocabularyId: "v1", correctAnswerCount: 1 },
        { courseVocabularyId: "v2", correctAnswerCount: 3 },
      ],
      questionProgress: [
        { questionId: "q1", correctAttempts: 1 },
        { questionId: "q2", correctAttempts: 2 },
      ],
    });
    expect(res.complete).toBe(true);
    expect(res.missingVocabIds).toEqual([]);
    expect(res.missingQuestionIds).toEqual([]);
  });

  it("does not require mastery (3×), only one correct answer", () => {
    const res = evaluateUnitCompletion({
      requiredVocabIds: ["v1"],
      requiredQuestionIds: ["q1"],
      vocabProgress: [{ courseVocabularyId: "v1", correctAnswerCount: 1 }],
      questionProgress: [{ questionId: "q1", correctAttempts: 1 }],
    });
    expect(res.complete).toBe(true);
  });

  it("fails when a question was only answered incorrectly", () => {
    const res = evaluateUnitCompletion({
      requiredVocabIds: ["v1"],
      requiredQuestionIds: ["q1"],
      vocabProgress: [{ courseVocabularyId: "v1", correctAnswerCount: 1 }],
      questionProgress: [{ questionId: "q1", correctAttempts: 0 }],
    });
    expect(res.complete).toBe(false);
    expect(res.missingQuestionIds).toEqual(["q1"]);
  });

  it("fails on an empty unit", () => {
    const res = evaluateUnitCompletion({
      requiredVocabIds: [],
      requiredQuestionIds: [],
      vocabProgress: [],
      questionProgress: [],
    });
    expect(res.complete).toBe(false);
  });
});

describe("module unlock", () => {
  it("keeps module 1 open and module 2 closed until the checkpoint", () => {
    const gates = buildModuleGates(module1);
    expect(isModuleOpen({ moduleNumber: 1, completedUnits: [], gates })).toBe(true);
    expect(isModuleOpen({ moduleNumber: 2, completedUnits: [1, 2, 11], gates })).toBe(false);
    expect(isModuleOpen({ moduleNumber: 2, completedUnits: [1, 2, 11, 12], gates })).toBe(true);
  });

  it("unlocks every unit of an open module", () => {
    expect(isUnitUnlockedByModule({ unitNumber: 2, completedUnits: [], units: module1 })).toBe(true);
    expect(isUnitUnlockedByModule({ unitNumber: 13, completedUnits: [12], units: module1 })).toBe(true);
    expect(isUnitUnlockedByModule({ unitNumber: 13, completedUnits: [1, 2], units: module1 })).toBe(false);
  });

  it("falls back to all standard units when a module has no checkpoint", () => {
    const units: PlannedUnit[] = [
      { unitNumber: 1, moduleNumber: 1, unitType: "standard" },
      { unitNumber: 2, moduleNumber: 1, unitType: "standard" },
      { unitNumber: 3, moduleNumber: 2, unitType: "standard" },
    ];
    expect(isUnitUnlockedByModule({ unitNumber: 3, completedUnits: [1], units })).toBe(false);
    expect(isUnitUnlockedByModule({ unitNumber: 3, completedUnits: [1, 2], units })).toBe(true);
  });

  it("recommends the first unlocked incomplete unit", () => {
    expect(nextRecommendedUnit({ completedUnits: [], units: module1 })).toBe(1);
    expect(nextRecommendedUnit({ completedUnits: [1], units: module1 })).toBe(2);
    expect(nextRecommendedUnit({ completedUnits: [1, 2, 11, 12], units: module1 })).toBe(13);
  });
});

function accessFacts(overrides: Partial<UnitAccessFacts> = {}): UnitAccessFacts {
  return {
    unitNumber: 13,
    role: "user",
    hasFeatureTierOverride: false,
    totalUnits: 27,
    isOffline: false,
    hasActiveSubscription: true,
    subscriptionPlanType: "beta",
    maxAccessibleUnits: null,
    isBetaTester: true,
    betaMaxUnits: 27,
    completedUnits: [],
    plannedUnits: module1,
    ...overrides,
  };
}

describe("evaluateUnitAccess", () => {
  it("locks a beta tester out of the next module", () => {
    expect(evaluateUnitAccess(accessFacts())).toEqual({
      allowed: false,
      reason: "curriculum",
    });
  });

  it("lets a beta tester open a unit in an open module", () => {
    expect(evaluateUnitAccess(accessFacts({ unitNumber: 2 }))).toEqual({
      allowed: true,
      reason: null,
    });
  });

  it("keeps a paid subscription behind the same curriculum gate", () => {
    expect(
      evaluateUnitAccess(
        accessFacts({
          subscriptionPlanType: "course",
          isBetaTester: false,
          betaMaxUnits: 0,
        }),
      ),
    ).toEqual({ allowed: false, reason: "curriculum" });
  });

  it("reports the beta cap as a plan lock before the curriculum lock", () => {
    expect(evaluateUnitAccess(accessFacts({ betaMaxUnits: 12 }))).toEqual({
      allowed: false,
      reason: "plan",
    });
  });

  it("allows admins and feature-tier overrides", () => {
    expect(evaluateUnitAccess(accessFacts({ role: "admin" })).allowed).toBe(true);
    expect(evaluateUnitAccess(accessFacts({ role: "superadmin" })).allowed).toBe(true);
    expect(evaluateUnitAccess(accessFacts({ hasFeatureTierOverride: true })).allowed).toBe(true);
  });

  it("denies an override past the published unit count", () => {
    expect(
      evaluateUnitAccess(
        accessFacts({ hasFeatureTierOverride: true, unitNumber: 40, totalUnits: 27 }),
      ),
    ).toEqual({ allowed: false, reason: "plan" });
  });

  it("keeps an already completed unit open even when its module is locked", () => {
    expect(evaluateUnitAccess(accessFacts({ completedUnits: [13] }))).toEqual({
      allowed: true,
      reason: null,
    });
  });

  it("hides offline units from learners", () => {
    expect(evaluateUnitAccess(accessFacts({ unitNumber: 2, isOffline: true }))).toEqual({
      allowed: false,
      reason: "unavailable",
    });
    expect(evaluateUnitAccess(accessFacts({ unitNumber: 2, isOffline: true, role: "admin" })).allowed).toBe(
      true,
    );
  });
});
