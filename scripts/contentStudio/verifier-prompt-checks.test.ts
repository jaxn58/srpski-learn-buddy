import { describe, it, expect } from "vitest";
import {
  runDeterministicTestPromptChecks,
  type VerifierInputItem,
} from "../../convex/contentStudio/_verifier";

function testItem(overrides: Partial<VerifierInputItem> & { enQ: string; deQ: string }): VerifierInputItem {
  const { enQ, deQ, ...rest } = overrides;
  return {
    key: rest.key ?? "test:sample",
    kind: "test",
    label: rest.label ?? "test sample",
    questionType: rest.questionType,
    serbian: rest.serbian ?? "Expected Serbian answer: Zovem se Ana.",
    english: `Question (EN): ${enQ}`,
    german: `Question (DE): ${deQ}`,
  };
}

describe("runDeterministicTestPromptChecks", () => {
  it("does not flag dialogue completion stems that stay Serbian (EN=DE)", () => {
    const items: VerifierInputItem[] = [
      testItem({
        key: "test:u2_ex5_q01",
        label: "test u2_ex5_q01",
        questionType: "multipleChoice",
        enQ: "A: Odakle ste Vi? B: _____",
        deQ: "A: Odakle ste Vi? B: _____",
      }),
      testItem({
        key: "test:u2_ex5_q04",
        label: "test u2_ex5_q04",
        questionType: "multipleChoice",
        enQ: "A: Kako se zovete? B: _____",
        deQ: "A: Kako se zovete? B: _____",
      }),
    ];
    const issues = runDeterministicTestPromptChecks(items);
    expect(issues).toHaveLength(0);
  });

  it("flags untranslated translation prompts", () => {
    const items = [
      testItem({
        questionType: "translation",
        enQ: "Monday",
        deQ: "Monday",
      }),
    ];
    const issues = runDeterministicTestPromptChecks(items);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.code).toBe("test_untranslated_learner_prompt");
  });

  it("does not flag orange cognate", () => {
    const items = [
      testItem({
        questionType: "matching",
        enQ: "_____ = orange",
        deQ: "_____ = orange",
      }),
    ];
    expect(runDeterministicTestPromptChecks(items)).toHaveLength(0);
  });

  it("flags untranslated matching prompts", () => {
    const items = [
      testItem({
        questionType: "matching",
        enQ: "_____ = half",
        deQ: "_____ = half",
      }),
    ];
    const issues = runDeterministicTestPromptChecks(items);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.code).toBe("test_untranslated_learner_prompt");
  });

  it("skips dialogue stems without questionType via defensive pattern", () => {
    const items = [
      testItem({
        enQ: "A: Mi smo turisti. B: _____",
        deQ: "A: Mi smo turisti. B: _____",
      }),
    ];
    const issues = runDeterministicTestPromptChecks(items);
    expect(issues).toHaveLength(0);
  });
});
