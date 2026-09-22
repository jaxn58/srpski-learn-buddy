import { describe, it, expect } from "vitest";
import {
  findAppendedForeignParentheticalIssues,
  findUntranslatedLearnerPromptIssues,
  composeTranslatorSystemPrompt,
  stripLeadingGermanArticle,
  type TranslatorAdminContext,
} from "../../convex/contentStudio/_translationCore";
import { collectDraftSkillIds, mergeSkillsById } from "../../convex/contentStudio/_shared";
import {
  ALL_TRANSLATOR_PROMPT_KEYS,
  CS_PROMPT_KEYS,
} from "../../convex/contentStudio/prompts";
import {
  CODE_DEFAULT_PROMPT_COGNATES,
  mergePromptCognates,
  parseUntranslatedPromptGuardFailures,
} from "../../convex/contentStudio/_translatorCognates";

describe("findAppendedForeignParentheticalIssues", () => {
  it("flags DE dialogue with appended English reference paren", () => {
    const issues = findAppendedForeignParentheticalIssues([
      {
        questionId: "u3_ex5_q01",
        questionType: "multipleChoice",
        category: "dialogueCompletion",
        questionEn: "A: Excuse me… B: _____",
        questionDe: "A: Excuse me… B: _____ (A: Excuse me… B: _____)",
      },
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain("appended English parenthetical");
    expect(issues[0]).toContain("u3_ex5_q01");
  });

  it("passes when EN and DE have the same parenthesis count", () => {
    const issues = findAppendedForeignParentheticalIssues([
      {
        questionId: "u3_ex5_q02",
        questionType: "multipleChoice",
        category: "dialogueCompletion",
        questionEn: "A: Odakle ste Vi? B: _____",
        questionDe: "A: Odakle ste Vi? B: _____",
      },
    ]);
    expect(issues).toHaveLength(0);
  });

  it("does not flag translation prompts", () => {
    const issues = findAppendedForeignParentheticalIssues([
      {
        questionId: "u2_ex1_q01",
        questionType: "translation",
        category: "translation",
        questionEn: "Monday",
        questionDe: "Montag",
      },
    ]);
    expect(issues).toHaveLength(0);
  });
});

describe("findUntranslatedLearnerPromptIssues cognates", () => {
  it("allows orange as EN/DE cognate", () => {
    const cognates = mergePromptCognates(CODE_DEFAULT_PROMPT_COGNATES, []);
    const issues = findUntranslatedLearnerPromptIssues(
      [
        {
          questionId: "u5_ex4_q01",
          questionType: "matching",
          questionEn: "_____ = orange",
          questionDe: "_____ = orange",
        },
      ],
      cognates
    );
    expect(issues).toHaveLength(0);
  });

  it("still flags Monday/Monday", () => {
    const cognates = mergePromptCognates(CODE_DEFAULT_PROMPT_COGNATES, []);
    const issues = findUntranslatedLearnerPromptIssues(
      [
        {
          questionId: "u1_q01",
          questionType: "translation",
          questionEn: "Monday",
          questionDe: "Monday",
        },
      ],
      cognates
    );
    expect(issues).toHaveLength(1);
  });

  it("accepts admin-added cognates", () => {
    const cognates = mergePromptCognates(CODE_DEFAULT_PROMPT_COGNATES, ["sandwich"]);
    const issues = findUntranslatedLearnerPromptIssues(
      [
        {
          questionId: "u5_q99",
          questionType: "matching",
          questionEn: "sandwich",
          questionDe: "sandwich",
        },
      ],
      cognates
    );
    expect(issues).toHaveLength(0);
  });
});

describe("parseUntranslatedPromptGuardFailures", () => {
  it("extracts flagged prompt words from guard errors", () => {
    const msg =
      'Test translation quality guard failed (category=vocabularyMatching): questionId=u5_ex4_q01 (matching): learner prompt is still English "orange". Translate it';
    expect(parseUntranslatedPromptGuardFailures(msg)).toEqual(["orange"]);
  });

  it("extracts words from verifier issue wording", () => {
    const msg = 'German question prompt is still English ("_____ = orange").';
    expect(parseUntranslatedPromptGuardFailures(msg)).toEqual(["orange"]);
  });
});

describe("composeTranslatorSystemPrompt", () => {
  it("orders base → skills → memory → retry", () => {
    const admin: TranslatorAdminContext = {
      skillBlock: "TRANSLATOR SKILLS:\n--- SKILL: Dialogue ---\nKeep Serbian.",
      memoryBlock: "TRANSLATOR MEMORY:\n- [rule] Do not append EN",
    };
    const out = composeTranslatorSystemPrompt("BASE PROMPT HERE", admin, "retry: fix q01");
    const iBase = out.indexOf("BASE PROMPT HERE");
    const iSkill = out.indexOf("TRANSLATOR SKILLS");
    const iMem = out.indexOf("TRANSLATOR MEMORY");
    const iRetry = out.indexOf("retry: fix q01");
    expect(iBase).toBeGreaterThanOrEqual(0);
    expect(iSkill).toBeGreaterThan(iBase);
    expect(iMem).toBeGreaterThan(iSkill);
    expect(iRetry).toBeGreaterThan(iMem);
    expect(out).toContain("MUST use that German wording verbatim");
  });

  it("works with empty admin blocks", () => {
    const out = composeTranslatorSystemPrompt("BASE ONLY", {
      skillBlock: "",
      memoryBlock: "",
    });
    expect(out).toBe("BASE ONLY");
  });
});

describe("ALL_TRANSLATOR_PROMPT_KEYS", () => {
  it("registers the five DB-only translator bases", () => {
    expect(ALL_TRANSLATOR_PROMPT_KEYS).toEqual([
      CS_PROMPT_KEYS.translatorMetadata,
      CS_PROMPT_KEYS.translatorSection,
      CS_PROMPT_KEYS.translatorVocab,
      CS_PROMPT_KEYS.translatorTests,
      CS_PROMPT_KEYS.translatorVerifier,
    ]);
  });
});

describe("stripLeadingGermanArticle", () => {
  it("removes a leading definite article from a noun gloss", () => {
    expect(stripLeadingGermanArticle("der Reisepass")).toBe("Reisepass");
    expect(stripLeadingGermanArticle("die Frau")).toBe("Frau");
    expect(stripLeadingGermanArticle("das Kind")).toBe("Kind");
    expect(stripLeadingGermanArticle("Den Pass")).toBe("Pass");
  });

  it("leaves lemmas and phrases without a leading article unchanged", () => {
    expect(stripLeadingGermanArticle("Reisepass")).toBe("Reisepass");
    expect(stripLeadingGermanArticle("zu Fuß gehen")).toBe("zu Fuß gehen");
    expect(stripLeadingGermanArticle("am Flughafen")).toBe("am Flughafen");
    expect(stripLeadingGermanArticle("ein bisschen")).toBe("ein bisschen");
  });

  it("does not empty a field that is only an article", () => {
    expect(stripLeadingGermanArticle("der")).toBe("der");
  });
});

describe("draft skill selection", () => {
  it("unions Creator and Lector checkboxes and drops duplicates", () => {
    expect(
      collectDraftSkillIds({
        specialistSkillIds: ["skillA", "skillB"],
        auditorSkillIds: ["skillB", "skillC"],
      })
    ).toEqual(["skillA", "skillB", "skillC"]);
  });

  it("returns no skills when nothing is checked on the draft", () => {
    expect(collectDraftSkillIds({ specialistSkillIds: [], auditorSkillIds: [] })).toEqual([]);
    expect(collectDraftSkillIds({})).toEqual([]);
  });

  it("drops empty prompts when merging skill docs", () => {
    expect(
      mergeSkillsById([
        { _id: "a", name: "Montenegro", prompt: "Add gdje to Notes." },
        { _id: "a", name: "dup", prompt: "ignored" },
        { _id: "b", name: "empty", prompt: "  " },
      ])
    ).toEqual([{ _id: "a", name: "Montenegro", prompt: "Add gdje to Notes." }]);
  });
});
